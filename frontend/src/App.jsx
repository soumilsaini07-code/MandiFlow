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
import ArthiyaPortal from './components/ArthiyaPortal';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview'); // overview, parchi, voice, agmarknet, disruptions, officer, arthiya
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

  const handleSearchToken = async (tokenOrPhone) => {
    if (!tokenOrPhone) return null;
    const clean = tokenOrPhone.trim().toLowerCase().replace(/^#/, '');

    // 1. Search in-memory Express slots & Standby queue
    const allSlots = [
      ...(dashboardData?.express_slots || []),
      ...(dashboardData?.standby_queue || [])
    ];
    let found = allSlots.find(
      (s) => s.token_number?.toLowerCase().includes(clean) ||
             (s.phone && s.phone.replace(/\D/g, '').includes(clean.replace(/\D/g, ''))) ||
             (s.farmer_name && s.farmer_name.toLowerCase().includes(clean))
    );

    // 2. Search cross-prefix (MS- vs MF-)
    if (!found) {
      const alt = clean.startsWith('ms-') ? clean.replace('ms-', 'mf-') : (clean.startsWith('mf-') ? clean.replace('mf-', 'ms-') : null);
      if (alt) {
        found = allSlots.find((s) => s.token_number?.toLowerCase().includes(alt));
      }
    }

    // 3. Live backend API lookup fallback
    if (!found) {
      try {
        const res = await fetch(`http://localhost:8000/api/token/${encodeURIComponent(clean)}`);
        if (res.ok) {
          found = await res.json();
        }
      } catch (err) {
        console.warn("Backend token lookup error:", err);
      }
    }

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

  const [whatsAppModalPass, setWhatsAppModalPass] = useState(null);
  const [copiedMessage, setCopiedMessage] = useState(false);

  const handleShareWhatsApp = (pass) => {
    setWhatsAppModalPass(pass);
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

        {activeTab === 'arthiya' && (
          <ArthiyaPortal 
            onBackToFarmerView={() => setActiveTab('overview')}
          />
        )}
      </main>

      {/* Stitch Footer */}
      <StitchFooter onNavigate={(tab) => setActiveTab(tab)} />

      {/* WhatsApp Message Preview Modal */}
      {whatsAppModalPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-surface-card rounded-2xl shadow-2xl border border-border-subtle max-w-md w-full overflow-hidden">
            {/* Modal Header */}
            <div className="bg-primary-deep p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-accent">chat</span>
                <div>
                  <h3 className="font-bold text-sm">WhatsApp e-Parchi Dispatch Preview</h3>
                  <p className="text-[11px] text-emerald-200">Recipient: +91 9812-XXXXXX ({whatsAppModalPass.farmer_name})</p>
                </div>
              </div>
              <button 
                onClick={() => setWhatsAppModalPass(null)}
                className="text-white/70 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: WhatsApp Chat Bubble */}
            <div className="p-5 bg-[#EFEAE2] space-y-4">
              <div className="text-[11px] text-center text-secondary font-medium">
                TODAY • ENCRYPTED GATEWAY DELIVERY
              </div>

              <div className="bg-white rounded-xl rounded-tl-none p-4 shadow-sm border border-[#E0D8CB] text-xs space-y-2 font-sans text-neutral-800 relative max-w-sm">
                <div className="font-bold text-primary-deep flex items-center gap-1.5 border-b border-neutral-100 pb-2">
                  <span>🌾</span>
                  <span>MandiFlow Digital Arrival Pass</span>
                </div>
                
                <p><strong>Namaste {whatsAppModalPass.farmer_name} ji!</strong></p>
                <p>Aapka Mandi arrival slot safaltapoorvak confirm ho gaya hai.</p>
                
                <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 font-mono text-[11px] space-y-1">
                  <div><strong>Token No:</strong> {whatsAppModalPass.token_number}</div>
                  <div><strong>Crop &amp; Qty:</strong> {whatsAppModalPass.crop} ({whatsAppModalPass.quantity_quintals} Qtl)</div>
                  <div><strong>Slot Window:</strong> {whatsAppModalPass.window_start || whatsAppModalPass.scheduled_window_start} - {whatsAppModalPass.window_end || whatsAppModalPass.scheduled_window_end}</div>
                  <div><strong>Gate &amp; Bay:</strong> North Gate (Weighbridge Bay {whatsAppModalPass.bay_assigned})</div>
                  <div><strong>MSP Lock:</strong> ₹{whatsAppModalPass.price_lock_rate}/qtl</div>
                  <div><strong>Entry TOTP:</strong> {whatsAppModalPass.dynamic_totp_code || '639201'}</div>
                </div>

                <p className="text-[10px] text-neutral-500 pt-1">
                  ⚠️ Gate par entry ke samay yah TOTP code officer ko dikhayein.
                </p>

                <div className="text-[10px] text-right text-neutral-400 flex items-center justify-end gap-1 pt-1">
                  <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-blue-500 font-bold">✓✓</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-surface flex items-center justify-between gap-2 border-t border-border-subtle">
              <button
                onClick={() => {
                  const messageText = `🌾 MandiFlow e-Parchi Confirmation\nToken: ${whatsAppModalPass.token_number}\nFarmer: ${whatsAppModalPass.farmer_name} (${whatsAppModalPass.village})\nCrop: ${whatsAppModalPass.crop} - ${whatsAppModalPass.quantity_quintals} Qtl\nGate: North Gate (Bay ${whatsAppModalPass.bay_assigned})\nWindow: ${whatsAppModalPass.window_start || whatsAppModalPass.scheduled_window_start} - ${whatsAppModalPass.window_end || whatsAppModalPass.scheduled_window_end}\nLocked MSP: ₹${whatsAppModalPass.price_lock_rate}/qtl\nEntry TOTP: ${whatsAppModalPass.dynamic_totp_code || '639201'}`;
                  navigator.clipboard.writeText(messageText);
                  setCopiedMessage(true);
                  setTimeout(() => setCopiedMessage(false), 2500);
                }}
                className="px-3 py-2 rounded-xl bg-surface-low border border-border-subtle text-xs font-bold text-primary-deep hover:bg-surface-low/80 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">content_copy</span>
                <span>{copiedMessage ? 'Copied!' : 'Copy Text'}</span>
              </button>

              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`🌾 *MandiFlow Arrival Pass*\nToken: ${whatsAppModalPass.token_number}\nFarmer: ${whatsAppModalPass.farmer_name}\nCrop: ${whatsAppModalPass.crop} (${whatsAppModalPass.quantity_quintals} Qtl)\nSlot: ${whatsAppModalPass.window_start || whatsAppModalPass.scheduled_window_start} - ${whatsAppModalPass.window_end || whatsAppModalPass.scheduled_window_end}\nBay: ${whatsAppModalPass.bay_assigned}\nTOTP: ${whatsAppModalPass.dynamic_totp_code || '639201'}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  <span>WhatsApp Web</span>
                </a>
                <button
                  onClick={() => setWhatsAppModalPass(null)}
                  className="px-3 py-2 rounded-xl bg-surface-low hover:bg-border-subtle text-xs font-bold text-on-surface cursor-pointer"
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
