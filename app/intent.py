"""
Voice/text -> structured booking intent, plus the confirmation-loop safety
net.

This is the piece the uploaded plan named as a risk (Section 11:
"ASR/dialect failures") but never actually scheduled time to build. A
mistranscribed voice note in a loud hall silently producing a
wrong-but-confident booking is one of the more likely live-demo failures,
so instead of booking straight off the LLM's extraction, every voice/text
message is echoed back for a one-word confirmation before anything is
booked. It costs one extra message and buys back the single failure mode
most likely to embarrass the demo.

Two providers are used, both via Groq, so the whole pipeline depends on one
API key instead of stitching together Whisper + a separate LLM vendor.
"""
import json
import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from app.config import GROQ_API_KEY

try:
    from groq import Groq

    _client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
except ImportError:  # pragma: no cover - groq is in requirements.txt
    _client = None

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


@dataclass
class FarmerIntent:
    crop: str
    quantity_quintals: float
    vehicle: Optional[str]
    requested_date: date
    raw_text: str


class IntentParseError(Exception):
    pass


def transcribe_voice_note(media_url: str, auth: tuple[str, str]) -> str:
    """
    Downloads the Twilio media URL (needs Basic Auth — see README "Known
    limits") and transcribes it with Groq's Whisper endpoint.
    """
    if _client is None:
        raise IntentParseError("GROQ_API_KEY is not set — cannot transcribe audio.")

    import httpx

    resp = httpx.get(media_url, auth=auth, timeout=15.0)
    resp.raise_for_status()

    transcript = _client.audio.transcriptions.create(
        file=("note.ogg", resp.content),
        model="whisper-large-v3-turbo",
        response_format="text",
    )
    return str(transcript).strip()


def _resolve_relative_date(day_word: str, today: date) -> date:
    day_word = day_word.lower().strip()
    if day_word in ("today",):
        return today
    if day_word in ("tomorrow",):
        return today + timedelta(days=1)
    if day_word in WEEKDAYS:
        target = WEEKDAYS.index(day_word)
        delta = (target - today.weekday()) % 7
        delta = delta or 7  # "thursday" said on a Thursday means next Thursday
        return today + timedelta(days=delta)
    return today


_INTENT_SYSTEM_PROMPT = """You extract a mandi procurement booking request from a
farmer's message (which may be a rough transcription with dialect spelling).
Today's date is {today}. Reply with ONLY a JSON object, no prose, matching:
{{"crop": string, "quantity_quintals": number, "vehicle": string or null,
"day_word": one of "today"|"tomorrow"|"monday".."sunday"}}
If a field truly cannot be determined, use your best reasonable guess rather
than failing — the farmer will be asked to confirm the result afterward."""


def _llm_extract(text: str, today: date) -> dict:
    if _client is None:
        raise IntentParseError("GROQ_API_KEY is not set — cannot run intent extraction.")

    completion = _client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": _INTENT_SYSTEM_PROMPT.format(today=today.isoformat())},
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    return json.loads(completion.choices[0].message.content)


_FALLBACK_QTY_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(?:quintal|qtl|q\b)", re.IGNORECASE)
_FALLBACK_CROPS = ["wheat", "paddy", "rice", "maize", "pulses", "gram", "mustard"]


def _rule_based_extract(text: str, today: date) -> dict:
    """
    Offline fallback so the pipeline is unit-testable and demoable without a
    live API key. Deliberately simple — this is a safety net for
    development, not a replacement for the LLM path.
    """
    lower = text.lower()
    qty_match = _FALLBACK_QTY_RE.search(lower)
    crop = next((c for c in _FALLBACK_CROPS if c in lower), "wheat")
    day_word = next((d for d in WEEKDAYS if d in lower), None) or (
        "tomorrow" if "tomorrow" in lower else "today"
    )
    return {
        "crop": crop,
        "quantity_quintals": float(qty_match.group(1)) if qty_match else 10.0,
        "vehicle": "tractor-trolley" if "tractor" in lower else None,
        "day_word": day_word,
    }


def parse_farmer_intent(text: str, today: Optional[date] = None) -> FarmerIntent:
    today = today or date.today()
    try:
        data = _llm_extract(text, today) if _client is not None else _rule_based_extract(text, today)
    except IntentParseError:
        data = _rule_based_extract(text, today)

    return FarmerIntent(
        crop=str(data.get("crop", "wheat")).title(),
        quantity_quintals=float(data.get("quantity_quintals", 10.0)),
        vehicle=data.get("vehicle"),
        requested_date=_resolve_relative_date(str(data.get("day_word", "today")), today),
        raw_text=text,
    )


def format_confirmation_prompt(intent: FarmerIntent) -> str:
    vehicle_part = f" via {intent.vehicle}" if intent.vehicle else ""
    return (
        f"Did we get this right?\n"
        f"{intent.quantity_quintals:g} quintals of {intent.crop}{vehicle_part}, "
        f"arriving {intent.requested_date.strftime('%A, %d %b')}.\n\n"
        f'Reply "1" to confirm, or send a new voice note / message to correct it.'
    )
