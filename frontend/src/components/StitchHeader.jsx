import React from 'react';

export default function StitchHeader({ activeTab, setActiveTab }) {
  return (
    <>
      {/* Subtle, Clean Top Utility Bar */}
      <div className="border-b border-border-light bg-surface-low/60 text-xs py-2 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-on-surface-subtle">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            <span>Govt. of India Initiative • e-NAM Integrated Mandi Pacing</span>
          </div>
          <div className="flex items-center gap-4 text-[13px]">
            <span>
              Toll-Free Kisan Helpline: <strong className="text-primary-deep font-semibold">1800-180-1551</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Clean, Spacious Header */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-border-light">
        <div className="max-w-6xl mx-auto h-20 px-6 flex items-center justify-between">
          {/* Brand */}
          <div 
            onClick={() => setActiveTab('overview')} 
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm">
              <span className="material-symbols-outlined text-[22px]">eco</span>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-primary-deep font-display block leading-none">
                MandiFlow
              </span>
              <span className="text-[11px] text-on-surface-subtle font-medium">
                Kisan Mandi Smart Arrival
              </span>
            </div>
          </div>

          {/* Minimal Navigation */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-on-surface-subtle">
            <button
              onClick={() => setActiveTab('overview')}
              className={`hover:text-primary transition-colors cursor-pointer ${activeTab === 'overview' ? 'text-primary font-bold border-b-2 border-primary pb-1' : ''}`}
            >
              Live Mandi
            </button>
            <button
              onClick={() => setActiveTab('parchi')}
              className={`hover:text-primary transition-colors cursor-pointer ${activeTab === 'parchi' ? 'text-primary font-bold border-b-2 border-primary pb-1' : ''}`}
            >
              Digital e-Parchi
            </button>
            <button
              onClick={() => setActiveTab('voice')}
              className={`hover:text-primary transition-colors cursor-pointer ${activeTab === 'voice' ? 'text-primary font-bold border-b-2 border-primary pb-1' : ''}`}
            >
              WhatsApp Voice AI
            </button>
            <button
              onClick={() => setActiveTab('agmarknet')}
              className={`hover:text-primary transition-colors cursor-pointer ${activeTab === 'agmarknet' ? 'text-primary font-bold border-b-2 border-primary pb-1' : ''}`}
            >
              Agmarknet Rates
            </button>
            <button
              onClick={() => setActiveTab('disruptions')}
              className={`hover:text-primary transition-colors cursor-pointer ${activeTab === 'disruptions' ? 'text-accent font-bold border-b-2 border-accent pb-1' : ''}`}
            >
              Disruption Engine
            </button>
          </nav>

          {/* Language & CTA Button */}
          <div className="flex items-center gap-3">
            {/* Google Translate Language Selector Dropdown */}
            <div className="relative flex items-center">
              <span className="material-symbols-outlined text-[17px] text-primary absolute left-2.5 pointer-events-none">
                translate
              </span>
              <select
                aria-label="Select Language"
                defaultValue="en"
                onChange={(e) => {
                  const langCode = e.target.value;
                  document.cookie = `googtrans=/en/${langCode}; path=/;`;
                  document.cookie = `googtrans=/en/${langCode}; path=/; domain=${window.location.hostname};`;
                  const combo = document.querySelector('.goog-te-combo');
                  if (combo) {
                    combo.value = langCode;
                    combo.dispatchEvent(new Event('change'));
                  } else {
                    window.location.reload();
                  }
                }}
                className="pl-8 pr-7 py-1.5 rounded-full text-xs font-bold text-primary-deep bg-surface-low/80 hover:bg-surface-low border border-border-subtle focus:outline-none focus:border-primary transition-all cursor-pointer shadow-2xs appearance-none"
              >
                <option value="en">English (EN)</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="gu">ગુજરાતી (Gujarati)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="bn">বাংলা (Bengali)</option>
              </select>
              <span className="material-symbols-outlined text-[14px] text-on-surface-subtle absolute right-2 pointer-events-none">
                expand_more
              </span>
            </div>

            <button 
              onClick={() => setActiveTab('officer')}
              className={`px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-sm cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'officer'
                  ? 'bg-accent text-white shadow-md'
                  : 'bg-primary text-white hover:bg-primary-dark'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">admin_panel_settings</span>
              <span>Officer Portal</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
