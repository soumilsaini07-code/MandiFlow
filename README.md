# Mandi WhatsApp Booking Bot

A working slice of the plan: farmers book a procurement slot over a WhatsApp
voice note or text, the scheduler enforces a hard hourly capacity cap so a
day can never be overbooked, and an admin "incident" trigger pushes
proactive delay alerts to everyone already booked downstream — before they
leave home.

## What's actually built

- `POST /webhook/whatsapp` — Twilio inbound webhook. Handles text and voice
  notes, transcribes with Groq Whisper, extracts a structured booking
  intent with an LLM, and **always confirms before booking** ("Did we get
  this right? Reply 1").
- Capacity-aware scheduler (`app/scheduler.py`) — a plain greedy allocator,
  not OR-Tools. It cannot book past `CAPACITY_PER_HOUR` for a given
  hour/day; overflow rolls forward to the next open hour, then the next
  open day. This is the actual fix for "1,000 farmers pick Monday."
- `POST /admin/incident` — the "Bay 1 breakdown, +45 min" demo button.
  Recomputes affected bookings and fires a proactive WhatsApp alert to each
  one via `app/twilio_client.py`.
- `GET /admin/bookings`, `GET /admin/capacity` — plain JSON, a stand-in for
  the admin dashboard so you can see state without building the React UI.
- `tests/` — 7 tests, all passing. They prove the two claims the pitch
  depends on: the scheduler can never exceed capacity, and a bad/uncertain
  voice transcription never gets silently booked without confirmation.

**Not built** (intentionally, to stay inside a realistic scope): the React
admin dashboard UI, TOTP/QR gate passes, Redis/Celery. See "Cut from the
original plan" below for why.

## Setup (about 15 minutes)

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Get a free Groq API key** — [console.groq.com](https://console.groq.com),
   used for both voice transcription and intent extraction so the whole
   pipeline depends on one provider.

3. **Get a Twilio account** — [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
   (free trial). In the console, go to Messaging → Try it out → WhatsApp
   Sandbox, and note your Account SID + Auth Token.

4. **Copy the env file and fill it in**
   ```bash
   cp .env.example .env
   # edit .env with your GROQ_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
   ```

5. **Run the server**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

6. **Expose it publicly with ngrok**
   ```bash
   ngrok http 8000
   ```
   Copy the `https://...ngrok-free.app` URL it prints.

7. **Point Twilio at it** — in the Sandbox settings, paste
   `https://<your-ngrok-url>/webhook/whatsapp` into "When a message comes
   in" (method: POST), and save.

8. **Join the sandbox from your own phone** — WhatsApp the `join <code>`
   message Twilio's sandbox page shows you, from the phone you'll demo
   with. Every judge/test phone needs to do this once, *before* the demo —
   this is the single most common live-demo failure in these builds.

9. **Text it** — send "40 quintals wheat, Thursday" to the sandbox number.
   You should get a confirmation prompt, then reply "1" to get a token.

## Trying the incident/delay demo

With the server running, book a couple of slots first, then:

```bash
curl -X POST http://localhost:8000/admin/incident \
  -d "reason=Bay 1 breakdown" -d "delay_minutes=45" -d "from_hour=10"
```

Every farmer booked at or after 10:00 today gets a proactive WhatsApp
message. Watch the phone that just booked — this is the "closed-loop"
moment for judges.

## Known limits (read before demo day)

- **The 24-hour WhatsApp session window is real.** Twilio/WhatsApp only
  allows free-form outbound messages within 24 hours of the recipient's
  last inbound message (Twilio error 63016 outside that window). The demo
  is fine — your test farmer just messaged minutes ago. At real scale, a
  farmer who booked three days ago and then hits a same-day breakdown alert
  would need a pre-approved Message Template, not a code fix — flag this
  as known follow-up work if a judge asks, rather than claiming it's
  solved.
- **Twilio media downloads need Basic Auth.** `MediaUrl0` returns a 401
  without your Account SID/Auth Token attached — already handled in
  `intent.py`, just don't strip it out.
- **Groq Whisper is fast but a loud venue is still a loud venue.** The
  confirmation step exists specifically because ASR mistakes happen; don't
  skip testing it with real background noise before the demo, not just a
  quiet room.
- **ngrok's free tier can rotate/drop your URL.** Re-check the forwarding
  URL is still live and still matches what's pasted into Twilio right
  before you go on stage.

## Cut from the original plan, on purpose

- **OR-Tools → plain greedy allocator.** Same hard-capacity guarantee,
  far less to debug at 2am. Swap in OR-Tools later if you want multi-factor
  priority scoring (distance, crop perishability, past wait time) — the
  capacity guarantee doesn't depend on which one you use.
- **Redis + Celery → direct function calls.** The incident endpoint runs
  synchronously. At hackathon scale (a few dozen bookings) this is
  instant; it removes an entire category of "is the worker connected"
  failure risk for the one day it can't fail.
- **TOTP/dynamic QR passes → not built.** Anti-fraud, zero demo value,
  real implementation time. Name it as future work if asked, per the
  original plan's own "flaws to name" section.
- **React dashboard → plain JSON endpoints.** `/admin/bookings` gives you
  everything a demo dashboard would show; wire it into a UI only if there's
  time left over after the core flow is solid.

## Project layout

```
app/
  main.py        FastAPI app + webhook + admin routes
  scheduler.py    capacity-aware slot allocator (the core-bug fix)
  intent.py       voice transcription + LLM intent extraction + confirmation
  incidents.py    delay propagation + proactive alerts
  twilio_client.py  outbound WhatsApp sends, session-window aware
  models.py       Booking / ConversationState / Incident tables
  config.py       all environment-driven settings
  db.py           SQLite engine/session
tests/            7 tests — capacity guarantee, confirmation loop, e2e webhook
```
