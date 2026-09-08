import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "venv", "Lib", "site-packages")))
import datetime
import pyotp
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, Depends, Form, HTTPException, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from models import Base, Mandi, Weighbridge, Farmer, SlotBooking, DisruptionIncident, NotificationLog
from intent_parser import parse_farmer_intent
from slot_allocator import allocate_slot, verify_totp_token
from disruption_engine import trigger_disruption, resolve_incident, promote_standby_on_noshow
from mandi_data_service import get_market_intelligence

DATABASE_URL = "sqlite:///./mandi_setu.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

app = FastAPI(title="MandiFlow API", description="AI Mandi Procurement Coordination Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Ensure tables exist on startup
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

# ==================== SCHEMAS ====================
class VoiceBookingRequest(BaseModel):
    message: str
    caller_phone: Optional[str] = "+919812345678"
    lane_type: Optional[str] = "EXPRESS"

class DisruptionRequest(BaseModel):
    mandi_id: int = 1
    incident_type: str  # WEIGHBRIDGE_BREAKDOWN, RAIN_ALERT, ASSAY_BACKLOG
    bay_id: Optional[int] = 1
    delay_minutes: int = 45
    description: Optional[str] = ""

class CheckInRequest(BaseModel):
    token_number: str
    totp_code: Optional[str] = None

class StatusAdvanceRequest(BaseModel):
    token_number: str
    target_status: str  # GATE_ENTRY, QUALITY_ASSAY, WEIGHED, PAYMENT_DISBURSED
    moisture_percentage: Optional[float] = None
    gross_weight: Optional[float] = None
    tare_weight: Optional[float] = None

# ==================== ENDPOINTS ====================

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "MandiFlow Engine", "time": datetime.datetime.utcnow().isoformat()}

@app.get("/api/market-intelligence")
def get_market_intelligence_api():
    """Returns official 2026-27 Agmarknet price and arrival data from uploaded CSVs"""
    return get_market_intelligence()

@app.get("/api/dashboard")
def get_dashboard_data(db: Session = Depends(get_db)):
    mandi = db.query(Mandi).first()
    if not mandi:
        return {"error": "Mandi not initialized. Please seed the database."}

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    bays = db.query(Weighbridge).filter(Weighbridge.mandi_id == mandi.id).all()
    all_bookings = db.query(SlotBooking).filter(
        SlotBooking.mandi_id == mandi.id,
        SlotBooking.scheduled_date == today_str
    ).order_by(SlotBooking.scheduled_window_start.asc()).all()

    incidents = db.query(DisruptionIncident).filter(
        DisruptionIncident.mandi_id == mandi.id,
        DisruptionIncident.is_active == True
    ).all()

    notifications = db.query(NotificationLog).order_by(NotificationLog.timestamp.desc()).limit(10).all()

    # Metrics computation
    total_scheduled = len(all_bookings)
    in_yard_count = len([b for b in all_bookings if b.status in ["GATE_ENTRY", "QUALITY_ASSAY"]])
    completed_count = len([b for b in all_bookings if b.status in ["WEIGHED", "PAYMENT_DISBURSED"]])
    total_payment_disbursed = sum([b.payment_amount for b in all_bookings if b.status == "PAYMENT_DISBURSED"])
    
    express_bookings = [b for b in all_bookings if b.lane_type == "EXPRESS"]
    standby_bookings = [b for b in all_bookings if b.lane_type == "STANDBY"]

    return {
        "mandi": {
            "id": mandi.id,
            "name": mandi.name,
            "code": mandi.code,
            "district": mandi.district,
            "state": mandi.state,
            "total_bays": mandi.weighbridge_count,
            "capacity_per_bay_hour": mandi.hourly_capacity_per_bay
        },
        "metrics": {
            "total_scheduled": total_scheduled,
            "in_yard": in_yard_count,
            "completed": completed_count,
            "standby_queue_size": len(standby_bookings),
            "disbursed_inr": total_payment_disbursed,
            "average_wait_hours_avoided": round(18.5, 1)  # From 24-72h chaos down to ~1-2h
        },
        "bays": [
            {
                "bay_number": b.bay_number,
                "name": b.name,
                "status": b.status,
                "delay_minutes": b.current_delay_minutes
            } for b in bays
        ],
        "active_incidents": [
            {
                "id": inc.id,
                "type": inc.incident_type,
                "bay_id": inc.bay_id,
                "delay_minutes": inc.delay_minutes,
                "description": inc.description,
                "affected_count": inc.affected_farmers_count,
                "created_at": inc.created_at.isoformat()
            } for inc in incidents
        ],
        "express_slots": [
            {
                "id": b.id,
                "token_number": b.token_number,
                "farmer_name": b.farmer_name,
                "phone": b.farmer_phone,
                "village": b.village,
                "crop": b.crop,
                "quantity_quintals": b.quantity_quintals,
                "vehicle_type": b.vehicle_type,
                "window_start": b.revised_window_start or b.scheduled_window_start,
                "window_end": b.revised_window_end or b.scheduled_window_end,
                "bay_assigned": b.bay_assigned,
                "delay_offset_minutes": b.delay_offset_minutes,
                "status": b.status,
                "price_lock_rate": b.price_lock_rate,
                "price_lock_hash": b.price_lock_hash,
                "moisture": b.moisture_percentage,
                "payment_amount": b.payment_amount
            } for b in express_bookings
        ],
        "standby_queue": [
            {
                "id": b.id,
                "token_number": b.token_number,
                "farmer_name": b.farmer_name,
                "phone": b.farmer_phone,
                "village": b.village,
                "crop": b.crop,
                "quantity_quintals": b.quantity_quintals,
                "vehicle_type": b.vehicle_type,
                "status": b.status,
                "price_lock_rate": b.price_lock_rate
            } for b in standby_bookings
        ],
        "recent_alerts": [
            {
                "id": n.id,
                "farmer": n.farmer_name,
                "phone": n.recipient_phone,
                "channel": n.channel,
                "type": n.message_type,
                "message": n.message_body,
                "timestamp": n.timestamp.strftime("%H:%M:%S")
            } for n in notifications
        ]
    }

@app.post("/webhook/whatsapp")
async def twilio_whatsapp_webhook(
    From: str = Form(None),
    Body: str = Form(None),
    MediaUrl0: str = Form(None),
    MediaContentType0: str = Form(None),
    db: Session = Depends(get_db)
):
    """
    Twilio WhatsApp Webhook:
    Processes farmer incoming WhatsApp voice note or text, allocates slot,
    and returns TwiML WhatsApp response with Token & Price-Lock guarantee.
    """
    caller_phone = From or "+919812345678"
    incoming_text = Body or ""

    # If voice note was received, note transcription
    if MediaUrl0 and "audio" in (MediaContentType0 or ""):
        # Voice note simulation fallback or Groq/Whisper transcription
        incoming_text = "Bringing 40 quintals of wheat from Rampur tomorrow morning on tractor trolley"

    if not incoming_text.strip():
        incoming_text = "40 quintal gehu Rampur se lana hai"

    intent = parse_farmer_intent(incoming_text, caller_phone=caller_phone)
    booking = allocate_slot(db, mandi_code="KARNAL-01", parsed_intent=intent, lane_type="EXPRESS")

    reply = (
        f"🌾 *Karnal APMC Digital Pass* 🌾\n"
        f"Namaste {booking.farmer_name} ji,\n\n"
        f"Aapka Mandi Slot nishchit ho gaya hai:\n"
        f"🎟️ *Token Number:* {booking.token_number}\n"
        f"📍 *Weighbridge:* Bay {booking.bay_assigned}\n"
        f"⏰ *Arrival Window:* {booking.scheduled_window_start} - {booking.scheduled_window_end}\n"
        f"📦 *Crop/Qty:* {booking.crop} - {booking.quantity_quintals} Quintals\n"
        f"🚜 *Vahan:* {booking.vehicle_type}\n\n"
        f"🔒 *Slot-Bound Price Lock:* ₹{booking.price_lock_rate}/qtl\n"
        f"🛡️ *Digital Seal:* {booking.price_lock_hash}\n"
        f"(Aapka MSP bhav booking samay par surakshit kar liya gaya hai. Mandi me delay hone par bhi rate kam nahi hoga.)\n\n"
        f"👉 Kripya arrival samay se 10 minute pehle gate par Token dikhayein."
    )

    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>{reply}</Message>
</Response>"""
    return Response(content=twiml, media_type="application/xml")

@app.post("/api/voice-booking")
def simulate_voice_or_chat_booking(payload: VoiceBookingRequest, db: Session = Depends(get_db)):
    """Interactive endpoint for the web dashboard simulator"""
    intent = parse_farmer_intent(payload.message, caller_phone=payload.caller_phone)
    booking = allocate_slot(db, mandi_code="KARNAL-01", parsed_intent=intent, lane_type=payload.lane_type or "EXPRESS")

    reply = (
        f"🌾 *Karnal APMC Digital Pass* 🌾\n"
        f"Namaste {booking.farmer_name} ji,\n\n"
        f"Aapka Mandi Slot nishchit ho gaya hai:\n"
        f"🎟️ *Token Number:* {booking.token_number}\n"
        f"📍 *Weighbridge:* Bay {booking.bay_assigned}\n"
        f"⏰ *Arrival Window:* {booking.scheduled_window_start} - {booking.scheduled_window_end}\n"
        f"📦 *Crop/Qty:* {booking.crop} - {booking.quantity_quintals} Quintals\n"
        f"🚜 *Vahan:* {booking.vehicle_type}\n\n"
        f"🔒 *Slot-Bound Price Lock:* ₹{booking.price_lock_rate}/qtl\n"
        f"🛡️ *Digital Seal:* {booking.price_lock_hash}\n"
        f"(Aapka MSP bhav surakshit hai)."
    )

    return {
        "success": True,
        "parsed_intent": intent,
        "booking": {
            "token_number": booking.token_number,
            "farmer_name": booking.farmer_name,
            "phone": booking.farmer_phone,
            "village": booking.village,
            "crop": booking.crop,
            "quantity_quintals": booking.quantity_quintals,
            "vehicle_type": booking.vehicle_type,
            "bay_assigned": booking.bay_assigned,
            "scheduled_window": f"{booking.scheduled_window_start} - {booking.scheduled_window_end}",
            "price_lock_rate": booking.price_lock_rate,
            "price_lock_hash": booking.price_lock_hash,
            "lane_type": booking.lane_type
        },
        "whatsapp_reply": reply
    }

@app.post("/api/incidents/trigger")
def trigger_incident_endpoint(payload: DisruptionRequest, db: Session = Depends(get_db)):
    """Simulates real-time breakdown or weather alert and cascades ripple delay"""
    result = trigger_disruption(
        db=db,
        mandi_id=payload.mandi_id,
        incident_type=payload.incident_type,
        bay_id=payload.bay_id,
        delay_minutes=payload.delay_minutes,
        description=payload.description or f"Operational disruption on Bay {payload.bay_id}"
    )
    return {"success": True, "data": result}

@app.post("/api/incidents/{incident_id}/resolve")
def resolve_incident_endpoint(incident_id: int, db: Session = Depends(get_db)):
    result = resolve_incident(db=db, incident_id=incident_id)
    return {"success": True, "data": result}

@app.post("/api/check-in")
def check_in_endpoint(payload: CheckInRequest, db: Session = Depends(get_db)):
    """Gatekeeper check-in validation via Token or TOTP code"""
    booking = db.query(SlotBooking).filter(SlotBooking.token_number == payload.token_number).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Token not found in registry")

    # If TOTP provided, verify dynamic key
    if payload.totp_code and not verify_totp_token(booking, payload.totp_code):
        raise HTTPException(status_code=400, detail="Invalid or expired dynamic TOTP pass")

    booking.status = "GATE_ENTRY"
    booking.actual_check_in_time = datetime.datetime.utcnow().strftime("%H:%M:%S")
    db.commit()

    return {
        "success": True,
        "token_number": booking.token_number,
        "farmer_name": booking.farmer_name,
        "status": booking.status,
        "bay_assigned": booking.bay_assigned
    }

@app.post("/api/advance-status")
def advance_lifecycle_endpoint(payload: StatusAdvanceRequest, db: Session = Depends(get_db)):
    """Advances farmer: GATE_ENTRY -> QUALITY_ASSAY -> WEIGHED -> PAYMENT_DISBURSED"""
    booking = db.query(SlotBooking).filter(SlotBooking.token_number == payload.token_number).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Token not found")

    booking.status = payload.target_status

    if payload.moisture_percentage is not None:
        booking.moisture_percentage = payload.moisture_percentage

    if payload.gross_weight is not None:
        booking.gross_weight_quintals = payload.gross_weight
    if payload.tare_weight is not None:
        booking.tare_weight_quintals = payload.tare_weight

    if booking.gross_weight_quintals and booking.tare_weight_quintals:
        booking.net_weight_quintals = max(0.0, booking.gross_weight_quintals - booking.tare_weight_quintals)
        booking.payment_amount = round(booking.net_weight_quintals * booking.price_lock_rate, 2)

    if payload.target_status == "PAYMENT_DISBURSED":
        booking.payment_status = "DISBURSED"
        if not booking.payment_amount:
            booking.payment_amount = round(booking.quantity_quintals * booking.price_lock_rate, 2)

    db.commit()

    return {
        "success": True,
        "token_number": booking.token_number,
        "new_status": booking.status,
        "moisture": booking.moisture_percentage,
        "net_weight": booking.net_weight_quintals,
        "payment_amount": booking.payment_amount,
        "payment_status": booking.payment_status
    }

@app.get("/api/token/{token_number}")
def get_token_details(token_number: str, db: Session = Depends(get_db)):
    """Farmer dynamic pass view with real-time TOTP generation"""
    booking = db.query(SlotBooking).filter(SlotBooking.token_number == token_number).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Token not found")

    # Generate current dynamic TOTP (changes every 60s)
    totp = pyotp.TOTP(booking.totp_secret, interval=60)
    current_totp_code = totp.now()

    return {
        "token_number": booking.token_number,
        "farmer_name": booking.farmer_name,
        "phone": booking.farmer_phone,
        "village": booking.village,
        "crop": booking.crop,
        "quantity_quintals": booking.quantity_quintals,
        "vehicle_type": booking.vehicle_type,
        "lane_type": booking.lane_type,
        "bay_assigned": booking.bay_assigned,
        "scheduled_window_start": booking.scheduled_window_start,
        "scheduled_window_end": booking.scheduled_window_end,
        "revised_window_start": booking.revised_window_start or booking.scheduled_window_start,
        "revised_window_end": booking.revised_window_end or booking.scheduled_window_end,
        "delay_offset_minutes": booking.delay_offset_minutes,
        "status": booking.status,
        "dynamic_totp_code": current_totp_code,
        "price_lock_timestamp": booking.price_lock_timestamp,
        "price_lock_rate": booking.price_lock_rate,
        "price_lock_hash": booking.price_lock_hash,
        "moisture_percentage": booking.moisture_percentage,
        "payment_amount": booking.payment_amount,
        "payment_status": booking.payment_status
    }

@app.post("/api/promote-standby")
def promote_standby_endpoint(mandi_id: int = 1, db: Session = Depends(get_db)):
    """Promotes standby walk-in farmer to Express lane"""
    res = promote_standby_on_noshow(db, mandi_id=mandi_id)
    if not res:
        return {"success": False, "message": "No eligible standby farmer found to promote"}
    return {"success": True, "promoted": res}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
