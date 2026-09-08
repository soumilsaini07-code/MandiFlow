import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Clock, 
  MapPin, 
  Scale, 
  Volume2, 
  CheckCircle2, 
  AlertTriangle,
  QrCode,
  Lock,
  RefreshCw,
  Building2,
  FileCheck2
} from 'lucide-react';

export default function FarmerPassView({ selectedToken, allTokens = [] }) {
  const [tokenData, setTokenData] = useState(null);
  const [currentToken, setCurrentToken] = useState(selectedToken || (allTokens[0]?.token_number || 'MF-0908-103'));
  const [totpCountdown, setTotpCountdown] = useState(60);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Sync token if selected from dashboard
  useEffect(() => {
    if (selectedToken) {
      setCurrentToken(selectedToken);
    }
  }, [selectedToken]);

  // Fetch token details & dynamic TOTP
  const fetchTokenDetails = async () => {
    if (!currentToken) return;
    try {
      const res = await fetch(`http://localhost:8000/api/token/${currentToken}`);
      if (res.ok) {
        const data = await res.json();
        setTokenData(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTokenDetails();
    const interval = setInterval(fetchTokenDetails, 8000);
    return () => clearInterval(interval);
  }, [currentToken]);

  // TOTP local 60s countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTotpCountdown((prev) => (prev > 1 ? prev - 1 : 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const playVernacularAudio = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.rate = 0.95;
      setIsPlayingAudio(true);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Audio speech synthesis not supported in this browser.");
    }
  };

  const stages = [
    { key: 'SCHEDULED', label: 'Slot Booked' },
    { key: 'GATE_ENTRY', label: 'Gate In' },
    { key: 'QUALITY_ASSAY', label: 'Moisture Assay' },
    { key: 'WEIGHED', label: 'Weighed' },
    { key: 'PAYMENT_DISBURSED', label: 'MSP Disbursed' }
  ];

  const getStageIndex = (status) => {
    const idx = stages.findIndex(s => s.key === status);
    return idx >= 0 ? idx : 0;
  };

  const currentStageIdx = getStageIndex(tokenData?.status || 'SCHEDULED');
  const isDelayed = (tokenData?.delay_offset_minutes || 0) > 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      padding: '10px 0'
    }}>
      {/* Token Selector Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '8px 16px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)'
      }}>
        <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Select or Enter Token / Mobile:</span>
        <select
          value={currentToken}
          onChange={(e) => setCurrentToken(e.target.value)}
          style={{
            background: 'var(--bg-dark)',
            color: '#ffffff',
            border: '1px solid var(--border-active)',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '0.84rem',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          {allTokens.map((t) => (
            <option key={t.token_number} value={t.token_number}>
              {t.token_number} - {t.farmer_name} ({t.crop})
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="text"
            placeholder="Type Token (e.g. A5BA or MS-0908...)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                setCurrentToken(e.target.value.trim());
              }
            }}
            onBlur={(e) => {
              if (e.target.value.trim()) {
                setCurrentToken(e.target.value.trim());
              }
            }}
            style={{
              background: 'var(--bg-dark)',
              color: '#ffffff',
              border: '1px solid var(--border-subtle)',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontFamily: 'monospace',
              width: '180px'
            }}
          />
        </div>
        <button onClick={fetchTokenDetails} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Realistic Mobile Frame */}
      <div style={{
        width: '100%',
        maxWidth: '430px',
        background: '#0a140f',
        borderRadius: '40px',
        border: '8px solid #1a2e24',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px rgba(16, 185, 129, 0.2)',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Phone Notch & Status Bar */}
        <div style={{
          background: '#0a140f',
          padding: '10px 24px 6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <span style={{ fontWeight: 600 }}>09:41</span>
          {/* Notch pill */}
          <div style={{ width: '80px', height: '14px', background: '#12231b', borderRadius: '10px' }}></div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span>5G</span>
            <span>100%</span>
          </div>
        </div>

        {/* Mobile Screen Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Header Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={20} color="var(--emerald-400)" />
              <div>
                <h2 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ffffff' }}>हरियाणा राज्य कृषि बोर्ड</h2>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Karnal APMC Digital Gate Pass</div>
              </div>
            </div>
            <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>
              {tokenData?.lane_type || 'EXPRESS'} LANE
            </span>
          </div>

          {/* Proactive Delay Notification (Audio Enabled) */}
          {isDelayed && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(180, 83, 9, 0.25))',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} /> MANDI DELAY ALERT (+{tokenData.delay_offset_minutes}m)
                </span>
                <button
                  onClick={() => playVernacularAudio(
                    `Namaste ${tokenData.farmer_name} ji. Weighbridge par yantrik deri ke karan aapka naya aane ka samay ${tokenData.revised_window_start} baje hai. Kripya gaav se deri se niklein. Aapka MSP bhav surakshit hai.`
                  )}
                  style={{
                    background: 'var(--amber-500)',
                    color: '#111827',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <Volume2 size={13} /> {isPlayingAudio ? 'Playing...' : 'सुनें (Hindi)'}
                </button>
              </div>
              <p style={{ fontSize: '0.76rem', color: '#fef3c7', lineHeight: 1.35 }}>
                Weighbridge par delay hai. Aapka naya samay <strong>{tokenData.revised_window_start} - {tokenData.revised_window_end}</strong> hai. Kripya sadak jam se bachne ke liye gaav {tokenData.village} se deri se niklein.
              </p>
            </div>
          )}

          {/* Main Appointment Pass Card */}
          <div style={{
            background: 'linear-gradient(145deg, #102119, #0d1a14)',
            border: '1px solid var(--border-active)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  TOKEN NUMBER
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--emerald-400)', letterSpacing: '0.02em' }}>
                  {tokenData?.token_number}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ASSIGNED GATE</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                  Bay {tokenData?.bay_assigned} (North)
                </div>
              </div>
            </div>

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)' }}></div>

            {/* Micro-Window Time */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '10px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color={isDelayed ? 'var(--amber-400)' : 'var(--emerald-400)'} />
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>SCHEDULED ARRIVAL WINDOW</div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: isDelayed ? 'var(--amber-400)' : '#ffffff' }}>
                    {tokenData?.revised_window_start} - {tokenData?.revised_window_end}
                  </div>
                </div>
              </div>
              <span className="badge badge-emerald" style={{ fontSize: '0.68rem' }}>1-Hour Window</span>
            </div>

            {/* Farmer & Crop Declarations */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Farmer Name:</span>
                <div style={{ fontWeight: 700, color: '#ffffff' }}>{tokenData?.farmer_name}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Origin Village:</span>
                <div style={{ fontWeight: 700, color: '#ffffff' }}>{tokenData?.village}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Crop / Variety:</span>
                <div style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>{tokenData?.crop}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-dim)' }}>Declared Qty:</span>
                <div style={{ fontWeight: 700, color: '#ffffff' }}>{tokenData?.quantity_quintals} Quintals</div>
              </div>
            </div>
          </div>

          {/* Dynamic TOTP Pass (Anti-Scalping / Anti-Forgery) */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Lock size={12} color="var(--emerald-400)" /> DYNAMIC GATE TOKEN (TOTP)
              </span>
              <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.15em', color: '#ffffff' }}>
                {tokenData?.dynamic_totp_code || '482 910'}
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--emerald-400)' }}>
                Refreshes in {totpCountdown}s (Screenshot-proof)
              </span>
            </div>

            {/* Simulated QR Code SVG */}
            <div style={{
              width: '64px',
              height: '64px',
              background: '#ffffff',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <QrCode size={56} color="#000000" />
            </div>
          </div>

          {/* Cryptographic Price Lock Guarantee Seal */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(16, 185, 129, 0.1))',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--amber-400)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={15} /> SLOT-BOUND MSP PRICE LOCK
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ffffff' }}>
                ₹{tokenData?.price_lock_rate}/qtl
              </span>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              Booking timestamp locks procurement price. Operational breakdowns cannot disqualify MSP rate.
            </p>
            <div className="mono" style={{ fontSize: '0.62rem', color: 'var(--text-dim)', marginTop: '4px', wordBreak: 'break-all' }}>
              SHA-256 Digest: {tokenData?.price_lock_hash}
            </div>
          </div>

          {/* 5-Stage Visual Progress Stepper */}
          <div style={{ marginTop: '4px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              LIFECYCLE STATUS
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
              {stages.map((st, i) => {
                const isPassed = i <= currentStageIdx;
                const isCurrent = i === currentStageIdx;
                return (
                  <div key={st.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: isPassed ? 'var(--emerald-500)' : 'rgba(255, 255, 255, 0.1)',
                      color: isPassed ? '#ffffff' : 'var(--text-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      boxShadow: isCurrent ? '0 0 10px var(--emerald-400)' : 'none'
                    }}>
                      {isPassed ? '✓' : i + 1}
                    </div>
                    <span style={{
                      fontSize: '0.58rem',
                      color: isCurrent ? 'var(--emerald-400)' : isPassed ? 'var(--text-main)' : 'var(--text-dim)',
                      fontWeight: isCurrent ? 700 : 500,
                      textAlign: 'center',
                      maxWidth: '55px'
                    }}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
