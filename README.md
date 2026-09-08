# Mandi WhatsApp Booking Bot

A working slice of the plan: farmers book a procurement slot over a WhatsApp
voice note or text, the scheduler enforces a hard hourly capacity cap so a
day can never be overbooked, and an admin "incident" trigger pushes
proactive delay alerts to everyone already booked downstream — before they
leave home.

## What's actually built

- `GET /webhook/whatsapp` + `POST /webhook/whatsapp` — Meta WhatsApp Cloud
  API webhook (the free tier — no credit card). GET handles Meta's
  one-time verification handshake; POST handles inbound text and voice
  notes, transcribes with Groq Whisper, extracts a structured booking
  intent with an LLM, and **always confirms before booking** ("Did we get
  this right? Reply 1"). Every reply is sent as an active outbound call via
  `app/whatsapp_client.py` — Meta's webhook has no inline-reply mechanism.
- Capacity-aware scheduler (`app/scheduler.py`) — a plain greedy allocator,
  not OR-Tools. It cannot book past `CAPACITY_PER_HOUR` for a given
  hour/day; overflow rolls forward to the next open hour, then the next
  open day. This is the actual fix for "1,000 farmers pick Monday."
- `POST /admin/incident` — the "Bay 1 breakdown, +45 min" demo button.
  Recomputes affected bookings and fires a proactive WhatsApp alert to each
  one via `app/whatsapp_client.py`.
- `GET /admin/bookings`, `GET /admin/capacity` — plain JSON, a stand-in for
  the admin dashboard so you can see state without building the React UI.
- `tests/` — 9 tests, all passing. They prove the claims the pitch depends
  on: the scheduler can never exceed capacity, a bad/uncertain voice
  transcription never gets silently booked without confirmation, and the
  webhook verification handshake behaves correctly.

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

3. **Get a free Meta Developer account — genuinely no credit card needed**
   - Go to [developers.facebook.com](https://developers.facebook.com) and
     sign up (or log in with an existing Facebook account).
   - Create a new App → choose "Business" type → add the **WhatsApp**
     product to it.
   - The WhatsApp → API Setup page gives you, for free: a **test phone
     number** and a **temporary access token** (valid ~24h — swap for a
     permanent one later via a System User if you keep building past the
     hackathon), plus a **Phone number ID**.
   - On that same page, under "To" / recipient list, add up to 5 phone
     numbers (yours and any judge/demo phones) — Meta's test tier can only
     message numbers you've explicitly added there.

4. **Copy the env file and fill it in**
   ```bash
   cp .env.example .env
   # edit .env with your GROQ_API_KEY, WHATSAPP_ACCESS_TOKEN,
   # WHATSAPP_PHONE_NUMBER_ID, and pick any string for WHATSAPP_VERIFY_TOKEN
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

7. **Point Meta at it** — in the App Dashboard, WhatsApp → Configuration →
   Webhook → Edit, paste `https://<your-ngrok-url>/webhook/whatsapp` as the
   Callback URL and the same value you put in `WHATSAPP_VERIFY_TOKEN` as
   the Verify Token, then click Verify and Save. This fires the `GET`
   handshake in `app/main.py` — if it fails, your server isn't reachable or
   the tokens don't match. Then subscribe to the `messages` webhook field.

8. **No "join sandbox" step needed** — unlike Twilio, any number you added
   to the recipient list in step 3 can message the test number directly,
   no opt-in keyword required. Still worth confirming every judge/demo
   phone can actually send a message *before* the demo — this is the
   single most common live-demo failure in these builds.

9. **Text it** — send "40 quintals wheat, Thursday" to the test number.
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

- **The 24-hour WhatsApp session window is real.** Meta only allows
  free-form outbound messages within 24 hours of the recipient's last
  inbound message. The demo is fine — your test farmer just messaged
  minutes ago. At real scale, a farmer who booked three days ago and then
  hits a same-day breakdown alert would need a pre-approved Message
  Template, not a code fix — flag this as known follow-up work if a judge
  asks, rather than claiming it's solved.
- **The free temporary access token expires in ~24 hours.** If the bot
  stops sending replies the next day, this is almost always why — go back
  to the App Dashboard's WhatsApp → API Setup page and generate a fresh
  token, then update `.env` (and restart the server). Worth doing this
  the morning of the demo, not the night before.
- **Meta media downloads are a two-step fetch, not a direct URL.** The
  webhook payload only gives you a `media_id`; `intent.py` first calls
  `GET /{media_id}` for a short-lived `url`, then fetches that URL — both
  requests need the Bearer token attached. Already handled, just don't
  strip it out.
- **The test tier only messages numbers you've explicitly added.** Add
  every judge/demo phone under WhatsApp → API Setup → "To" *before* you're
  on stage — an unadded number gets silently ignored by Meta, not an error
  you'll see in your own logs.
- **Groq Whisper is fast but a loud venue is still a loud venue.** The
  confirmation step exists specifically because ASR mistakes happen; don't
  skip testing it with real background noise before the demo, not just a
  quiet room.
- **ngrok's free tier can rotate/drop your URL.** Re-check the forwarding
  URL is still live and still matches what's saved in the Meta webhook
  config right before you go on stage — if you regenerate an ngrok URL,
  you also need to re-verify the webhook in the App Dashboard.

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
  main.py        FastAPI app + webhook (verification + inbound) + admin routes
  scheduler.py    capacity-aware slot allocator (the core-bug fix)
  intent.py       voice transcription + LLM intent extraction + confirmation
  incidents.py    delay propagation + proactive alerts
  whatsapp_client.py  outbound WhatsApp sends via Meta Cloud API, session-window aware
  models.py       Booking / ConversationState / Incident tables
  config.py       all environment-driven settings
  db.py           SQLite engine/session
tests/            9 tests — capacity guarantee, confirmation loop, e2e webhook, verification handshake
```
