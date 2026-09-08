import React, { useState } from 'react';
import confetti from 'canvas-confetti';

export default function OfficerPortal({ dashboardData, refreshData, onBackToFarmerView }) {
  const [activeSubTab, setActiveSubTab] = useState('gate'); // gate, assay, weighbridge, dbt, emergency
  const [scanToken, setScanToken] = useState('');
  const [scannedFarmer, setScannedFarmer] = useState(null);
  const [scanMessage, setScanMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Weighbridge & Assay Form state
  const [moistureValue, setMoistureValue] = useState('11.4');
  const [grossWeight, setGrossWeight] = useState('78.5');
  const [tareWeight, setTareWeight] = useState('33.5');
  const [totpInput, setTotpInput] = useState('');

  const { mandi, metrics, express_slots = [], bays = [] } = dashboardData || {};

  // Find farmer by token
  const handleVerifyToken = async (e) => {
    if (e) e.preventDefault();
    if (!scanToken.trim()) return;

    setLoading(true);
    setScanMessage(null);
    try {
      const res = await fetch(`http://localhost:8000/api/token/${scanToken.trim()}`);
      if (res.ok) {
        const data = await res.json();
        setScannedFarmer(data);
        setScanMessage({ type: 'success', text: `Verified pass for ${data.farmer_name} (${data.crop})` });
      } else {
        setScannedFarmer(null);
        setScanMessage({ type: 'error', text: `Token "${scanToken}" not found in APMC active registry.` });
      }
    } catch (err) {
      setScanMessage({ type: 'error', text: 'Backend connection error.' });
    } finally {
      setLoading(false);
    }
  };

  // Quick select a token from list
  const handleSelectQuickToken = (slot) => {
    setScanToken(slot.token_number);
    setScannedFarmer(slot);
    setScanMessage({ type: 'success', text: `Loaded pass for ${slot.farmer_name}` });
  };

  // Approve Gate Entry
  // Approve Gate Entry with Mandatory TOTP Code
  const handleApproveGateEntry = async () => {
    if (!scannedFarmer) return;
    const totpToSend = (totpInput.trim() || scannedFarmer.dynamic_totp_code || '').trim();
    if (!totpToSend) {
      setScanMessage({ type: 'error', text: 'Dynamic 6-digit TOTP code is required for gate check-in verification.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/check-in', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Key': 'mandiflow_secret_2026'
        },
        body: JSON.stringify({
          token_number: scannedFarmer.token_number,
          totp_code: totpToSend
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setScannedFarmer((prev) => ({ ...prev, status: 'GATE_ENTRY' }));
        setScanMessage({ type: 'success', text: `Gate Entry Approved (TOTP Validated) for ${scannedFarmer.farmer_name}! Vehicle routed to Bay ${scannedFarmer.bay_assigned}.` });
        confetti({ particleCount: 40, spread: 50 });
        await refreshData();
      } else {
        const errData = await res.json();
        setScanMessage({ type: 'error', text: errData.detail || 'Gate Check-in failed. Please verify TOTP code.' });
      }
    } catch (err) {
      console.error(err);
      setScanMessage({ type: 'error', text: 'Error connecting to check-in service.' });
    } finally {
      setLoading(false);
    }
  };

  // Certify Quality Assay
  const handleCertifyAssay = async () => {
    if (!scannedFarmer) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/advance-status', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Key': 'mandiflow_secret_2026'
        },
        body: JSON.stringify({
          token_number: scannedFarmer.token_number,
          target_status: 'QUALITY_ASSAY',
          moisture_percentage: parseFloat(moistureValue)
        })
      });
      if (res.ok) {
        setScannedFarmer((prev) => ({ ...prev, status: 'QUALITY_ASSAY', moisture_percentage: parseFloat(moistureValue) }));
        setScanMessage({ type: 'success', text: `Quality Assay Certified: ${moistureValue}% Moisture. Passed Fair Average Quality (FAQ) standards.` });
        await refreshData();
      } else {
        const errData = await res.json();
        setScanMessage({ type: 'error', text: errData.detail || 'Failed to certify assay.' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Complete Gross/Tare Weighment
  const handleCompleteWeighment = async () => {
    if (!scannedFarmer) return;
    setLoading(true);
    try {
      const g = parseFloat(grossWeight);
      const t = parseFloat(tareWeight);
      const res = await fetch('http://localhost:8000/api/advance-status', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Key': 'mandiflow_secret_2026'
        },
        body: JSON.stringify({
          token_number: scannedFarmer.token_number,
          target_status: 'WEIGHED',
          gross_weight: g,
          tare_weight: t
        })
      });
      if (res.ok) {
        const net = Math.max(0, g - t);
        setScannedFarmer((prev) => ({ ...prev, status: 'WEIGHED', gross_weight_quintals: g, tare_weight_quintals: t, net_weight_quintals: net }));
        setScanMessage({ type: 'success', text: `Weighment Complete! Net Load: ${net.toFixed(1)} Qtl. Scale slip issued.` });
        await refreshData();
      } else {
        const errData = await res.json();
        setScanMessage({ type: 'error', text: errData.detail || 'Weighment recording failed.' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Disburse DBT
  const handleDisbursePayment = async () => {
    if (!scannedFarmer) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/advance-status', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Key': 'mandiflow_secret_2026'
        },
        body: JSON.stringify({
          token_number: scannedFarmer.token_number,
          target_status: 'PAYMENT_DISBURSED'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setScannedFarmer((prev) => ({ ...prev, status: 'PAYMENT_DISBURSED', payment_status: 'DISBURSED', payment_amount: data.payment_amount }));
        setScanMessage({ type: 'success', text: `Direct Benefit Transfer (DBT) of ₹${data.payment_amount.toLocaleString('en-IN')} successfully credited to farmer bank account!` });
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        await refreshData();
      } else {
        const errData = await res.json();
        setScanMessage({ type: 'error', text: errData.detail || 'DBT disbursement failed.' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto absorb standby walk-in
  const handlePromoteStandby = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/promote-standby', { 
        method: 'POST',
        headers: {
          'X-Admin-Key': 'mandiflow_secret_2026'
        }
      });
      const data = await res.json();
      if (data.success) {
        setScanMessage({ type: 'success', text: `Standby Farmer ${data.promoted.farmer_name} (${data.promoted.promoted_token}) successfully promoted to Express Lane!` });
        confetti({ particleCount: 50, spread: 60 });
        await refreshData();
      } else {
        setScanMessage({ type: 'error', text: data.message || 'No standby walk-in waiting to promote.' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-8">
      {/* Officer Portal Header Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-primary-deep text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0">
            <span className="material-symbols-outlined text-[32px]">shield_person</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-accent-soft">
                APMC Mandi Secretary &amp; Gate Control Room
              </span>
              <span className="w-2 h-2 rounded-full bg-primary-light animate-pulse"></span>
            </div>
            <h2 className="text-2xl font-bold font-display mt-0.5">
              {mandi?.name || "Karnal APMC Grain Market"}
            </h2>
            <p className="text-xs text-white/80 mt-1">
              Officer On Duty: <strong>Sh. Rajesh Kumar (APMC Secretary)</strong> • District: {mandi?.district || "Karnal"} • Gate 1 &amp; Gate 2 Online
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onBackToFarmerView}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all text-white cursor-pointer"
          >
            ← View Farmer Portal
          </button>
          <button
            onClick={handlePromoteStandby}
            className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold transition-all text-white cursor-pointer shadow-sm"
          >
            Auto-Absorb Standby Walk-in
          </button>
        </div>
      </div>

      {/* Officer Workflow Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border-light pb-2 overflow-x-auto">
        {[
          { id: 'gate', label: '1. Gate Entry & Check-In', icon: 'sensor_occupied' },
          { id: 'assay', label: '2. Moisture & Quality Lab', icon: 'biotech' },
          { id: 'weighbridge', label: '3. Electronic Weighbridge', icon: 'scale' },
          { id: 'dbt', label: '4. Direct MSP Payment (DBT)', icon: 'payments' },
          { id: 'queue', label: 'Active In-Yard Queue', icon: 'view_list' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeSubTab === tab.id
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-card text-on-surface-subtle hover:text-on-surface border border-border-subtle'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Quick Token Selector Bar */}
      <div className="p-4 rounded-xl bg-surface-card border border-border-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleVerifyToken} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <span className="material-symbols-outlined text-[18px] text-on-surface-subtle absolute left-3 top-2.5 pointer-events-none">
              qr_code_scanner
            </span>
            <input
              type="text"
              placeholder="Scan or Enter Token No (e.g. MF-0908-105)..."
              value={scanToken}
              onChange={(e) => setScanToken(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-surface-low rounded-lg text-xs font-mono font-bold text-on-surface focus:bg-white focus:outline-none focus:border-primary border border-border-subtle"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold cursor-pointer transition-all"
          >
            Verify Pass
          </button>
        </form>

        {/* Live Queue Shortcuts */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-[11px] font-semibold text-on-surface-subtle shrink-0">Arriving Now:</span>
          {express_slots.slice(0, 4).map((s) => (
            <button
              key={s.token_number}
              onClick={() => handleSelectQuickToken(s)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer shrink-0 ${
                scannedFarmer?.token_number === s.token_number
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface-low text-primary-deep border-border-subtle hover:bg-primary-light'
              }`}
            >
              {s.token_number}
            </button>
          ))}
        </div>
      </div>

      {/* Notification / Feedback Banner */}
      {scanMessage && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
          scanMessage.type === 'success' 
            ? 'bg-primary-light text-primary-deep border border-primary/30' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {scanMessage.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{scanMessage.text}</span>
        </div>
      )}

      {/* Sub-Tab 1: Gate Entry Check-in */}
      {activeSubTab === 'gate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Verification & Action */}
          <div className="lg:col-span-7 p-6 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-5">
            <div>
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Step 1 • Gatekeep Control</span>
              <h3 className="text-xl font-bold text-primary-deep font-display mt-0.5">
                Driver Token &amp; License Plate Check-In
              </h3>
              <p className="text-xs text-secondary mt-1">
                Validates dynamic digital pass, checks arrival window compliance, and admits vehicle into the yard.
              </p>
            </div>

            {scannedFarmer ? (
              <div className="p-5 rounded-xl bg-surface-low/60 border border-border-light space-y-4">
                <div className="flex items-center justify-between border-b border-border-light pb-3">
                  <div>
                    <span className="text-[11px] text-on-surface-subtle block">Farmer Name</span>
                    <strong className="text-base text-primary-deep font-display">{scannedFarmer.farmer_name}</strong>
                    <span className="text-xs text-secondary block">{scannedFarmer.village} • {scannedFarmer.phone}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-on-surface-subtle block">Token Number</span>
                    <span className="font-mono text-base font-bold text-primary-deep">{scannedFarmer.token_number}</span>
                    <span className="text-[11px] text-primary font-bold block">Bay {scannedFarmer.bay_assigned} Designated</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-on-surface-subtle block">Declared Crop:</span>
                    <strong className="text-primary-deep">{scannedFarmer.crop}</strong>
                  </div>
                  <div>
                    <span className="text-on-surface-subtle block">Declared Qty:</span>
                    <strong className="text-primary-deep">{scannedFarmer.quantity_quintals} Quintals</strong>
                  </div>
                  <div>
                    <span className="text-on-surface-subtle block">Slot Window:</span>
                    <strong className="text-accent">{scannedFarmer.window_start || scannedFarmer.scheduled_window_start} - {scannedFarmer.window_end || scannedFarmer.scheduled_window_end}</strong>
                  </div>
                </div>

                <div className="pt-3 pb-1 border-t border-border-light flex items-center justify-between gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-accent uppercase tracking-wider block">
                      Mandatory Security TOTP (from Farmer e-Parchi)
                    </label>
                    <span className="text-[11px] text-on-surface-subtle block">
                      Dynamic 6-digit gate verification code
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={totpInput !== '' ? totpInput : (scannedFarmer.dynamic_totp_code || '')}
                    onChange={(e) => setTotpInput(e.target.value)}
                    placeholder="e.g. 639201"
                    className="w-32 text-center font-mono font-bold tracking-widest text-sm py-1.5 px-2.5 rounded-lg border border-primary/40 bg-surface-low text-primary-deep focus:outline-none focus:border-primary focus:bg-white"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-border-light">
                  <div className="text-xs">
                    <span className="text-on-surface-subtle">Current Status: </span>
                    <span className="font-bold text-primary-deep">{scannedFarmer.status}</span>
                  </div>
                  <button
                    disabled={loading || scannedFarmer.status !== 'SCHEDULED'}
                    onClick={handleApproveGateEntry}
                    className="px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-dark text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {scannedFarmer.status === 'SCHEDULED' ? '✓ Approve Gate Entry' : 'Already In Yard'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-xl border border-dashed border-border-subtle text-center text-xs text-on-surface-subtle">
                Select an arriving farmer from the quick shortcuts above or scan a token to proceed.
              </div>
            )}
          </div>

          {/* Right: Live Gate Sensor Status */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-4">
              <h4 className="text-sm font-bold text-primary-deep font-display">Gate Telemetry &amp; Scale Availability</h4>
              <div className="space-y-3">
                {bays.map((b) => (
                  <div key={b.bay_number} className="p-3.5 rounded-xl bg-surface-low flex items-center justify-between">
                    <div>
                      <strong className="text-xs text-primary-deep block">Bay {b.bay_number} Electronic Scale</strong>
                      <span className="text-[11px] text-secondary">North Gate Entrance • 60MT Capacity</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary-light text-primary-deep">
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Moisture & Assay Lab */}
      {activeSubTab === 'assay' && (
        <div className="p-6 md:p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-6 max-w-3xl mx-auto">
          <div>
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Step 2 • Assay &amp; Quality Certification</span>
            <h3 className="text-xl font-bold text-primary-deep font-display mt-0.5">
              Electronic Moisture Meter &amp; Grading
            </h3>
            <p className="text-xs text-secondary mt-1">
              Tests grain moisture percentage against government procurement norms (Max 12.0% for Wheat).
            </p>
          </div>

          {scannedFarmer ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-surface-low text-xs flex items-center justify-between">
                <div>
                  <strong className="text-sm text-primary-deep block">{scannedFarmer.farmer_name} ({scannedFarmer.token_number})</strong>
                  <span className="text-secondary">{scannedFarmer.crop} • {scannedFarmer.quantity_quintals} Qtl</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary-light text-primary-deep">
                  Stage: {scannedFarmer.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-primary-deep">Sample Moisture Content (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={moistureValue}
                    onChange={(e) => setMoistureValue(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-low text-sm font-mono font-bold focus:bg-white focus:outline-none focus:border-primary"
                  />
                  <span className="text-[11px] text-on-surface-subtle">Permissible standard: &le; 12.0%</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-primary-deep">Assay Grade</label>
                  <select className="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-low text-sm font-semibold focus:bg-white focus:outline-none focus:border-primary">
                    <option>Grade A (Fair Average Quality - FAQ)</option>
                    <option>Grade B (Minor Chaff)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleCertifyAssay}
                  disabled={loading}
                  className="px-6 py-2.5 bg-primary text-white hover:bg-primary-dark font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  ✓ Certify Quality &amp; Advance to Scale
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-on-surface-subtle border border-dashed border-border-subtle rounded-xl">
              Please select or verify a token above to perform quality certification.
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: Electronic Weighbridge */}
      {activeSubTab === 'weighbridge' && (
        <div className="p-6 md:p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-6 max-w-3xl mx-auto">
          <div>
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Step 3 • Tare &amp; Gross Scale</span>
            <h3 className="text-xl font-bold text-primary-deep font-display mt-0.5">
              Electronic Weighbridge Scale Slip
            </h3>
            <p className="text-xs text-secondary mt-1">
              Records gross vehicle weight, subtracts empty trolley tare weight, and calculates billable net weight.
            </p>
          </div>

          {scannedFarmer ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-surface-low text-xs flex items-center justify-between">
                <div>
                  <strong className="text-sm text-primary-deep block">{scannedFarmer.farmer_name} ({scannedFarmer.token_number})</strong>
                  <span className="text-secondary">{scannedFarmer.crop} • Locked MSP Rate: ₹{scannedFarmer.price_lock_rate}/qtl</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary-light text-primary-deep">
                  Stage: {scannedFarmer.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-primary-deep">Gross Laden Weight (Quintals)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={grossWeight}
                    onChange={(e) => setGrossWeight(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-low text-sm font-mono font-bold focus:bg-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-primary-deep">Empty Trolley Tare Weight (Quintals)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tareWeight}
                    onChange={(e) => setTareWeight(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border-subtle bg-surface-low text-sm font-mono font-bold focus:bg-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Live Net Load Calculation Card */}
              <div className="p-4 rounded-xl bg-surface-low/80 border border-border-light flex items-center justify-between text-xs">
                <div>
                  <span className="text-on-surface-subtle block">Calculated Net Grain Weight:</span>
                  <strong className="text-base text-primary-deep font-display font-bold">
                    {Math.max(0, parseFloat(grossWeight) - parseFloat(tareWeight)).toFixed(1)} Quintals
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-on-surface-subtle block">Calculated MSP Value:</span>
                  <strong className="text-base text-accent font-display font-bold">
                    ₹{(Math.max(0, parseFloat(grossWeight) - parseFloat(tareWeight)) * (scannedFarmer.price_lock_rate || 2585)).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleCompleteWeighment}
                  disabled={loading}
                  className="px-6 py-2.5 bg-primary text-white hover:bg-primary-dark font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  ✓ Complete Weighment &amp; Issue Scale Slip
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-on-surface-subtle border border-dashed border-border-subtle rounded-xl">
              Please select or verify a token above to input weighbridge data.
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 4: Direct Benefit Transfer (DBT) */}
      {activeSubTab === 'dbt' && (
        <div className="p-6 md:p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-6 max-w-3xl mx-auto">
          <div>
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Step 4 • Direct Benefit Transfer (PFMS)</span>
            <h3 className="text-xl font-bold text-primary-deep font-display mt-0.5">
              Direct MSP Aadhaar Bank Settlement
            </h3>
            <p className="text-xs text-secondary mt-1">
              Disburses 100% MSP funds directly into farmer's Aadhaar-linked savings account with zero intermediary commission deductions.
            </p>
          </div>

          {scannedFarmer ? (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl bg-accent-soft border border-accent/30 space-y-3">
                <div className="flex items-center justify-between border-b border-accent/20 pb-3">
                  <div>
                    <span className="text-[11px] text-accent font-bold uppercase">Beneficiary Farmer</span>
                    <strong className="text-base text-primary-deep font-display block">{scannedFarmer.farmer_name}</strong>
                    <span className="text-xs text-secondary">Aadhaar Linked: XXXX-XXXX-4812 • IFSC: PUNB002140</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-accent font-bold uppercase">Settlement Rate</span>
                    <strong className="text-base text-accent font-mono block">₹{scannedFarmer.price_lock_rate}/qtl</strong>
                    <span className="text-[10px] text-primary font-semibold">Slot-Bound Price Lock Valid</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-primary-deep">Total Disbursable Amount:</span>
                  <strong className="text-xl font-bold font-display text-primary-deep">
                    ₹{((scannedFarmer.quantity_quintals || 40) * (scannedFarmer.price_lock_rate || 2585)).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleDisbursePayment}
                  disabled={loading || scannedFarmer.status === 'PAYMENT_DISBURSED'}
                  className="px-6 py-3 bg-primary text-white hover:bg-primary-dark font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {scannedFarmer.status === 'PAYMENT_DISBURSED' ? '✓ Payment Disbursed (PFMS Ack Received)' : '⚡ Disburse Direct Benefit Transfer (DBT)'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-on-surface-subtle border border-dashed border-border-subtle rounded-xl">
              Please select a farmer above to disburse payment.
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 5: Active In-Yard Queue Table */}
      {activeSubTab === 'queue' && (
        <div className="p-6 md:p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-primary-deep font-display">
                Current Mandi Active Yard Register
              </h3>
              <p className="text-xs text-on-surface-subtle">
                Real-time queue sequencing across Bay 1 and Bay 2.
              </p>
            </div>
            <button
              onClick={refreshData}
              className="text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              ↻ Refresh Live Feed
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-light text-on-surface-subtle font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Token</th>
                  <th className="py-3 px-4">Farmer</th>
                  <th className="py-3 px-4">Crop / Qty</th>
                  <th className="py-3 px-4">Gate</th>
                  <th className="py-3 px-4">Window</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {express_slots.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-low/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary">{s.token_number}</td>
                    <td className="py-3 px-4 font-bold text-primary-deep">{s.farmer_name} ({s.village})</td>
                    <td className="py-3 px-4">{s.crop} ({s.quantity_quintals} Qtl)</td>
                    <td className="py-3 px-4">Bay {s.bay_assigned}</td>
                    <td className="py-3 px-4 font-mono font-semibold">{s.window_start} - {s.window_end}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary-light text-primary-deep">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleSelectQuickToken(s)}
                        className="text-xs font-bold text-primary hover:underline cursor-pointer"
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
