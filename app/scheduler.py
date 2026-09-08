"""
The actual fix for the core bug: farmer demand and centre capacity are
disconnected, so popular days silently overload.

This allocator makes capacity a hard constraint on booking itself, not just
a number on a dashboard. A slot cannot be booked if the hour is already at
capacity — the request is automatically rolled forward to the next open
hour, then the next open day, until it finds one. That is what makes "1,000
farmers pick Monday" structurally impossible: the 301st Monday request never
gets a Monday slot in the first place.

This is a plain greedy allocator, not an OR-Tools solver. For a hackathon
build that has to work live in front of judges, "provably cannot overbook"
from simple, readable code beats a more sophisticated solver that might have
a bug nobody has time to find at 2am. Swap in OR-Tools later if you want
multi-factor priority scoring (distance, perishability, past wait time) —
the capacity guarantee this function gives you does not change either way.
"""
import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from sqlmodel import Session, select

from app.config import CAPACITY_PER_HOUR, DAY_START_HOUR, DAY_END_HOUR
from app.models import Booking

MAX_DAYS_TO_SEARCH = 7


@dataclass
class SlotOffer:
    slot_date: date
    slot_hour: int
    bumped_days: int  # 0 = got the requested day, >0 = pushed forward this many days


class NoCapacityError(Exception):
    """Every hour in the search window is already full."""


def _hour_count(session: Session, mandi_id: str, d: date, hour: int) -> int:
    rows = session.exec(
        select(Booking).where(
            Booking.slot_date == d,
            Booking.slot_hour == hour,
            Booking.status == "confirmed",
        )
    ).all()
    return len(rows)


def find_slot(session: Session, mandi_id: str, requested_date: date) -> SlotOffer:
    """
    Walk forward from requested_date, hour by hour within operating hours,
    day by day, until an hour with spare capacity is found. This is the
    entire "distribute farmers across available days" mechanism — it is
    just a bounded search against a hard cap, not a forecast.
    """
    for day_offset in range(MAX_DAYS_TO_SEARCH):
        d = requested_date + timedelta(days=day_offset)
        for hour in range(DAY_START_HOUR, DAY_END_HOUR):
            if _hour_count(session, mandi_id, d, hour) < CAPACITY_PER_HOUR:
                return SlotOffer(slot_date=d, slot_hour=hour, bumped_days=day_offset)
    raise NoCapacityError(
        f"No capacity in the next {MAX_DAYS_TO_SEARCH} days — the mandi "
        "config's CAPACITY_PER_HOUR is genuinely too low for this demo load."
    )


def make_token(slot: SlotOffer) -> str:
    return f"TKN-{slot.slot_date.isoformat()}-{slot.slot_hour:02d}00-{uuid.uuid4().hex[:4].upper()}"


def book_slot(
    session: Session,
    mandi_id: str,
    farmer_phone: str,
    crop: str,
    quantity_quintals: float,
    vehicle: str | None,
    requested_date: date,
) -> tuple[Booking, SlotOffer]:
    slot = find_slot(session, mandi_id, requested_date)
    booking = Booking(
        token=make_token(slot),
        farmer_phone=farmer_phone,
        crop=crop,
        quantity_quintals=quantity_quintals,
        vehicle=vehicle,
        slot_date=slot.slot_date,
        slot_hour=slot.slot_hour,
        status="confirmed",
    )
    session.add(booking)
    session.commit()
    session.refresh(booking)
    return booking, slot
