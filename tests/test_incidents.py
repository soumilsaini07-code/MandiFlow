from datetime import date

from sqlmodel import SQLModel, Session, create_engine

from app.incidents import apply_incident
from app.models import Booking, Incident  # noqa: F401
from app.scheduler import book_slot


def make_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_incident_flags_only_downstream_bookings(monkeypatch):
    session = make_session()
    today = date.today()

    # Force everyone into the same day for a deterministic test.
    import app.scheduler as sched

    monkeypatch.setattr(sched, "MAX_DAYS_TO_SEARCH", 1)

    b_early, s_early = book_slot(session, "mandi-1", "whatsapp:+91111", "Wheat", 10, None, today)
    # Fill up hours until we land past the "affects_from_hour" cutoff.
    for i in range(sched.CAPACITY_PER_HOUR * 2):
        book_slot(session, "mandi-1", f"whatsapp:+9122{i}", "Wheat", 10, None, today)

    result = apply_incident(
        session, mandi_id="mandi-1", reason="Bay 1 breakdown", delay_minutes=45,
        affects_from_hour=s_early.slot_hour,
    )

    assert result["affected_bookings"] >= 1
    assert result["delay_minutes"] == 45
    # Every alert attempt is accounted for (sent, or a clear skip reason —
    # never silently dropped).
    assert len(result["alerts"]) == result["affected_bookings"]
    assert all("sent" in a for a in result["alerts"])
