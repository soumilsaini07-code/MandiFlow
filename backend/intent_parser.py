import os
import re
import json
import datetime
from typing import Dict, Any, Optional
import requests
from dotenv import load_dotenv

from mandi_data_service import get_crop_msp

# Load environment variables
load_dotenv()

CROP_SYNONYMS = {
    "wheat": ["wheat", "gehu", "gehoon", "kanak", "gehun", "गेहूं", "गेंहू"],
    "mustard": ["mustard", "sarso", "sarson", "rai", "toria", "सरसों"],
    "paddy": ["paddy", "dhan", "rice", "chawal", "धान", "चावल"],
    "bajra": ["bajra", "pearl millet", "cumbu", "बाजरा"],
    "maize": ["corn", "maize", "makka", "makki", "मक्का"],
    "cotton": ["cotton", "kapas", "narma", "कपास", "नरमा"],
    "gram": ["gram", "bengal gram", "chana", "chole", "चना"],
    "moong": ["moong", "green gram", "मूंग"],
    "urd": ["urd", "black gram", "urad", "उड़द"],
    "masur": ["masur", "lentil", "मसूर"],
    "soyabean": ["soyabean", "soybean", "सोयाबीन"],
    "groundnut": ["groundnut", "peanut", "moongfali", "मूंगफली"],
    "barley": ["barley", "jau", "जौ"],
    "jowar": ["jowar", "sorghum", "ज्वार"]
}

VEHICLE_PATTERNS = {
    "Tractor-Trolley": ["tractor", "trolley", "trali", "traali", "ट्रैक्टर", "ट्राली"],
    "Mini-Truck": ["mini truck", "pickup", "bolero", "chota hathi", "camper", "छोटा हाथी", "पिकअप"],
    "Truck": ["truck", "lorry", "10 wheeler", "6 wheeler", "ट्रक"],
    "Bullock Cart": ["cart", "bailgadi", "bail gadi", "बैलगाड़ी"]
}

VILLAGE_EXAMPLES = [
    "Rampur", "Nilokheri", "Taraori", "Indri", "Gharaunda", 
    "Assandh", "Kunjpura", "Nissing", "Karnal", "Samalkha"
]

def normalize_crop_name(raw_crop: str) -> str:
    """Normalizes any dialect or informal crop name to official title"""
    lowered = (raw_crop or "").strip().lower()
    for crop_key, synonyms in CROP_SYNONYMS.items():
        if any(syn in lowered for syn in synonyms):
            return crop_key.capitalize()
    return raw_crop.capitalize() if raw_crop else "Wheat"

def parse_with_llm(text: str) -> Optional[Dict[str, Any]]:
    """
    Calls Groq (or Gemini) API using structured JSON output to extract entities.
    Returns None on missing API key, timeout, parsing error, or exception.
    """
    groq_api_key = os.getenv("GROQ_API_KEY")
    gemini_api_key = os.getenv("GEMINI_API_KEY")

    if not groq_api_key and not gemini_api_key:
        return None

    today_str = datetime.date.today().strftime("%Y-%m-%d")
    tomorrow_str = (datetime.date.today() + datetime.timedelta(days=1)).strftime("%Y-%m-%d")

    system_prompt = (
        "You are an AI agricultural procurement assistant for MandiFlow, an Indian APMC grain mandi platform. "
        "Extract arrival scheduling details from Hindi, Hinglish, or English farmer messages. "
        f"Today's date is {today_str}. If farmer says 'kal' or 'tomorrow', use {tomorrow_str}. "
        "Respond ONLY with a valid JSON object matching this schema:\n"
        "{\n"
        '  "farmer_name": "str (e.g. Sardar Gurpreet Singh, or Kisan Bandhu if unspecified)",\n'
        '  "village": "str (e.g. Rampur, Taraori, or Rampur if unspecified)",\n'
        '  "crop": "str (Wheat, Mustard, Paddy, Bajra, Maize, Gram, Cotton, etc.)",\n'
        '  "quantity_quintals": float (convert tons to quintals by *10, trolley to 40, bags to 0.5),\n'
        '  "vehicle_type": "str (Tractor-Trolley, Mini-Truck, Truck, or Bullock Cart)",\n'
        '  "preferred_date": "YYYY-MM-DD",\n'
        '  "preferred_time_window": "HH:00 (between 08:00 and 17:00, default 09:00)"\n'
        "}\n"
        "Do not include any explanation or markdown wrapping, output raw JSON only."
    )

    # 1. Try Groq API first
    if groq_api_key:
        candidate_models = [
            os.getenv("GROQ_MODEL"),
            "groq/compound-mini",
            "openai/gpt-oss-20b",
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant"
        ]
        # remove None and retain order
        seen = set()
        models_to_try = [m for m in candidate_models if m and not (m in seen or seen.add(m))]

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {groq_api_key}",
            "Content-Type": "application/json"
        }

        for model_name in models_to_try:
            try:
                body = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                    "max_tokens": 512
                }
                res = requests.post(url, headers=headers, json=body, timeout=4.5)
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    # Strip any markdown fences
                    if content.startswith("```"):
                        lines = content.splitlines()
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].startswith("```"):
                            lines = lines[:-1]
                        content = "\n".join(lines).strip()
                    
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and "crop" in parsed:
                        return parsed
            except Exception:
                continue

    # 2. Try Gemini API if available
    if gemini_api_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_api_key}"
            headers = {"Content-Type": "application/json"}
            body = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{system_prompt}\n\nFarmer Message: {text}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "response_mime_type": "application/json",
                    "temperature": 0.1
                }
            }
            res = requests.post(url, headers=headers, json=body, timeout=4.5)
            if res.status_code == 200:
                data = res.json()
                content = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(content)
                if isinstance(parsed, dict) and "crop" in parsed:
                    return parsed
        except Exception:
            pass

    return None

def parse_farmer_intent(text: str, caller_phone: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses Hindi, Hinglish, or English farmer utterances into structured JSON.
    Tries the real LLM path first (Groq/Gemini); on failure or missing keys,
    gracefully falls back to high-speed regex matching for zero-latency demo safety.
    """
    cleaned = text.strip()
    lowered = cleaned.lower()

    # Step A: Attempt Real LLM Extraction First
    llm_extracted = parse_with_llm(cleaned)
    if llm_extracted:
        crop = normalize_crop_name(llm_extracted.get("crop", "Wheat"))
        msp_price = get_crop_msp(crop)
        try:
            qty = float(llm_extracted.get("quantity_quintals", 40.0))
        except (ValueError, TypeError):
            qty = 40.0

        return {
            "farmer_name": llm_extracted.get("farmer_name") or "Kisan Bandhu",
            "farmer_phone": caller_phone or "+919812345678",
            "village": llm_extracted.get("village") or "Rampur",
            "crop": crop,
            "quantity_quintals": round(qty, 1),
            "vehicle_type": llm_extracted.get("vehicle_type") or "Tractor-Trolley",
            "preferred_date": llm_extracted.get("preferred_date") or datetime.date.today().strftime("%Y-%m-%d"),
            "preferred_time_window": llm_extracted.get("preferred_time_window") or "09:00",
            "price_lock_rate": msp_price,
            "confidence": 0.96,
            "source": "LLM_STRUCTURED_OUTPUT",
            "raw_text": cleaned
        }

    # Step B: Deterministic Regex/Keyword Fallback (Demo-Safe)
    # 1. Detect Crop
    detected_crop = "Wheat"
    matched_crop_key = "wheat"
    for crop_key, synonyms in CROP_SYNONYMS.items():
        if any(syn in lowered for syn in synonyms):
            detected_crop = crop_key.capitalize()
            matched_crop_key = crop_key
            break

    # 2. Detect Quantity (quintals)
    quantity = 40.0  # default realistic smallholder trolley load
    qty_patterns = [
        r'(\d+(?:\.\d+)?)\s*(?:quintal|kintal|kvintal|kuntal|क्विंटल|qtl|qtls)',
        r'(\d+(?:\.\d+)?)\s*(?:ton|tonne|टन)',
        r'(\d+(?:\.\d+)?)\s*(?:bori|bag|बोरी)',
        r'(\d+(?:\.\d+)?)\s*(?:trolley|trolleys|ट्राली)'
    ]
    
    qty_match = None
    for pattern in qty_patterns:
        m = re.search(pattern, lowered)
        if m:
            val = float(m.group(1))
            if "ton" in pattern:
                val = val * 10.0  # 1 ton = 10 quintals
            elif "bori" in pattern:
                val = val * 0.5   # 1 bag ~ 50kg = 0.5 quintal
            elif "trolley" in pattern:
                val = val * 40.0  # 1 trolley ~ 40 quintals
            quantity = val
            qty_match = True
            break

    if not qty_match:
        digits = re.findall(r'\b(\d{1,3})\b', lowered)
        if digits:
            for d in digits:
                num = float(d)
                if 5 <= num <= 400:
                    quantity = num
                    break

    # 3. Detect Vehicle
    detected_vehicle = "Tractor-Trolley"
    for v_type, syns in VEHICLE_PATTERNS.items():
        if any(syn in lowered for syn in syns):
            detected_vehicle = v_type
            break

    # 4. Detect Village
    detected_village = "Rampur"
    for v in VILLAGE_EXAMPLES:
        if v.lower() in lowered:
            detected_village = v
            break
    village_regex = re.search(r'(?:from|se|gaav|gaon|village)\s+([a-zA-Z]+)', cleaned, re.IGNORECASE)
    if village_regex and village_regex.group(1).lower() not in ["tractor", "kal", "aaj", "gehu", "wheat", "quintal"]:
        detected_village = village_regex.group(1).capitalize()

    # 5. Detect Farmer Name
    farmer_name = "Kisan Ramesh Kumar"
    name_patterns = [
        r'(?:naam|name\s+is|kisan)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)',
        r'mera\s+naam\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)'
    ]
    for np in name_patterns:
        nm = re.search(np, cleaned, re.IGNORECASE)
        if nm and nm.group(1).lower() not in ["gehu", "wheat", "rampur", "tractor"]:
            farmer_name = nm.group(1).title()
            break

    # 6. Detect Preferred Date & Time
    today = datetime.date.today()
    target_date = today
    if any(w in lowered for w in ["kal", "tomorrow", "next day", "कल"]):
        target_date = today + datetime.timedelta(days=1)
    elif any(w in lowered for w in ["parso", "day after tomorrow", "परसों"]):
        target_date = today + datetime.timedelta(days=2)
    elif "thursday" in lowered:
        target_date = today + datetime.timedelta(days=1)

    preferred_hour = 9  # default 09:00 AM
    time_match = re.search(r'(\d{1,2})\s*(?:baje|am|pm|o\'clock|बजे)', lowered)
    if time_match:
        val = int(time_match.group(1))
        if "pm" in lowered and val < 12:
            val += 12
        if 8 <= val <= 17:
            preferred_hour = val
    elif any(w in lowered for w in ["subah", "morning", "सुबह"]):
        preferred_hour = 9
    elif any(w in lowered for w in ["dopahar", "afternoon", "दोपहर"]):
        preferred_hour = 14
    elif any(w in lowered for w in ["shaam", "evening", "शाम"]):
        preferred_hour = 16

    preferred_time_str = f"{preferred_hour:02d}:00"
    msp_price = get_crop_msp(detected_crop)

    confidence = 0.92 if qty_match else 0.78

    return {
        "farmer_name": farmer_name,
        "farmer_phone": caller_phone or "+919812345678",
        "village": detected_village,
        "crop": detected_crop,
        "quantity_quintals": round(quantity, 1),
        "vehicle_type": detected_vehicle,
        "preferred_date": target_date.strftime("%Y-%m-%d"),
        "preferred_time_window": preferred_time_str,
        "price_lock_rate": msp_price,
        "confidence": confidence,
        "source": "REGEX_KEYWORD_FALLBACK",
        "raw_text": cleaned
    }
