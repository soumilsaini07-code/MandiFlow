import React from 'react';

export default function StitchFooter({ onNavigate }) {
  return (
    <footer className="border-t border-border-light bg-surface-card py-16 px-6 text-sm">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand Col */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[16px]">eco</span>
              </div>
              <span className="font-bold text-primary-deep font-display text-base">
                MandiFlow
              </span>
            </div>
            <p className="text-xs text-on-surface-subtle leading-relaxed">
              Queue-free mandi arrivals, zero highway gridlock, and transparent direct MSP settlement for Indian farmers.
            </p>
          </div>

          {/* Col 2 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-deep">
              Farmer Services
            </h4>
            <ul className="space-y-2 text-xs text-on-surface-subtle">
              <li>
                <button onClick={() => onNavigate('parchi')} className="hover:text-primary transition-colors cursor-pointer">
                  Check e-Parchi Status
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('voice')} className="hover:text-primary transition-colors cursor-pointer">
                  WhatsApp Voice Booking
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('agmarknet')} className="hover:text-primary transition-colors cursor-pointer">
                  Today's Official MSP Rates
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-deep">
              Mandi Committees
            </h4>
            <ul className="space-y-2 text-xs text-on-surface-subtle">
              <li>
                <button onClick={() => onNavigate('officer')} className="hover:text-primary transition-colors cursor-pointer">
                  APMC Secretary Login
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('officer')} className="hover:text-primary transition-colors cursor-pointer">
                  Weighbridge Scale Telemetry
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('disruptions')} className="hover:text-primary transition-colors cursor-pointer">
                  Disruption Control Room
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-deep">
              Helpline Support
            </h4>
            <p className="text-xs text-on-surface-subtle">Kisan Call Centre (24x7 Toll-Free)</p>
            <p className="text-base font-bold font-mono text-primary-deep">1800-180-1551</p>
            <span className="text-[11px] text-accent font-semibold block">
              Direct Aadhaar DBT Grievance Cell
            </span>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 border-t border-border-light flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-subtle">
          <span>© 2026 Directorate of Agricultural Marketing &amp; MandiFlow Platform</span>
          <div className="flex gap-6">
            <a className="hover:text-primary transition-colors" href="#">Citizen Charter</a>
            <a className="hover:text-primary transition-colors" href="#">e-NAM Portal</a>
            <a className="hover:text-primary transition-colors" href="#">Agmarknet Inflow Reports</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
