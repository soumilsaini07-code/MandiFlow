"""
End-to-end through the actual HTTP webhook (not just the internal
functions) — this is the exact request/response cycle Meta's Cloud API
will drive during the live demo, so it's the most important thing to have
proof of before standing on stage with it.

Meta's webhook has no inline-reply mechanism (unlike Twilio's TwiML), so
every reply is an active outbound call via app.whatsapp_client.send_reply.
With no WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID set in the test
environment, those calls run in dry-run mode (logged, not actually sent) —
so instead of asserting on the webhook's own response body, these tests
assert on the resulting server-side state (bookings created, confirmation
state stored).
"""
import os
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_webhook.db")

# The line above points every test in this module at a real file on disk
# (not :memory:) so the FastAPI TestClient's separate startup/shutdown per
# `with TestClient(app)` block still shares one consistent schema. But that
# means the file survives between separate `pytest` invocations too — without
# this cleanup, bookings from a previous run pile up and these tests start
# failing with "assert 2 == 1" (or worse) even though nothing is actually
# broken. Delete any leftover file before app.main (and therefore app.db's
# engine) is imported, so every run starts from a clean, empty database.
_stale_db = Path(__file__).resolve().parent.parent / "test_webhook.db"
if _stale_db.exists():
    _stale_db.unlink()

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def _text_message_payload(from_phone: str, body: str, msg_id: str = "wamid.test1") -> dict:
    """Builds a minimal Meta Cloud API inbound-text webhook payload."""
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


def test_full_booking_conversation():
    with TestClient(app) as client:
        phone = "919999900001"

        # 1) Farmer sends a text booking request.
        r1 = client.post(
            "/webhook/whatsapp",
            json=_text_message_payload(phone, "40 quintal wheat tomorrow", "wamid.1"),
        )
        assert r1.status_code == 200

        # 2) Farmer confirms.
        r2 = client.post(
            "/webhook/whatsapp",
            json=_text_message_payload(phone, "1", "wamid.2"),
        )
        assert r2.status_code == 200

        # 3) It shows up in the admin listing.
        r3 = client.get("/admin/bookings")
        assert r3.status_code == 200
        bookings = [b for b in r3.json() if b["phone"] == phone]
        assert len(bookings) == 1
        assert bookings[0]["token"].startswith("TKN-")
        assert bookings[0]["quantity_quintals"] == 40


def test_correction_reparses_instead_of_booking_wrong_data():
    with TestClient(app) as client:
        phone = "919999900002"

        r1 = client.post(
            "/webhook/whatsapp",
            json=_text_message_payload(phone, "10 quintal maize today", "wamid.3"),
        )
        assert r1.status_code == 200

        # Farmer doesn't confirm — sends a correction instead.
        r2 = client.post(
            "/webhook/whatsapp",
            json=_text_message_payload(phone, "sorry I meant 25 quintal maize", "wamid.4"),
        )
        assert r2.status_code == 200

        # Confirm the corrected amount.
        r3 = client.post(
            "/webhook/whatsapp",
            json=_text_message_payload(phone, "1", "wamid.5"),
        )
        assert r3.status_code == 200

        r4 = client.get("/admin/bookings")
        bookings = [b for b in r4.json() if b["phone"] == phone]
        assert len(bookings) == 1
        assert bookings[0]["quantity_quintals"] == 25


def test_webhook_verification_handshake():
    with TestClient(app) as client:
        from app.config import WHATSAPP_VERIFY_TOKEN

        r = client.get(
            "/webhook/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": WHATSAPP_VERIFY_TOKEN,
                "hub.challenge": "12345",
            },
        )
        assert r.status_code == 200
        assert r.text == "12345"


def test_webhook_verification_rejects_wrong_token():
    with TestClient(app) as client:
        r = client.get(
            "/webhook/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "wrong-token",
                "hub.challenge": "12345",
            },
        )
        assert r.status_code == 403
