import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ShieldCheck, 
  AlertTriangle, 
  Layers, 
  BarChart3, 
  RefreshCw,
  Search,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

export default function MarketIntelligence() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');

  const fetchIntelligence = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/market-intelligence');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, []);

  const commodities = data?.commodities || [];

  const groups = ['ALL', 'Cereals', 'Pulses', 'Oil Seeds', 'Fibre Crops', 'Vegetables'];

  const filtered = commodities.filter((c) => {
    const matchesSearch = c.raw_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          c.normalized_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGroup = selectedGroup === 'ALL' || c.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  // Calculate total distress loss avoided across commodities
  const highRiskCrops = commodities.filter(c => c.distress_risk === 'HIGH');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet size={24} color="var(--emerald-400)" />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff' }}>
                Official APMC Agmarknet Market Intelligence (2026-27)
              </h2>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Ingested from official government market price & harvest arrival telemetry (<code className="mono">Market_Wise_Price_Arrival.csv</code>).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="badge badge-emerald">
              <span className="pulse-dot"></span> 23 Official Crops Calibrated
            </span>
            <button onClick={fetchIntelligence} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              <RefreshCw size={14} /> Refresh Data
            </button>
          </div>
        </div>
      </div>

      {/* Distress Selling Arbitrage Protection Card */}
      <div className="glass-card-amber" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <AlertTriangle size={22} color="var(--amber-400)" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
            The Problem: Unscheduled Surges Trigger Distress Selling Below MSP
          </h3>
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
          When mandi gates suffer 24–72hr gridlocks, desperate farmers sell up to <strong>₹500–₹1,200/quintal below MSP</strong> to avoid waiting costs. With MandiFlow's <strong>Slot-Bound Price Lock</strong>, the booking timestamp mathematically locks the procurement rate at government MSP, guaranteeing full value even during operational delay:
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginTop: '16px'
        }}>
          {highRiskCrops.slice(0, 4).map((crop) => (
            <div key={crop.normalized_name} style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '8px',
              padding: '12px'
            }}>
              <div style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.88rem' }}>
                {crop.raw_name.split('(')[0]}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: '6px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Open Market:</span>
                <span style={{ color: '#f87171', fontWeight: 600 }}>₹{crop.latest_price}/qtl</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: '2px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Locked MSP:</span>
                <span style={{ color: 'var(--emerald-400)', fontWeight: 700 }}>₹{crop.msp_rate}/qtl</span>
              </div>
              <div style={{
                marginTop: '6px',
                paddingTop: '6px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.74rem',
                color: 'var(--amber-400)',
                fontWeight: 700
              }}>
                +₹{crop.distress_loss_avoided_per_qtl}/qtl Saved by MandiFlow
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Commodity Group Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              style={{
                background: selectedGroup === g ? 'var(--emerald-600)' : 'rgba(255, 255, 255, 0.06)',
                color: selectedGroup === g ? '#ffffff' : 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-subtle)',
          padding: '6px 12px',
          borderRadius: '8px',
          minWidth: '240px'
        }}>
          <Search size={15} color="var(--text-dim)" />
          <input
            type="text"
            placeholder="Search crop or commodity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '0.82rem',
              width: '100%'
            }}
          />
        </div>
      </div>

      {/* Commodities Table */}
      <div className="glass-card" style={{ padding: '20px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '10px' }}>Commodity Group</th>
              <th style={{ padding: '10px' }}>Crop Name</th>
              <th style={{ padding: '10px' }}>Official MSP (2026-27)</th>
              <th style={{ padding: '10px' }}>Market Price (06 Sep)</th>
              <th style={{ padding: '10px' }}>Arrivals (06 Sep)</th>
              <th style={{ padding: '10px' }}>Peak Arrival (05 Sep)</th>
              <th style={{ padding: '10px' }}>Distress Risk Status</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Price Lock Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => {
              const isHighRisk = item.distress_risk === 'HIGH';
              const isMediumRisk = item.distress_risk === 'MEDIUM';
              return (
                <tr key={idx} style={{
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  transition: 'background 0.15s'
                }}>
                  <td style={{ padding: '12px 10px', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                    {item.group}
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ fontWeight: 700, color: '#ffffff' }}>
                      {item.raw_name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Model Entity: {item.normalized_name}
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    {item.msp_rate ? (
                      <span style={{ fontWeight: 800, color: 'var(--emerald-400)' }}>
                        ₹{item.msp_rate.toLocaleString('en-IN')}/qtl
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>Non-MSP</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    {item.price_sep06 ? (
                      <div style={{ fontWeight: 600, color: item.msp_rate && item.price_sep06 < item.msp_rate ? '#f87171' : '#ffffff' }}>
                        ₹{item.price_sep06.toLocaleString('en-IN')}/qtl
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ fontWeight: 600, color: '#ffffff' }}>
                      {item.arrival_sep06_mt > 0 ? `${item.arrival_sep06_mt.toLocaleString('en-IN')} MT` : '-'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {item.arrival_sep05_mt > 0 ? `${item.arrival_sep05_mt.toLocaleString('en-IN')} MT` : '-'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    {isHighRisk ? (
                      <span className="badge badge-red" style={{ fontSize: '0.68rem' }}>
                        High Loss Risk (-₹{item.distress_loss_avoided_per_qtl})
                      </span>
                    ) : isMediumRisk ? (
                      <span className="badge badge-amber" style={{ fontSize: '0.68rem' }}>
                        Moderate Dip
                      </span>
                    ) : (
                      <span className="badge badge-emerald" style={{ fontSize: '0.68rem' }}>
                        Stable Rate
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.74rem',
                      color: 'var(--emerald-400)',
                      fontWeight: 600
                    }}>
                      <ShieldCheck size={14} /> Guaranteed Lock
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
