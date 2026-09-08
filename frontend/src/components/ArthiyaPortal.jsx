import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

const SAMPLE_ARHTIYAS = [
  {
    name: "Chaudhary Devi Lal Trading Co.",
    license: "HR-KAR-A101",
    phone: "+919812001122",
    secret: "arhtiya_secret_101",
    rate: 2.5
  },
  {
    name: "Kisan Sahayta Arhtiya Kendra",
    license: "HR-KAR-A102",
    phone: "+919812003344",
    secret: "arhtiya_secret_102",
    rate: 2.5
  },
  {
    name: "Bharat Kisan Commission Agency",
    license: "HR-KAR-A103",
    phone: "+919812005566",
    secret: "arhtiya_secret_103",
    rate: 2.0
  }
];

export default function ArthiyaPortal({ onBackToFarmerView }) {
  // Authentication State
  const [token, setToken] = useState(() => localStorage.getItem('mandiflow_arhtiya_token') || '');
  const [arhtiyaInfo, setArhtiyaInfo] = useState(null);
  const [loginPhone, setLoginPhone] = useState('+919812001122');
  const [loginSecret, setLoginSecret] = useState('arhtiya_secret_101');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Active View Tab: 'roster', 'commission', 'proxy-booking', 'delays'
  const [activeSubTab, setActiveSubTab] = useState('roster');

  // Data States
  const [dashboardData, setDashboardData] = useState(null);
  const [marketData, setMarketData] = useState([]);
  const [commissionData, setCommissionData] = useState(null);
  const [delayLogData, setDelayLogData] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Selected J-Form Modal
  const [selectedJForm, setSelectedJForm] = useState(null);
  const [loadingJForm, setLoadingJForm] = useState(false);

  // Proxy Booking Form State
  const [proxyForm, setProxyForm] = useState({
    farmer_name: '',
    farmer_phone: '+91',
    village: 'Rampur',
    crop: 'Wheat',
    quantity_quintals: '40',
    vehicle_type: 'Tractor-Trolley',
    preferred_date: new Date().toISOString().split('T')[0],
    preferred_time_window: '10:00'
  });
  const [proxySuccess, setProxySuccess] = useState(null);
  const [proxyError, setProxyError] = useState('');

  // Fetch Market Intelligence (Priority 3 Item 8: Always visible at top)
  const fetchMarketPrices = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/market-intelligence');
      if (res.ok) {
        const data = await res.json();
        setMarketData(data.commodities || []);
      }
    } catch (e) {
      console.error("Error fetching market intelligence:", e);
    }
  };

  // Fetch Scoped Arhtiya Dashboard
  const fetchDashboard = async (authToken = token) => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/arhtiya/dashboard', {
        headers: { 'X-Arhtiya-Token': authToken }
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        setArhtiyaInfo(data.arhtiya);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Commission Ledger
  const fetchCommissionSummary = async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await fetch('http://localhost:8000/api/arhtiya/commission-summary', {
        headers: { 'X-Arhtiya-Token': authToken }
      });
      if (res.ok) {
        const data = await res.json();
        setCommissionData(data);
      }
    } catch (e) {
      console.error("Commission summary error:", e);
    }
  };

  // Fetch Delay & Dispute Logs
  const fetchDelayLogs = async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await fetch('http://localhost:8000/api/arhtiya/delay-log', {
        headers: { 'X-Arhtiya-Token': authToken }
      });
      if (res.ok) {
        const data = await res.json();
        setDelayLogData(data);
      }
    } catch (e) {
      console.error("Delay log error:", e);
    }
  };

  // Fetch Single Digital J-Form
  const handleOpenJForm = async (tokenNumber) => {
    setLoadingJForm(true);
    try {
      const res = await fetch(`http://localhost:8000/api/token/${tokenNumber}/jform`);
      if (res.ok) {
        const data = await res.json();
        setSelectedJForm(data);
      } else {
        alert("Digital J-Form not yet generated or token invalid.");
      }
    } catch (e) {
      console.error("J-Form error:", e);
    } finally {
      setLoadingJForm(false);
    }
  };

  useEffect(() => {
    fetchMarketPrices();
    if (token) {
      fetchDashboard(token);
      fetchCommissionSummary(token);
      fetchDelayLogs(token);
    }
  }, [token]);

  // Login Handler
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/arhtiya/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone, secret: loginSecret })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToken(data.token);
        localStorage.setItem('mandiflow_arhtiya_token', data.token);
        setArhtiyaInfo(data.arhtiya);
        confetti({ particleCount: 50, spread: 60 });
        await fetchDashboard(data.token);
        await fetchCommissionSummary(data.token);
        await fetchDelayLogs(data.token);
      } else {
        setLoginError(data.detail || 'Login failed. Please verify credentials.');
      }
    } catch (err) {
      setLoginError('Could not connect to backend authentication service.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setArhtiyaInfo(null);
    setDashboardData(null);
    localStorage.removeItem('mandiflow_arhtiya_token');
  };

  // Quick Demo Login
  const handleQuickDemoLogin = (sample) => {
    setLoginPhone(sample.phone);
    setLoginSecret(sample.secret);
  };

  // Proxy Booking Submit
  const handleProxyBookingSubmit = async (e) => {
    e.preventDefault();
    setProxyError('');
    setProxySuccess(null);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/arhtiya/book-for-farmer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Arhtiya-Token': token
        },
        body: JSON.stringify({
          ...proxyForm,
          quantity_quintals: parseFloat(proxyForm.quantity_quintals)
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setProxySuccess(data.booking);
        confetti({ particleCount: 60, spread: 70 });
        // Reset form
        setProxyForm({
          farmer_name: '',
          farmer_phone: '+91',
          village: 'Rampur',
          crop: 'Wheat',
          quantity_quintals: '40',
          vehicle_type: 'Tractor-Trolley',
          preferred_date: new Date().toISOString().split('T')[0],
          preferred_time_window: '10:00'
        });
        await fetchDashboard(token);
      } else {
        setProxyError(data.detail || 'Booking allocation rejected.');
      }
    } catch (err) {
      setProxyError('Server error while allocating slot.');
    } finally {
      setLoading(false);
    }
  };

  // If Not Logged In, Render Secure Arhtiya Login Screen
  if (!token) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6 space-y-8 animate-in fade-in">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-600 flex items-center justify-center text-white shadow-sm">
              <span className="material-symbols-outlined text-[26px]">storefront</span>
            </div>
            <div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Licensed Intermediary Module</span>
              <h2 className="text-2xl font-bold text-primary-deep font-display">Arhtiya Commission Agent Portal</h2>
            </div>
          </div>
          <button 
            onClick={onBackToFarmerView}
            className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
          >
            ← Back to Farmer Portal
          </button>
        </div>

        {/* Live MSP Price Ticker (Priority 3 Item 8: Always visible upfront) */}
        <div className="p-4 rounded-2xl bg-surface-card border border-border-subtle shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-primary-deep border-b border-border-light pb-2">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
              <span>Official 2026-27 APMC Government MSP &amp; Market Intelligence</span>
            </span>
            <span className="text-accent text-[11px]">Agmarknet Ground Synchronized</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {marketData.slice(0, 4).map((item) => (
              <div key={item.crop} className="p-2.5 rounded-xl bg-surface-low border border-border-light">
                <span className="text-[11px] text-on-surface-subtle font-semibold block">{item.crop}</span>
                <strong className="text-sm text-primary-deep font-mono">₹{item.official_msp}/qtl</strong>
                <span className="text-[10px] text-emerald-600 block font-medium">
                  +₹{item.distress_risk_spread} vs Distress
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Login Form Box */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-7 p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-primary-deep font-display">Agent License Authorization</h3>
              <p className="text-xs text-secondary mt-1">
                Enter your registered mobile number and unique passkey to access your farmer roster, proxy booking terminal, and commission accounts.
              </p>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-on-surface-subtle block mb-1">
                  Registered Arhtiya Phone
                </label>
                <input
                  type="text"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  placeholder="+919812001122"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-low border border-border-subtle text-xs font-mono text-on-surface focus:bg-white focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-on-surface-subtle block mb-1">
                  Agent Secret Passkey
                </label>
                <input
                  type="password"
                  value={loginSecret}
                  onChange={(e) => setLoginSecret(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-low border border-border-subtle text-xs font-mono text-on-surface focus:bg-white focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-dark transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">lock_open</span>
                <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
              </button>
            </form>
          </div>

          {/* Quick Demo Credentials */}
          <div className="md:col-span-5 p-6 rounded-2xl bg-surface-low border border-border-subtle space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-primary-deep">
              <span className="material-symbols-outlined text-amber-600 text-[18px]">badge</span>
              <span>Demo Agent Profiles (Seeded)</span>
            </div>
            <p className="text-[11px] text-secondary">
              Click any agent below to automatically test data isolation, commission tracking, and proxy booking:
            </p>

            <div className="space-y-2.5">
              {SAMPLE_ARHTIYAS.map((agent) => (
                <div 
                  key={agent.license}
                  onClick={() => handleQuickDemoLogin(agent)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-1 ${
                    loginPhone === agent.phone 
                      ? 'bg-white border-primary shadow-xs' 
                      : 'bg-surface-card border-border-subtle hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-primary-deep font-semibold text-xs">{agent.name}</strong>
                    <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                      {agent.rate}% Comm.
                    </span>
                  </div>
                  <div className="text-[11px] text-secondary flex items-center justify-between">
                    <span>License: <code className="font-mono text-primary">{agent.license}</code></span>
                    <span>{agent.phone}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Logged-in View
  const { metrics, express_slots = [], farmers = [] } = dashboardData || {};

  const filteredSlots = express_slots.filter((s) => {
    if (filterStatus === 'ALL') return true;
    return s.status === filterStatus;
  });

  return (
    <div className="max-w-6xl mx-auto py-8 px-6 space-y-8 animate-in fade-in">
      {/* Top Banner: Arhtiya Profile + Navigation */}
      <div className="p-6 rounded-3xl bg-surface-card border border-border-subtle shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-2xs">
            <span className="material-symbols-outlined text-[32px]">storefront</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-primary-deep font-display leading-tight">
                {arhtiyaInfo?.name}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                Licensed Agent
              </span>
            </div>
            <p className="text-xs text-secondary mt-0.5 flex items-center gap-3">
              <span>License: <strong className="font-mono text-primary">{arhtiyaInfo?.license_number}</strong></span>
              <span>•</span>
              <span>Phone: <strong className="font-mono">{arhtiyaInfo?.phone}</strong></span>
              <span>•</span>
              <span>Commission: <strong className="text-amber-700 font-bold">{arhtiyaInfo?.commission_rate}%</strong></span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          <button
            onClick={() => {
              fetchDashboard();
              fetchCommissionSummary();
              fetchDelayLogs();
            }}
            className="p-2 rounded-xl bg-surface-low text-primary-deep hover:bg-surface-low/80 border border-border-subtle cursor-pointer transition-all"
            title="Refresh Data"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-surface-low border border-border-subtle text-xs font-bold text-red-600 hover:bg-red-50 transition-all cursor-pointer"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Priority 3 Item 8: Always Upfront Market Intelligence Ticker */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900 via-primary-deep to-neutral-900 text-white shadow-md">
        <div className="flex items-center justify-between text-xs font-bold border-b border-white/10 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-accent text-[18px]">trending_up</span>
            <span>Live APMC MSP Price Benchmark &amp; Guaranteed Rate Shield</span>
          </div>
          <span className="text-[11px] text-emerald-200">2026-27 Ministry of Agriculture Ingest</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {marketData.map((item) => (
            <div key={item.crop} className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/10">
              <span className="text-[11px] text-emerald-200 block truncate">{item.crop}</span>
              <strong className="text-sm font-mono block">₹{item.official_msp}/qtl</strong>
              <span className="text-[10px] text-accent font-semibold">
                Avoids -₹{item.distress_risk_spread} loss
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle shadow-2xs">
          <span className="text-[11px] text-on-surface-subtle font-semibold block">My Farmer Roster</span>
          <strong className="text-2xl text-primary-deep font-display mt-1 block">
            {metrics?.total_farmers || 0} Kisans
          </strong>
          <span className="text-[11px] text-secondary mt-1 block">
            {metrics?.total_bookings || 0} Total Bookings
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle shadow-2xs">
          <span className="text-[11px] text-on-surface-subtle font-semibold block">In-Yard Currently</span>
          <strong className="text-2xl text-accent font-display mt-1 block">
            {metrics?.in_yard_count || 0} Loads
          </strong>
          <span className="text-[11px] text-secondary mt-1 block">
            {metrics?.scheduled_count || 0} Awaiting Gate Entry
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle shadow-2xs">
          <span className="text-[11px] text-on-surface-subtle font-semibold block">Total Procurement Val.</span>
          <strong className="text-2xl text-primary-deep font-mono font-bold mt-1 block">
            ₹{(metrics?.total_disbursed_payment || 0).toLocaleString('en-IN')}
          </strong>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
            {metrics?.completed_count || 0} Completed Disbursed
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/20 border border-amber-500/30 shadow-2xs">
          <span className="text-[11px] text-amber-900 font-bold block">Commission Earned</span>
          <strong className="text-2xl text-amber-900 font-mono font-bold mt-1 block">
            ₹{(metrics?.total_commission_earned || 0).toLocaleString('en-IN')}
          </strong>
          <span className="text-[11px] text-amber-800 font-semibold mt-1 block">
            @{arhtiyaInfo?.commission_rate}% Agent Brokerage
          </span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border-light pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('roster')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'roster'
              ? 'bg-primary text-white shadow-xs'
              : 'text-on-surface-subtle hover:bg-surface-low'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">groups</span>
          <span>Farmer Roster &amp; Live Status</span>
        </button>

        <button
          onClick={() => setActiveSubTab('proxy-booking')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'proxy-booking'
              ? 'bg-primary text-white shadow-xs'
              : 'text-on-surface-subtle hover:bg-surface-low'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">add_circle</span>
          <span>Book on Behalf of Farmer</span>
        </button>

        <button
          onClick={() => setActiveSubTab('commission')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'commission'
              ? 'bg-primary text-white shadow-xs'
              : 'text-on-surface-subtle hover:bg-surface-low'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
          <span>Commission Ledger</span>
        </button>

        <button
          onClick={() => setActiveSubTab('delays')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'delays'
              ? 'bg-primary text-white shadow-xs'
              : 'text-on-surface-subtle hover:bg-surface-low'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">history_toggle_off</span>
          <span>Disruption &amp; Delay Log</span>
        </button>
      </div>

      {/* TAB 1: Roster & Live Status Tracker */}
      {activeSubTab === 'roster' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-primary-deep font-display">
                Assigned Farmer Arrivals
              </h3>
              <p className="text-xs text-secondary">
                Track current gate, assay, and weighbridge states for all farmers mapped to your agency.
              </p>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1 text-xs">
              {['ALL', 'SCHEDULED', 'GATE_ENTRY', 'QUALITY_ASSAY', 'WEIGHED', 'PAYMENT_DISBURSED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    filterStatus === st
                      ? 'bg-primary-deep text-white font-bold'
                      : 'bg-surface-low text-on-surface-subtle hover:bg-surface-low/80'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-card shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-low text-on-surface-subtle border-b border-border-subtle uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Token / Pass</th>
                  <th className="py-3 px-4">Farmer Details</th>
                  <th className="py-3 px-4">Crop &amp; Qty</th>
                  <th className="py-3 px-4">Arrival Window</th>
                  <th className="py-3 px-4">Bay</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Est. Payout</th>
                  <th className="py-3 px-4 text-right">Digital J-Form</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light font-medium">
                {filteredSlots.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-on-surface-subtle text-xs">
                      No farmer arrival slots matching selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredSlots.map((slot) => (
                    <tr key={slot.token_number} className="hover:bg-surface-low/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-primary-deep">
                        {slot.token_number}
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-primary-deep block font-display">{slot.farmer_name}</strong>
                        <span className="text-[11px] text-on-surface-subtle font-normal">{slot.village} • {slot.farmer_phone}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-primary-deep">{slot.crop}</span>
                        <span className="text-[11px] text-secondary block">{slot.quantity_quintals} Qtl</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs">{slot.scheduled_window_start} - {slot.scheduled_window_end}</span>
                        {slot.delay_offset_minutes > 0 && (
                          <span className="text-[10px] text-accent font-bold block">
                            +{slot.delay_offset_minutes}m buffer applied
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-primary-deep">
                        Bay {slot.bay_assigned}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          slot.status === 'PAYMENT_DISBURSED' ? 'bg-emerald-100 text-emerald-800' :
                          slot.status === 'WEIGHED' ? 'bg-blue-100 text-blue-800' :
                          slot.status === 'QUALITY_ASSAY' ? 'bg-purple-100 text-purple-800' :
                          slot.status === 'GATE_ENTRY' ? 'bg-amber-100 text-amber-800' :
                          'bg-neutral-100 text-neutral-800'
                        }`}>
                          {slot.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        ₹{(slot.payment_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenJForm(slot.token_number)}
                          className="px-2.5 py-1 rounded-lg bg-surface-low border border-border-subtle text-[11px] font-bold text-primary-deep hover:bg-surface-low/80 cursor-pointer inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                          <span>J-Form</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Proxy Booking (Book on behalf of farmer) */}
      {activeSubTab === 'proxy-booking' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-7 p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm space-y-5">
            <div>
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Broker Terminal</span>
              <h3 className="text-xl font-bold text-primary-deep font-display mt-0.5">
                Proxy Slot Reservation for Farmer
              </h3>
              <p className="text-xs text-secondary mt-1">
                Directly book an arrival slot on behalf of a farmer without requiring WhatsApp voice interaction. The farmer will automatically be mapped to your agency.
              </p>
            </div>

            {proxyError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{proxyError}</span>
              </div>
            )}

            {proxySuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                  <span>Arrival Slot Successfully Confirmed!</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div>Token: <strong>{proxySuccess.token_number}</strong></div>
                  <div>Gate Bay: <strong>Bay {proxySuccess.bay_assigned}</strong></div>
                  <div>Window: <strong>{proxySuccess.window_start} - {proxySuccess.window_end}</strong></div>
                  <div>Dynamic TOTP: <strong>{proxySuccess.dynamic_totp_code}</strong></div>
                </div>
              </div>
            )}

            <form onSubmit={handleProxyBookingSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-on-surface-subtle block mb-1">Farmer Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jaswant Singh"
                    value={proxyForm.farmer_name}
                    onChange={(e) => setProxyForm({ ...proxyForm, farmer_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-low border border-border-subtle focus:bg-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-bold text-on-surface-subtle block mb-1">Farmer Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="+919812XXXXXX"
                    value={proxyForm.farmer_phone}
                    onChange={(e) => setProxyForm({ ...proxyForm, farmer_phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-low border border-border-subtle font-mono focus:bg-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-on-surface-subtle block mb-1">Village</label>
                  <input
                    type="text"
                    required
                    value={proxyForm.village}
                    onChange={(e) => setProxyForm({ ...proxyForm, village: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-low border border-border-subtle focus:bg-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-bold text-on-surface-subtle block mb-1">Crop</label>
                  <select
                    value={proxyForm.crop}
                    onChange={(e) => setProxyForm({ ...proxyForm, crop: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-low border border-border-subtle focus:bg-white focus:outline-none focus:border-primary font-semibold"
                  >
                    <option value="Wheat">Wheat (₹2,585 MSP)</option>
                    <option value="Mustard">Mustard (₹5,650 MSP)</option>
                    <option value="Paddy">Paddy (₹2,300 MSP)</option>
                    <option value="Maize">Maize (₹2,090 MSP)</option>
                    <option value="Gram">Gram (₹5,440 MSP)</option>
                    <option value="Bajra">Bajra (₹2,500 MSP)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-on-surface-subtle block mb-1">Quantity (Quintals)</label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={proxyForm.quantity_quintals}
                    onChange={(e) => setProxyForm({ ...proxyForm, quantity_quintals: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-low border border-border-subtle font-mono focus:bg-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-on-surface-subtle block mb-1">Vehicle</label>
                  <select
                    value={proxyForm.vehicle_type}
                    onChange={(e) => setProxyForm({ ...proxyForm, vehicle_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-low border border-border-subtle focus:bg-white focus:outline-none focus:border-primary"
                  >
                    <option value="Tractor-Trolley">Tractor-Trolley</option>
                    <option value="Mini-Truck">Mini-Truck</option>
                    <option value="Truck">Heavy Truck</option>
                    <option value="Bullock Cart">Bullock Cart</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-on-surface-subtle block mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={proxyForm.preferred_date}
                    onChange={(e) => setProxyForm({ ...proxyForm, preferred_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-low border border-border-subtle font-mono focus:bg-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-bold text-on-surface-subtle block mb-1">Target Window</label>
                  <select
                    value={proxyForm.preferred_time_window}
                    onChange={(e) => setProxyForm({ ...proxyForm, preferred_time_window: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-surface-low border border-border-subtle font-mono focus:bg-white focus:outline-none focus:border-primary"
                  >
                    <option value="08:00">08:00 - 09:00 AM</option>
                    <option value="09:00">09:00 - 10:00 AM</option>
                    <option value="10:00">10:00 - 11:00 AM</option>
                    <option value="11:00">11:00 - 12:00 PM</option>
                    <option value="12:00">12:00 - 01:00 PM</option>
                    <option value="13:00">01:00 - 02:00 PM</option>
                    <option value="14:00">02:00 - 03:00 PM</option>
                    <option value="15:00">03:00 - 04:00 PM</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
                <span>{loading ? 'Allocating Staggered Window...' : 'Confirm Proxy Booking & Issue Token'}</span>
              </button>
            </form>
          </div>

          <div className="md:col-span-5 p-6 rounded-2xl bg-surface-low border border-border-subtle space-y-4 text-xs">
            <div className="flex items-center gap-2 text-primary-deep font-bold">
              <span className="material-symbols-outlined text-amber-600 text-[18px]">verified_user</span>
              <span>Regulatory APMC Proxy Standards</span>
            </div>
            <p className="text-secondary leading-relaxed">
              Under Haryana APMC Bye-Laws, licensed commission agents may book arrival windows on behalf of registered farmers.
            </p>
            <ul className="space-y-2 text-[11px] text-secondary">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Automatic 2026-27 MSP Price Lock with SHA-256 seal.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Anti-scalping: restricted to 1 active reservation per farmer phone per day.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Farmer receives instant SMS / WhatsApp notification with 60s dynamic TOTP.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 3: Commission Ledger */}
      {activeSubTab === 'commission' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-primary-deep font-display">
                Commission Settlement Ledger
              </h3>
              <p className="text-xs text-secondary">
                Audited calculation of {arhtiyaInfo?.commission_rate}% commission on all completed and disbursed procurement transactions.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-on-surface-subtle block">Cumulative Brokerage Earned</span>
              <span className="text-lg font-mono font-bold text-amber-900">
                ₹{(commissionData?.total_commission_earned || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Daily Aggregate Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(commissionData?.daily_summary || []).map((day) => (
              <div key={day.date} className="p-4 rounded-2xl bg-surface-card border border-border-subtle shadow-2xs space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-bold text-primary-deep">
                  <span>{day.date}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                    {day.bookings_count} Loads
                  </span>
                </div>
                <div className="text-[11px] text-secondary">
                  Total Volume: <strong>{day.total_quintals} Qtl</strong>
                </div>
                <div className="text-[11px] text-secondary">
                  Procurement Value: <strong className="font-mono">₹{day.procurement_value.toLocaleString('en-IN')}</strong>
                </div>
                <div className="text-xs pt-1 border-t border-border-light flex items-center justify-between font-bold text-amber-900">
                  <span>Commission ({arhtiyaInfo?.commission_rate}%):</span>
                  <span className="font-mono">₹{day.commission_earned.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Transaction Table */}
          <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-surface-card shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-low text-on-surface-subtle border-b border-border-subtle uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Token</th>
                  <th className="py-3 px-4">Farmer</th>
                  <th className="py-3 px-4">Crop</th>
                  <th className="py-3 px-4">Net Load</th>
                  <th className="py-3 px-4">MSP Rate</th>
                  <th className="py-3 px-4">Procurement Val.</th>
                  <th className="py-3 px-4 text-right">Commission ({arhtiyaInfo?.commission_rate}%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light font-medium">
                {(commissionData?.transactions || []).length === 0 ? (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-on-surface-subtle text-xs">
                      No disbursed transactions recorded yet. Completed DBT payments will settle here automatically.
                    </td>
                  </tr>
                ) : (
                  (commissionData?.transactions || []).map((t) => (
                    <tr key={t.token_number} className="hover:bg-surface-low/50">
                      <td className="py-3 px-4 font-mono text-secondary">{t.date}</td>
                      <td className="py-3 px-4 font-mono font-bold text-primary-deep">{t.token_number}</td>
                      <td className="py-3 px-4 font-bold text-primary-deep">{t.farmer_name}</td>
                      <td className="py-3 px-4">{t.crop}</td>
                      <td className="py-3 px-4 font-mono">{t.quantity_quintals} Qtl</td>
                      <td className="py-3 px-4 font-mono">₹{t.rate}</td>
                      <td className="py-3 px-4 font-mono font-bold">₹{t.payment_amount.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-mono font-bold text-right text-amber-900">
                        ₹{t.commission_earned.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Disruption & Delay Transparency Log (Priority 3 Item 6) */}
      {activeSubTab === 'delays' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-primary-deep font-display">
              Dispute &amp; Mandi Delay Transparency Log
            </h3>
            <p className="text-xs text-secondary">
              Official system-audited record of APMC yard incidents (scale breakdowns, weather buffers, lab backlogs) affecting your farmers. Provides proof that arrival shifts were mandated by mandi management.
            </p>
          </div>

          <div className="space-y-4">
            {(delayLogData?.delay_records || []).length === 0 ? (
              <div className="p-8 rounded-2xl bg-surface-card border border-border-subtle text-center text-xs text-on-surface-subtle">
                No active yard disruptions recorded affecting your farmers today. All bays running to schedule.
              </div>
            ) : (
              (delayLogData?.delay_records || []).map((rec) => (
                <div key={rec.incident_id} className="p-5 rounded-2xl bg-surface-card border border-accent/30 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm text-primary-deep">
                      <span className="material-symbols-outlined text-accent text-[20px]">warning</span>
                      <span>{rec.description || rec.incident_type}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-accent-soft text-accent text-xs font-bold font-mono">
                      +{rec.delay_minutes} min shift
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-surface-low border border-border-light text-xs space-y-2">
                    <strong className="text-[11px] text-on-surface-subtle uppercase tracking-wider block">
                      Your Affected Farmers in this Shift ({rec.affected_my_farmers.length}):
                    </strong>
                    {rec.affected_my_farmers.length === 0 ? (
                      <span className="text-[11px] text-secondary italic">None of your assigned farmers were affected by this specific disruption.</span>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {rec.affected_my_farmers.map((f) => (
                          <div key={f.token_number} className="p-2 rounded-lg bg-white border border-border-subtle font-mono text-[11px] flex items-center justify-between">
                            <span>{f.farmer_name} ({f.token_number})</span>
                            <span className="text-accent font-bold">Shifted to {f.revised_start}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Proactive Notification Audit History */}
          {(delayLogData?.notification_history || []).length > 0 && (
            <div className="p-5 rounded-2xl bg-surface-card border border-border-subtle shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-primary-deep font-display uppercase tracking-wider">
                Proactive WhatsApp Dispatch Receipts
              </h4>
              <div className="space-y-2 text-xs">
                {(delayLogData?.notification_history || []).map((n, i) => (
                  <div key={i} className="p-3 rounded-xl bg-surface-low border border-border-light flex items-center justify-between">
                    <div>
                      <span className="font-bold text-primary-deep block">{n.farmer_name} ({n.recipient_phone})</span>
                      <p className="text-[11px] text-secondary mt-0.5">{n.message_body}</p>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full font-bold shrink-0">
                      SENT • {n.channel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Digital J-Form Modal Viewer (Priority 3 Item 7) */}
      {selectedJForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface-card rounded-2xl shadow-2xl border border-border-subtle max-w-2xl w-full overflow-hidden">
            {/* J-Form Header */}
            <div className="bg-primary-deep p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[24px] text-accent">description</span>
                <div>
                  <h3 className="font-bold text-base font-display">e-J-Form APMC Sale Confirmation Slip</h3>
                  <p className="text-[11px] text-emerald-200">Haryana State Agricultural Marketing Board (e-NAM Certified)</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedJForm(null)}
                className="text-white/70 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* J-Form Printable Body */}
            <div className="p-6 bg-white space-y-5 text-xs text-neutral-800 font-sans border-b border-border-subtle">
              <div className="flex items-center justify-between border-b pb-3 border-neutral-200">
                <div>
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-bold">Certificate Number</span>
                  <strong className="text-base font-mono text-primary-deep">{selectedJForm.jform_number}</strong>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wider block font-bold">Token &amp; Date</span>
                  <span className="font-mono text-xs font-bold text-neutral-700">{selectedJForm.token_number} • {selectedJForm.date}</span>
                </div>
              </div>

              {/* Farmer and Agent Row */}
              <div className="grid grid-cols-2 gap-4 p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
                <div>
                  <span className="text-[10px] text-neutral-500 font-bold block uppercase">Seller (Kisan)</span>
                  <strong className="text-sm text-neutral-900 block font-display">{selectedJForm.farmer_name}</strong>
                  <span className="text-[11px] text-neutral-600">{selectedJForm.village} • {selectedJForm.farmer_phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 font-bold block uppercase">Licensed Arhtiya (Commission Agent)</span>
                  <strong className="text-sm text-neutral-900 block font-display">{selectedJForm.arhtiya?.name}</strong>
                  <span className="text-[11px] text-neutral-600">License: {selectedJForm.arhtiya?.license_number}</span>
                </div>
              </div>

              {/* Scale Weights & Financials */}
              <div className="grid grid-cols-4 gap-3 text-center border-t border-b border-neutral-200 py-3 font-mono">
                <div>
                  <span className="text-[10px] text-neutral-500 block font-sans">Crop</span>
                  <strong className="text-sm text-neutral-900">{selectedJForm.crop}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block font-sans">Gross / Tare / Net</span>
                  <strong className="text-sm text-neutral-900">{selectedJForm.net_weight_quintals} Qtl</strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block font-sans">Locked MSP Rate</span>
                  <strong className="text-sm text-neutral-900">₹{selectedJForm.price_lock_rate}/qtl</strong>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-500 block font-sans">Net Payout (DBT)</span>
                  <strong className="text-sm text-emerald-700">₹{selectedJForm.total_procurement_value.toLocaleString('en-IN')}</strong>
                </div>
              </div>

              {/* Cryptographic SHA-256 Seal */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-[11px]">
                <div className="space-y-0.5">
                  <span className="font-bold text-emerald-900 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-emerald-700">verified</span>
                    <span>SHA-256 Cryptographic MSP Integrity Seal</span>
                  </span>
                  <code className="font-mono text-[10px] text-emerald-800 block">
                    {selectedJForm.security_seal?.price_lock_hash}
                  </code>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-700 font-bold block">PFMS / DBT STATUS</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold text-[10px]">
                    {selectedJForm.payment_status}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-surface flex items-center justify-between">
              <span className="text-[11px] text-secondary">
                e-J-Form recognized under National Agriculture Market (e-NAM) Act.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-dark transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Print e-J-Form</span>
                </button>
                <button
                  onClick={() => setSelectedJForm(null)}
                  className="px-4 py-2 rounded-xl bg-surface-low border border-border-subtle text-xs font-bold text-on-surface hover:bg-surface-low/80 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
