"""
Delay propagation: the "closed-loop" half of the pitch. A breakdown doesn't
just get logged — every farmer already booked for the affected window gets
texted before they leave home, not left to discover a 45-minute wait after
they've already driven a tractor-trolley to the gate.
"""
from datetime import date

from sqlmodel import Session, select

from app.models import Booking, Incident
from app.twilio_client import send_proactive_alert


def apply_incident(
    session: Session,
    mandi_id: str,
    reason: str,
    delay_minutes: int,
    affects_from_hour: int,
) -> dict:
    incident = Incident(
        mandi_id=mandi_id,
        reason=reason,
        delay_minutes=delay_minutes,
        affects_from_hour=affects_from_hour,
    )
    session.add(incident)

    affected = session.exec(
        select(Booking).where(
            Booking.slot_date == date.today(),
            Booking.slot_hour >= affects_from_hour,
            Booking.status == "confirmed",
        )
    ).all()

    alert_results = []
    for booking in affected:
        booking.delay_minutes += delay_minutes
        session.add(booking)

        new_hour = booking.slot_hour  # display hour unchanged; delay is additive minutes
        body = (
            f"Update on your booking {booking.token}: {reason}. "
            f"Expect a {delay_minutes}-minute delay for your "
            f"{new_hour:02d}:00 window today. No need to rebook — "
            f"just plan to arrive {delay_minutes} min later."
        )
        alert_results.append(
            send_proactive_alert(booking.farmer_phone, body, booking.last_inbound_at)
        )

    session.commit()

    return {
        "incident_reason": reason,
        "delay_minutes": delay_minutes,
        "affected_bookings": len(affected),
        "alerts": alert_results,
    }
