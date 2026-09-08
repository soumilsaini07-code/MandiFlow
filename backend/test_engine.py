import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, Mandi, Weighbridge, Farmer, SlotBooking, NotificationLog, Arhtiya
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
    assert res["price_lock_rate"] == 2585.0, f"Expected 2585.0, got {res['price_lock_rate']}"
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

def test_duplicate_booking_rejection():
    print("Testing Duplicate Booking Prevention...")
    db = TestingSessionLocal()
    intent = {
        "farmer_name": "Ramesh Kumar",
        "farmer_phone": "+919812999999",
        "village": "Rampur",
        "crop": "Wheat",
        "quantity_quintals": 45.0,
        "preferred_date": datetime.date.today().strftime("%Y-%m-%d"),
        "preferred_time_window": "09:00",
        "price_lock_rate": 2585.0
    }
    try:
        allocate_slot(db, mandi_code="KARNAL-TEST", parsed_intent=intent, lane_type="EXPRESS")
        assert False, "Should have rejected duplicate active booking on same date"
    except ValueError as e:
        assert "Active booking already exists" in str(e)
        print("[PASS] Duplicate booking prevented successfully!")
    finally:
        db.close()

def test_arhtiya_portal_scoping_and_commission():
    print("Testing Arhtiya Data Scoping, Commission Math & Proxy Booking...")
    db = TestingSessionLocal()

    mandi = db.query(Mandi).first()
    if not mandi:
        mandi = Mandi(code="KARNAL-TEST", name="Karnal APMC Test")
        db.add(mandi)
        db.commit()

    # 1. Create two separate Arhtiyas
    a1 = Arhtiya(
        name="Chaudhary Trading Co.",
        license_number="HR-TEST-A1",
        phone="+919812000001",
        mandi_id=mandi.id,
        secret_key="secret1",
        commission_rate=2.5
    )
    a2 = Arhtiya(
        name="Kisan Sahayta Kendra",
        license_number="HR-TEST-A2",
        phone="+919812000002",
        mandi_id=mandi.id,
        secret_key="secret2",
        commission_rate=3.0
    )
    db.add_all([a1, a2])
    db.commit()

    # 2. Assign Farmer A to Arhtiya 1, Farmer B to Arhtiya 2
    fA = Farmer(phone="+919812110001", name="Kisan A", village="Rampur", arhtiya_id=a1.id)
    fB = Farmer(phone="+919812110002", name="Kisan B", village="Taraori", arhtiya_id=a2.id)
    db.add_all([fA, fB])
    db.commit()

    today_str = datetime.date.today().strftime("%Y-%m-%d")

    # Add Disbursed Booking for Farmer A under Arhtiya 1
    bookingA = SlotBooking(
        token_number="MS-ARH-01",
        mandi_id=mandi.id,
        farmer_id=fA.id,
        arhtiya_id=a1.id,
        farmer_name=fA.name,
        farmer_phone=fA.phone,
        crop="Wheat",
        quantity_quintals=40.0,
        scheduled_date=today_str,
        scheduled_window_start="08:00",
        scheduled_window_end="09:00",
        bay_assigned=1,
        status="PAYMENT_DISBURSED",
        totp_secret="SECRETTESTA",
        price_lock_timestamp="2026-09-08T08:00:00Z",
        price_lock_rate=2500.0,
        price_lock_hash="HASHSEALA",
        payment_status="DISBURSED",
        payment_amount=100000.0  # 40 Qtl * 2500
    )
    # Add Scheduled Booking for Farmer B under Arhtiya 2
    bookingB = SlotBooking(
        token_number="MS-ARH-02",
        mandi_id=mandi.id,
        farmer_id=fB.id,
        arhtiya_id=a2.id,
        farmer_name=fB.name,
        farmer_phone=fB.phone,
        crop="Mustard",
        quantity_quintals=20.0,
        scheduled_date=today_str,
        scheduled_window_start="09:00",
        scheduled_window_end="10:00",
        bay_assigned=2,
        status="SCHEDULED",
        totp_secret="SECRETTESTB",
        price_lock_timestamp="2026-09-08T09:00:00Z",
        price_lock_rate=5650.0,
        price_lock_hash="HASHSEALB",
        payment_status="PENDING",
        payment_amount=113000.0
    )
    db.add_all([bookingA, bookingB])
    db.commit()

    # 3. Test Scoping Isolation: Arhtiya 1 MUST NOT see Farmer B or Booking B
    a1_farmers = db.query(Farmer).filter(Farmer.arhtiya_id == a1.id).all()
    a1_farmer_ids = [f.id for f in a1_farmers]
    a1_bookings = db.query(SlotBooking).filter(
        (SlotBooking.arhtiya_id == a1.id) | (SlotBooking.farmer_id.in_(a1_farmer_ids))
    ).all()

    assert len(a1_farmers) == 1 and a1_farmers[0].name == "Kisan A", "Arhtiya 1 saw unexpected farmers"
    assert len(a1_bookings) == 1 and a1_bookings[0].token_number == "MS-ARH-01", "Arhtiya 1 saw another arhtiya's booking"
    assert "MS-ARH-02" not in [b.token_number for b in a1_bookings], "Data leak: Arhtiya 1 accessed Arhtiya 2's booking"

    # 4. Test Commission Math
    # Total payment = 100,000.0; commission rate = 2.5% -> Expected commission = 2,500.0
    a1_disbursed = [b for b in a1_bookings if b.status == "PAYMENT_DISBURSED"]
    total_val = sum(b.payment_amount for b in a1_disbursed)
    comm_earned = sum(round(b.payment_amount * (a1.commission_rate / 100.0), 2) for b in a1_disbursed)
    assert total_val == 100000.0, f"Expected 100000.0, got {total_val}"
    assert comm_earned == 2500.0, f"Expected 2500.0 commission, got {comm_earned}"

    # 5. Test Proxy Booking: Arhtiya books for a new farmer with unassigned phone
    proxy_intent = {
        "farmer_name": "Kisan C (Proxy)",
        "farmer_phone": "+919812555555",
        "village": "Indri",
        "crop": "Paddy",
        "quantity_quintals": 50.0,
        "vehicle_type": "Mini-Truck",
        "preferred_date": today_str,
        "preferred_time_window": "11:00",
        "price_lock_rate": 2300.0
    }
    proxy_booking = allocate_slot(
        db=db,
        mandi_code="KARNAL-TEST",
        parsed_intent=proxy_intent,
        lane_type="EXPRESS",
        arhtiya_id=a1.id
    )

    # Verify farmer and booking are now mapped to Arhtiya 1
    new_farmer = db.query(Farmer).filter(Farmer.phone == "+919812555555").first()
    assert new_farmer is not None, "Proxy farmer was not created"
    assert new_farmer.arhtiya_id == a1.id, "Proxy farmer was not linked to Arhtiya 1"
    assert proxy_booking.arhtiya_id == a1.id, "Proxy booking was not assigned arhtiya_id"

    # Confirm Arhtiya 2 still cannot see the proxy booking
    a2_bookings = db.query(SlotBooking).filter(
        (SlotBooking.arhtiya_id == a2.id) | (SlotBooking.farmer_id.in_([f.id for f in db.query(Farmer).filter(Farmer.arhtiya_id == a2.id).all()]))
    ).all()
    assert proxy_booking.token_number not in [b.token_number for b in a2_bookings], "Data leak in proxy booking"

    print("[PASS] Arhtiya data isolation, commission math, and proxy booking verified!")
    db.close()

if __name__ == "__main__":
    test_intent_parsing()
    test_slot_allocation_and_price_lock()
    test_duplicate_booking_rejection()
    test_disruption_cascade()
    test_arhtiya_portal_scoping_and_commission()
    print("\nALL BACKEND CORE TESTS PASSED SUCCESSFULLY! [OK]")
