"""
Proves the one claim the whole pitch rests on: the allocator cannot be
booked past capacity, and overflow rolls forward to the next open slot
instead of silently overloading a day.
"""
from datetime import date, timedelta

from sqlmodel import SQLModel, Session, create_engine

from app.models import Booking  # noqa: F401 - registers table with metadata
from app.scheduler import CAPACITY_PER_HOUR, DAY_END_HOUR, DAY_START_HOUR, book_slot


def make_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_never_exceeds_hourly_capacity():
    session = make_session()
    monday = date(2026, 9, 14)

    hours_per_day = DAY_END_HOUR - DAY_START_HOUR
    day_capacity = hours_per_day * CAPACITY_PER_HOUR

    # Book one more than a single day can hold.
    bookings = []
    for i in range(day_capacity + 5):
        booking, slot = book_slot(
            session, "mandi-1", f"whatsapp:+91{i:05d}", "Wheat", 10.0, "tractor", monday
        )
        bookings.append((booking, slot))

    # No single (date, hour) may exceed CAPACITY_PER_HOUR.
    from collections import Counter

    counts = Counter((s.slot_date, s.slot_hour) for _, s in bookings)
    assert all(c <= CAPACITY_PER_HOUR for c in counts.values()), (
        "Scheduler allowed an hour to exceed capacity — this is the exact "
        "bug the whole project exists to prevent."
    )

    # The overflow farmers must have been pushed to a later day, not lost
    # or double-booked onto Monday.
    overflow = bookings[day_capacity:]
    assert all(s.slot_date > monday for _, s in overflow), (
        "Overflow bookings should roll forward to a later day."
    )


def test_requested_day_still_used_when_capacity_allows():
    session = make_session()
    today = date(2026, 9, 14)
    booking, slot = book_slot(session, "mandi-1", "whatsapp:+911", "Wheat", 5.0, None, today)
    assert slot.slot_date == today
    assert slot.bumped_days == 0
    assert DAY_START_HOUR <= slot.slot_hour < DAY_END_HOUR
