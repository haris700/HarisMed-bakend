import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Loader2, FileText, ChevronRight, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';


// ── Reference ranges for common kidney markers ──────────────────
const RANGES = {
  pcratio:      { low: 0,    high: 0.3,   unit: 'mg/mg', label: 'Urine PCR',           hi_warn: 3.5 },
  creatinine:   { low: 0.6,  high: 1.2,   unit: 'mg/dL', label: 'Creatinine' },
  egfr:         { low: 60,   high: 120,   unit: 'mL/min',label: 'eGFR' },
  bun:          { low: 7,    high: 20,    unit: 'mg/dL', label: 'BUN / Urea' },
  urineProtein: { low: 0,    high: 12,    unit: 'mg/dL', label: 'Urine Protein' },
  urineCreat:   { low: 30,   high: 125,   unit: 'mg/dL', label: 'Urine Creatinine' },
  ana:          { low: null, high: null,  unit: '',       label: 'ANA' },
  chf:          { low: null, high: 100,   unit: 'pg/mL', label: 'BNP (CHF)' },
  hemoglobin:   { low: 12,   high: 17.5,  unit: 'g/dL',  label: 'Hemoglobin' },
  potassium:    { low: 3.5,  high: 5.0,   unit: 'mEq/L', label: 'Potassium' },
  sodium:       { low: 137,  high: 145,   unit: 'mmol/L',label: 'Sodium' },
  uricAcid:     { low: 3.5,  high: 7.2,   unit: 'mg/dL', label: 'Uric Acid' },
  albumin:      { low: 3.5,  high: 5.0,   unit: 'g/dL',  label: 'Albumin' },
  totalProtein: { low: 6.3,  high: 8.2,   unit: 'g/dL',  label: 'Total Protein' },
  calcium:      { low: 8.4,  high: 10.2,  unit: 'mg/dL', label: 'Calcium' },
  glucose:      { low: 70,   high: 140,   unit: 'mg/dL', label: 'Glucose' },
};

function getRangeStatus(key, val) {
  const r = RANGES[key];
  if (!r || val == null) return 'normal';
  if (r.high && val > r.high) return 'high';
  if (r.low  && val < r.low)  return 'low';
  return 'normal';
}

function statusColor(status) {
  if (status === 'high') return 'var(--rose)';
  if (status === 'low')  return 'var(--amber)';
  return 'var(--green)';
}

// ── Inline trend arrow ───────────────────────────────────────────
function TrendArrow({ data, field }) {
  if (data.length < 2) return null;
  const vals = data.map(d => d[field]).filter(v => v != null);
  if (vals.length < 2) return null;
  const last  = vals[vals.length - 1];
  const prev  = vals[vals.length - 2];
  const delta = ((last - prev) / prev * 100).toFixed(1);
  if (Math.abs(delta) < 1) return <span className="trend-flat"><Minus size={12} style={{ display:'inline' }} /> Stable</span>;
  if (last > prev) return <span className="trend-up"><TrendingUp size={12} style={{ display:'inline' }} /> +{delta}%</span>;
  return <span className="trend-down"><TrendingDown size={12} style={{ display:'inline' }} /> {delta}%</span>;
}

// ── Latest-value summary card ────────────────────────────────────
function LatestCard({ label, value, unit, status, trend }) {
  const color = statusColor(status);
  return (
    <div className="card" style={{ display:'flex', flexDirection:'column', gap:'6px', minWidth: 0 }}>
      <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:500 }}>{label}</span>
      <span style={{ fontSize:'1.55rem', fontWeight:700, color, lineHeight:1.1 }}>
        {value ?? '—'}
      </span>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>{unit}</span>
        {trend}
      </div>
    </div>
  );
}

// ── Custom chart tooltip ─────────────────────────────────────────
const ChartTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--bg-raised)', border:'1px solid var(--border-strong)', borderRadius:'10px', padding:'10px 14px' }}>
      <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginBottom:'4px' }}>{label}</p>
      <p style={{ fontSize:'1rem', fontWeight:700, color:'var(--teal)' }}>
        {payload[0].value} <span style={{ fontSize:'0.75rem', fontWeight:400 }}>{unit}</span>
      </p>
    </div>
  );
};

const TREND_MARKERS = [
  { key:'pcratio',      color:'#f97316' },  // PCR — MOST IMPORTANT
  { key:'creatinine',   color:'#2dd4bf' },
  { key:'egfr',         color:'#a78bfa' },  // Added eGFR
  { key:'urineProtein', color:'#fb923c' },
  { key:'bun',          color:'#60a5fa' },
  { key:'potassium',    color:'#34d399' },
  { key:'uricAcid',     color:'#f59e0b' },
];

export default function Dashboard() {
  const [reports, setReports]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeKey, setActiveKey] = useState('creatinine');

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('date', 'asc'));
    return onSnapshot(q, snap => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setReports(data);
      setLoading(false);
    });
  }, []);

  // Latest marker values (from most-recent report that has that field)
  const latest = useMemo(() => {
    const out = {};
    const rev = [...reports].reverse();
    for (const m of TREND_MARKERS) {
      const found = rev.find(r => r.markers?.[m.key] != null);
      out[m.key] = found?.markers?.[m.key] ?? null;
    }
    return out;
  }, [reports]);

  // Chart data for the selected key
  const chartData = useMemo(() =>
    reports
      .filter(r => r.markers?.[activeKey] != null)
      .map(r => ({
        date: new Date(r.date).toLocaleDateString('en-US', { month:'short', year:'2-digit', timeZone:'UTC' }),
        [activeKey]: r.markers[activeKey],
      })),
    [reports, activeKey]
  );

  const recentReports = useMemo(() => [...reports].reverse().slice(0, 4), [reports]);
  const r = RANGES[activeKey] || {};
  const trendData = chartData;

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h1 style={{ fontSize:'1.15rem', fontWeight:700, color:'var(--text-primary)' }}>Haris V K</h1>
            <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:'1px' }}>Kidney Health Tracker</p>
          </div>
          <Link to="/add" style={{
            background:'var(--teal)', color:'#111318',
            padding:'8px 14px', borderRadius:'100px',
            fontSize:'0.8rem', fontWeight:700, textDecoration:'none'
          }}>
            + Add Test
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
          <Loader2 size={28} color="var(--teal)" className="spin" />
        </div>
      ) : (
        <>
          {/* ── PCR Hero Card ── */}
          {(() => {
            const pcrVals = reports
              .filter(r => r.markers?.pcratio != null)
              .map(r => ({ date: r.date, val: r.markers.pcratio }))
              .sort((a,b) => a.date.localeCompare(b.date));
            if (pcrVals.length === 0) return null;
            const latest = pcrVals[pcrVals.length - 1];
            const prev   = pcrVals.length > 1 ? pcrVals[pcrVals.length - 2] : null;
            const delta  = prev ? ((latest.val - prev.val) / prev.val * 100).toFixed(1) : null;
            const improved = delta !== null && parseFloat(delta) < 0;
            const zone = latest.val < 0.3 ? { label:'Normal', color:'var(--green)' }
                       : latest.val < 1   ? { label:'Mild', color:'var(--amber)' }
                       : latest.val < 3.5 ? { label:'Moderate', color:'#f97316' }
                       :                    { label:'Nephrotic Range', color:'var(--rose)' };
            return (
              <div style={{
                background: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(249,115,22,0.04) 100%)',
                border: '1px solid rgba(249,115,22,0.3)', borderRadius:'var(--radius-md)',
                padding:'18px', marginBottom:'20px',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                  <div>
                    <p style={{ fontSize:'0.72rem', fontWeight:600, color:'rgba(249,115,22,0.8)', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:'4px' }}>
                      Urine Protein:Creatinine Ratio
                    </p>
                    <div style={{ display:'flex', alignItems:'baseline', gap:'8px' }}>
                      <span style={{ fontSize:'2.8rem', fontWeight:800, color:'#f97316', lineHeight:1 }}>{latest.val}</span>
                      <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>mg/mg</span>
                    </div>
                    <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'4px' }}>
                      {new Date(latest.date).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'})}
                      {prev && <span> · was <strong style={{color:'var(--text-secondary)'}}>{prev.val}</strong> ({new Date(prev.date).toLocaleDateString('en-US',{month:'short',year:'2-digit',timeZone:'UTC'})})</span>}
                    </p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ background: zone.color + '22', border:`1px solid ${zone.color}44`, color:zone.color, borderRadius:'6px', padding:'4px 10px', fontSize:'0.75rem', fontWeight:700 }}>
                      {zone.label}
                    </span>
                    {delta !== null && (
                      <p style={{ marginTop:'8px', fontSize:'0.8rem', fontWeight:600, color: improved ? 'var(--green)' : 'var(--rose)' }}>
                        {improved ? '▼' : '▲'} {Math.abs(delta)}% vs prev
                      </p>
                    )}
                  </div>
                </div>
                {/* Mini progress bar */}
                <div style={{ height:'6px', background:'rgba(255,255,255,0.06)', borderRadius:'6px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.min(latest.val / 7 * 100, 100)}%`,
                    background: `linear-gradient(90deg, var(--green), var(--amber), var(--rose))`,
                    borderRadius:'6px', transition:'width 0.5s ease' }} />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'4px' }}>
                  <span style={{ fontSize:'0.62rem', color:'var(--text-muted)' }}>0 Normal</span>
                  <span style={{ fontSize:'0.62rem', color:'var(--amber)' }}>1 Mild</span>
                  <span style={{ fontSize:'0.62rem', color:'#f97316' }}>3.5 Nephrotic</span>
                </div>
              </div>
            );
          })()}

          {/* ── Latest Values Grid ─── */}
          <p className="section-title">Latest Results</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'28px' }}>
            {TREND_MARKERS.filter(m => latest[m.key] != null).slice(0, 8).map(m => (
              <div
                key={m.key}
                onClick={() => setActiveKey(m.key)}
                style={{ cursor:'pointer', outline: activeKey === m.key ? `2px solid ${m.color}` : 'none', borderRadius:'14px', outlineOffset:'2px' }}
              >
                <LatestCard
                  label={RANGES[m.key]?.label || m.key}
                  value={latest[m.key]}
                  unit={RANGES[m.key]?.unit || ''}
                  status={getRangeStatus(m.key, latest[m.key])}
                  trend={<TrendArrow data={reports.map(r => ({ [m.key]: r.markers?.[m.key] }))} field={m.key} />}
                />
              </div>
            ))}
            {TREND_MARKERS.filter(m => latest[m.key] != null).length === 0 && (
              <div className="card" style={{ gridColumn:'1/-1', padding:'24px 20px' }}>
                <p style={{ fontWeight:600, marginBottom:'6px' }}>No marker values yet</p>
                <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:'14px', lineHeight:1.5 }}>
                  Your {reports.length} uploaded reports have no numeric values filled in yet.
                  Open the <strong>History</strong> tab, tap ✏️ on each report, and enter the values from your PDF.
                </p>
                <div style={{ display:'flex', gap:'10px' }}>
                  <Link to="/history" style={{ flex:1, textAlign:'center', background:'var(--teal)', color:'#111', padding:'10px', borderRadius:'8px', textDecoration:'none', fontWeight:700, fontSize:'0.85rem' }}>
                    Open History →
                  </Link>
                  <Link to="/add" style={{ flex:1, textAlign:'center', border:'1px solid var(--border-strong)', color:'var(--text-secondary)', padding:'10px', borderRadius:'8px', textDecoration:'none', fontWeight:600, fontSize:'0.85rem' }}>
                    + New Test
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* ── Trend Chart ─── */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'12px' }}>
            <p className="section-title" style={{ margin:0 }}>Trend Over Time</p>
            <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{r.label}</span>
          </div>

          {/* Marker selector chips */}
          <div style={{ display:'flex', gap:'7px', overflowX:'auto', paddingBottom:'8px', marginBottom:'14px' }}>
            {TREND_MARKERS.map(m => (
              <button key={m.key} onClick={() => setActiveKey(m.key)}
                style={{
                  flex:'0 0 auto', padding:'5px 13px', borderRadius:'100px',
                  fontSize:'0.75rem', fontWeight:600, cursor:'pointer', border:'1px solid',
                  whiteSpace:'nowrap', fontFamily:'inherit',
                  background: activeKey === m.key ? m.color : 'transparent',
                  borderColor: activeKey === m.key ? m.color : 'var(--border-strong)',
                  color: activeKey === m.key ? 'var(--text-inverse)' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}>
                {RANGES[m.key]?.label || m.key}
              </button>
            ))}
          </div>

          <div className="card" style={{ padding:'20px 12px 12px', marginBottom:'28px' }}>
            {chartData.length < 2 ? (
              <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)' }}>
                <p style={{ fontSize:'0.85rem' }}>Not enough data to show a trend.</p>
                <p style={{ fontSize:'0.8rem', marginTop:'4px' }}>Add at least 2 reports with {r.label} values.</p>
              </div>
            ) : (
              <div style={{ height:'210px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top:4, right:16, bottom:0, left:-24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip unit={r.unit} />} />
                    {r.high && <ReferenceLine y={r.high} stroke="rgba(251,113,133,0.4)" strokeDasharray="4 4" />}
                    {r.low  && <ReferenceLine y={r.low}  stroke="rgba(251,191,36,0.4)"  strokeDasharray="4 4" />}
                    <Line
                      type="monotoneX"
                      dataKey={activeKey}
                      stroke={TREND_MARKERS.find(m => m.key===activeKey)?.color || 'var(--teal)'}
                      strokeWidth={2.5}
                      dot={{ r:4, fill:'var(--bg-base)', strokeWidth:2.5 }}
                      activeDot={{ r:6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Recent Reports ─── */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
            <p className="section-title" style={{ margin:0 }}>Recent Reports</p>
            <Link to="/history" style={{ fontSize:'0.78rem', color:'var(--teal)', textDecoration:'none', fontWeight:600 }}>
              See all <ArrowRight size={13} style={{ display:'inline', verticalAlign:'middle' }} />
            </Link>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {recentReports.length === 0 ? (
              <div className="card" style={{ textAlign:'center', padding:'28px', color:'var(--text-muted)' }}>
                No reports yet. <Link to="/add" style={{ color:'var(--teal)', textDecoration:'none', fontWeight:600 }}>Add one →</Link>
              </div>
            ) : recentReports.map(r => (
              <Link key={r.id} to="/history" style={{ textDecoration:'none' }}>
                <div className="card" style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                  <div style={{ background:'var(--teal-dim)', border:'1px solid var(--teal-border)', borderRadius:'10px', padding:'10px', flexShrink:0 }}>
                    <FileText size={18} color="var(--teal)" />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:600, color:'var(--text-primary)', fontSize:'0.9rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {r.tests === 'To be updated' ? r.fileName || 'Report' : r.tests}
                    </p>
                    <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'2px' }}>
                      {new Date(r.date).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', timeZone:'UTC' })}
                      {r.doctor && r.doctor !== 'To be updated' && ` · ${r.doctor}`}
                    </p>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink:0 }} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
