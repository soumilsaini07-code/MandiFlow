import os
import csv
from typing import Dict, Any, List, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
MARKET_CSV = os.path.join(DATA_DIR, "Market_Wise_Price_Arrival_08-09-2026_06-59-33_PM.csv")
SEASON_CSV = os.path.join(DATA_DIR, "Crop_Season_Wise_Price_Arrival_08-09-2026_07-00-01_PM.csv")

# Dynamic cache
MARKET_DATA_CACHE: Dict[str, Any] = {}
MSP_DICTIONARY: Dict[str, float] = {
    # Default fallbacks from 2026-27 government data
    "Wheat": 2585.0,
    "Mustard": 6200.0,
    "Paddy": 2441.0,
    "Bajra": 2900.0,
    "Maize": 2410.0,
    "Cotton": 8267.0,
    "Gram": 5875.0,
    "Moong": 8780.0,
    "Urd": 8200.0,
    "Masur": 7000.0,
    "Soyabean": 5708.0,
    "Groundnut": 7517.0,
    "Barley": 2150.0,
    "Jowar": 4023.0
}

def clean_float(val: str) -> Optional[float]:
    if not val or val.strip() in ["-", "", "NA", "null"]:
        return None
    try:
        return float(val.replace(",", "").strip())
    except Exception:
        return None

def normalize_crop_name(name: str) -> str:
    cleaned = name.lower()
    if "wheat" in cleaned or "gehu" in cleaned or "gehoon" in cleaned:
        return "Wheat"
    if "mustard" in cleaned or "sarso" in cleaned or "sarson" in cleaned or "rai" in cleaned:
        return "Mustard"
    if "paddy" in cleaned or "dhan" in cleaned or "rice" in cleaned:
        return "Paddy"
    if "bajra" in cleaned:
        return "Bajra"
    if "maize" in cleaned or "corn" in cleaned or "makka" in cleaned:
        return "Maize"
    if "cotton" in cleaned or "kapas" in cleaned or "narma" in cleaned:
        return "Cotton"
    if "bengal gram" in cleaned or "gram" in cleaned or "chana" in cleaned:
        return "Gram"
    if "green gram" in cleaned or "moong" in cleaned:
        return "Moong"
    if "black gram" in cleaned or "urd" in cleaned:
        return "Urd"
    if "lentil" in cleaned or "masur" in cleaned:
        return "Masur"
    if "soyabean" in cleaned:
        return "Soyabean"
    if "groundnut" in cleaned:
        return "Groundnut"
    if "barley" in cleaned or "jau" in cleaned:
        return "Barley"
    if "jowar" in cleaned:
        return "Jowar"
    if "onion" in cleaned:
        return "Onion"
    if "potato" in cleaned:
        return "Potato"
    if "tomato" in cleaned:
        return "Tomato"
    return name.split("(")[0].strip().capitalize()

def load_market_data() -> Dict[str, Any]:
    global MSP_DICTIONARY, MARKET_DATA_CACHE

    commodities = []

    # 1. Parse Market Wise CSV (has 3-day trend + 2026-27 MSP)
    if os.path.exists(MARKET_CSV):
        try:
            with open(MARKET_CSV, "r", encoding="utf-8-sig", errors="ignore") as f:
                reader = csv.reader(f)
                lines = list(reader)
                
                # Header starts at row 3 (0-indexed: index 2)
                # Commodity Group,Commodity,MSP (Rs./Quintal) 2026-27,Price on 06 Sep...,Price on 05 Sep...,Price on 04 Sep...,Arrival on 06 Sep...
                for row in lines[3:]:
                    if not row or len(row) < 3:
                        continue
                    group = row[0].strip() if len(row) > 0 else ""
                    raw_commodity = row[1].strip() if len(row) > 1 else ""
                    if not raw_commodity:
                        continue

                    msp = clean_float(row[2]) if len(row) > 2 else None
                    p_06 = clean_float(row[3]) if len(row) > 3 else None
                    p_05 = clean_float(row[4]) if len(row) > 4 else None
                    p_04 = clean_float(row[5]) if len(row) > 5 else None
                    arr_06 = clean_float(row[6]) if len(row) > 6 else 0.0
                    arr_05 = clean_float(row[7]) if len(row) > 7 else 0.0
                    arr_04 = clean_float(row[8]) if len(row) > 8 else 0.0

                    norm_name = normalize_crop_name(raw_commodity)
                    if msp:
                        MSP_DICTIONARY[norm_name] = msp

                    latest_price = p_06 or p_05 or p_04 or msp or 0.0
                    
                    # Calculate distress selling delta
                    # If market price is significantly lower than MSP, farmers risk distress selling
                    distress_risk = "LOW"
                    loss_avoided_per_qtl = 0.0
                    if msp and latest_price and latest_price < msp:
                        loss_avoided_per_qtl = round(msp - latest_price, 2)
                        distress_risk = "HIGH" if loss_avoided_per_qtl > 200 else "MEDIUM"

                    commodities.append({
                        "group": group,
                        "raw_name": raw_commodity,
                        "normalized_name": norm_name,
                        "msp_rate": msp,
                        "price_sep06": p_06,
                        "price_sep05": p_05,
                        "price_sep04": p_04,
                        "latest_price": latest_price,
                        "arrival_sep06_mt": arr_06,
                        "arrival_sep05_mt": arr_05,
                        "arrival_sep04_mt": arr_04,
                        "distress_risk": distress_risk,
                        "distress_loss_avoided_per_qtl": loss_avoided_per_qtl
                    })
        except Exception as e:
            print(f"Error loading {MARKET_CSV}: {e}")

    MARKET_DATA_CACHE = {
        "report_title": "Official Government APMC Market-Wise Price & Arrival Report (2026-27)",
        "source": "Agmarknet / Ministry of Agriculture (Imported 08-09-2026)",
        "total_commodities": len(commodities),
        "msp_map": MSP_DICTIONARY,
        "commodities": commodities
    }
    return MARKET_DATA_CACHE

def get_crop_msp(crop_name: str) -> float:
    """Returns official 2026-27 MSP rate from CSV"""
    if not MARKET_DATA_CACHE:
        load_market_data()
    norm = normalize_crop_name(crop_name)
    return MSP_DICTIONARY.get(norm, MSP_DICTIONARY.get("Wheat", 2585.0))

def get_market_intelligence() -> Dict[str, Any]:
    if not MARKET_DATA_CACHE:
        load_market_data()
    return MARKET_DATA_CACHE

# Load on module import
load_market_data()
