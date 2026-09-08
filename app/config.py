"""
Central config, loaded once from environment variables (see .env.example).
Everything that differs between a laptop demo and a real mandi deployment
lives here, not scattered through the code.
"""
import os

from dotenv import load_dotenv

load_dotenv()


def _int(name: str, default: int) -> int:
    val = os.getenv(name)
    return int(val) if val else default


TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

MANDI_ID = os.getenv("MANDI_ID", "mandi-1")
CAPACITY_PER_HOUR = _int("CAPACITY_PER_HOUR", 4)
DAY_START_HOUR = _int("DAY_START_HOUR", 9)
DAY_END_HOUR = _int("DAY_END_HOUR", 17)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./mandi.db")

# How long a farmer's own inbound message keeps an outbound "session" open
# for free-form WhatsApp replies (Twilio enforces this; see README "Known
# limits"). We use it to decide reply-vs-template, and to warn in logs
# rather than fail silently against a farmer who booked days ago.
WHATSAPP_SESSION_WINDOW_HOURS = 24
