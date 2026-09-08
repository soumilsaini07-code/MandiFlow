"""
FastAPI app: the WhatsApp webhook, plus a minimal admin surface for the
"simulate a breakdown" demo moment. Run with:

    uvicorn app.main:app --reload --port 8000

then point ngrok + the Meta Cloud API webhook config at /webhook/whatsapp
(see README).
"""
import json
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime

from fastapi import FastAPI, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from sqlmodel import select

from app.config import (
    CAPACITY_PER_HOUR,
    MANDI_ID,
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_VERIFY_TOKEN,
)
from app.dashboard import DASHBOARD_HTML
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
from app.whatsapp_client import send_reply

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


@app.get("/webhook/whatsapp")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """
    Meta's one-time webhook verification handshake. When you paste your
    callback URL + verify token into the Meta App Dashboard, Meta sends this
    GET request; if the token matches, you must echo back hub.challenge
    exactly (as plain text) or the webhook is rejected.
    """
    if hub_mode == "subscribe" and hub_verify_token == WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(hub_challenge or "")
    return PlainTextResponse("verification failed", status_code=403)


@app.post("/webhook/whatsapp")
async def whatsapp_receiver(request: Request):
    """
    Meta's Cloud API webhook. Unlike Twilio's form-encoded, single-message
    POST, this is a JSON payload that can (rarely) carry a batch of events,
    and there's no inline-reply mechanism — every reply is its own active
    outbound call via app.whatsapp_client.send_reply.
    """
    payload = await request.json()
    session = get_session()
    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for message in value.get("messages", []):
                    _handle_message(session, message)
        return JSONResponse({"status": "ok"})
    finally:
        session.close()


def _handle_message(session, message: dict) -> None:
    phone = message.get("from")
    if not phone:
        return
    state = _get_state(session, phone)

    # Track this as the farmer's most recent inbound message, for the
    # 24-hour proactive-alert session window.
    state.updated_at = datetime.utcnow()

    msg_type = message.get("type")
    body_text = ""
    if msg_type == "text":
        body_text = message.get("text", {}).get("body", "")
    elif msg_type == "audio":
        media_id = message.get("audio", {}).get("id")
        try:
            body_text = transcribe_voice_note(media_id, WHATSAPP_ACCESS_TOKEN)
        except Exception:
            logger.exception("Voice transcription failed for %s", phone)
            session.add(state)
            session.commit()
            send_reply(
                phone,
                "Sorry, that voice note didn't come through clearly. "
                "Please try again, or type: crop, quantity, day.",
            )
            return

    # --- Confirmation branch: we already asked "did we get this right?"
    if state.state == "awaiting_confirmation" and state.pending_intent_json:
        reply_body = body_text.strip().lower()
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
            send_reply(phone, reply_text)
            return
        # Anything else is treated as a correction — fall through and
        # re-parse this message as a fresh booking request instead of
        # silently booking something the farmer didn't actually say.

    if not body_text.strip():
        session.add(state)
        session.commit()
        send_reply(
            phone,
            "Send a voice note or text like: '40 quintals wheat, "
            "Thursday' and we'll find you a slot.",
        )
        return

    intent = parse_farmer_intent(body_text)
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
    send_reply(phone, format_confirmation_prompt(intent))


@app.post("/admin/incident")
async def trigger_incident(request: Request):
    """
    The "Bay 1 Breakdown (+45min)" button from the demo script. Pushes the
    remaining slots today and proactively alerts every affected farmer.
    Accepts either form data or JSON.
    """
    if request.headers.get("content-type", "").startswith("application/json"):
        body = await request.json()
    else:
        form = await request.form()
        body = dict(form)

    session = get_session()
    try:
        result = apply_incident(
            session,
            mandi_id=MANDI_ID,
            reason=body["reason"],
            delay_minutes=int(body["delay_minutes"]),
            affects_from_hour=int(body["from_hour"]),
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


@app.get("/admin", response_class=HTMLResponse)
@app.get("/dashboard", response_class=HTMLResponse)
async def admin_dashboard():
    """
    The demo-day dashboard: reads the /admin/* JSON endpoints above and can
    fire the incident button, all from one page with no build step. See
    app/dashboard.py.
    """
    return HTMLResponse(DASHBOARD_HTML)
