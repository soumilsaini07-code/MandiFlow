"""
End-to-end through the actual HTTP webhook (not just the internal
functions) — this is the exact request/response cycle Twilio will drive
during the live demo, so it's the most important thing to have proof of
before standing on stage with it.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_webhook.db")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_full_booking_conversation():
    with TestClient(app) as client:
        phone = "whatsapp:+919999900001"

        # 1) Farmer sends a text booking request.
        r1 = client.post(
            "/webhook/whatsapp",
            data={"Body": "40 quintal wheat tomorrow", "From": phone},
        )
        assert r1.status_code == 200
        assert "Did we get this right" in r1.text
        assert "40" in r1.text

        # 2) Farmer confirms.
        r2 = client.post("/webhook/whatsapp", data={"Body": "1", "From": phone})
        assert r2.status_code == 200
        assert "Booked! Token TKN-" in r2.text

        # 3) It shows up in the admin listing.
        r3 = client.get("/admin/bookings")
        assert r3.status_code == 200
        tokens = [b["token"] for b in r3.json()]
        assert any(t in r2.text for t in tokens)


def test_correction_reparses_instead_of_booking_wrong_data():
    with TestClient(app) as client:
        phone = "whatsapp:+919999900002"

        r1 = client.post(
            "/webhook/whatsapp", data={"Body": "10 quintal maize today", "From": phone}
        )
        assert "10" in r1.text

        # Farmer doesn't confirm — sends a correction instead.
        r2 = client.post(
            "/webhook/whatsapp",
            data={"Body": "sorry I meant 25 quintal maize", "From": phone},
        )
        assert "Did we get this right" in r2.text
        assert "25" in r2.text
