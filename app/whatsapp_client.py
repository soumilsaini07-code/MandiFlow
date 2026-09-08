"""
Outbound WhatsApp messages via Meta's WhatsApp Cloud API (Graph API) —
separate from the inbound-reply path in main.py because it has a real,
documented failure mode the plan doc didn't account for: WhatsApp only
allows free-form outbound messages within a 24-hour window of the farmer's
last inbound message. Outside that window you need a pre-approved Message
Template instead.

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

import httpx

from app.config import (
    WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_API_VERSION,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_SESSION_WINDOW_HOURS,
)

logger = logging.getLogger("mandi_bot.whatsapp")

_GRAPH_BASE = "https://graph.facebook.com"


def within_session_window(last_inbound_at: datetime, now: datetime | None = None) -> bool:
    now = now or datetime.utcnow()
    return now - last_inbound_at < timedelta(hours=WHATSAPP_SESSION_WINDOW_HOURS)


def _send_text(to_phone: str, body: str) -> dict:
    """
    Low-level Graph API send. `to_phone` should be a bare E.164 number
    (e.g. "919999900001", no "whatsapp:" prefix — that was a Twilio-ism).
    """
    url = f"{_GRAPH_BASE}/{WHATSAPP_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": {"body": body},
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=15.0)
    resp.raise_for_status()
    return resp.json()


def send_reply(to_phone: str, body: str) -> dict:
    """
    Sends an active outbound reply to an inbound webhook message. Meta's
    Cloud API (unlike Twilio's TwiML) has no inline-reply mechanism — every
    reply, including the very next message in a conversation, is its own
    outbound API call. Callers should not raise on failure so one bad send
    can't break the whole webhook handler.
    """
    if not WHATSAPP_ACCESS_TOKEN or not WHATSAPP_PHONE_NUMBER_ID:
        logger.info("[DRY RUN, no Meta credentials] would message %s: %s", to_phone, body)
        return {"to": to_phone, "sent": False, "reason": "no_whatsapp_credentials"}
    try:
        result = _send_text(to_phone, body)
        return {"to": to_phone, "sent": True, "id": result.get("messages", [{}])[0].get("id")}
    except Exception as exc:  # noqa: BLE001 - surface any Graph API error per-recipient
        logger.exception("Failed to reply to %s", to_phone)
        return {"to": to_phone, "sent": False, "reason": str(exc)}


def send_proactive_alert(to_phone: str, body: str, last_inbound_at: datetime) -> dict:
    """
    Sends a free-form outbound WhatsApp message (the incident/delay alert
    path). Returns a status dict instead of raising, so one farmer's send
    failure can't take down an incident blast to everyone else.
    """
    if not within_session_window(last_inbound_at):
        logger.warning(
            "Outside 24h session window for %s — Meta will reject a "
            "freeform send. Needs an approved Message Template in "
            "production; skipping in this demo build.",
            to_phone,
        )
        return {"to": to_phone, "sent": False, "reason": "outside_session_window"}

    return send_reply(to_phone, body)
