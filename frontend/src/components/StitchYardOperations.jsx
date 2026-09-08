import React, { useState } from 'react';
import confetti from 'canvas-confetti';

export default function StitchYardOperations({ 
  dashboardData, 
  refreshData, 
  onSelectFarmer 
}) {
  const [loadingAction, setLoadingAction] = useState(false);
  const [filterLane, setFilterLane] = useState('ALL');

  const { mandi, metrics, bays, active_incidents, express_slots = [] } = dashboardData || {};

  const handleAdvanceStatus = async (token_number, currentStatus) => {
    setLoadingAction(true);
    let nextStatus = 'GATE_ENTRY';
    let extra = {};

    if (currentStatus === 'SCHEDULED') {
      nextStatus = 'GATE_ENTRY';
    } else if (currentStatus === 'GATE_ENTRY') {
      nextStatus = 'QUALITY_ASSAY';
      extra.moisture_percentage = Number((10.8 + Math.random() * 2).toFixed(1));
    } else if (currentStatus === 'QUALITY_ASSAY') {
      nextStatus = 'WEIGHED';
      extra.gross_weight = 74.5;
      extra.tare_weight = 32.5;
    } else if (currentStatus === 'WEIGHED') {
      nextStatus = 'PAYMENT_DISBURSED';
      confetti({ particleCount: 70, spread: 60 });
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

  const filteredSlots = express_slots.filter(s => {
    if (filterLane === 'ALL') return true;
    if (filterLane === 'SCHEDULED') return s.status === 'SCHEDULED';
    if (filterLane === 'IN_YARD') return ['GATE_ENTRY', 'QUALITY_ASSAY'].includes(s.status);
    if (filterLane === 'COMPLETED') return ['WEIGHED', 'PAYMENT_DISBURSED'].includes(s.status);
    return true;
  });

  const isIncidentActive = active_incidents && active_incidents.length > 0;

  return (
    <section className="py-16 md:py-20 border-t border-border-light bg-surface-low/30" id="mandi-status">
      <div className="max-w-6xl mx-auto px-6 space-y-12">
        {/* Active Incident Warning Alert */}
        {isIncidentActive && (
          <div className="p-5 rounded-2xl bg-accent-soft border border-accent/40 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-accent text-[28px]">warning</span>
              <div>
                <h4 className="text-sm font-bold text-primary-deep font-display">
                  Active Operational Buffer: Bay {active_incidents[0].bay_id || 'All'} (+{active_incidents[0].delay_minutes} min shift)
                </h4>
                <p className="text-xs text-secondary mt-0.5">
                  {active_incidents[0].description}. Downstream farmers notified via WhatsApp before leaving home.
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                await fetch(`http://localhost:8000/api/incidents/${active_incidents[0].id}/resolve`, { method: 'POST' });
                refreshData();
              }}
              className="px-4 py-2 rounded-xl bg-accent text-white hover:bg-accent/90 text-xs font-bold transition-all cursor-pointer"
            >
              Resolve Buffer
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-accent uppercase tracking-wider">
              {mandi?.name || "Karnal APMC Grain Yard"}
            </span>
            <h2 className="text-3xl font-bold text-primary-deep mt-1 font-display">
              Live Yard Operations
            </h2>
            <p className="text-sm text-secondary mt-1">
              Real-time gate clearance, weighbridge telemetry, and paced arrival schedules.
            </p>
          </div>
          <div className="text-xs text-on-surface-subtle flex items-center gap-2 bg-surface-card px-3 py-1.5 rounded-full border border-border-light shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span>Real-time Telemetry Active</span>
          </div>
        </div>

        {/* 3 High-Level KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-subtle">
              Average Wait Time
            </span>
            <div className="text-4xl font-bold text-primary-deep font-display">
              {isIncidentActive ? "45 mins" : "25 mins"}
            </div>
            <p className="text-xs text-on-surface-subtle">
              Gate entry to completed tare weighment (Down from 36-48h)
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-subtle">
              Daily Procurement
            </span>
            <div className="text-4xl font-bold text-primary-deep font-display">
              {metrics ? `${metrics.total_scheduled * 45} Qtl` : "1,420 Qtl"}
            </div>
            <p className="text-xs text-on-surface-subtle">
              Wheat, Mustard &amp; Chana processed today
            </p>
          </div>

          <div className="p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-subtle">
              Weighbridge Status
            </span>
            <div className={`text-4xl font-bold font-display ${isIncidentActive ? 'text-accent' : 'text-primary'}`}>
              {isIncidentActive ? "Rebalancing Bay 1" : "All Bays Smooth"}
            </div>
            <p className="text-xs text-on-surface-subtle">
              Zero highway backup reported on approach roads
            </p>
          </div>
        </div>

        {/* Sleek Row of 3 Bay Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-surface-card border border-border-light space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-subtle uppercase tracking-wider">
                Bay 1 • Weighment
              </span>
              <span className={`w-2 h-2 rounded-full ${isIncidentActive ? 'bg-accent' : 'bg-primary'}`}></span>
            </div>
            <h3 className="text-base font-bold text-primary-deep font-display">
              Gross Laden Electronic Scale
            </h3>
            <p className="text-xs text-secondary leading-relaxed">
              Handling 60MT Electronic Scale • Turnaround under 8 mins remaining per trolley.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-surface-card border border-border-light space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-subtle uppercase tracking-wider">
                Bay 2 • Inspection
              </span>
              <span className="w-2 h-2 rounded-full bg-primary"></span>
            </div>
            <h3 className="text-base font-bold text-primary-deep font-display">
              Assay &amp; Moisture Lab
            </h3>
            <p className="text-xs text-secondary leading-relaxed">
              Automated sample moisture testing running at 11.6% average moisture norm.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-surface-card border border-border-light space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-on-surface-subtle uppercase tracking-wider">
                Bay 3 • Clearance
              </span>
              <span className="w-2 h-2 rounded-full bg-primary"></span>
            </div>
            <h3 className="text-base font-bold text-primary-deep font-display">
              Tare &amp; Direct DBT Settlement
            </h3>
            <p className="text-xs text-secondary leading-relaxed">
              Direct Aadhaar MSP settlement (PFMS/DBT) triggered instantly upon gate exit.
            </p>
          </div>
        </div>

        {/* Live Arrival Queue Table */}
        <div className="p-6 md:p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-primary-deep font-display">
                Today's Paced Micro-Windows Schedule
              </h3>
              <p className="text-xs text-on-surface-subtle mt-1">
                Sequence-buffered 1-hour slots matching physical scale capacity.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              {['ALL', 'SCHEDULED', 'IN_YARD', 'COMPLETED'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterLane(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    filterLane === f 
                      ? 'bg-primary text-white shadow-2xs' 
                      : 'bg-surface-low text-on-surface-subtle hover:text-on-surface'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-light text-on-surface-subtle uppercase tracking-wider font-bold">
                  <th className="py-3 px-4">Window</th>
                  <th className="py-3 px-4">Bay</th>
                  <th className="py-3 px-4">Pass &amp; Farmer</th>
                  <th className="py-3 px-4">Crop / Qty</th>
                  <th className="py-3 px-4">Price Lock</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Gate Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {filteredSlots.map((slot) => {
                  const isDelayed = slot.delay_offset_minutes > 0;
                  return (
                    <tr key={slot.id} className="hover:bg-surface-low/30 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-primary-deep">
                        <div>{slot.window_start} – {slot.window_end}</div>
                        {isDelayed && (
                          <span className="text-[10px] text-accent font-semibold">
                            +{slot.delay_offset_minutes}m buffered
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-1 rounded bg-surface-low text-primary-dark font-semibold font-mono">
                          Bay {slot.bay_assigned}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => onSelectFarmer && onSelectFarmer(slot)}
                          className="font-mono font-bold text-primary hover:underline cursor-pointer text-left block"
                        >
                          {slot.token_number}
                        </button>
                        <span className="text-secondary">{slot.farmer_name} ({slot.village})</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <strong className="text-primary-deep block">{slot.crop}</strong>
                        <span className="text-secondary">{slot.quantity_quintals} Qtl • {slot.vehicle_type}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-accent">₹{slot.price_lock_rate}/qtl</span>
                        <div className="text-[10px] font-mono text-on-surface-subtle">
                          {slot.price_lock_hash ? `${slot.price_lock_hash.substring(0, 8)}...` : 'LOCKED'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          slot.status === 'PAYMENT_DISBURSED' ? 'bg-primary-light text-primary-deep' :
                          slot.status === 'WEIGHED' ? 'bg-blue-50 text-blue-800' :
                          slot.status === 'QUALITY_ASSAY' ? 'bg-amber-50 text-amber-800' :
                          slot.status === 'GATE_ENTRY' ? 'bg-indigo-50 text-indigo-800' :
                          'bg-surface-low text-on-surface-subtle'
                        }`}>
                          {slot.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {slot.status !== 'PAYMENT_DISBURSED' ? (
                          <button
                            disabled={loadingAction}
                            onClick={() => handleAdvanceStatus(slot.token_number, slot.status)}
                            className="px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary-dark text-xs font-bold transition-all cursor-pointer shadow-2xs"
                          >
                            {slot.status === 'SCHEDULED' ? 'Gate In' :
                             slot.status === 'GATE_ENTRY' ? 'Assay Done' :
                             slot.status === 'QUALITY_ASSAY' ? 'Weighed' :
                             'Disburse MSP'}
                          </button>
                        ) : (
                          <span className="text-primary font-bold text-xs inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">verified</span> Settled
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
      </div>
    </section>
  );
}
