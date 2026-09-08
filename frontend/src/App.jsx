import React, { useState, useEffect } from 'react';
import StitchHeader from './components/StitchHeader';
import StitchHero from './components/StitchHero';
import StitchYardOperations from './components/StitchYardOperations';
import StitchHowItWorks from './components/StitchHowItWorks';
import StitchFooter from './components/StitchFooter';

import FarmerPassView from './components/FarmerPassView';
import VoiceSimulator from './components/VoiceSimulator';
import DisruptionSimulator from './components/DisruptionSimulator';
import MarketIntelligence from './components/MarketIntelligence';
import OfficerPortal from './components/OfficerPortal';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview'); // overview, parchi, voice, agmarknet, disruptions, officer
  const [dashboardData, setDashboardData] = useState(null);
  const [currentSelectedPass, setCurrentSelectedPass] = useState(null);
  const [backendError, setBackendError] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        setBackendError(false);

        // Default to first booking if none selected
        if (!currentSelectedPass && data.express_slots && data.express_slots.length > 0) {
          setCurrentSelectedPass(data.express_slots[0]);
        }
      } else {
        setBackendError(true);
      }
    } catch (e) {
      console.warn("Backend not yet connected:", e);
      setBackendError(true);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchToken = (tokenOrPhone) => {
    if (!dashboardData || !dashboardData.express_slots) return null;
    const clean = tokenOrPhone.trim().toLowerCase();
    const found = dashboardData.express_slots.find(
      (s) => s.token_number.toLowerCase().includes(clean) ||
             (s.phone && s.phone.includes(clean)) ||
             (s.farmer_name && s.farmer_name.toLowerCase().includes(clean))
    );
    if (found) {
      setCurrentSelectedPass(found);
      return found;
    }
    return null;
  };

  const handleSelectFarmerFromTable = (slot) => {
    setCurrentSelectedPass(slot);
    // Scroll smoothly to the hero pass card
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleShareWhatsApp = (pass) => {
    alert(
      `🌾 MandiFlow e-Parchi Forwarded!\n\n` +
      `Token: ${pass.token_number}\n` +
      `Farmer: ${pass.farmer_name} (${pass.village})\n` +
      `Crop: ${pass.crop} - ${pass.quantity_quintals} Quintals\n` +
      `Arrival Gate: North Gate (Bay ${pass.bay_assigned})\n` +
      `Window: ${pass.window_start || pass.scheduled_window_start} - ${pass.window_end || pass.scheduled_window_end}\n` +
      `Locked MSP: ₹${pass.price_lock_rate}/qtl (SHA-256 Valid)\n\n` +
      `Sent to registered mobile via WhatsApp Gateway.`
    );
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col font-body selection:bg-primary selection:text-white">
      {/* Stitch Header */}
      <StitchHeader activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Backend offline warning banner */}
      {backendError && (
        <div className="bg-accent-soft border-b border-accent/30 text-accent text-xs py-2 px-6 text-center font-semibold">
          Notice: FastAPI backend connecting on port 8000. Running in live demo mode.
        </div>
      )}

      {/* View Switcher Routing */}
      <main className="flex-1">
        {activeTab === 'overview' && (
          <>
            {/* Hero Section with Token Lookup & e-Parchi Pass */}
            <StitchHero 
              currentPass={currentSelectedPass}
              onSearchToken={handleSearchToken}
              availableTokens={dashboardData?.express_slots || []}
              onShareWhatsApp={handleShareWhatsApp}
            />

            {/* Live Yard Operations & Telemetry */}
            <StitchYardOperations 
              dashboardData={dashboardData}
              refreshData={fetchDashboard}
              onSelectFarmer={handleSelectFarmerFromTable}
            />

            {/* 3-Step Farmer Flow, Field Benchmark, & APMC Callout */}
            <StitchHowItWorks 
              onOpenVoiceAI={() => setActiveTab('voice')}
            />
          </>
        )}

        {activeTab === 'parchi' && (
          <div className="max-w-4xl mx-auto py-12 px-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Farmer Pass Verification</span>
                <h2 className="text-3xl font-bold text-primary-deep font-display">Digital Mandi e-Parchi</h2>
              </div>
              <button 
                onClick={() => setActiveTab('overview')}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                ← Back to Live Mandi
              </button>
            </div>
            <FarmerPassView 
              selectedToken={currentSelectedPass?.token_number}
              allTokens={dashboardData?.express_slots || []}
            />
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="max-w-5xl mx-auto py-12 px-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Multilingual Access Layer</span>
                <h2 className="text-3xl font-bold text-primary-deep font-display">WhatsApp Voice AI Bot</h2>
                <p className="text-sm text-secondary">Dialect voice-to-JSON intent extraction with automatic constraint allocation.</p>
              </div>
              <button 
                onClick={() => setActiveTab('overview')}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                ← Back to Live Mandi
              </button>
            </div>
            <VoiceSimulator 
              onBookingCreated={fetchDashboard}
            />
          </div>
        )}

        {activeTab === 'agmarknet' && (
          <div className="max-w-6xl mx-auto py-12 px-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Official Government Telemetry</span>
                <h2 className="text-3xl font-bold text-primary-deep font-display">Agmarknet Price &amp; Arrival Intelligence</h2>
              </div>
              <button 
                onClick={() => setActiveTab('overview')}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                ← Back to Live Mandi
              </button>
            </div>
            <MarketIntelligence />
          </div>
        )}

        {activeTab === 'disruptions' && (
          <div className="max-w-6xl mx-auto py-12 px-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Closed-Loop Control</span>
                <h2 className="text-3xl font-bold text-primary-deep font-display">Disruption &amp; Rebalancing Engine</h2>
              </div>
              <button 
                onClick={() => setActiveTab('overview')}
                className="text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                ← Back to Live Mandi
              </button>
            </div>
            <DisruptionSimulator 
              dashboardData={dashboardData || {}}
              refreshData={fetchDashboard}
            />
          </div>
        )}

        {activeTab === 'officer' && (
          <OfficerPortal 
            dashboardData={dashboardData}
            refreshData={fetchDashboard}
            onBackToFarmerView={() => setActiveTab('overview')}
          />
        )}
      </main>

      {/* Stitch Footer */}
      <StitchFooter onNavigate={(tab) => setActiveTab(tab)} />
    </div>
  );
}
