import datetime
import uuid
import hashlib
import pyotp
from typing import Dict, Any, Optional, Tuple, List
from sqlalchemy.orm import Session
from models import Mandi, Weighbridge, SlotBooking, Farmer

def generate_unique_token() -> str:
    """Generates an official-looking mandi token: MS-YYYYMMDD-XXXX"""
    now = datetime.datetime.utcnow()
    rand_suffix = uuid.uuid4().hex[:4].upper()
    return f"MS-{now.strftime('%m%d')}-{rand_suffix}"

def find_best_slot_and_bay(
    db: Session,
    mandi: Mandi,
    target_date: str,
    preferred_hour: int,
    lane_type: str = "EXPRESS"
) -> Tuple[int, str, str]:
    """
    Constraint-based micro-window allocator with 80/20 dual-track split.
    Returns: (bay_assigned, window_start, window_end)
    """
    total_capacity = mandi.hourly_capacity_per_bay  # e.g., 4 vehicles per bay/hour
    max_express_per_bay = int(total_capacity * 0.80) if lane_type == "EXPRESS" else total_capacity
    
    # Query all bookings for this date
    existing_bookings = db.query(SlotBooking).filter(
        SlotBooking.mandi_id == mandi.id,
        SlotBooking.scheduled_date == target_date,
        SlotBooking.status.notin_(["CANCELLED"])
    ).all()

    # Build hour -> bay -> count map
    usage: Dict[int, Dict[int, int]] = {
        h: {1: 0, 2: 0} for h in range(mandi.operating_start_hour, mandi.operating_end_hour)
    }

    for b in existing_bookings:
        try:
            start_h = int(b.scheduled_window_start.split(":")[0])
            if start_h in usage and b.bay_assigned in usage[start_h]:
                usage[start_h][b.bay_assigned] += 1
        except Exception:
            pass

    # Try preferred hour first, then look outward (+1, -1, +2, -2...)
    hour_candidates = []
    hour_candidates.append(preferred_hour)
    for offset in range(1, 10):
        if preferred_hour + offset < mandi.operating_end_hour:
            hour_candidates.append(preferred_hour + offset)
        if preferred_hour - offset >= mandi.operating_start_hour:
            hour_candidates.append(preferred_hour - offset)

    chosen_hour = preferred_hour
    chosen_bay = 1

    allocated = False
    for h in hour_candidates:
        if h not in usage:
            continue
        # Check bay 1 vs bay 2
        bay_loads = [
            (usage[h][1], 1),
            (usage[h][2], 2)
        ]
        # Pick least loaded bay
        bay_loads.sort(key=lambda x: x[0])
        for load, bay in bay_loads:
            if load < max_express_per_bay:
                chosen_hour = h
                chosen_bay = bay
                allocated = True
                break
        if allocated:
            break

    # If all hours full, assign to standby queue for the afternoon
    if not allocated:
        chosen_hour = min(preferred_hour + 2, mandi.operating_end_hour - 1)
        chosen_bay = 1

    window_start = f"{chosen_hour:02d}:00"
    window_end = f"{(chosen_hour + 1):02d}:00"

    return chosen_bay, window_start, window_end

def allocate_slot(
    db: Session,
    mandi_code: str,
    parsed_intent: Dict[str, Any],
    lane_type: str = "EXPRESS"
) -> SlotBooking:
    """
    Allocates a verified slot, generates TOTP security keys and price-lock certificate.
    """
    mandi = db.query(Mandi).filter(Mandi.code == mandi_code).first()
    if not mandi:
        # Create default mandi if missing
        mandi = Mandi(
            code="KARNAL-01",
            name="Karnal Main APMC Grain Market",
            state="Haryana",
            district="Karnal",
            weighbridge_count=2,
            hourly_capacity_per_bay=4,
            walk_in_ratio=0.20
        )
        db.add(mandi)
        db.commit()
        db.refresh(mandi)

    # Resolve or create Farmer
    phone = parsed_intent.get("farmer_phone", "+919812345678")
    farmer = db.query(Farmer).filter(Farmer.phone == phone).first()
    if not farmer:
        farmer = Farmer(
            phone=phone,
            name=parsed_intent.get("farmer_name", "Kisan Bandhu"),
            village=parsed_intent.get("village", "Rampur")
        )
        db.add(farmer)
        db.commit()
        db.refresh(farmer)

    # Determine window
    preferred_date = parsed_intent.get("preferred_date", datetime.date.today().strftime("%Y-%m-%d"))
    preferred_time = parsed_intent.get("preferred_time_window", "09:00")
    try:
        pref_hour = int(preferred_time.split(":")[0])
    except Exception:
        pref_hour = 9

    bay_assigned, win_start, win_end = find_best_slot_and_bay(
        db=db,
        mandi=mandi,
        target_date=preferred_date,
        preferred_hour=pref_hour,
        lane_type=lane_type
    )

    # Security: TOTP secret + Price Lock
    totp_secret = pyotp.random_base32()
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"
    token_number = generate_unique_token()
    crop = parsed_intent.get("crop", "Wheat")
    price_rate = float(parsed_intent.get("price_lock_rate", 2275.0))

    # SHA-256 seal
    seal_raw = f"{token_number}:{phone}:{crop}:{price_rate}:{now_iso}"
    price_lock_hash = hashlib.sha256(seal_raw.encode()).hexdigest()[:24].upper()

    booking = SlotBooking(
        token_number=token_number,
        mandi_id=mandi.id,
        farmer_id=farmer.id,
        farmer_name=farmer.name,
        farmer_phone=farmer.phone,
        village=parsed_intent.get("village", farmer.village),
        crop=crop,
        quantity_quintals=float(parsed_intent.get("quantity_quintals", 40.0)),
        vehicle_type=parsed_intent.get("vehicle_type", "Tractor-Trolley"),
        lane_type=lane_type,
        scheduled_date=preferred_date,
        scheduled_window_start=win_start,
        scheduled_window_end=win_end,
        bay_assigned=bay_assigned,
        totp_secret=totp_secret,
        price_lock_timestamp=now_iso,
        price_lock_rate=price_rate,
        price_lock_hash=price_lock_hash,
        payment_amount=round(float(parsed_intent.get("quantity_quintals", 40.0)) * price_rate, 2),
        status="SCHEDULED"
    )

    db.add(booking)
    db.commit()
    db.refresh(booking)

    return booking

def verify_totp_token(booking: SlotBooking, user_code: str) -> bool:
    """Verifies dynamic 6-digit TOTP token to prevent screenshot or fake gate pass entry"""
    totp = pyotp.TOTP(booking.totp_secret, interval=60)
    return totp.verify(user_code, valid_window=2)
