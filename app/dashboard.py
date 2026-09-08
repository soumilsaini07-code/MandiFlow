"""
The admin dashboard the README's "Cut from the original plan" section
originally deferred (a plain JSON API instead of a React UI). This is the
minimal version that's actually worth having for a demo: a single
self-contained HTML page, served directly by this app (no separate
frontend build/deploy), that reads the existing /admin/* JSON endpoints
and can fire the incident demo button without a terminal in view.

Kept as one plain string (not a templates/ directory + Jinja2) on purpose:
it's the same "less to debug at 2am" tradeoff the rest of this project
makes, and it means the whole dashboard ships with zero extra
dependencies or build steps on Render.
"""

DASHBOARD_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mandi Dashboard</title>
<style>
  :root {
    --bg: #0f172a; --panel: #1e293b; --panel-2: #24314d; --border: #334155;
    --text: #e2e8f0; --muted: #94a3b8; --accent: #22c55e; --accent-2: #3b82f6;
    --warn: #f59e0b; --danger: #ef4444;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--bg); color: var(--text); padding: 24px;
  }
  h1 { font-size: 1.4rem; margin: 0 0 4px; }
  .sub { color: var(--muted); margin: 0 0 24px; font-size: 0.9rem; }
  .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; align-items: start; }
  @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  .card {
    background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
    padding: 18px 20px; margin-bottom: 20px;
  }
  .card h2 { font-size: 1rem; margin: 0 0 14px; display: flex; align-items: center; justify-content: space-between; }
  .pill {
    display: inline-block; background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 999px; padding: 3px 12px; font-size: 0.78rem; color: var(--muted);
  }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; }
  tr:last-child td { border-bottom: none; }
  .delay { color: var(--warn); font-weight: 600; }
  .empty { color: var(--muted); font-style: italic; padding: 12px 0; }
  label { display: block; font-size: 0.78rem; color: var(--muted); margin: 12px 0 4px; }
  input {
    width: 100%; background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px;
    color: var(--text); padding: 9px 10px; font-size: 0.9rem;
  }
  button {
    margin-top: 16px; width: 100%; background: var(--danger); color: white; border: none;
    border-radius: 8px; padding: 11px; font-size: 0.9rem; font-weight: 600; cursor: pointer;
  }
  button:hover { opacity: 0.9; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .refresh-btn {
    background: none; border: 1px solid var(--border); color: var(--muted);
    width: auto; margin: 0; padding: 5px 12px; font-size: 0.78rem; font-weight: 500;
  }
  .stat-row { display: flex; gap: 12px; margin-bottom: 4px; }
  .stat { flex: 1; background: var(--panel-2); border-radius: 8px; padding: 12px 14px; }
  .stat .num { font-size: 1.6rem; font-weight: 700; }
  .stat .label { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
  #incidentResult {
    margin-top: 14px; font-size: 0.82rem; background: var(--panel-2); border-radius: 8px;
    padding: 10px 12px; white-space: pre-wrap; display: none; max-height: 220px; overflow-y: auto;
  }
  .toast {
    position: fixed; top: 18px; right: 18px; background: var(--accent); color: #052e16;
    padding: 10px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600;
    opacity: 0; transform: translateY(-8px); transition: all 0.25s ease; pointer-events: none;
  }
  .toast.show { opacity: 1; transform: translateY(0); }
</style>
</head>
<body>
  <h1>Mandi Booking Dashboard</h1>
  <p class="sub" id="subtitle">Loading…</p>

  <div class="grid">
    <div>
      <div class="card">
        <h2>
          Today's bookings
          <span>
            <input type="date" id="dateFilter" style="width:auto;display:inline-block;padding:5px 8px;font-size:0.78rem;">
            <button class="refresh-btn" onclick="loadBookings()">Refresh</button>
          </span>
        </h2>
        <div class="stat-row" id="statRow"></div>
        <table id="bookingsTable">
          <thead>
            <tr><th>Token</th><th>Phone</th><th>Crop</th><th>Qty (qtl)</th><th>Hour</th><th>Delay</th></tr>
          </thead>
          <tbody id="bookingsBody"></tbody>
        </table>
        <div class="empty" id="emptyMsg" style="display:none;">No confirmed bookings for this date yet.</div>
      </div>
    </div>

    <div>
      <div class="card">
        <h2>Simulate an incident</h2>
        <label for="reason">Reason</label>
        <input id="reason" value="Bay 1 breakdown">
        <label for="delay">Delay (minutes)</label>
        <input id="delay" type="number" value="45">
        <label for="fromHour">Affects bookings from hour (24h) — match the hour your demo booking landed in</label>
        <input id="fromHour" type="number" value="9" min="0" max="23">
        <button id="incidentBtn" onclick="triggerIncident()">Trigger incident &amp; alert farmers</button>
        <div id="incidentResult"></div>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

<script>
const todayStr = () => new Date().toISOString().slice(0, 10);
document.getElementById('dateFilter').value = todayStr();
document.getElementById('dateFilter').addEventListener('change', loadBookings);

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

async function loadCapacity() {
  const res = await fetch('/admin/capacity');
  const data = await res.json();
  document.getElementById('subtitle').textContent =
    `${data.mandi_id} · capacity ${data.capacity_per_hour} vehicles/hour`;
  document.getElementById('fromHour').max = 23;
}

async function loadBookings() {
  const date = document.getElementById('dateFilter').value;
  const res = await fetch(`/admin/bookings?for_date=${date}`);
  const bookings = await res.json();
  const body = document.getElementById('bookingsBody');
  const empty = document.getElementById('emptyMsg');
  body.innerHTML = '';
  empty.style.display = bookings.length ? 'none' : 'block';

  const byHour = {};
  for (const b of bookings) byHour[b.hour] = (byHour[b.hour] || 0) + 1;
  const busiest = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0];
  const delayed = bookings.filter(b => b.delay_minutes > 0).length;

  document.getElementById('statRow').innerHTML = `
    <div class="stat"><div class="num">${bookings.length}</div><div class="label">Total booked</div></div>
    <div class="stat"><div class="num">${busiest ? busiest[0] + ':00' : '—'}</div><div class="label">Busiest hour</div></div>
    <div class="stat"><div class="num">${delayed}</div><div class="label">Delayed</div></div>
  `;

  for (const b of bookings.sort((a, b) => a.hour - b.hour)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${b.token}</td>
      <td>${b.phone}</td>
      <td>${b.crop}</td>
      <td>${b.quantity_quintals}</td>
      <td>${String(b.hour).padStart(2, '0')}:00</td>
      <td>${b.delay_minutes > 0 ? `<span class="delay">+${b.delay_minutes}m</span>` : '—'}</td>
    `;
    body.appendChild(tr);
  }
}

async function triggerIncident() {
  const btn = document.getElementById('incidentBtn');
  const resultBox = document.getElementById('incidentResult');
  btn.disabled = true;
  btn.textContent = 'Sending alerts…';

  const params = new URLSearchParams({
    reason: document.getElementById('reason').value,
    delay_minutes: document.getElementById('delay').value,
    from_hour: document.getElementById('fromHour').value,
  });

  try {
    const res = await fetch('/admin/incident', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await res.json();
    resultBox.style.display = 'block';
    resultBox.textContent = JSON.stringify(data, null, 2);
    showToast(`${data.affected_bookings} farmer(s) alerted`);
    loadBookings();
  } catch (e) {
    resultBox.style.display = 'block';
    resultBox.textContent = 'Error: ' + e;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Trigger incident & alert farmers';
  }
}

loadCapacity();
loadBookings();
</script>
</body>
</html>
"""
