"""
FastAPI app: the WhatsApp webhook, plus a minimal admin surface for the
"simulate a breakdown" demo moment. Run with:

    uvicorn app.main:app --reload --port 8000

then point ngrok + the Twilio Sandbox at /webhook/whatsapp (see README).
"""
import json
import logging
from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI, Form, Response
from fastapi.responses import JSONResponse
from sqlmodel import select
from twilio.twiml.messaging_response import MessagingResponse

from app.config import CAPACITY_PER_HOUR, MANDI_ID, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
from app.db import get_session, init_db
from app.incidents import apply_incident
from app.intent import (
    FarmerIntent,
    format_confirmation_prompt,
    parse_farmer_intent,
    transcribe_voice_note,
)
from app.models import Booking, ConversationState
from app.scheduler import book_slot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mandi_bot")

@asynccontextmanager
async def _lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Mandi WhatsApp Booking Bot", lifespan=_lifespan)


def _get_state(session, phone: str) -> ConversationState:
    state = session.get(ConversationState, phone)
    if state is None:
        state = ConversationState(phone=phone)
        session.add(state)
        session.commit()
        session.refresh(state)
    return state


def _reply(text: str) -> Response:
    twiml = MessagingResponse()
    twiml.message(text)
    return Response(content=str(twiml), media_type="application/xml")


def _confirm_and_book(session, phone: str, intent: FarmerIntent) -> str:
    booking, slot = book_slot(
        session=session,
        mandi_id=MANDI_ID,
        farmer_phone=phone,
        crop=intent.crop,
        quantity_quintals=intent.quantity_quintals,
        vehicle=intent.vehicle,
        requested_date=intent.requested_date,
    )
    when = f"{slot.slot_date.strftime('%A, %d %b')}, {slot.slot_hour:02d}:00–{slot.slot_hour + 1:02d}:00"
    lines = [f"Booked! Token {booking.token}", f"Window: {when}"]
    if slot.bumped_days > 0:
        lines.append(
            f"({intent.requested_date.strftime('%A')} was already full — "
            f"moved you to the next open slot instead of a long queue.)"
        )
    lines.append("We'll text you here if anything changes before you arrive.")
    return "\n".join(lines)


@app.post("/webhook/whatsapp")
async def whatsapp_receiver(
    Body: str = Form(None),
    From: str = Form(None),
    MediaUrl0: str = Form(None),
    MediaContentType0: str = Form(None),
):
    session = get_session()
    try:
        phone = From or "whatsapp:+unknown"
        state = _get_state(session, phone)

        # --- Confirmation branch: we already asked "did we get this right?"
        if state.state == "awaiting_confirmation" and state.pending_intent_json:
            reply_body = (Body or "").strip().lower()
            if reply_body in ("1", "yes", "confirm", "correct"):
                intent_dict = json.loads(state.pending_intent_json)
                intent = FarmerIntent(
                    crop=intent_dict["crop"],
                    quantity_quintals=intent_dict["quantity_quintals"],
                    vehicle=intent_dict.get("vehicle"),
                    requested_date=date.fromisoformat(intent_dict["requested_date"]),
                    raw_text=intent_dict.get("raw_text", ""),
                )
                reply_text = _confirm_and_book(session, phone, intent)
                state.state = "idle"
                state.pending_intent_json = None
                session.add(state)
                session.commit()
                return _reply(reply_text)
            # Anything else is treated as a correction — fall through and
            # re-parse this message as a fresh booking request instead of
            # silently booking something the farmer didn't actually say.

        # --- Fresh message: transcribe (if voice) then extract intent.
        incoming_text = Body or ""
        if MediaUrl0 and "audio" in (MediaContentType0 or ""):
            try:
                incoming_text = transcribe_voice_note(
                    MediaUrl0, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
                )
            except Exception:
                logger.exception("Voice transcription failed for %s", phone)
                return _reply(
                    "Sorry, that voice note didn't come through clearly. "
                    "Please try again, or type: crop, quantity, day."
                )

        if not incoming_text.strip():
            return _reply(
                "Send a voice note or text like: '40 quintals wheat, "
                "Thursday' and we'll find you a slot."
            )

        intent = parse_farmer_intent(incoming_text)
        state.state = "awaiting_confirmation"
        state.pending_intent_json = json.dumps(
            {
                "crop": intent.crop,
                "quantity_quintals": intent.quantity_quintals,
                "vehicle": intent.vehicle,
                "requested_date": intent.requested_date.isoformat(),
                "raw_text": intent.raw_text,
            }
        )
        session.add(state)
        session.commit()
        return _reply(format_confirmation_prompt(intent))
    finally:
        session.close()


@app.post("/admin/incident")
async def trigger_incident(reason: str = Form(...), delay_minutes: int = Form(...), from_hour: int = Form(...)):
    """
    The "Bay 1 Breakdown (+45min)" button from the demo script. Pushes the
    remaining slots today and proactively alerts every affected farmer.
    """
    session = get_session()
    try:
        result = apply_incident(
            session,
            mandi_id=MANDI_ID,
            reason=reason,
            delay_minutes=delay_minutes,
            affects_from_hour=from_hour,
        )
        return JSONResponse(result)
    finally:
        session.close()


@app.get("/admin/bookings")
async def list_bookings(for_date: str | None = None):
    """Lightweight stand-in for the admin dashboard's arrivals list."""
    session = get_session()
    try:
        query = select(Booking).where(Booking.status == "confirmed")
        if for_date:
            query = query.where(Booking.slot_date == date.fromisoformat(for_date))
        bookings = session.exec(query.order_by(Booking.slot_date, Booking.slot_hour)).all()
        return [
            {
                "token": b.token,
                "phone": b.farmer_phone,
                "crop": b.crop,
                "quantity_quintals": b.quantity_quintals,
                "date": b.slot_date.isoformat(),
                "hour": b.slot_hour,
                "delay_minutes": b.delay_minutes,
            }
            for b in bookings
        ]
    finally:
        session.close()


@app.get("/admin/capacity")
async def capacity_config():
    return {"mandi_id": MANDI_ID, "capacity_per_hour": CAPACITY_PER_HOUR}
