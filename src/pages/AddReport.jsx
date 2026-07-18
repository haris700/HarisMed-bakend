import React, { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CheckCircle, Plus, UploadCloud, File, Loader2 } from 'lucide-react';

// Reference ranges for the 7 core markers
const RANGES = {
  pcratio:      { low: 0,    high: 0.3,   unit: 'mg/mg',  label: 'Urine PCR' },
  creatinine:   { low: 0.6,  high: 1.2,   unit: 'mg/dL',  label: 'Creatinine' },
  egfr:         { low: 60,   high: 120,   unit: 'mL/min', label: 'eGFR' },
  bun:          { low: 7,    high: 20,    unit: 'mg/dL',  label: 'BUN / Urea' },
  urineProtein: { low: 0,    high: 12,    unit: 'mg/dL',  label: 'Urine Protein' },
  potassium:    { low: 3.5,  high: 5.0,   unit: 'mEq/L',  label: 'Potassium' },
  uricAcid:     { low: 3.5,  high: 7.2,   unit: 'mg/dL',  label: 'Uric Acid' },
};

const CORE_FIELDS = [
  { key: 'pcratio',      label: 'Urine PCR (Ratio)',   unit: 'mg/mg',  placeholder: 'e.g. 0.3' },
  { key: 'creatinine',   label: 'Creatinine (Serum)',  unit: 'mg/dL',  placeholder: 'e.g. 1.1' },
  { key: 'egfr',         label: 'eGFR',                unit: 'mL/min', placeholder: 'e.g. 72' },
  { key: 'bun',          label: 'BUN / Urea',          unit: 'mg/dL',  placeholder: 'e.g. 15' },
  { key: 'urineProtein', label: 'Urine Protein',       unit: 'mg/dL',  placeholder: 'e.g. 12' },
  { key: 'potassium',    label: 'Potassium',           unit: 'mEq/L',  placeholder: 'e.g. 4.1' },
  { key: 'uricAcid',     label: 'Uric Acid',           unit: 'mg/dL',  placeholder: 'e.g. 6.0' },
];

export default function AddReport() {
  const [date, setDate]                 = useState(new Date().toISOString().split('T')[0]);
  const [doctor, setDoctor]             = useState('');
  const [tests, setTests]               = useState('');
  const [markers, setMarkers]           = useState({});
  const [extractedDetails, setExtractedDetails] = useState({});
  const [file, setFile]                 = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [scanning, setScanning]         = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const fileInputRef = useRef(null);

  const setMarker = (key, val) => setMarkers(m => ({ ...m, [key]: val }));

  const handleFile = async e => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setScanning(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onloadend = async () => {
        const base64Data = reader.result;

        try {
          // Call server to extract biomarkers using Gemini 3.5 Flash
          const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3001'
            : 'https://harismed-bakend.onrender.com';

          const response = await fetch(`${API_BASE}/api/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: base64Data,
              mimeType: selectedFile.type
            })
          });

          if (!response.ok) throw new Error("Auto-fill failed");
          const extracted = await response.json();

          // Auto-populate form
          if (extracted.date) setDate(extracted.date);
          if (extracted.tests) setTests(extracted.tests.join(', '));
          
          // Load markers into form inputs
          const newMarkers = {};
          CORE_FIELDS.forEach(f => {
            if (extracted.markers[f.key] !== undefined) {
              newMarkers[f.key] = extracted.markers[f.key];
            }
          });
          setMarkers(newMarkers);
          setExtractedDetails(extracted.markers_detail || {});

        } catch (err) {
          console.error("Auto-extraction failed:", err);
          alert("Could not auto-fill report details. You can still type them manually!");
        } finally {
          setScanning(false);
        }
      };
    } catch (err) {
      console.error(err);
      setScanning(false);
    }
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

      // Build markers objects
      const markerPayload = {};
      const detailPayload = {};

      CORE_FIELDS.forEach(f => {
        const valStr = markers[f.key];
        if (valStr !== '' && valStr != null) {
          const val = parseFloat(valStr);
          if (!isNaN(val)) {
            markerPayload[f.key] = val;

            // Generate detail metadata using reference ranges
            const range = RANGES[f.key];
            let flag = 'Normal';
            if (range.high && val > range.high) flag = 'High';
            if (range.low && val < range.low) flag = 'Low';

            detailPayload[f.key] = {
              value: val,
              unit: range.unit,
              flag: flag,
              reference_range: `${range.low}-${range.high}`
            };
          }
        }
      });

      // Merge manually entered detail payloads with anything extracted from file
      const finalDetailPayload = { ...extractedDetails, ...detailPayload };

      // Auto-build tests string if empty
      const testNames = Object.keys(markerPayload)
        .map(k => CORE_FIELDS.find(f => f.key === k)?.label)
        .filter(Boolean);
      const finalTests = tests || (testNames.length > 0 ? testNames.join(', ') : 'Kidney Panel');

      await addDoc(collection(db, 'reports'), {
        date,
        doctor: doctor || 'Unknown',
        tests:  finalTests,
        markers: markerPayload,
        markers_detail: finalDetailPayload, // Build strong RAG data model!
        fileData, fileName, isImage, mimeType, fileSizeKB,
        createdAt: serverTimestamp(),
      });

      setSubmitted(true);
      // Reset
      setDate(new Date().toISOString().split('T')[0]);
      setDoctor(''); setTests(''); setMarkers({}); setFile(null); setExtractedDetails({});
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
          Select your document below to auto-fill or enter details manually.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        
        {/* File Upload / Auto-fill Card */}
        <div className="card" style={{ marginBottom:'14px' }}>
          <p style={{ fontSize:'0.85rem', fontWeight:600, marginBottom:'10px' }}>Original Document (Auto-Fill)</p>
          <label style={{
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            border:'2px dashed var(--border-strong)', borderRadius:'10px',
            padding:'24px 16px', cursor: scanning ? 'default' : 'pointer',
            background: file ? 'var(--teal-dim)' : 'transparent',
            borderColor: file ? 'var(--teal-border)' : 'var(--border-strong)',
            transition:'all 0.2s',
          }}>
            {scanning ? (
              <>
                <Loader2 size={28} color="var(--teal)" className="spin" style={{ marginBottom:'8px' }} />
                <span style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--teal)' }}>Scanning report with Gemini AI...</span>
                <span style={{ color:'var(--text-muted)', fontSize:'0.75rem', marginTop:'3px' }}>Extracting biomarkers</span>
              </>
            ) : file ? (
              <>
                <File size={28} color="var(--teal)" style={{ marginBottom:'8px' }} />
                <span style={{ fontWeight:600, fontSize:'0.85rem' }}>{file.name}</span>
                <span style={{ color:'var(--text-muted)', fontSize:'0.75rem', marginTop:'3px' }}>Tap to replace report</span>
              </>
            ) : (
              <>
                <UploadCloud size={28} color="var(--text-muted)" style={{ marginBottom:'8px' }} />
                <span style={{ fontWeight:600, color:'var(--text-secondary)', fontSize:'0.85rem' }}>Upload PDF or Image</span>
                <span style={{ color:'var(--text-muted)', fontSize:'0.75rem', marginTop:'3px' }}>Gemini will automatically fill the form</span>
              </>
            )}
            <input type="file" ref={fileInputRef} disabled={scanning} style={{ display:'none' }} accept=".pdf,image/*" onChange={handleFile} />
          </label>
        </div>

        {/* Date & Doctor */}
        <div className="card" style={{ marginBottom:'14px', display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <label className="field-label">Date of Test *</label>
            <input type="date" className="field-input" required
              value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Doctor / Clinic</label>
            <input type="text" className="field-input" placeholder="e.g. Dr. Sajeesh Sivadas · MIMS Hospital"
              value={doctor} onChange={e => setDoctor(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Tests Done</label>
            <input type="text" className="field-input" placeholder="e.g. Kidney Function Test, Urinalysis"
              value={tests} onChange={e => setTests(e.target.value)} />
          </div>
        </div>

        {/* 7 Core Markers Grid (No collapsible sections, very clean!) */}
        <div className="card" style={{ marginBottom:'20px', display:'flex', flexDirection:'column', gap:'14px' }}>
          <p style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--text-secondary)' }}>Biomarkers</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            {CORE_FIELDS.map(f => (
              <div key={f.key}>
                <label className="field-label" style={{ display:'flex', justifyContent:'space-between' }}>
                  <span>{f.label}</span>
                  <span style={{ color:'var(--text-muted)', fontWeight:400 }}>{f.unit}</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="field-input"
                  placeholder={f.placeholder}
                  value={markers[f.key] ?? ''}
                  onChange={e => setMarker(f.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="btn btn-teal" disabled={submitting || scanning}>
          {submitting ? 'Saving...' : <><Plus size={18} /> Save Report</>}
        </button>
        <div style={{ height:'8px' }} />
      </form>
    </div>
  );
}
