"""
No GROQ_API_KEY is available in this environment, so these exercise the
offline rule-based fallback — which is also what a contributor without an
API key configured yet will hit, so it needs to actually work, not just
exist as a stub.
"""
from datetime import date

from app.intent import format_confirmation_prompt, parse_farmer_intent


def test_extracts_quantity_and_crop_from_text():
    today = date(2026, 9, 14)  # a Monday
    intent = parse_farmer_intent("Bringing 40 quintals of wheat by tractor on Thursday", today=today)
    assert intent.crop == "Wheat"
    assert intent.quantity_quintals == 40.0
    assert intent.vehicle == "tractor-trolley"
    assert intent.requested_date == date(2026, 9, 17)  # the coming Thursday


def test_confirmation_prompt_is_human_readable():
    today = date(2026, 9, 14)
    intent = parse_farmer_intent("20 quintal paddy tomorrow", today=today)
    prompt = format_confirmation_prompt(intent)
    assert "20" in prompt
    assert "Paddy" in prompt
    assert 'Reply "1"' in prompt
