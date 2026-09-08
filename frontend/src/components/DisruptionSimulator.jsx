import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CloudRain, 
  Wrench, 
  FlaskConical, 
  CheckCircle2, 
  Send, 
  Clock, 
  Users, 
  Radio,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function DisruptionSimulator({ dashboardData, refreshData }) {
  const [loading, setLoading] = useState(false);
  const [lastDispatchedAlerts, setLastDispatchedAlerts] = useState([]);

  const { active_incidents, recent_alerts } = dashboardData;

  const handleTriggerIncident = async (type, bayId, delayMins, desc) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/incidents/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandi_id: 1,
          incident_type: type,
          bay_id: bayId,
          delay_minutes: delayMins,
          description: desc
        })
      });

      if (res.ok) {
        const data = await res.json();
        setLastDispatchedAlerts(data.data.alerts_dispatched || []);
        confetti({ particleCount: 40, spread: 50 });
        await refreshData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAll = async () => {
    setLoading(true);
    try {
      if (active_incidents && active_incidents.length > 0) {
        for (const inc of active_incidents) {
          await fetch(`http://localhost:8000/api/incidents/${inc.id}/resolve`, { method: 'POST' });
        }
      }
      setLastDispatchedAlerts([]);
      await refreshData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Intro Hero Box explaining Closed-Loop Differentiation */}
      <div className="glass-card-amber" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <AlertTriangle size={26} color="var(--amber-400)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
            Closed-Loop Disruption Rebalancing Engine
          </h2>
        </div>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: 1.5, maxWidth: '900px' }}>
          Traditional government portals (e-Uparjan, e-Kharid) are <strong>open-loop</strong>: they assign a static day pass and collapse into 36-hour gridlocks whenever a weighbridge jams. MandiFlow is a <strong>closed-loop control system</strong>. When an incident occurs, delays ripple backward through the queue and reach farmers on WhatsApp <em>before</em> they leave their village.
        </p>
      </div>

      {/* Incident Triggers Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px'
      }}>
        {/* Incident 1: Bay 1 Breakdown */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red-400)', fontWeight: 700 }}>
              <Wrench size={18} />
              <span>Weighbridge Bay 1 Breakdown</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', margin: '10px 0 6px' }}>
              +45 Minutes Delay
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Simulates load cell hydraulic failure on Bay 1. Cascades all downstream Bay 1 micro-windows and dispatches proactive departure delay warnings.
            </p>
          </div>
          <button
            disabled={loading}
            onClick={() => handleTriggerIncident(
              'WEIGHBRIDGE_BREAKDOWN',
              1,
              45,
              'Bay 1 Load Cell Sensor recalibration'
            )}
            className="btn btn-danger"
            style={{ marginTop: '16px', fontSize: '0.82rem' }}
          >
            Trigger Bay 1 Breakdown
          </button>
        </div>

        {/* Incident 2: Rainstorm Alert */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--blue-500)', fontWeight: 700 }}>
              <CloudRain size={18} />
              <span>Sudden Harvest Rainstorm</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', margin: '10px 0 6px' }}>
              +60 Minutes Delay
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Wet unloading yard slowdown across all weighbridges. Protects grain from open spoilage by instructing farmers to hold grain under tarpaulins at home.
            </p>
          </div>
          <button
            disabled={loading}
            onClick={() => handleTriggerIncident(
              'RAIN_ALERT',
              null,
              60,
              'Heavy downpour warning on APMC approach road'
            )}
            className="btn"
            style={{
              marginTop: '16px',
              fontSize: '0.82rem',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: '#ffffff'
            }}
          >
            Trigger Rainstorm Pause
          </button>
        </div>

        {/* Incident 3: Moisture Assay Jam */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--amber-400)', fontWeight: 700 }}>
              <FlaskConical size={18} />
              <span>Quality Assay Backlog</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', margin: '10px 0 6px' }}>
              +30 Minutes Delay
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Moisture assay meter recalibration queue. Paces vehicle inflow to prevent tractor idling in the yard.
            </p>
          </div>
          <button
            disabled={loading}
            onClick={() => handleTriggerIncident(
              'ASSAY_BACKLOG',
              2,
              30,
              'Moisture meter queue calibration on Bay 2'
            )}
            className="btn btn-amber"
            style={{ marginTop: '16px', fontSize: '0.82rem' }}
          >
            Trigger Assay Backlog
          </button>
        </div>

        {/* Incident 4: Reset / Restore */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--emerald-400)', fontWeight: 700 }}>
              <CheckCircle2 size={18} />
              <span>Operational Recovery</span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', margin: '10px 0 6px' }}>
              Restore Normal Pace
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Clears active incidents, resets weighbridge telemetry to operational health, and maintains sequenced arrivals.
            </p>
          </div>
          <button
            disabled={loading}
            onClick={handleResolveAll}
            className="btn btn-primary"
            style={{ marginTop: '16px', fontSize: '0.82rem' }}
          >
            Resolve All & Restore
          </button>
        </div>
      </div>

      {/* Live Dispatched Broadcasts Feed */}
      <div className="glass-card" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Radio size={20} color="var(--emerald-400)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
              Proactive WhatsApp Disruption Outbox (Closed-Loop Feed)
            </h3>
          </div>
          <span className="badge badge-emerald">
            <span className="pulse-dot"></span> Live Twilio Gateway
          </span>
        </div>

        {lastDispatchedAlerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {lastDispatchedAlerts.map((alert, idx) => (
              <div key={idx} style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                  <span style={{ fontWeight: 700, color: '#ffffff' }}>
                    Recipient: {alert.farmer} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({alert.phone})</span>
                  </span>
                  <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>
                    Rescheduled to: {alert.new_window}
                  </span>
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: '#fbbf24',
                  whiteSpace: 'pre-line',
                  lineHeight: 1.4
                }}>
                  {alert.message}
                </div>
              </div>
            ))}
          </div>
        ) : recent_alerts && recent_alerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recent_alerts.map((a) => (
              <div key={a.id} style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.85rem' }}>
                    {a.farmer} ({a.phone})
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {a.message.split('\n')[0]}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-emerald" style={{ fontSize: '0.68rem' }}>Sent {a.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            No recent alerts. Click any disruption trigger above to observe the closed-loop notification ripple in real-time.
          </div>
        )}
      </div>

    </div>
  );
}
