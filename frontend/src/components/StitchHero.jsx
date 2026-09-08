import React, { useState } from 'react';

export default function StitchHero({ 
  currentPass, 
  onSearchToken, 
  availableTokens = [],
  onShareWhatsApp
}) {
  const [searchInput, setSearchInput] = useState("");
  const [feedback, setFeedback] = useState("");

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    const found = onSearchToken(searchInput.trim());
    if (found) {
      setFeedback(`Verified: Token ${found.token_number} (${found.farmer_name}) loaded!`);
    } else {
      setFeedback(`Searching for "${searchInput}"... Showing closest matched pass.`);
    }
  };

  const pass = currentPass || {
    token_number: "#MF-1042",
    farmer_name: "Sardar Gurpreet Singh",
    village: "Amritsar",
    crop: "Sharbati Wheat",
    quantity_quintals: 45,
    vehicle_type: "PB-02-AX (Tractor)",
    bay_assigned: 2,
    window_start: "10:30",
    window_end: "11:30",
    price_lock_rate: 2585.0,
    price_lock_hash: "7A9F21E8CDDC",
    status: "SCHEDULED"
  };

  const playVernacularAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text = `Namaste ${pass.farmer_name} ji. Aapka token number ${pass.token_number} hai. Aane ka samay ${pass.window_start} baje hai. Weighbridge Bay ${pass.bay_assigned} par jayein. MSP bhav ${pass.price_lock_rate} rupaye surakshit hai.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <section className="pt-12 pb-20 md:pt-16 md:pb-24 px-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
        {/* Left: Punchy Message & Clean Search Form */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <span className="text-xs font-bold tracking-wider text-accent uppercase block">
              Paced Harvest Logistics
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-primary-deep leading-[1.15] font-display">
              Smart Mandi Arrivals.<br />
              <span className="text-accent">Zero Highway Gridlock.</span>
            </h1>
            <p className="text-base sm:text-lg text-secondary leading-relaxed max-w-xl">
              Book a guaranteed 1-hour micro-window arrival slot via WhatsApp or a missed call. Avoid 3-day tractor queues, protect against distress selling, and receive direct MSP payments into your Aadhaar-linked bank account.
            </p>
          </div>

          {/* Streamlined Token Lookup Box */}
          <div className="p-6 rounded-2xl bg-surface-card border border-border-subtle shadow-sm max-w-xl space-y-4">
            <div className="text-xs font-semibold text-on-surface-subtle">
              Check Your Digital Token / Arrival Slot (e-Parchi)
            </div>
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex rounded-xl border border-border-subtle bg-surface-low/50 px-3.5 py-3 focus-within:border-primary focus-within:bg-white transition-all">
                <input 
                  className="w-full bg-transparent text-sm font-medium text-on-surface placeholder:text-on-surface-subtle/70 focus:outline-none" 
                  placeholder="Enter Pass Token (e.g. MF-0908-103) or Mobile" 
                  type="text" 
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <button 
                className="px-6 py-3 rounded-xl bg-primary text-white hover:bg-primary-dark font-bold text-sm transition-all shrink-0 cursor-pointer shadow-sm" 
                type="submit"
              >
                Check Slot
              </button>
            </form>

            {feedback && (
              <div className="text-xs font-semibold text-primary">
                {feedback}
              </div>
            )}

            {/* Quick Token Pills */}
            {availableTokens.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pt-1">
                <span className="text-[11px] text-on-surface-subtle shrink-0 font-medium">Quick Verify:</span>
                {availableTokens.slice(0, 3).map((t) => (
                  <button
                    key={t.token_number}
                    type="button"
                    onClick={() => {
                      setSearchInput(t.token_number);
                      onSearchToken(t.token_number);
                    }}
                    className="text-[11px] bg-surface-low hover:bg-primary-light text-primary-deep px-2.5 py-1 rounded-lg font-mono font-semibold border border-border-subtle transition-colors shrink-0 cursor-pointer"
                  >
                    {t.token_number} ({t.farmer_name.split(' ')[0]})
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-5 text-xs text-on-surface-subtle pt-1 border-t border-border-light/60">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">done</span> SMS &amp; WhatsApp Pass
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">done</span> Direct DBT Credit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">done</span> Slot-Bound Price Lock
              </span>
            </div>
          </div>
        </div>

        {/* Right: Crisp, Minimalist Digital Mandi Pass (e-Parchi) */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-md bg-surface-card rounded-2xl border border-border-subtle shadow-sm overflow-hidden transition-all hover:shadow-md">
            {/* Clean Header */}
            <div className="px-6 py-4 bg-primary-deep text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] text-white/70 block uppercase tracking-wider font-semibold">
                  APMC Digital Gate Pass
                </span>
                <span className="text-sm font-bold font-display">
                  किसान ई-पर्ची • Kisan e-Pass
                </span>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary-light text-primary-deep">
                {pass.status === 'PAYMENT_DISBURSED' ? 'Settled' : 'Active Slot'}
              </span>
            </div>

            {/* Card Body */}
            <div className="p-6 space-y-5">
              {/* Farmer Row */}
              <div className="flex items-center justify-between pb-4 border-b border-border-light">
                <div>
                  <span className="text-xs text-on-surface-subtle">Farmer Name</span>
                  <h3 className="text-base font-bold text-primary-deep font-display mt-0.5">
                    {pass.farmer_name}
                  </h3>
                  <span className="text-xs text-on-surface-subtle">
                    {pass.village} • {pass.phone || "+91 9812-XXXXXX"}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-on-surface-subtle uppercase font-semibold block">
                    Token No.
                  </span>
                  <span className="font-mono text-sm font-bold text-primary-deep">
                    {pass.token_number}
                  </span>
                </div>
              </div>

              {/* Crop & Bay Info */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-surface-low/50">
                  <span className="text-on-surface-subtle block mb-1">Crop &amp; Volume</span>
                  <strong className="text-primary-deep font-semibold text-sm block">
                    {pass.crop}
                  </strong>
                  <span className="text-on-surface-subtle">
                    {pass.quantity_quintals} Quintals • {pass.vehicle_type}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-low/50">
                  <span className="text-on-surface-subtle block mb-1">Arrival Gate</span>
                  <strong className="text-primary-deep font-semibold text-sm block">
                    North Gate (Bay {pass.bay_assigned})
                  </strong>
                  <span className="text-on-surface-subtle">Priority Paced Lane</span>
                </div>
              </div>

              {/* Time Slot */}
              <div className="p-4 rounded-xl bg-accent-soft border border-accent/20 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-accent uppercase tracking-wider block">
                    Arrival Window
                  </span>
                  <span className="text-base font-bold text-primary-deep font-display mt-0.5 block">
                    Today: {pass.window_start || pass.scheduled_window_start} – {pass.window_end || pass.scheduled_window_end}
                  </span>
                </div>
                <span className="material-symbols-outlined text-accent text-[26px]">schedule</span>
              </div>

              {/* Slot-Bound MSP Guarantee */}
              <div className="p-3 rounded-xl bg-primary-light/50 border border-primary/20 flex items-center justify-between text-xs">
                <div>
                  <span className="text-primary-dark font-bold block">
                    Slot-Bound Price Lock: ₹{pass.price_lock_rate}/qtl
                  </span>
                  <span className="text-[11px] text-on-surface-subtle">
                    Guaranteed MSP at booking timestamp.
                  </span>
                </div>
                <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button 
                  onClick={playVernacularAudio}
                  className="px-3.5 py-2 rounded-xl bg-surface-low hover:bg-surface-low/80 text-primary-deep text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Listen in Hindi"
                >
                  <span className="material-symbols-outlined text-[16px]">volume_up</span>
                  <span>सुनें (Hindi)</span>
                </button>

                <button 
                  onClick={() => onShareWhatsApp && onShareWhatsApp(pass)}
                  className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-dark transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Preview official WhatsApp e-Parchi notification"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span>Preview WhatsApp Message</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
