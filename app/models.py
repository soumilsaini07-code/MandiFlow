"""
SQLModel tables.

Booking is the source of truth for "who has a slot." ConversationState is
what makes the confirmation loop possible — WhatsApp is stateless per
message, so we have to remember "we just asked this phone number to
confirm 40 quintals of wheat" between one inbound message and the next.
"""
from datetime import datetime, date
from typing import Optional

from sqlmodel import SQLModel, Field


class Booking(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    token: str = Field(index=True, unique=True)

    farmer_phone: str = Field(index=True)  # e.g. "whatsapp:+91..."
    crop: str
    quantity_quintals: float
    vehicle: Optional[str] = None

    slot_date: date = Field(index=True)
    slot_hour: int  # 24h clock, start of the 1-hour window

    status: str = Field(default="confirmed")  # confirmed | cancelled
    delay_minutes: int = Field(default=0)  # cumulative, from incidents

    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_inbound_at: datetime = Field(default_factory=datetime.utcnow)


class ConversationState(SQLModel, table=True):
    phone: str = Field(primary_key=True)
    state: str = Field(default="idle")  # idle | awaiting_confirmation
    pending_intent_json: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Incident(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    mandi_id: str
    reason: str
    delay_minutes: int
    affects_from_hour: int  # every booking at/after this hour today is pushed
    created_at: datetime = Field(default_factory=datetime.utcnow)
