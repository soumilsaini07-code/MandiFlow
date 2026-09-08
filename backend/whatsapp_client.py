"""
Outbound WhatsApp messages via Meta's WhatsApp Cloud API (Graph API).
Supports both direct replies to inbound messages and proactive delay alerts.
Gracefully operates in dry-run mode when Meta credentials are not configured.
"""
import os
import re
import logging
from datetime import datetime, timedelta
from typing import Optional
import requests

logger = logging.getLogger("mandiflow.whatsapp")

WHATSAPP_ACCESS_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "").strip()
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "mandi-verify-token").strip()
WHATSAPP_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v20.0").strip()
WHATSAPP_SESSION_WINDOW_HOURS = int(os.getenv("WHATSAPP_SESSION_WINDOW_HOURS", "24"))

_GRAPH_BASE = "https://graph.facebook.com"


def clean_phone_number(phone: str) -> str:
    """
    Cleans phone number for Meta Graph API.
    Removes 'whatsapp:', '+', spaces, dashes, parentheses.
    E.g., '+91 98123-45678' -> '919812345678'
    """
    cleaned = re.sub(r"[^\d]", "", phone.replace("whatsapp:", ""))
    if len(cleaned) == 10:
        cleaned = "91" + cleaned
    return cleaned


def within_session_window(last_inbound_at: datetime, now: Optional[datetime] = None) -> bool:
    now = now or datetime.utcnow()
    return now - last_inbound_at < timedelta(hours=WHATSAPP_SESSION_WINDOW_HOURS)


def send_reply(to_phone: str, body: str) -> dict:
    """
    Sends an active outbound reply to a WhatsApp user via Meta Cloud API.
    If credentials are not set, logs as a dry-run and returns success status.
    """
    clean_to = clean_phone_number(to_phone)
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", WHATSAPP_ACCESS_TOKEN)
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", WHATSAPP_PHONE_NUMBER_ID)
    version = os.getenv("WHATSAPP_API_VERSION", WHATSAPP_API_VERSION)

    if not token or not phone_id:
        logger.info("[DRY RUN, no Meta WhatsApp credentials] message to %s: %s", clean_to, body)
        return {"to": clean_to, "sent": False, "reason": "no_whatsapp_credentials"}

    url = f"{_GRAPH_BASE}/{version}/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": clean_to,
        "type": "text",
        "text": {"body": body},
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        msg_id = data.get("messages", [{}])[0].get("id")
        logger.info("Successfully sent WhatsApp message to %s (id=%s)", clean_to, msg_id)
        return {"to": clean_to, "sent": True, "id": msg_id}
    except Exception as exc:
        logger.exception("Failed to send WhatsApp message to %s: %s", clean_to, exc)
        return {"to": clean_to, "sent": False, "reason": str(exc)}


def send_proactive_alert(to_phone: str, body: str, last_inbound_at: Optional[datetime] = None) -> dict:
    """
    Sends a proactive delay or disruption alert to the farmer over WhatsApp.
    Enforces the 24-hour Meta free-form messaging window if last_inbound_at is provided.
    """
    if last_inbound_at and not within_session_window(last_inbound_at):
        logger.warning(
            "Outside 24h session window for %s — Meta requires approved template outside window.",
            to_phone
        )
        return {"to": to_phone, "sent": False, "reason": "outside_session_window"}

    return send_reply(to_phone, body)
