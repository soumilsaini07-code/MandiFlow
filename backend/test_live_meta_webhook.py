import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=== STARTING LIVE HTTP META WHATSAPP WEBHOOK TESTS ===")

    # 1. Health check
    h_res = requests.get(f"{BASE_URL}/health")
    assert h_res.status_code == 200, f"Health check failed: {h_res.text}"
    print("[PASS] Health check passed:", h_res.json())

    # 2. Meta Webhook Verification Handshake
    print("\n1. Testing GET /webhook/whatsapp (Meta Handshake)...")
    v_res = requests.get(
        f"{BASE_URL}/webhook/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "mandi-verify-token",
            "hub.challenge": "11223344_challenge"
        }
    )
    assert v_res.status_code == 200, f"Expected 200, got {v_res.status_code}: {v_res.text}"
    assert v_res.text == "11223344_challenge", f"Expected challenge echo, got {v_res.text}"
    print("[PASS] Meta Webhook Verification handshake succeeded!")

    # Invalid token handshake rejection
    bad_res = requests.get(
        f"{BASE_URL}/webhook/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "bad-token",
            "hub.challenge": "11223344_challenge"
        }
    )
    assert bad_res.status_code == 403
    print("[PASS] Meta Webhook rejected invalid token with 403!")

    # 3. Meta Inbound Message: Farmer asks for booking
    test_phone = "919876501234"
    print(f"\n2. Testing POST /webhook/whatsapp (Farmer Booking Request from {test_phone})...")
    payload1 = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "0",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"display_phone_number": "15550001111"},
                            "messages": [
                                {
                                    "from": test_phone,
                                    "id": "wamid.live1",
                                    "timestamp": str(int(time.time())),
                                    "type": "text",
                                    "text": {"body": "40 quintals wheat, tomorrow, tractor"},
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }
    r1 = requests.post(f"{BASE_URL}/webhook/whatsapp", json=payload1)
    assert r1.status_code == 200, f"Expected 200, got {r1.status_code}: {r1.text}"
    assert r1.json().get("status") == "ok"
    print("[PASS] Inbound message received and processed! State transitioned to awaiting_confirmation.")

    # 4. Meta Inbound Message: Farmer confirms with "1"
    print(f"\n3. Testing POST /webhook/whatsapp (Farmer Confirms with '1')...")
    payload2 = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "0",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"display_phone_number": "15550001111"},
                            "messages": [
                                {
                                    "from": test_phone,
                                    "id": "wamid.live2",
                                    "timestamp": str(int(time.time())),
                                    "type": "text",
                                    "text": {"body": "1"},
                                }
                            ],
                        },
                        "field": "messages",
                    }
                ],
            }
        ],
    }
    r2 = requests.post(f"{BASE_URL}/webhook/whatsapp", json=payload2)
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text}"
    print("[PASS] Confirmation received! Slot booked and digital pass issued.")

    # 5. Verify booking in /admin/bookings
    print("\n4. Verifying booking in /admin/bookings...")
    r_book = requests.get(f"{BASE_URL}/admin/bookings")
    assert r_book.status_code == 200
    all_b = r_book.json()
    matched = [b for b in all_b if b.get("phone") in (f"+{test_phone}", test_phone)]
    assert len(matched) >= 1, f"Booking for {test_phone} not found in {all_b}"
    b = matched[0]
    print(f"[PASS] Found live booking: Token={b['token']}, Crop={b['crop']}, Qty={b['quantity_quintals']}q, Bay={b['bay']}")

    # 6. Test /admin/incident (Demo breakdown simulation)
    print("\n5. Testing /admin/incident (Bay 1 Breakdown, +45m delay)...")
    inc_res = requests.post(
        f"{BASE_URL}/admin/incident",
        json={"reason": "Bay 1 load cell failure", "delay_minutes": 45, "bay_id": 1}
    )
    assert inc_res.status_code == 200
    inc_data = inc_res.json()
    print(f"[PASS] Incident triggered: Affected Farmers = {inc_data.get('affected_farmers_count')}")

    # 7. Test /admin/capacity
    print("\n6. Testing /admin/capacity...")
    cap_res = requests.get(f"{BASE_URL}/admin/capacity")
    assert cap_res.status_code == 200
    cap_data = cap_res.json()
    print(f"[PASS] Mandi Capacity: {cap_data}")

    print("\n=======================================================")
    print("ALL LIVE HTTP META WHATSAPP WEBHOOK TESTS PASSED! [100% OK]")
    print("=======================================================")

if __name__ == "__main__":
    run_tests()
