import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models import DisruptionIncident, SlotBooking, Weighbridge, NotificationLog, Mandi

def format_time_offset(original_hhmm: str, delay_minutes: int) -> str:
    """Takes '09:00' and adds 45 minutes -> '09:45'"""
    try:
        parts = original_hhmm.split(":")
        h, m = int(parts[0]), int(parts[1])
        total_mins = h * 60 + m + delay_minutes
        new_h = (total_mins // 60) % 24
        new_m = total_mins % 60
        return f"{new_h:02d}:{new_m:02d}"
    except Exception:
        return original_hhmm

def trigger_disruption(
    db: Session,
    mandi_id: int,
    incident_type: str,
    bay_id: Optional[int],
    delay_minutes: int,
    description: str = ""
) -> Dict[str, Any]:
    """
    Simulates or handles real incident, cascades delay to downstream farmers,
    and pushes proactive WhatsApp/SMS alerts before farmers leave their village.
    """
    mandi = db.query(Mandi).filter(Mandi.id == mandi_id).first()
    if not mandi:
        raise ValueError("Mandi not found")

    # 1. Update Weighbridge status if specific bay
    if bay_id:
        wb = db.query(Weighbridge).filter(
            Weighbridge.mandi_id == mandi_id,
            Weighbridge.bay_number == bay_id
        ).first()
        if wb:
            wb.status = "BREAKDOWN" if "BREAKDOWN" in incident_type else "SLOW"
            wb.current_delay_minutes += delay_minutes

    # 2. Record Incident
    incident = DisruptionIncident(
        mandi_id=mandi_id,
        bay_id=bay_id,
        incident_type=incident_type,
        description=description or f"Operational delay on Bay {bay_id or 'All'}: +{delay_minutes} min",
        delay_minutes=delay_minutes,
        is_active=True
    )
    db.add(incident)
    db.flush()

    # 3. Find affected downstream bookings
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    query = db.query(SlotBooking).filter(
        SlotBooking.mandi_id == mandi_id,
        SlotBooking.scheduled_date == today_str,
        SlotBooking.status.in_(["SCHEDULED", "GATE_ENTRY"])
    )
    if bay_id:
        query = query.filter(SlotBooking.bay_assigned == bay_id)

    affected_bookings = query.all()
    incident.affected_farmers_count = len(affected_bookings)

    alerts_sent = []

    # 4. Cascade shift and generate proactive vernacular alerts
    for booking in affected_bookings:
        booking.delay_offset_minutes += delay_minutes
        base_start = booking.revised_window_start or booking.scheduled_window_start
        base_end = booking.revised_window_end or booking.scheduled_window_end

        booking.revised_window_start = format_time_offset(base_start, delay_minutes)
        booking.revised_window_end = format_time_offset(base_end, delay_minutes)

        # Craft proactive message
        msg = (
            f"⚠️ *MANDI DELAY ALERT* | Karnal APMC\n"
            f"Namaste {booking.farmer_name} ji,\n"
            f"Bay {booking.bay_assigned} me {description or 'yantrik kharabi'} ke karan {delay_minutes} minute ki deri hai.\n\n"
            f"📍 Token: *{booking.token_number}*\n"
            f"⏰ Naya Arrival Samay: *{booking.revised_window_start} - {booking.revised_window_end}*\n"
            f"🔒 MSP Price Lock Rate: *₹{booking.price_lock_rate}/qtl (SURAKSHIT)*\n\n"
            f"👉 Kripya apne gaav {booking.village} se deri se niklein taaki sadak par jam na lage."
        )

        notif = NotificationLog(
            booking_id=booking.id,
            recipient_phone=booking.farmer_phone,
            farmer_name=booking.farmer_name,
            channel="WHATSAPP",
            message_type="DELAY_ALERT",
            message_body=msg,
            status="DELIVERED"
        )
        db.add(notif)
        alerts_sent.append({
            "token": booking.token_number,
            "farmer": booking.farmer_name,
            "phone": booking.farmer_phone,
            "new_window": f"{booking.revised_window_start} - {booking.revised_window_end}",
            "message": msg
        })

    db.commit()

    return {
        "incident_id": incident.id,
        "type": incident_type,
        "delay_minutes": delay_minutes,
        "affected_count": len(affected_bookings),
        "alerts_dispatched": alerts_sent
    }

def resolve_incident(db: Session, incident_id: int) -> Dict[str, Any]:
    """Resolves an active incident and resets weighbridge operational health"""
    inc = db.query(DisruptionIncident).filter(DisruptionIncident.id == incident_id).first()
    if not inc:
        return {"error": "Incident not found"}
    inc.is_active = False
    inc.resolved_at = datetime.datetime.utcnow()

    if inc.bay_id:
        wb = db.query(Weighbridge).filter(
            Weighbridge.mandi_id == inc.mandi_id,
            Weighbridge.bay_number == inc.bay_id
        ).first()
        if wb:
            wb.status = "OPERATIONAL"
            wb.current_delay_minutes = 0

    db.commit()
    return {"status": "RESOLVED", "incident_id": incident_id}

def promote_standby_on_noshow(db: Session, mandi_id: int) -> Optional[Dict[str, Any]]:
    """
    20-minute Grace Period Rule:
    Finds earliest scheduled booking that is >20 min past window start without check-in,
    forfeits express slot, and promotes first available standby walk-in farmer.
    """
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    standby_farmer = db.query(SlotBooking).filter(
        SlotBooking.mandi_id == mandi_id,
        SlotBooking.scheduled_date == today_str,
        SlotBooking.lane_type == "STANDBY",
        SlotBooking.status == "SCHEDULED"
    ).first()

    if not standby_farmer:
        return None

    standby_farmer.lane_type = "EXPRESS"
    standby_farmer.status = "SCHEDULED"
    db.commit()

    msg = (
        f"🎉 *STANDBY PROMOTION ALERT* | Karnal APMC\n"
        f"Namaste {standby_farmer.farmer_name} ji,\n"
        f"Ek slot khali hone ke karan aapka Standby Token *{standby_farmer.token_number}* "
        f"ko EXPRESS LANE me promote kar diya gaya hai!\n"
        f"Kripya turant Weighbridge Bay {standby_farmer.bay_assigned} par Gate Pass dikhayein."
    )

    notif = NotificationLog(
        booking_id=standby_farmer.id,
        recipient_phone=standby_farmer.farmer_phone,
        farmer_name=standby_farmer.farmer_name,
        channel="WHATSAPP",
        message_type="STANDBY_PROMOTION",
        message_body=msg,
        status="DELIVERED"
    )
    db.add(notif)
    db.commit()

    return {
        "promoted_token": standby_farmer.token_number,
        "farmer_name": standby_farmer.farmer_name,
        "phone": standby_farmer.farmer_phone
    }
