"""
Outbound WhatsApp messages (proactive delay alerts), separate from the
inbound-reply path in main.py because it has a real, documented failure
mode the plan doc didn't account for: Twilio/WhatsApp only allows free-form
outbound messages within a 24-hour window of the farmer's last inbound
message (Twilio error 63016). Outside that window you need a pre-approved
Message Template instead.

For the live demo this is a non-issue — the test farmer just messaged
seconds ago. At real scale it is not: a farmer who booked Monday for a
Thursday slot is long outside the window by the time Thursday's breakdown
happens. This module does not solve that (fixing it means Meta template
approval, a business process, not a code change) — but it logs the
distinction clearly instead of pretending a freeform send always works, so
this known limit surfaces in testing instead of on stage.
"""
import logging
from datetime import datetime, timedelta

from twilio.rest import Client

from app.config import (
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM,
    WHATSAPP_SESSION_WINDOW_HOURS,
)

logger = logging.getLogger("mandi_bot.twilio")

_client = (
    Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
    else None
)


def within_session_window(last_inbound_at: datetime, now: datetime | None = None) -> bool:
    now = now or datetime.utcnow()
    return now - last_inbound_at < timedelta(hours=WHATSAPP_SESSION_WINDOW_HOURS)


def send_proactive_alert(to_phone: str, body: str, last_inbound_at: datetime) -> dict:
    """
    Sends a free-form outbound WhatsApp message. Returns a status dict
    instead of raising, so one farmer's send failure can't take down an
    incident blast to everyone else.
    """
    if not within_session_window(last_inbound_at):
        logger.warning(
            "Outside 24h session window for %s — Twilio will reject a "
            "freeform send (error 63016). Needs an approved Message "
            "Template in production; skipping in this demo build.",
            to_phone,
        )
        return {"to": to_phone, "sent": False, "reason": "outside_session_window"}

    if _client is None:
        logger.info("[DRY RUN, no Twilio credentials] would message %s: %s", to_phone, body)
        return {"to": to_phone, "sent": False, "reason": "no_twilio_credentials"}

    try:
        msg = _client.messages.create(from_=TWILIO_WHATSAPP_FROM, to=to_phone, body=body)
        return {"to": to_phone, "sent": True, "sid": msg.sid}
    except Exception as exc:  # noqa: BLE001 - surface any Twilio error per-recipient
        logger.exception("Failed to alert %s", to_phone)
        return {"to": to_phone, "sent": False, "reason": str(exc)}
