import datetime
import pyotp
import hashlib
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Mandi, Weighbridge, Farmer, SlotBooking, DisruptionIncident, NotificationLog
from mandi_data_service import get_crop_msp

DATABASE_URL = "sqlite:///./mandi_setu.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear previous seed
    db.query(NotificationLog).delete()
    db.query(DisruptionIncident).delete()
    db.query(SlotBooking).delete()
    db.query(Farmer).delete()
    db.query(Weighbridge).delete()
    db.query(Mandi).delete()
    db.commit()

    # 1. Mandi
    mandi = Mandi(
        code="KARNAL-01",
        name="Karnal APMC Grain Mandi (हरियाणा राज्य कृषि विपणन बोर्ड)",
        state="Haryana",
        district="Karnal",
        weighbridge_count=2,
        hourly_capacity_per_bay=4,
        walk_in_ratio=0.20,
        operating_start_hour=8,
        operating_end_hour=18
    )
    db.add(mandi)
    db.commit()
    db.refresh(mandi)

    # 2. Weighbridges
    bay1 = Weighbridge(
        mandi_id=mandi.id,
        bay_number=1,
        name="Weighbridge Bay 1 (North Gate - 60MT Electronic)",
        status="OPERATIONAL",
        current_delay_minutes=0
    )
    bay2 = Weighbridge(
        mandi_id=mandi.id,
        bay_number=2,
        name="Weighbridge Bay 2 (South Gate - 60MT Automated)",
        status="OPERATIONAL",
        current_delay_minutes=0
    )
    db.add_all([bay1, bay2])
    db.commit()

    # 3. Farmers & Bookings
    today_str = datetime.date.today().strftime("%Y-%m-%d")
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"

    sample_farmers_data = [
        {
            "name": "Sardar Balbir Singh",
            "phone": "+919812001001",
            "village": "Taraori",
            "crop": "Wheat",
            "qty": 45.0,
            "vehicle": "Tractor-Trolley",
            "start": "08:00",
            "end": "09:00",
            "bay": 1,
            "status": "PAYMENT_DISBURSED",
            "lane": "EXPRESS",
            "rate": 2275.0,
            "moisture": 11.2,
            "delay": 0
        },
        {
            "name": "Chaudhary Rameshwar",
            "phone": "+919812001002",
            "village": "Rampur",
            "crop": "Mustard",
            "qty": 35.0,
            "vehicle": "Tractor-Trolley",
            "start": "08:00",
            "end": "09:00",
            "bay": 2,
            "status": "WEIGHED",
            "lane": "EXPRESS",
            "rate": 5650.0,
            "moisture": 8.1,
            "delay": 0
        },
        {
            "name": "Sukhdev Yadav",
            "phone": "+919812001003",
            "village": "Nilokheri",
            "crop": "Wheat",
            "qty": 40.0,
            "vehicle": "Tractor-Trolley",
            "start": "09:00",
            "end": "10:00",
            "bay": 1,
            "status": "QUALITY_ASSAY",
            "lane": "EXPRESS",
            "rate": 2275.0,
            "moisture": 12.0,
            "delay": 0
        },
        {
            "name": "Jaswant Gill",
            "phone": "+919812001004",
            "village": "Indri",
            "crop": "Paddy",
            "qty": 60.0,
            "vehicle": "Mini-Truck",
            "start": "09:00",
            "end": "10:00",
            "bay": 2,
            "status": "GATE_ENTRY",
            "lane": "EXPRESS",
            "rate": 2203.0,
            "moisture": 13.5,
            "delay": 0
        },
        {
            "name": "Dharamveer Singh",
            "phone": "+919812001005",
            "village": "Gharaunda",
            "crop": "Wheat",
            "qty": 50.0,
            "vehicle": "Tractor-Trolley",
            "start": "10:00",
            "end": "11:00",
            "bay": 1,
            "status": "SCHEDULED",
            "lane": "EXPRESS",
            "rate": 2275.0,
            "moisture": None,
            "delay": 0
        },
        {
            "name": "Mahinder Kumar",
            "phone": "+919812001006",
            "village": "Assandh",
            "crop": "Wheat",
            "qty": 42.0,
            "vehicle": "Tractor-Trolley",
            "start": "10:00",
            "end": "11:00",
            "bay": 2,
            "status": "SCHEDULED",
            "lane": "EXPRESS",
            "rate": 2275.0,
            "moisture": None,
            "delay": 0
        },
        {
            "name": "Om Prakash Sharma",
            "phone": "+919812001007",
            "village": "Kunjpura",
            "crop": "Mustard",
            "qty": 28.0,
            "vehicle": "Tractor-Trolley",
            "start": "11:00",
            "end": "12:00",
            "bay": 1,
            "status": "SCHEDULED",
            "lane": "EXPRESS",
            "rate": 5650.0,
            "moisture": None,
            "delay": 0
        },
        {
            "name": "Harbans Lal",
            "phone": "+919812001008",
            "village": "Nissing",
            "crop": "Wheat",
            "qty": 40.0,
            "vehicle": "Tractor-Trolley",
            "start": "11:00",
            "end": "12:00",
            "bay": 2,
            "status": "SCHEDULED",
            "lane": "EXPRESS",
            "rate": 2275.0,
            "moisture": None,
            "delay": 0
        },
        {
            "name": "Satish Chand",
            "phone": "+919812001009",
            "village": "Samalkha",
            "crop": "Corn",
            "qty": 38.0,
            "vehicle": "Mini-Truck",
            "start": "12:00",
            "end": "13:00",
            "bay": 1,
            "status": "SCHEDULED",
            "lane": "EXPRESS",
            "rate": 2090.0,
            "moisture": None,
            "delay": 0
        },
        {
            "name": "Jagdish Prasad",
            "phone": "+919812001010",
            "village": "Taraori",
            "crop": "Wheat",
            "qty": 55.0,
            "vehicle": "Tractor-Trolley",
            "start": "12:00",
            "end": "13:00",
            "bay": 2,
            "status": "SCHEDULED",
            "lane": "EXPRESS",
            "rate": 2275.0,
            "moisture": None,
            "delay": 0
        },
        # Walk-in Standby Queue (20% Reserve Lane)
        {
            "name": "Ram Saran (Walk-in)",
            "phone": "+919812001011",
            "village": "Indri",
            "crop": "Wheat",
            "qty": 30.0,
            "vehicle": "Bullock Cart",
            "start": "11:00",
            "end": "14:00",
            "bay": 1,
            "status": "SCHEDULED",
            "lane": "STANDBY",
            "rate": 2275.0,
            "moisture": None,
            "delay": 0
        },
        {
            "name": "Birbal Ram (Walk-in)",
            "phone": "+919812001012",
            "village": "Rampur",
            "crop": "Wheat",
            "qty": 25.0,
            "vehicle": "Tractor-Trolley",
            "start": "12:00",
            "end": "15:00",
            "bay": 2,
            "status": "SCHEDULED",
            "lane": "STANDBY",
            "rate": 2275.0,
            "moisture": None,
            "delay": 0
        }
    ]

    for idx, f_data in enumerate(sample_farmers_data, 1):
        farmer = Farmer(
            phone=f_data["phone"],
            name=f_data["name"],
            village=f_data["village"],
            land_holding_acres=3.2 + (idx * 0.4)
        )
        db.add(farmer)
        db.commit()
        db.refresh(farmer)

        token_no = f"MS-{datetime.date.today().strftime('%m%d')}-{100 + idx}"
        totp_sec = pyotp.random_base32()
        official_rate = get_crop_msp(f_data['crop'])
        seal = f"{token_no}:{farmer.phone}:{f_data['crop']}:{official_rate}:{now_iso}"
        price_hash = hashlib.sha256(seal.encode()).hexdigest()[:24].upper()

        booking = SlotBooking(
            token_number=token_no,
            mandi_id=mandi.id,
            farmer_id=farmer.id,
            farmer_name=farmer.name,
            farmer_phone=farmer.phone,
            village=farmer.village,
            crop=f_data["crop"],
            quantity_quintals=f_data["qty"],
            vehicle_type=f_data["vehicle"],
            lane_type=f_data["lane"],
            scheduled_date=today_str,
            scheduled_window_start=f_data["start"],
            scheduled_window_end=f_data["end"],
            bay_assigned=f_data["bay"],
            delay_offset_minutes=f_data["delay"],
            revised_window_start=f_data["start"],
            revised_window_end=f_data["end"],
            status=f_data["status"],
            totp_secret=totp_sec,
            price_lock_timestamp=now_iso,
            price_lock_rate=official_rate,
            price_lock_hash=price_hash,
            moisture_percentage=f_data["moisture"],
            payment_status="DISBURSED" if f_data["status"] == "PAYMENT_DISBURSED" else "PENDING",
            payment_amount=round(f_data["qty"] * official_rate, 2)
        )
        db.add(booking)

    db.commit()
    db.close()
    print(f"Successfully seeded MandiSetu with {len(sample_farmers_data)} realistic records.")

if __name__ == "__main__":
    seed_database()
