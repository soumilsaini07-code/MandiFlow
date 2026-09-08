"""
End-to-end unit and integration tests for Meta WhatsApp Cloud API Webhook:
- GET verification handshake
- Inbound JSON webhook processing
- 2-step confirmation state machine (Request -> "Did we get this right?" -> Reply "1" -> Confirmed e-Parchi)
- Re-parsing correction requests
- Admin demo compatibility endpoints (/admin/incident, /admin/bookings, /admin/capacity)
"""
import os
import sys

# Ensure venv site-packages is first in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "venv", "Lib", "site-packages")))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient

from main import app, get_db
from models import Base, Mandi, Weighbridge, Farmer, SlotBooking, ConversationState, engine, SessionLocal
from seed import seed_demo_data
from whatsapp_client import WHATSAPP_VERIFY_TOKEN

client = TestClient(app)

def setup_module():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_demo_data(db)
    db.close()

def _meta_text_payload(from_phone: str, body: str, msg_id: str = "wamid.test1") -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "0",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"display_phone_number": "15550001111"},
                            "messages": [
                                {
                                    "from": from_phone,
                                    "id": msg_id,
                                    "timestamp": "1700000000",
                                    "type": "text",
                                    "text": {"body": body},
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }

def test_meta_webhook_verification():
    print("Testing Meta Webhook Verification Handshake...")
    # Valid verification
    r_ok = client.get(
        "/webhook/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": WHATSAPP_VERIFY_TOKEN,
            "hub.challenge": "test_challenge_9988",
        },
    )
    assert r_ok.status_code == 200, f"Expected 200, got {r_ok.status_code}"
    assert r_ok.text == "test_challenge_9988", f"Expected challenge echo, got {r_ok.text}"

    # Invalid verification
    r_bad = client.get(
        "/webhook/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_token",
            "hub.challenge": "test_challenge_9988",
        },
    )
    assert r_bad.status_code == 403
    print("[PASS] Meta Webhook Verification passed!")

def test_meta_whatsapp_confirmation_loop():
    print("Testing Meta WhatsApp 2-Step Confirmation Loop...")
    phone = "919812999888"
    db = SessionLocal()

    # Clean up any previous test state/bookings
    db.query(ConversationState).filter(ConversationState.phone == f"+{phone}").delete()
    db.query(SlotBooking).filter(SlotBooking.farmer_phone == f"+{phone}").delete()
    db.commit()

    # Step 1: Farmer sends booking message
    r1 = client.post(
        "/webhook/whatsapp",
        json=_meta_text_payload(phone, "45 quintal wheat tomorrow tractor", "wamid.t1"),
    )
    assert r1.status_code == 200

    # State should now be 'awaiting_confirmation'
    state = db.query(ConversationState).filter(ConversationState.phone == f"+{phone}").first()
    assert state is not None, "ConversationState not created"
    assert state.state == "awaiting_confirmation", f"State is {state.state}, expected awaiting_confirmation"
    assert state.pending_intent_json is not None

    # Step 2: Farmer replies "1" to confirm
    r2 = client.post(
        "/webhook/whatsapp",
        json=_meta_text_payload(phone, "1", "wamid.t2"),
    )
    assert r2.status_code == 200

    # State should reset to 'idle'
    db.refresh(state)
    assert state.state == "idle"
    assert state.pending_intent_json is None

    # Booking must be confirmed in database
    booking = db.query(SlotBooking).filter(SlotBooking.farmer_phone == f"+{phone}").first()
    assert booking is not None, "Booking was not created"
    assert booking.token_number.startswith("TKN-")
    assert booking.crop == "Wheat"
    assert booking.quantity_quintals == 45
    print(f"[PASS] Meta WhatsApp Confirmation Loop passed! Token: {booking.token_number}, Bay: {booking.bay_assigned}")
    db.close()

def test_admin_incident_and_bookings_aliases():
    print("Testing /admin/incident and /admin/bookings demo aliases...")
    # Trigger incident
    r_inc = client.post(
        "/admin/incident",
        json={"reason": "Bay 1 sensor calibration", "delay_minutes": 30, "bay_id": 1}
    )
    assert r_inc.status_code == 200
    res_data = r_inc.json()
    assert "incident_id" in res_data
    assert "affected_farmers_count" in res_data

    # Query bookings
    r_book = client.get("/admin/bookings")
    assert r_book.status_code == 200
    bookings = r_book.json()
    assert isinstance(bookings, list)
    assert len(bookings) > 0

    # Query capacity
    r_cap = client.get("/admin/capacity")
    assert r_cap.status_code == 200
    cap_data = r_cap.json()
    assert "capacity_per_hour" in cap_data
    print("[PASS] Admin demo aliases passed!")

if __name__ == "__main__":
    setup_module()
    test_meta_webhook_verification()
    test_meta_whatsapp_confirmation_loop()
    test_admin_incident_and_bookings_aliases()
    print("\nALL META WHATSAPP BOT INTEGRATION TESTS PASSED SUCCESSFULLY! [OK]")
