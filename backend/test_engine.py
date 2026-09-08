import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, Mandi, Weighbridge, Farmer, SlotBooking, NotificationLog
from intent_parser import parse_farmer_intent
from slot_allocator import allocate_slot, verify_totp_token
from disruption_engine import trigger_disruption, promote_standby_on_noshow

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_intent_parsing():
    print("Testing Intent Parsing...")
    sample_text = "Namaste, Rampur se 40 quintal gehu tractor me kal subah 10 baje lana hai"
    res = parse_farmer_intent(sample_text, caller_phone="+919812345678")

    assert res["crop"] == "Wheat", f"Expected Wheat, got {res['crop']}"
    assert res["quantity_quintals"] == 40.0, f"Expected 40.0, got {res['quantity_quintals']}"
    assert res["vehicle_type"] == "Tractor-Trolley", f"Expected Tractor-Trolley, got {res['vehicle_type']}"
    assert res["village"] == "Rampur", f"Expected Rampur, got {res['village']}"
    assert res["price_lock_rate"] == 2275.0, f"Expected 2275.0, got {res['price_lock_rate']}"
    print("[PASS] Intent parsing passed!")

def test_slot_allocation_and_price_lock():
    print("Testing Slot Allocation & Price Lock...")
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    mandi = Mandi(
        code="KARNAL-TEST",
        name="Karnal APMC Test",
        weighbridge_count=2,
        hourly_capacity_per_bay=4
    )
    db.add(mandi)
    db.commit()

    intent = {
        "farmer_name": "Ramesh Kumar",
        "farmer_phone": "+919812999999",
        "village": "Rampur",
        "crop": "Wheat",
        "quantity_quintals": 45.0,
        "vehicle_type": "Tractor-Trolley",
        "preferred_date": datetime.date.today().strftime("%Y-%m-%d"),
        "preferred_time_window": "09:00",
        "price_lock_rate": 2275.0
    }

    booking = allocate_slot(db, mandi_code="KARNAL-TEST", parsed_intent=intent, lane_type="EXPRESS")
    assert booking.token_number.startswith("MS-"), "Invalid token format"
    assert booking.bay_assigned in [1, 2], "Bay must be 1 or 2"
    assert booking.price_lock_rate == 2275.0, "Price lock mismatch"
    assert len(booking.price_lock_hash) == 24, "Invalid price lock hash"
    assert booking.totp_secret is not None, "Missing TOTP secret"

    # Verify TOTP validation
    import pyotp
    totp = pyotp.TOTP(booking.totp_secret, interval=60)
    current_code = totp.now()
    assert verify_totp_token(booking, current_code) is True, "TOTP verification failed"

    print("[PASS] Slot allocation and price-lock security passed!")
    db.close()

def test_disruption_cascade():
    print("Testing Disruption Ripple Engine...")
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    db.query(SlotBooking).delete()
    db.commit()

    mandi = db.query(Mandi).first()
    bay1 = Weighbridge(mandi_id=mandi.id, bay_number=1, name="Bay 1", status="OPERATIONAL")
    bay2 = Weighbridge(mandi_id=mandi.id, bay_number=2, name="Bay 2", status="OPERATIONAL")
    db.add_all([bay1, bay2])
    db.commit()

    today_str = datetime.date.today().strftime("%Y-%m-%d")

    # Add 2 bookings on Bay 1
    b1 = SlotBooking(
        token_number="MS-TEST-01",
        mandi_id=mandi.id,
        farmer_name="Farmer 1",
        farmer_phone="+919812111111",
        village="Taraori",
        crop="Wheat",
        quantity_quintals=40,
        scheduled_date=today_str,
        scheduled_window_start="09:00",
        scheduled_window_end="10:00",
        bay_assigned=1,
        status="SCHEDULED",
        totp_secret="JBSWY3DPEHPK3PXP",
        price_lock_timestamp="2026-09-08T09:00:00Z",
        price_lock_rate=2275.0,
        price_lock_hash="SEAL123456"
    )
    b2 = SlotBooking(
        token_number="MS-TEST-02",
        mandi_id=mandi.id,
        farmer_name="Farmer 2",
        farmer_phone="+919812222222",
        village="Indri",
        crop="Wheat",
        quantity_quintals=40,
        scheduled_date=today_str,
        scheduled_window_start="10:00",
        scheduled_window_end="11:00",
        bay_assigned=1,
        status="SCHEDULED",
        totp_secret="JBSWY3DPEHPK3PXP",
        price_lock_timestamp="2026-09-08T09:00:00Z",
        price_lock_rate=2275.0,
        price_lock_hash="SEAL123457"
    )
    db.add_all([b1, b2])
    db.commit()

    # Trigger Bay 1 breakdown (+45 min)
    res = trigger_disruption(
        db=db,
        mandi_id=mandi.id,
        incident_type="WEIGHBRIDGE_BREAKDOWN",
        bay_id=1,
        delay_minutes=45,
        description="Load cell sensor recalibration"
    )

    assert res["affected_count"] == 2, f"Expected 2 affected, got {res['affected_count']}"
    assert b1.revised_window_start == "09:45", f"Expected 09:45, got {b1.revised_window_start}"
    assert b2.revised_window_start == "10:45", f"Expected 10:45, got {b2.revised_window_start}"

    # Verify proactive notifications logged
    notifs = db.query(NotificationLog).filter(NotificationLog.booking_id == b1.id).all()
    assert len(notifs) >= 1, "Proactive alert was not recorded"
    assert "45 minute ki deri" in notifs[0].message_body, "Alert body missing delay info"

    print("[PASS] Disruption cascade and proactive alerts passed!")
    db.close()

if __name__ == "__main__":
    test_intent_parsing()
    test_slot_allocation_and_price_lock()
    test_disruption_cascade()
    print("\nALL BACKEND CORE TESTS PASSED SUCCESSFULLY! [OK]")
