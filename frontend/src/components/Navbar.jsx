import React from 'react';
import { 
  Activity, 
  Smartphone, 
  Radio, 
  AlertTriangle, 
  MapPin, 
  ShieldCheck 
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, mandiInfo }) {
  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(7, 14, 10, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      {/* Brand & Mandi Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'rgba(16, 185, 129, 0.12)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(16, 185, 129, 0.25)'
        }}>
          <span style={{ fontSize: '1.4rem' }}>🌾</span>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              Mandi<span style={{ color: 'var(--emerald-400)' }}>Flow</span>
            </h1>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              Closed-Loop Procurement Engine
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
          <MapPin size={15} color="var(--emerald-400)" />
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {mandiInfo?.name || 'Karnal APMC Grain Market'}
          </span>
          <span style={{ color: 'var(--text-dim)' }}>•</span>
          <span className="badge badge-emerald">
            <span className="pulse-dot"></span> Live Telemetry
          </span>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(0, 0, 0, 0.4)',
        padding: '4px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        gap: '4px'
      }}>
        <button
          onClick={() => setActiveTab('command')}
          className="btn"
          style={{
            background: activeTab === 'command' ? 'var(--emerald-600)' : 'transparent',
            color: activeTab === 'command' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'command' ? '0 2px 10px rgba(16, 185, 129, 0.4)' : 'none',
            fontSize: '0.84rem',
            padding: '8px 14px'
          }}
        >
          <Activity size={16} />
          Mandi Command Center
        </button>

        <button
          onClick={() => setActiveTab('farmer')}
          className="btn"
          style={{
            background: activeTab === 'farmer' ? 'var(--emerald-600)' : 'transparent',
            color: activeTab === 'farmer' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'farmer' ? '0 2px 10px rgba(16, 185, 129, 0.4)' : 'none',
            fontSize: '0.84rem',
            padding: '8px 14px'
          }}
        >
          <Smartphone size={16} />
          Farmer Mobile Pass
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className="btn"
          style={{
            background: activeTab === 'simulator' ? 'var(--emerald-600)' : 'transparent',
            color: activeTab === 'simulator' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'simulator' ? '0 2px 10px rgba(16, 185, 129, 0.4)' : 'none',
            fontSize: '0.84rem',
            padding: '8px 14px'
          }}
        >
          <Radio size={16} />
          WhatsApp Voice AI
        </button>

        <button
          onClick={() => setActiveTab('disruptions')}
          className="btn"
          style={{
            background: activeTab === 'disruptions' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
            color: activeTab === 'disruptions' ? '#111827' : 'var(--amber-400)',
            boxShadow: activeTab === 'disruptions' ? '0 2px 10px rgba(245, 158, 11, 0.4)' : 'none',
            fontSize: '0.84rem',
            padding: '8px 14px',
            fontWeight: 700
          }}
        >
          <AlertTriangle size={16} />
          Disruption Engine
        </button>

        <button
          onClick={() => setActiveTab('market')}
          className="btn"
          style={{
            background: activeTab === 'market' ? 'var(--emerald-600)' : 'transparent',
            color: activeTab === 'market' ? '#ffffff' : 'var(--text-muted)',
            boxShadow: activeTab === 'market' ? '0 2px 10px rgba(16, 185, 129, 0.4)' : 'none',
            fontSize: '0.84rem',
            padding: '8px 14px'
          }}
        >
          <span>🌾</span>
          Agmarknet Data
        </button>
      </nav>

      {/* Security Seal Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.78rem',
          color: 'var(--emerald-400)',
          background: 'rgba(16, 185, 129, 0.08)',
          padding: '6px 12px',
          borderRadius: '999px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <ShieldCheck size={14} />
          <span>TOTP + MSP Price Lock Active</span>
        </div>
      </div>
    </header>
  );
}
