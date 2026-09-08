# Demo Script — Mandi WhatsApp Booking Bot (PS15)

Target length: ~4 minutes total. Practice with a stopwatch — judges cut you off at the time limit, not at a natural pause.

---

## 1. The bug (30 seconds)

Say this, don't read a slide:

> "Right now, a farmer picks *any* day to bring their produce to the mandi — with zero visibility into whether that day is already full. So everyone picks Monday. The centre has a fixed number of vehicles it can process per hour, but nothing stops 1,000 farmers from showing up for the same slot. The result is what every mandi already knows: multi-hour queues, spoiled produce sitting in the sun, and farmers who drove hours for nothing.
>
> This isn't a communication problem. It's a coordination problem — farmer demand and centre capacity are completely disconnected."

## 2. The fix, in one line (20 seconds)

> "We made capacity a hard constraint on the booking itself, not just a number on a dashboard. A farmer books over WhatsApp — voice note or text, no app to install — and our scheduler will simply never hand out more slots in an hour than the mandi can actually process. If your day is full, you get the *next open slot* automatically, instead of a queue number."

## 3. Live demo (90–120 seconds)

Do this in order. **Book the demo farmer's slot in hour 9 (9:00–10:00) so the incident step below lines up with the dashboard's default.**

1. **Send the WhatsApp message.** From your phone (already added as a test recipient), send:
   `"40 quintals wheat, tomorrow, tractor"`
   — or record it as a voice note if your venue is quiet enough to trust the mic.

2. **Show the confirmation prompt** on your phone: *"Did we get this right? 40 quintals of Wheat via tractor-trolley, arriving [date]. Reply 1 to confirm..."*
   Say out loud: *"We never book off a raw transcription — ASR mistakes are real, so we always confirm first."*

3. **Reply "1".** Show the booked message with the token and time window.

4. **Switch to the dashboard** (`your-ngrok-url/admin` or `/dashboard`). Point at:
   - The booking that just appeared in the table
   - The three live stats (total booked / busiest hour / delayed)

5. **Trigger the incident.** Reason is pre-filled ("Bay 1 breakdown"), delay 45 minutes, from-hour 9. Click **"Trigger incident & alert farmers."**

6. **Show the payoff, two places at once:**
   - Dashboard: the delay column now reads `+45m` next to your booking, and a toast says "N farmer(s) alerted."
   - Your phone: the proactive WhatsApp message that just arrived — *"Update on your booking [token]: Bay 1 breakdown. Expect a 45-minute delay... No need to rebook, just plan to arrive 45 min later."*

> Say: *"This is the closed loop the current system doesn't have. The farmer finds out about the delay from their phone, before they've left home — not after they've already driven a tractor-trolley to a gate that isn't ready for them."*

## 4. The proof point (20–30 seconds)

> "The core claim here isn't 'we built a chatbot' — it's that this scheduler *cannot* overbook an hour. We proved that with an automated test that tries to book five days' worth of farmers into a single Monday: it never exceeds capacity, and every overflow booking gets pushed to the next open slot instead of vanishing or double-booking. That test is in the repo and passes every time, not just in this demo."

(If asked to show it: `pytest -q` in the terminal — 9/9 passing, sub-second.)

## 5. Anticipated questions — have these ready

**"What if the WhatsApp message gets misread by voice recognition?"**
→ Every booking goes through a confirmation step first ("Reply 1 to confirm"). Nothing books off a raw transcription.

**"Does this scale past a hackathon demo?"**
→ The scheduler is a plain greedy allocator, not a toy — the capacity guarantee holds regardless of how many farmers hit it. The two things that would need real infrastructure at scale are a production WhatsApp Business number (this uses Meta's Cloud API, the same one production apps use) and a proper database instead of SQLite — the booking logic itself doesn't change.

**"What happens if a farmer needs an alert but it's been days since they messaged?"**
→ WhatsApp only allows free-form messages within 24 hours of the user's last message — that's a platform rule, not our bug. Past that window you need a pre-approved Message Template, which is a business process (get it approved by Meta), not a code change. We flag this explicitly rather than pretending it's solved — it's in the README as known follow-up work.

**"Why not [OR-Tools / a fancier optimizer]?"**
→ We chose a plain greedy allocator on purpose: same hard-capacity guarantee, far less to debug live. A smarter solver (weighing distance, crop perishability, wait history) is a natural next step that slots in without changing the capacity guarantee.

**"Why WhatsApp and not an app?"**
→ Every farmer already has WhatsApp; almost none would install a new app for one weekly interaction. Voice notes matter specifically for farmers who aren't comfortable typing.

## 6. Closing line

> "The bug was never 'farmers don't tell us when they're coming' — they do, right now, informally. The bug is that nothing on the centre's side turns that into a hard constraint before it's too late. That's the one thing this fixes."

---

### Pre-demo checklist (do this the morning of, not the night before)

- [ ] Regenerate the Meta access token if it's been >24h since you last got one
- [ ] Confirm ngrok is running and the URL in the Meta webhook config still matches
- [ ] Confirm your demo phone is still in the Meta test-recipient list
- [ ] Send yourself one test booking end-to-end before judges arrive
- [ ] Have the `/admin` dashboard tab already open, not something you navigate to live
- [ ] Know which hour your practice booking landed in, so the incident's "from hour" field is right
