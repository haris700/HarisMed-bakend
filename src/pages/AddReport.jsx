import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckCircle, Plus, UploadCloud, File, ChevronDown, ChevronUp } from 'lucide-react';

// All markers we track
const SECTIONS = [
  {
    title: 'Kidney Function',
    fields: [
      { key: 'creatinine',  label: 'Creatinine (Serum)', unit: 'mg/dL',  placeholder: 'e.g. 1.1' },
      { key: 'egfr',        label: 'eGFR',               unit: 'mL/min',  placeholder: 'e.g. 72' },
      { key: 'bun',         label: 'BUN',                unit: 'mg/dL',  placeholder: 'e.g. 15' },
      { key: 'pcratio',     label: 'Protein:Creatinine Ratio', unit: 'mg/g', placeholder: 'e.g. 180' },
    ],
  },
  {
    title: 'Urine',
    fields: [
      { key: 'protein',     label: 'Urine Protein',      unit: 'mg/day', placeholder: 'e.g. 120' },
      { key: 'urineCreat',  label: 'Urine Creatinine',   unit: 'mg/dL',  placeholder: 'e.g. 90' },
    ],
  },
  {
    title: 'Blood & Immune',
    fields: [
      { key: 'ana',         label: 'ANA (titer)',        unit: '',        placeholder: 'e.g. 1:160' },
      { key: 'chf',         label: 'BNP / CHF',          unit: 'pg/mL',  placeholder: 'e.g. 80' },
      { key: 'antiChf',     label: 'Anti-dsDNA',         unit: 'IU/mL',  placeholder: 'e.g. 12' },
      { key: 'hemoglobin',  label: 'Hemoglobin',         unit: 'g/dL',   placeholder: 'e.g. 13.5' },
      { key: 'potassium',   label: 'Potassium',          unit: 'mEq/L',  placeholder: 'e.g. 4.1' },
    ],
  },
];

export default function AddReport() {
  const [date, setDate]         = useState(new Date().toISOString().split('T')[0]);
  const [doctor, setDoctor]     = useState('');
  const [tests, setTests]       = useState('');
  const [markers, setMarkers]   = useState({});
  const [file, setFile]         = useState(null);
  const [openSections, setOpenSections] = useState({ 0: true, 1: false, 2: false });
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);

  const setMarker = (key, val) => setMarkers(m => ({ ...m, [key]: val }));
  const toggleSection = i => setOpenSections(s => ({ ...s, [i]: !s[i] }));

  const handleFile = e => {
    if (e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let fileData = null, fileName = null, isImage = false, mimeType = null, fileSizeKB = null;

      if (file) {
        const buf = await file.arrayBuffer();
        const uint = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < uint.length; i++) binary += String.fromCharCode(uint[i]);
        const b64 = btoa(binary);
        mimeType   = file.type;
        fileName   = file.name;
        fileSizeKB = Math.round(file.size / 1024);
        isImage    = file.type.startsWith('image/');
        fileData   = `data:${mimeType};base64,${b64}`;
      }

      // Build markers object (only non-empty values)
      const markerPayload = {};
      for (const [k, v] of Object.entries(markers)) {
        if (v !== '' && v != null) {
          markerPayload[k] = isNaN(parseFloat(v)) ? v : parseFloat(v);
        }
      }

      // Auto-build test string from filled markers
      const testNames = Object.keys(markerPayload)
        .map(k => SECTIONS.flatMap(s => s.fields).find(f => f.key === k)?.label)
        .filter(Boolean);
      const finalTests = tests || (testNames.length > 0 ? testNames.join(', ') : 'General Report');

      await addDoc(collection(db, 'reports'), {
        date,
        doctor: doctor || 'Unknown',
        tests:  finalTests,
        markers: markerPayload,
        fileData, fileName, isImage, mimeType, fileSizeKB,
        createdAt: serverTimestamp(),
      });

      setSubmitted(true);
      // reset
      setDate(new Date().toISOString().split('T')[0]);
      setDoctor(''); setTests(''); setMarkers({}); setFile(null);
      setTimeout(() => setSubmitted(false), 3500);
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) return (
    <div className="fade-up" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'70dvh', gap:'16px', textAlign:'center' }}>
      <div style={{ background:'var(--green-dim)', border:'1px solid var(--green-border)', borderRadius:'50%', padding:'20px' }}>
        <CheckCircle size={40} color="var(--green)" />
      </div>
      <h2 style={{ fontSize:'1.2rem', fontWeight:700 }}>Report Saved!</h2>
      <p style={{ color:'var(--text-muted)', fontSize:'0.9rem' }}>Your test is now in your history.</p>
      <button className="btn btn-ghost" onClick={() => setSubmitted(false)} style={{ maxWidth:'200px' }}>
        Add Another
      </button>
    </div>
  );

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1 style={{ fontSize:'1.15rem', fontWeight:700 }}>Add Test Results</h1>
        <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:'1px' }}>
          Fill what you have — everything is optional except the date.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Date & Doctor */}
        <div className="card" style={{ marginBottom:'14px', display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <label className="field-label">Date of Test *</label>
            <input type="date" className="field-input" required
              value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Doctor / Clinic</label>
            <input type="text" className="field-input" placeholder="e.g. Dr. Sharma · City Hospital"
              value={doctor} onChange={e => setDoctor(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Tests Done (optional, auto-filled from values below)</label>
            <input type="text" className="field-input" placeholder="e.g. Kidney Panel, CBC"
              value={tests} onChange={e => setTests(e.target.value)} />
          </div>
        </div>

        {/* Collapsible marker sections */}
        {SECTIONS.map((section, si) => (
          <div key={si} className="card" style={{ marginBottom:'10px', padding:0, overflow:'hidden' }}>
            <button type="button"
              onClick={() => toggleSection(si)}
              style={{
                width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'16px 18px', background:'none', border:'none', cursor:'pointer',
                color:'var(--text-primary)', fontFamily:'inherit', fontWeight:600, fontSize:'0.9rem',
              }}>
              {section.title}
              {openSections[si] ? <ChevronUp size={17} color="var(--text-muted)" /> : <ChevronDown size={17} color="var(--text-muted)" />}
            </button>

            {openSections[si] && (
              <div style={{ padding:'4px 18px 18px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', borderTop:'1px solid var(--border)' }}>
                {section.fields.map(field => (
                  <div key={field.key}>
                    <label className="field-label">
                      {field.label}
                      {field.unit && <span style={{ color:'var(--text-muted)', fontWeight:400, marginLeft:'4px' }}>({field.unit})</span>}
                    </label>
                    <input
                      type={field.key === 'ana' ? 'text' : 'number'}
                      step="0.01"
                      className="field-input"
                      placeholder={field.placeholder}
                      value={markers[field.key] ?? ''}
                      onChange={e => setMarker(field.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* File Upload */}
        <div className="card" style={{ marginBottom:'20px' }}>
          <p style={{ fontSize:'0.85rem', fontWeight:600, marginBottom:'10px' }}>Original Document</p>
          <label style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            border:'2px dashed var(--border-strong)', borderRadius:'10px',
            padding:'28px 16px', cursor:'pointer',
            background: file ? 'var(--green-dim)' : 'transparent',
            borderColor: file ? 'var(--green-border)' : 'var(--border-strong)',
            transition:'all 0.2s',
          }}>
            {file
              ? <><File size={28} color="var(--green)" style={{ marginBottom:'8px' }} />
                  <span style={{ fontWeight:600, fontSize:'0.85rem' }}>{file.name}</span>
                  <span style={{ color:'var(--text-muted)', fontSize:'0.75rem', marginTop:'3px' }}>Tap to change</span></>
              : <><UploadCloud size={28} color="var(--text-muted)" style={{ marginBottom:'8px' }} />
                  <span style={{ fontWeight:600, color:'var(--text-secondary)', fontSize:'0.85rem' }}>Upload PDF or Image</span>
                  <span style={{ color:'var(--text-muted)', fontSize:'0.75rem', marginTop:'3px' }}>Up to ~700 KB</span></>
            }
            <input type="file" style={{ display:'none' }} accept=".pdf,image/*" onChange={handleFile} />
          </label>
        </div>

        <button type="submit" className="btn btn-teal" disabled={submitting}>
          {submitting ? 'Saving...' : <><Plus size={18} /> Save Report</>}
        </button>
        <div style={{ height:'8px' }} />
      </form>
    </div>
  );
}
