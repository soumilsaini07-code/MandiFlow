import datetime
import hashlib
import uuid
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Mandi(Base):
    __tablename__ = "mandis"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(32), unique=True, index=True)
    name = Column(String(128), nullable=False)
    state = Column(String(64), default="Haryana")
    district = Column(String(64), default="Karnal")
    weighbridge_count = Column(Integer, default=2)
    hourly_capacity_per_bay = Column(Integer, default=4)
    walk_in_ratio = Column(Float, default=0.20)
    operating_start_hour = Column(Integer, default=8)  # 08:00 AM
    operating_end_hour = Column(Integer, default=18)   # 06:00 PM

    weighbridges = relationship("Weighbridge", back_populates="mandi", cascade="all, delete-orphan")
    bookings = relationship("SlotBooking", back_populates="mandi", cascade="all, delete-orphan")
    incidents = relationship("DisruptionIncident", back_populates="mandi", cascade="all, delete-orphan")


class Weighbridge(Base):
    __tablename__ = "weighbridges"

    id = Column(Integer, primary_key=True, index=True)
    mandi_id = Column(Integer, ForeignKey("mandis.id"))
    bay_number = Column(Integer, nullable=False)  # 1 or 2
    name = Column(String(64), nullable=False)      # e.g., Weighbridge Bay 1 (North Gate)
    status = Column(String(32), default="OPERATIONAL")  # OPERATIONAL, BREAKDOWN, SLOW
    current_delay_minutes = Column(Integer, default=0)

    mandi = relationship("Mandi", back_populates="weighbridges")


class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(32), unique=True, index=True)
    name = Column(String(128), nullable=False)
    village = Column(String(128), default="Rampur")
    land_holding_acres = Column(Float, default=3.5)
    kisan_id = Column(String(64), unique=True, default=lambda: f"KISAN-{uuid.uuid4().hex[:8].upper()}")

    bookings = relationship("SlotBooking", back_populates="farmer")


class SlotBooking(Base):
    __tablename__ = "slot_bookings"

    id = Column(Integer, primary_key=True, index=True)
    token_number = Column(String(64), unique=True, index=True)
    mandi_id = Column(Integer, ForeignKey("mandis.id"))
    farmer_id = Column(Integer, ForeignKey("farmers.id"), nullable=True)

    farmer_name = Column(String(128), nullable=False)
    farmer_phone = Column(String(32), nullable=False, index=True)
    village = Column(String(128), default="Rampur")
    crop = Column(String(64), nullable=False)  # Wheat, Mustard, Paddy, etc.
    quantity_quintals = Column(Float, nullable=False)
    vehicle_type = Column(String(64), default="Tractor-Trolley")  # Tractor-Trolley, Mini-Truck, Cart

    lane_type = Column(String(32), default="EXPRESS")  # EXPRESS (80%), STANDBY (20% walk-in)
    scheduled_date = Column(String(32), nullable=False)  # YYYY-MM-DD
    scheduled_window_start = Column(String(32), nullable=False)  # HH:MM
    scheduled_window_end = Column(String(32), nullable=False)    # HH:MM
    bay_assigned = Column(Integer, default=1)

    # Dynamic delay shift
    delay_offset_minutes = Column(Integer, default=0)
    revised_window_start = Column(String(32), nullable=True)
    revised_window_end = Column(String(32), nullable=True)

    # Lifecycle state
    status = Column(String(32), default="SCHEDULED", index=True)
    # SCHEDULED -> GATE_ENTRY -> QUALITY_ASSAY -> WEIGHED -> PAYMENT_DISBURSED / CANCELLED

    # Verification & security
    totp_secret = Column(String(64), nullable=False)
    price_lock_timestamp = Column(String(64), nullable=False)
    price_lock_rate = Column(Float, default=2275.0)  # MSP ₹/quintal
    price_lock_hash = Column(String(128), nullable=False)

    moisture_percentage = Column(Float, nullable=True)
    gross_weight_quintals = Column(Float, nullable=True)
    tare_weight_quintals = Column(Float, nullable=True)
    net_weight_quintals = Column(Float, nullable=True)

    payment_status = Column(String(32), default="PENDING")
    payment_amount = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    mandi = relationship("Mandi", back_populates="bookings")
    farmer = relationship("Farmer", back_populates="bookings")

    def compute_hash(self) -> str:
        payload = f"{self.token_number}:{self.farmer_phone}:{self.crop}:{self.price_lock_rate}:{self.price_lock_timestamp}"
        return hashlib.sha256(payload.encode()).hexdigest()[:24].upper()


class DisruptionIncident(Base):
    __tablename__ = "disruption_incidents"

    id = Column(Integer, primary_key=True, index=True)
    mandi_id = Column(Integer, ForeignKey("mandis.id"))
    bay_id = Column(Integer, nullable=True)  # 1, 2 or None for whole mandi
    incident_type = Column(String(64), nullable=False)
    # WEIGHBRIDGE_BREAKDOWN, RAIN_ALERT, ASSAY_BACKLOG, UNLOADING_CONGESTION
    description = Column(Text, nullable=True)
    delay_minutes = Column(Integer, default=45)
    is_active = Column(Boolean, default=True)
    affected_farmers_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    mandi = relationship("Mandi", back_populates="incidents")


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("slot_bookings.id"), nullable=True)
    recipient_phone = Column(String(32), nullable=False)
    farmer_name = Column(String(128), nullable=False)
    channel = Column(String(32), default="WHATSAPP")  # WHATSAPP, SMS
    message_type = Column(String(64), default="BOOKING_CONFIRMATION")  # BOOKING_CONFIRMATION, DELAY_ALERT, GATE_CALL, PAYMENT_RECEIPT
    message_body = Column(Text, nullable=False)
    status = Column(String(32), default="SENT")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
