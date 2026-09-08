import React from 'react';

export default function StitchHowItWorks({ onOpenVoiceAI }) {
  return (
    <>
      {/* How It Works: 3-Step Farmer Flow */}
      <section className="py-20 md:py-28 px-6 bg-surface" id="how-it-works">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="max-w-xl">
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Simple &amp; App-Free</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-deep mt-1 font-display">
              How MandiFlow Works
            </h2>
            <p className="text-base text-secondary mt-2">
              No complicated app downloads. Simple voice notes and missed calls in your mother tongue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm flex flex-col space-y-4 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-full bg-surface-low text-primary-deep font-bold text-sm flex items-center justify-center font-mono">
                01
              </div>
              <h3 className="text-lg font-bold text-primary-deep font-display">
                Send Voice Note or Call
              </h3>
              <p className="text-sm text-secondary leading-relaxed">
                Send a 10-second WhatsApp audio message in your dialect stating your crop volume, or place a free missed call.
              </p>
              <div className="pt-2">
                <button
                  onClick={onOpenVoiceAI}
                  className="text-xs font-bold text-primary hover:text-primary-dark inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Test Voice Bot Now</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm flex flex-col space-y-4 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-full bg-surface-low text-primary-deep font-bold text-sm flex items-center justify-center font-mono">
                02
              </div>
              <h3 className="text-lg font-bold text-primary-deep font-display">
                Receive Your Paced Slot
              </h3>
              <p className="text-sm text-secondary leading-relaxed">
                Get an exact 1-hour gate arrival window on WhatsApp with a tamper-resistant TOTP QR pass and slot-bound MSP rate lock.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-2xl bg-surface-card border border-border-subtle shadow-sm flex flex-col space-y-4 hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-full bg-surface-low text-primary-deep font-bold text-sm flex items-center justify-center font-mono">
                03
              </div>
              <h3 className="text-lg font-bold text-primary-deep font-display">
                15-Min Weighment &amp; DBT
              </h3>
              <p className="text-sm text-secondary leading-relaxed">
                Arrive at the designated bay, clear automated assay testing, and funds disburse directly into your Aadhaar-linked bank account.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Comparison Table: Streamlined & Breathable */}
      <section className="py-20 md:py-24 border-t border-border-light bg-surface-low/30" id="impact">
        <div className="max-w-5xl mx-auto px-6 space-y-10">
          <div>
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Field Benchmark</span>
            <h2 className="text-3xl font-bold text-primary-deep mt-1 font-display">
              Traditional Mandi vs. MandiFlow
            </h2>
            <p className="text-sm text-secondary mt-1">
              Field-measured operational gains across peak Rabi harvest arrivals.
            </p>
          </div>

          <div className="rounded-2xl bg-surface-card border border-border-subtle shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border-light text-xs font-bold uppercase tracking-wider text-on-surface-subtle bg-surface-low/50">
                  <th className="py-4 px-6">Parameters</th>
                  <th className="py-4 px-6 text-on-surface-subtle">Traditional Mandi System</th>
                  <th className="py-4 px-6 text-primary-deep bg-primary-light/40">MandiFlow Paced Model</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                <tr className="hover:bg-surface-low/30 transition-colors">
                  <td className="py-5 px-6 font-semibold text-primary-deep">Arrival Wait Time</td>
                  <td className="py-5 px-6 text-secondary">36 to 48 Hours in roadside queues</td>
                  <td className="py-5 px-6 font-bold text-primary bg-primary-light/20">Under 45 Minutes guaranteed</td>
                </tr>
                <tr className="hover:bg-surface-low/30 transition-colors">
                  <td className="py-5 px-6 font-semibold text-primary-deep">Diesel &amp; Idling Cost</td>
                  <td className="py-5 px-6 text-secondary">₹1,500 – ₹2,200 wasted diesel per trip</td>
                  <td className="py-5 px-6 font-bold text-primary bg-primary-light/20">₹0 Wasted Tractor Diesel</td>
                </tr>
                <tr className="hover:bg-surface-low/30 transition-colors">
                  <td className="py-5 px-6 font-semibold text-primary-deep">Distress Selling Loss</td>
                  <td className="py-5 px-6 text-secondary">₹500 – ₹1,200/qtl below MSP due to queue exhaustion</td>
                  <td className="py-5 px-6 font-bold text-primary bg-primary-light/20">100% Locked at Official MSP Rate</td>
                </tr>
                <tr className="hover:bg-surface-low/30 transition-colors">
                  <td className="py-5 px-6 font-semibold text-primary-deep">Farmer Comfort</td>
                  <td className="py-5 px-6 text-secondary">Sleeping under trolleys on roadside</td>
                  <td className="py-5 px-6 font-bold text-primary bg-primary-light/20">Rest comfortably at home until window</td>
                </tr>
                <tr className="hover:bg-surface-low/30 transition-colors">
                  <td className="py-5 px-6 font-semibold text-primary-deep">Weighment &amp; DBT Speed</td>
                  <td className="py-5 px-6 text-secondary">Manual slips, payment delays up to 14 days</td>
                  <td className="py-5 px-6 font-bold text-primary bg-primary-light/20">Instant digital assay &amp; direct DBT</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Dignified APMC Callout */}
      <section className="py-20 md:py-28 px-6" id="officers">
        <div className="max-w-5xl mx-auto rounded-3xl bg-primary-deep text-white p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-10 shadow-lg">
          <div className="space-y-3 max-w-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-white/70">
              For Mandi Secretaries &amp; APMC Boards
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold font-display">
              Bring Smart Pacing to Your Mandi Yard
            </h2>
            <p className="text-sm text-white/80 leading-relaxed">
              Zero new hardware required. Connects directly to existing weighbridge scales in under 48 hours to eliminate yard congestion and highway bottlenecks.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full md:w-auto">
            <button 
              className="px-6 py-3.5 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold text-sm transition-all text-center cursor-pointer shadow-sm"
              onClick={() => alert("Mandi Secretary onboarding request logged. An APMC technical coordinator will contact you within 24 hours.")}
            >
              Request Mandi Setup
            </button>
            <button 
              className="px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all text-center cursor-pointer"
              onClick={() => alert("Connecting to 24x7 Kisan & Mandi Helpline: 1800-180-1551")}
            >
              Call Agri Desk (1800-180-1551)
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
