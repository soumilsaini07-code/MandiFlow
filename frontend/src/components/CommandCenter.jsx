import React, { useState } from 'react';
import { 
  Truck, 
  Scale, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ShieldAlert, 
  ArrowUpRight,
  TrendingUp,
  RotateCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CommandCenter({ 
  dashboardData, 
  refreshData, 
  onSelectFarmerForPass 
}) {
  const [loadingAction, setLoadingAction] = useState(false);
  const [filterLane, setFilterLane] = useState('ALL');

  if (!dashboardData || !dashboardData.mandi) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading Mandi Telemetry...
      </div>
    );
  }

  const { mandi, metrics, bays, active_incidents, express_slots, standby_queue } = dashboardData;

  const handleAdvanceStatus = async (token_number, currentStatus) => {
    setLoadingAction(true);
    let nextStatus = 'GATE_ENTRY';
    let extra = {};

    if (currentStatus === 'SCHEDULED') {
      nextStatus = 'GATE_ENTRY';
    } else if (currentStatus === 'GATE_ENTRY') {
      nextStatus = 'QUALITY_ASSAY';
      extra.moisture_percentage = Number((10.5 + Math.random() * 2.5).toFixed(1));
    } else if (currentStatus === 'QUALITY_ASSAY') {
      nextStatus = 'WEIGHED';
      extra.gross_weight = 75.4;
      extra.tare_weight = 34.2;
    } else if (currentStatus === 'WEIGHED') {
      nextStatus = 'PAYMENT_DISBURSED';
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    try {
      await fetch('http://localhost:8000/api/advance-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_number,
          target_status: nextStatus,
          ...extra
        })
      });
      await refreshData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(false);
    }
  };

  const handlePromoteStandby = async () => {
    setLoadingAction(true);
    try {
      const res = await fetch('http://localhost:8000/api/promote-standby', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        confetti({ particleCount: 50, spread: 60 });
        await refreshData();
      } else {
        alert(data.message || 'No standby farmer found to promote.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(false);
    }
  };

  const filteredSlots = express_slots.filter(s => {
    if (filterLane === 'ALL') return true;
    if (filterLane === 'SCHEDULED') return s.status === 'SCHEDULED';
    if (filterLane === 'IN_YARD') return ['GATE_ENTRY', 'QUALITY_ASSAY'].includes(s.status);
    if (filterLane === 'COMPLETED') return ['WEIGHED', 'PAYMENT_DISBURSED'].includes(s.status);
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Active Disruption Banner */}
      {active_incidents && active_incidents.length > 0 && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.18), rgba(245, 158, 11, 0.18))',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <ShieldAlert size={26} color="var(--red-400)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ACTIVE OPERATIONAL DISRUPTION IN PROGRESS
                <span className="badge badge-red">Bay {active_incidents[0].bay_id || 'All'} (+{active_incidents[0].delay_minutes}m)</span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {active_incidents[0].description}. Downstream schedules auto-buffered and {active_incidents[0].affected_count} farmers proactively alerted via WhatsApp.
              </p>
            </div>
          </div>
          <button 
            onClick={async () => {
              await fetch(`http://localhost:8000/api/incidents/${active_incidents[0].id}/resolve`, { method: 'POST' });
              refreshData();
            }}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 14px' }}
          >
            Resolve & Restore
          </button>
        </div>
      )}

      {/* Top Metrics Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '16px'
      }}>
        {/* Metric 1 */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            <span>TODAY'S VEHICLE INFLOW</span>
            <Truck size={18} color="var(--emerald-400)" />
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '8px', color: '#ffffff' }}>
            {metrics?.total_scheduled} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Loads</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--emerald-400)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <TrendingUp size={12} /> 100% Slot Micro-Window Adherence
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            <span>IN-YARD REAL-TIME LOAD</span>
            <Scale size={18} color="var(--blue-500)" />
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '8px', color: '#ffffff' }}>
            {metrics?.in_yard} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Active</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--blue-500)', marginTop: '4px' }}>
            Gate Entry & Moisture Assay in-progress
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            <span>AVG WAIT TIME ELIMINATED</span>
            <Clock size={18} color="var(--amber-400)" />
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '8px', color: '#ffffff' }}>
            {metrics?.average_wait_hours_avoided} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Hours/Farmer</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--amber-400)', marginTop: '4px' }}>
            Saved vs. traditional 24-72h chaos
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            <span>STANDBY BUFFER (20%)</span>
            <AlertCircle size={18} color="var(--indigo-500)" />
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '8px', color: '#ffffff' }}>
            {metrics?.standby_queue_size} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Walk-ins</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--indigo-500)', marginTop: '4px' }}>
            Auto-absorbs forfeited 20-min grace slots
          </div>
        </div>

        {/* Metric 5 */}
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            <span>MSP SETTLED DIRECTLY</span>
            <DollarSign size={18} color="var(--emerald-400)" />
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, marginTop: '8px', color: '#ffffff' }}>
            ₹{(metrics?.disbursed_inr / 100000).toFixed(2)} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Lakh</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--emerald-400)', marginTop: '4px' }}>
            Guaranteed Slot-Bound Price Lock
          </div>
        </div>
      </div>

      {/* Weighbridges Telemetry Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '16px'
      }}>
        {bays?.map((bay) => {
          const isDown = bay.status === 'BREAKDOWN';
          const isSlow = bay.status === 'SLOW';
          return (
            <div key={bay.bay_number} className="glass-card" style={{
              padding: '20px',
              borderLeft: `4px solid ${isDown ? 'var(--red-500)' : isSlow ? 'var(--amber-500)' : 'var(--emerald-500)'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: isDown ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isDown ? 'var(--red-400)' : 'var(--emerald-400)',
                    fontWeight: 800
                  }}>
                    B{bay.bay_number}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>{bay.name}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Capacity: 4 Vehicles/Hour (60MT Scale)</span>
                  </div>
                </div>
                <span className={`badge ${isDown ? 'badge-red' : isSlow ? 'badge-amber' : 'badge-emerald'}`}>
                  <span className="pulse-dot" style={{ backgroundColor: isDown ? 'var(--red-400)' : 'var(--emerald-400)' }}></span>
                  {bay.status}
                </span>
              </div>

              <div style={{
                marginTop: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem'
              }}>
                <span style={{ color: 'var(--text-muted)' }}>Current Dynamic Delay:</span>
                <span style={{ fontWeight: 700, color: bay.delay_minutes > 0 ? 'var(--amber-400)' : 'var(--emerald-400)' }}>
                  {bay.delay_minutes > 0 ? `+${bay.delay_minutes} min shift` : '0 min (On Schedule)'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Schedules Table & Standby Queue */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2.5fr 1fr',
        gap: '20px'
      }}>
        {/* Express Micro-Windows Schedule */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                Today's 1-Hour Micro-Windows (Express Lane - 80%)
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Pre-buffered appointments sequenced to match weighbridge processing capacity
              </p>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {['ALL', 'SCHEDULED', 'IN_YARD', 'COMPLETED'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterLane(f)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    background: filterLane === f ? 'var(--emerald-600)' : 'rgba(255, 255, 255, 0.05)',
                    color: filterLane === f ? '#ffffff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Slots Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 8px' }}>Window</th>
                  <th style={{ padding: '10px 8px' }}>Bay</th>
                  <th style={{ padding: '10px 8px' }}>Token & Farmer</th>
                  <th style={{ padding: '10px 8px' }}>Crop & Qty</th>
                  <th style={{ padding: '10px 8px' }}>Price Lock</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSlots.map((slot) => {
                  const isDelayed = slot.delay_offset_minutes > 0;
                  return (
                    <tr key={slot.id} style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s'
                    }}>
                      {/* Window */}
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 700, color: isDelayed ? 'var(--amber-400)' : '#ffffff' }}>
                          {slot.window_start} - {slot.window_end}
                        </div>
                        {isDelayed && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--amber-400)' }}>
                            +{slot.delay_offset_minutes}m buffered
                          </div>
                        )}
                      </td>

                      {/* Bay */}
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: slot.bay_assigned === 1 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: slot.bay_assigned === 1 ? 'var(--emerald-400)' : '#60a5fa',
                          padding: '3px 8px',
                          borderRadius: '4px'
                        }}>
                          Bay {slot.bay_assigned}
                        </span>
                      </td>

                      {/* Token & Farmer */}
                      <td style={{ padding: '12px 8px' }}>
                        <div 
                          onClick={() => onSelectFarmerForPass(slot.token_number)}
                          style={{ fontWeight: 700, color: 'var(--emerald-400)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          {slot.token_number}
                          <ArrowUpRight size={12} />
                        </div>
                        <div style={{ color: '#ffffff', fontSize: '0.8rem', marginTop: '2px' }}>
                          {slot.farmer_name} <span style={{ color: 'var(--text-dim)' }}>({slot.village})</span>
                        </div>
                      </td>

                      {/* Crop & Qty */}
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>{slot.crop}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {slot.quantity_quintals} Qtl • {slot.vehicle_type}
                        </div>
                      </td>

                      {/* Price Lock */}
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--amber-400)' }}>
                          ₹{slot.price_lock_rate}/qtl
                        </div>
                        <div className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                          {slot.price_lock_hash.substring(0, 10)}...
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 8px' }}>
                        <span className={`badge ${
                          slot.status === 'PAYMENT_DISBURSED' ? 'badge-emerald' :
                          slot.status === 'WEIGHED' ? 'badge-blue' :
                          slot.status === 'QUALITY_ASSAY' ? 'badge-amber' :
                          slot.status === 'GATE_ENTRY' ? 'badge-blue' : 'badge-emerald'
                        }`}>
                          {slot.status.replace('_', ' ')}
                        </span>
                        {slot.moisture && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Moisture: {slot.moisture}%
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        {slot.status !== 'PAYMENT_DISBURSED' ? (
                          <button
                            disabled={loadingAction}
                            onClick={() => handleAdvanceStatus(slot.token_number, slot.status)}
                            className="btn btn-primary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                          >
                            {slot.status === 'SCHEDULED' ? 'Gate In' :
                             slot.status === 'GATE_ENTRY' ? 'Assay Done' :
                             slot.status === 'QUALITY_ASSAY' ? 'Weighed' :
                             'Disburse MSP'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--emerald-400)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} /> Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Standby Queue Panel (20% Reserve Lane) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="glass-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                Walk-In Standby Buffer
              </h3>
              <span className="badge badge-amber">20% Reserved</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Absorbs unbooked walk-ins and auto-fills cancelled/forfeited express slots (20-min grace period).
            </p>

            <button
              onClick={handlePromoteStandby}
              disabled={loadingAction || standby_queue.length === 0}
              className="btn btn-amber"
              style={{ width: '100%', marginBottom: '16px', fontSize: '0.8rem', padding: '8px' }}
            >
              <RotateCw size={14} /> Auto-Absorb Standby Walk-in
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {standby_queue.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>
                  No walk-in farmers currently waiting.
                </div>
              ) : (
                standby_queue.map((s, idx) => (
                  <div key={s.id} style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    padding: '12px',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.85rem' }}>{s.farmer_name}</span>
                      <span className="badge badge-amber" style={{ fontSize: '0.68rem' }}>Queue #{idx + 1}</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {s.crop} • {s.quantity_quintals} Qtl • {s.vehicle_type}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      From {s.village} • MSP ₹{s.price_lock_rate}/qtl
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
