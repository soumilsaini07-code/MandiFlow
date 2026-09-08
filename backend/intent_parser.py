import re
import datetime
from typing import Dict, Any, Optional
from mandi_data_service import get_crop_msp

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

def parse_farmer_intent(text: str, caller_phone: Optional[str] = None) -> Dict[str, Any]:
    """
    Parses Hindi, Hinglish, or English farmer utterances into structured JSON:
    {
      "farmer_name": str,
      "village": str,
      "crop": str,
      "quantity_quintals": float,
      "vehicle_type": str,
      "preferred_date": str (YYYY-MM-DD),
      "preferred_time_window": str (HH:MM),
      "price_lock_rate": float,
      "confidence": float,
      "raw_text": str
    }
    """
    cleaned = text.strip()
    lowered = cleaned.lower()

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
            # pick first plausible quantity digit (between 5 and 500)
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

    # 5. Detect Farmer Name (if mentioned: e.g. "Kisan Ramesh Sharma", "Mera naam Ramesh hai")
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
        "raw_text": cleaned
    }
