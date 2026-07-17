import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection, query, orderBy, onSnapshot, doc, updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  FileText, Image as ImageIcon, Calendar, Loader2, X,
  Edit2, Check, Stethoscope, ChevronDown, ChevronUp, Search
} from 'lucide-react';

// ── Document viewer ───────────────────────────────────────────────
function Viewer({ report, onClose }) {
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.93)',
      zIndex:200, display:'flex', flexDirection:'column'
    }}>
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'13px 16px', background:'var(--bg-surface)',
        borderBottom:'1px solid var(--border)', flexShrink:0
      }}>
        <div>
          <p style={{ fontWeight:600, color:'var(--text-primary)', fontSize:'0.9rem' }}>{report.tests}</p>
          <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'1px' }}>
            {new Date(report.date).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})}
            {' · '}{report.fileName}
          </p>
        </div>
        <button onClick={onClose} style={{ background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:'8px', padding:'8px', cursor:'pointer' }}>
          <X size={20} color="var(--text-primary)" />
        </button>
      </div>
      <div style={{ flex:1, overflow:'auto', display:'flex', alignItems:'center', justifyContent:'center', padding:'8px' }}>
        {report.isImage
          ? <img src={report.fileData} alt={report.fileName} style={{ maxWidth:'100%', maxHeight:'100%', borderRadius:'8px', objectFit:'contain' }} />
          : <iframe src={report.fileData} title={report.fileName} style={{ width:'100%', height:'100%', border:'none', borderRadius:'8px', minHeight:'82dvh' }} />
        }
      </div>
    </div>
  );
}

// ── Doctor summary view ───────────────────────────────────────────
const MARKER_META = {
  pcratio:     { label:'Urine PCR',            unit:'mg/mg'  },
  creatinine:  { label:'Creatinine',           unit:'mg/dL'  },
  egfr:        { label:'eGFR',                  unit:'mL/min' },
  bun:         { label:'BUN / Urea',            unit:'mg/dL'  },
  urineProtein:{ label:'Urine Protein',         unit:'mg/dL'  },
  potassium:   { label:'Potassium',             unit:'mEq/L'  },
  uricAcid:    { label:'Uric Acid',             unit:'mg/dL'  },
};

function DoctorView({ report, onClose }) {
  const [showFile, setShowFile] = useState(false);
  if (showFile) return <Viewer report={report} onClose={() => setShowFile(false)} />;

  const markers = Object.entries(report.markers || {}).filter(([,v]) => v != null && v !== '');

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.82)',
      zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px'
    }}>
      <div style={{
        background:'var(--bg-surface)', width:'100%', maxWidth:'440px',
        borderRadius:'20px', border:'1px solid var(--border-strong)',
        overflow:'hidden', maxHeight:'90dvh', display:'flex', flexDirection:'column'
      }}>
        {/* Green header strip */}
        <div style={{ background:'rgba(45,212,191,0.12)', borderBottom:'1px solid rgba(45,212,191,0.2)', padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontSize:'0.72rem', color:'var(--teal)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'4px' }}>Patient Report</p>
              <h2 style={{ fontSize:'1.3rem', fontWeight:700 }}>Haris V K</h2>
            </div>
            <button onClick={onClose} style={{ background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:'8px', padding:'7px', cursor:'pointer', alignSelf:'flex-start' }}>
              <X size={18} color="var(--text-primary)" />
            </button>
          </div>
          <div style={{ marginTop:'12px', fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.6 }}>
            <span>📅 {new Date(report.date).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})}</span><br />
            <span>👨‍⚕️ {report.doctor}</span><br />
            <span>🧪 {report.tests}</span>
          </div>
        </div>

        {/* Markers grid */}
        <div style={{ padding:'16px', overflowY:'auto', flex:1 }}>
          {markers.length > 0 && (
            <>
              <p style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'12px' }}>Test Values</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
                {markers.map(([k, v]) => {
                  const meta = MARKER_META[k] || { label: k, unit:'' };
                  return (
                    <div key={k} style={{ background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px', textAlign:'center' }}>
                      <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:'4px' }}>{meta.label}</p>
                      <p style={{ fontSize:'1.35rem', fontWeight:700, color:'var(--teal)' }}>{v}</p>
                      {meta.unit && <p style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginTop:'2px' }}>{meta.unit}</p>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* File actions */}
          {report.fileData
            ? <button className="btn btn-teal" onClick={() => setShowFile(true)} style={{ marginBottom:'10px' }}>
                {report.isImage ? <ImageIcon size={17} /> : <FileText size={17} />}
                View Original Lab Report
              </button>
            : <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:'10px', textAlign:'center' }}>No original document attached.</p>
          }
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────
const EDIT_FIELDS = Object.entries(MARKER_META).map(([key, meta]) => ({ key, ...meta }));

function EditModal({ report, onClose }) {
  const [date, setDate]     = useState(report.date);
  const [doctor, setDoctor] = useState(report.doctor === 'To be updated' ? '' : report.doctor);
  const [tests, setTests]   = useState(report.tests  === 'To be updated' ? '' : report.tests);
  const [markers, setMarkers] = useState(() => {
    const m = {};
    for (const f of EDIT_FIELDS) m[f.key] = report.markers?.[f.key] ?? '';
    return m;
  });
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(true);

  const setM = (k, v) => setMarkers(m => ({ ...m, [k]: v }));

  const save = async () => {
    setSaving(true);
    const payload = {};
    for (const [k, v] of Object.entries(markers)) {
      payload[k] = v !== '' ? (isNaN(parseFloat(v)) ? v : parseFloat(v)) : null;
    }
    const autoTests = Object.entries(payload).filter(([,v]) => v != null)
      .map(([k]) => MARKER_META[k]?.label).filter(Boolean).join(', ');
    await updateDoc(doc(db, 'reports', report.id), {
      date,
      doctor: doctor || 'Unknown',
      tests: tests || autoTests || 'General Report',
      markers: payload,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
      zIndex:100, display:'flex', alignItems:'flex-end', justifyContent:'center'
    }}>
      <div style={{
        background:'var(--bg-surface)', width:'100%', maxWidth:'600px',
        borderRadius:'22px 22px 0 0', padding:'22px 18px',
        maxHeight:'92dvh', overflowY:'auto',
        borderTop:'1px solid var(--border-strong)'
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <h2 style={{ fontSize:'1.05rem', fontWeight:700 }}>Edit Report</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer' }}>
            <X size={22} color="var(--text-muted)" />
          </button>
        </div>

        <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:'16px', fontStyle:'italic' }}>{report.fileName}</p>

        <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>
          <div>
            <label className="field-label">Date</label>
            <input type="date" className="field-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Doctor / Clinic</label>
            <input type="text" className="field-input" value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="e.g. Dr. Sharma" />
          </div>
          <div>
            <label className="field-label">Tests (auto-filled if blank)</label>
            <input type="text" className="field-input" value={tests} onChange={e => setTests(e.target.value)} placeholder="e.g. Kidney Panel" />
          </div>
        </div>

        {/* Collapsible markers */}
        <button type="button" onClick={() => setOpen(o => !o)}
          style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 14px', cursor:'pointer', fontFamily:'inherit', color:'var(--text-secondary)', fontWeight:600, fontSize:'0.85rem', marginBottom:'8px' }}>
          Blood & Urine Markers
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {open && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'20px' }}>
            {EDIT_FIELDS.map(f => (
              <div key={f.key}>
                <label className="field-label">{f.label}{f.unit && ` (${f.unit})`}</label>
                <input
                  type={f.key === 'ana' ? 'text' : 'number'} step="0.01"
                  className="field-input" placeholder="—"
                  value={markers[f.key] ?? ''}
                  onChange={e => setM(f.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-teal" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : <><Check size={17} /> Save Changes</>}
        </button>
      </div>
    </div>
  );
}

// ── Instant search logic ──────────────────────────────────────────
function matchReport(report, term) {
  if (!term.trim()) return true;
  const t = term.toLowerCase();
  const fields = [
    report.tests, report.doctor, report.date, report.fileName,
    ...Object.entries(report.markers || {}).map(([k, v]) => `${MARKER_META[k]?.label || k} ${v}`)
  ].map(f => (f || '').toLowerCase());
  return fields.some(f => f.includes(t));
}

const CHIPS = ['All', 'Urine PCR', 'Creatinine', 'eGFR', 'BUN / Urea', 'Urine Protein', 'Potassium', 'Uric Acid'];

// ── Main History page ─────────────────────────────────────────────
export default function History() {
  const [reports, setReports]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [activeChip, setChip]     = useState('All');
  const [viewer, setViewer]       = useState(null);
  const [editor, setEditor]       = useState(null);
  const [drView, setDrView]       = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('date', 'desc'));
    return onSnapshot(q, snap => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setReports(data);
      setLoading(false);
    });
  }, []);

  const effectiveTerm = activeChip !== 'All' ? activeChip : search;

  const filtered = useMemo(() =>
    reports.filter(r => matchReport(r, effectiveTerm)),
    [reports, effectiveTerm]
  );

  const needsUpdate = reports.filter(r => r.tests === 'To be updated').length;

  return (
    <div className="fade-up">
      {viewer && <Viewer      report={viewer} onClose={() => setViewer(null)} />}
      {editor && <EditModal   report={editor} onClose={() => setEditor(null)} />}
      {drView && <DoctorView  report={drView} onClose={() => setDrView(null)} />}

      {/* Header with inline search */}
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ position:'relative', flex:1 }}>
            <Search size={16} color="var(--text-muted)" style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
            <input
              ref={inputRef}
              type="text"
              className="field-input"
              placeholder="Search ANA, Creatinine, doctor, date..."
              style={{ paddingLeft:'36px', paddingRight: search ? '36px' : '14px', borderRadius:'100px', fontSize:'0.85rem', height:'40px' }}
              value={search}
              onChange={e => { setSearch(e.target.value); setChip('All'); }}
            />
            {search && (
              <button onClick={() => { setSearch(''); inputRef.current?.focus(); }}
                style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', display:'flex' }}>
                <X size={16} color="var(--text-muted)" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick chips */}
      <div style={{ display:'flex', gap:'7px', overflowX:'auto', paddingBottom:'12px', marginBottom:'16px', scrollbarWidth:'none' }}>
        {CHIPS.map(chip => (
          <button key={chip} onClick={() => { setChip(chip); setSearch(''); }}
            style={{
              flex:'0 0 auto', padding:'5px 13px', borderRadius:'100px',
              fontSize:'0.77rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              border:'1px solid',
              background: activeChip === chip ? 'var(--teal)' : 'transparent',
              borderColor: activeChip === chip ? 'var(--teal)' : 'var(--border-strong)',
              color: activeChip === chip ? 'var(--text-inverse)' : 'var(--text-secondary)',
              transition:'all 0.15s',
              whiteSpace:'nowrap',
            }}>
            {chip}
          </button>
        ))}
      </div>

      {/* Needs-update banner */}
      {needsUpdate > 0 && !effectiveTerm && (
        <div style={{
          background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)',
          borderRadius:'10px', padding:'10px 14px', marginBottom:'16px',
          fontSize:'0.8rem', color:'var(--amber)', display:'flex', gap:'8px', alignItems:'center'
        }}>
          <span>✏️</span>
          <span><strong>{needsUpdate} reports</strong> still need details — tap the edit icon to fill them in.</span>
        </div>
      )}

      {/* Result count */}
      {effectiveTerm && (
        <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:'12px' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} · <span style={{ color:'var(--teal)' }}>{effectiveTerm}</span>
        </p>
      )}

      {/* Report cards */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', paddingTop:'60px' }}>
          <Loader2 size={28} color="var(--teal)" className="spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'50px 20px', color:'var(--text-muted)' }}>
          <Search size={36} style={{ margin:'0 auto 12px', opacity:0.3 }} />
          <p>No reports found for "<strong>{effectiveTerm}</strong>"</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {filtered.map(report => {
            const filledMarkers = Object.entries(report.markers || {}).filter(([,v]) => v != null && v !== '');
            return (
              <div key={report.id} className="card">
                {/* Top row */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'3px' }}>
                      <Calendar size={12} color="var(--teal)" />
                      <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--teal)' }}>
                        {new Date(report.date).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'})}
                      </span>
                    </div>
                    <p style={{
                      fontWeight:600, fontSize:'0.92rem',
                      color: report.tests === 'To be updated' ? 'var(--text-muted)' : 'var(--text-primary)',
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                    }}>
                      {report.tests}
                    </p>
                    {report.doctor && report.doctor !== 'To be updated' && (
                      <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'2px' }}>
                        {report.doctor}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display:'flex', gap:'5px', marginLeft:'8px', flexShrink:0 }}>
                    <button title="Edit" onClick={() => setEditor(report)}
                      style={{ background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:'7px', padding:'7px', cursor:'pointer' }}>
                      <Edit2 size={14} color="var(--text-muted)" />
                    </button>
                    <button title="Show to Doctor" onClick={() => setDrView(report)}
                      style={{ background:'var(--teal-dim)', border:'1px solid var(--teal-border)', borderRadius:'7px', padding:'7px', cursor:'pointer' }}>
                      <Stethoscope size={14} color="var(--teal)" />
                    </button>
                    {report.fileData && (
                      <button title="View file" onClick={() => setViewer(report)}
                        style={{ background:'var(--bg-raised)', border:'1px solid var(--border)', borderRadius:'7px', padding:'7px', cursor:'pointer' }}>
                        {report.isImage ? <ImageIcon size={14} color="var(--text-secondary)" /> : <FileText size={14} color="var(--text-secondary)" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Marker chips */}
                {filledMarkers.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'5px', marginBottom:'8px' }}>
                    {filledMarkers.map(([k, v]) => (
                      <span key={k} style={{
                        background:'var(--teal-dim)', border:'1px solid var(--teal-border)',
                        color:'var(--teal)', borderRadius:'6px', padding:'2px 9px',
                        fontSize:'0.72rem', fontWeight:600,
                      }}>
                        {MARKER_META[k]?.label || k}: {v}
                      </span>
                    ))}
                  </div>
                )}

                {/* File tag */}
                {report.fileName && (
                  <div style={{ display:'flex', alignItems:'center', gap:'5px', paddingTop:'8px', borderTop:'1px solid var(--border)' }}>
                    {report.isImage ? <ImageIcon size={12} color="var(--text-muted)" /> : <FileText size={12} color="var(--text-muted)" />}
                    <span style={{ fontSize:'0.72rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {report.fileName} · {report.fileSizeKB}KB
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ height:'8px' }} />
        </div>
      )}
    </div>
  );
}
