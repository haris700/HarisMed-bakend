import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  User, Stethoscope, Pill, AlertTriangle, Utensils, 
  FileText, Upload, Plus, Trash2, Save, Loader2, Check, Sparkles, RefreshCw 
} from 'lucide-react';
import { processFileForUpload } from '../utils/fileHelper';
import ExtractionOverlay from '../components/ExtractionOverlay';

const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://harismed-bakend.onrender.com');

const MOCK_DIAGNOSES = ['CKD Stage 3', 'Hypertension'];
const MOCK_MEDS = ['Lisinopril', 'Allopurinol'];
const MOCK_ALLERGIES = ['NSAIDs (Ibuprofen)'];
const MOCK_DIETARY = ['Low Sodium (<2g/day)', 'Controlled Potassium'];

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Start with completely EMPTY state by default
  const [diagnoses, setDiagnoses] = useState([]);
  const [medications, setMedications] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [dietary, setDietary] = useState([]);
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Input states for adding new items
  const [newDiagnosis, setNewDiagnosis] = useState('');
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newAllergy, setNewAllergy] = useState('');
  const [newDiet, setNewDiet] = useState('');

  useEffect(() => {
    async function loadProfile() {
      try {
        const ref = doc(db, 'profile', 'patient_profile');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();

          // Filter out any lingering mock items saved in earlier test runs
          const cleanDiagnoses = (data.diagnoses || []).filter(d => !MOCK_DIAGNOSES.includes(d));
          const cleanMeds = (data.medications || []).filter(m => {
            const name = typeof m === 'string' ? m : m.name;
            return !MOCK_MEDS.includes(name);
          });
          const cleanAllergies = (data.allergies || []).filter(a => !MOCK_ALLERGIES.includes(a));
          const cleanDietary = (data.dietary_restrictions || []).filter(d => !MOCK_DIETARY.includes(d));
          const cleanNotes = (data.clinical_notes || '').includes('Maintain hydration. Avoid NSAIDs.') ? '' : (data.clinical_notes || '');

          setDiagnoses(cleanDiagnoses);
          setMedications(cleanMeds);
          setAllergies(cleanAllergies);
          setDietary(cleanDietary);
          setClinicalNotes(cleanNotes);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const saveProfile = async (customData) => {
    setSaving(true);
    setSuccessMsg('');
    try {
      const payload = customData || {
        diagnoses,
        medications,
        allergies,
        dietary_restrictions: dietary,
        clinical_notes: clinicalNotes,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'profile', 'patient_profile'), payload);
      setSuccessMsg('Medical profile saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const clearProfile = async () => {
    if (!window.confirm("Are you sure you want to clear all profile details?")) return;
    setDiagnoses([]);
    setMedications([]);
    setAllergies([]);
    setDietary([]);
    setClinicalNotes('');
    try {
      await setDoc(doc(db, 'profile', 'patient_profile'), {
        diagnoses: [],
        medications: [],
        allergies: [],
        dietary_restrictions: [],
        clinical_notes: '',
        updatedAt: new Date().toISOString()
      });
      setSuccessMsg('Profile cleared!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error("Error clearing profile:", err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setExtracting(true);
    setSuccessMsg('');

    try {
      // 1. Process & compress image/document to prevent 'Payload Too Large' (413)
      const { fileData, mimeType } = await processFileForUpload(file);

      // 2. Call AI extraction backend
      const response = await fetch(`${API_BASE_URL}/api/extract-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileData, mimeType })
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("File is too large even after compression. Please try a smaller image or PDF.");
        }
        throw new Error("Failed to extract clinical data from file");
      }

      const data = await response.json();

      // 3. Set profile directly to fresh AI extracted data (overwrite old mock data)
      const extractedDiagnoses = data.diagnoses || [];
      const extractedAllergies = data.allergies || [];
      const extractedDietary = data.dietary_restrictions || [];
      const extractedMeds = (data.medications || []).map(m => typeof m === 'string' ? { name: m, dosage: '' } : m);
      const extractedNotes = data.clinical_notes || '';

      setDiagnoses(extractedDiagnoses);
      setMedications(extractedMeds);
      setAllergies(extractedAllergies);
      setDietary(extractedDietary);
      setClinicalNotes(extractedNotes);

      const newPayload = {
        diagnoses: extractedDiagnoses,
        medications: extractedMeds,
        allergies: extractedAllergies,
        dietary_restrictions: extractedDietary,
        clinical_notes: extractedNotes,
        updatedAt: new Date().toISOString()
      };

      await saveProfile(newPayload);
      setSuccessMsg('Prescription & OP Summary data extracted cleanly!');
    } catch (err) {
      console.error("AI prescription extraction failed:", err);
      alert(err.message || "Could not extract data from document. Please try again or type manually.");
    } finally {
      setExtracting(false);
    }
  };

  const addDiagnosis = () => {
    if (!newDiagnosis.trim()) return;
    setDiagnoses(prev => [...prev, newDiagnosis.trim()]);
    setNewDiagnosis('');
  };
  const removeDiagnosis = (index) => setDiagnoses(prev => prev.filter((_, i) => i !== index));

  const addMedication = () => {
    if (!newMedName.trim()) return;
    setMedications(prev => [...prev, { name: newMedName.trim(), dosage: newMedDosage.trim() }]);
    setNewMedName('');
    setNewMedDosage('');
  };
  const removeMedication = (index) => setMedications(prev => prev.filter((_, i) => i !== index));

  const addAllergy = () => {
    if (!newAllergy.trim()) return;
    setAllergies(prev => [...prev, newAllergy.trim()]);
    setNewAllergy('');
  };
  const removeAllergy = (index) => setAllergies(prev => prev.filter((_, i) => i !== index));

  const addDiet = () => {
    if (!newDiet.trim()) return;
    setDietary(prev => [...prev, newDiet.trim()]);
    setNewDiet('');
  };
  const removeDiet = (index) => setDietary(prev => prev.filter((_, i) => i !== index));

  if (loading) {
    return (
      <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
        <Loader2 size={28} color="var(--teal)" className="spin" />
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ paddingBottom: '30px' }}>
      {extracting && <ExtractionOverlay title="Extracting Prescription & Clinical Data" />}

      {/* Header */}
      <div className="page-header">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize:'1.15rem', fontWeight:800, color:'var(--text-primary)', lineHeight:1.2 }}>Patient Clinical Profile</h1>
            <p style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              Diagnoses, Medications & Doctor Notes
            </p>
          </div>
          <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
            <button 
              onClick={clearProfile} 
              disabled={saving || extracting}
              title="Clear all fields"
              style={{
                background:'var(--bg-raised)', color:'var(--text-muted)', border:'1px solid var(--border)',
                padding:'8px 12px', borderRadius:'100px',
                fontSize:'0.78rem', fontWeight:600, cursor:'pointer',
                display:'inline-flex', alignItems:'center', gap:'4px'
              }}>
              <RefreshCw size={13} />
              <span>Clear</span>
            </button>
            <button 
              onClick={() => saveProfile()} 
              disabled={saving || extracting}
              style={{
                background:'var(--teal)', color:'#ffffff', border:'none',
                padding:'8px 14px', borderRadius:'100px',
                fontSize:'0.78rem', fontWeight:700, cursor:'pointer',
                display:'inline-flex', alignItems:'center', gap:'6px',
                whiteSpace: 'nowrap'
              }}>
              {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>

      {successMsg && (
        <div style={{
          background:'var(--teal-dim)', border:'1px solid var(--teal-border)',
          color:'var(--teal)', borderRadius:'12px', padding:'12px 16px',
          marginBottom:'18px', fontSize:'0.82rem', fontWeight:600,
          display:'flex', alignItems:'center', gap:'8px'
        }}>
          <Check size={16} /> {successMsg}
        </div>
      )}

      {/* AI Document Upload Banner */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, var(--teal-dim) 0%, rgba(99,102,241,0.06) 100%)',
        border: '1px solid var(--teal-border)',
        marginBottom: '20px', padding: '18px'
      }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:'12px' }}>
          <div style={{ background:'var(--teal)', borderRadius:'10px', padding:'10px', color:'#fff', flexShrink:0 }}>
            <Sparkles size={20} />
          </div>
          <div style={{ flex:1, minWidth: 0 }}>
            <h3 style={{ fontSize:'0.95rem', fontWeight:700, marginBottom:'4px' }}>AI Prescription & Clinical Extractor</h3>
            <p style={{ fontSize:'0.8rem', color:'var(--text-secondary)', lineHeight:1.5, marginBottom:'12px' }}>
              Upload a doctor note, discharge summary, or prescription (PDF / Image). Gemini AI will extract active diagnoses, medications, and clinical guidelines directly into your medical profile.
            </p>
            
            <label 
              className="btn btn-teal" 
              style={{ 
                display:'inline-flex', width:'auto', padding:'9px 18px', fontSize:'0.82rem', cursor: extracting ? 'not-allowed' : 'pointer',
                opacity: extracting ? 0.8 : 1
              }}>
              {extracting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Extracting Clinical Details...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Upload Prescription / Doctor Note</span>
                </>
              )}
              <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={extracting} style={{ display:'none' }} />
            </label>
          </div>
        </div>
      </div>

      {/* Active Diagnoses Card */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
          <Stethoscope size={18} color="var(--teal)" />
          <h3 style={{ fontSize:'0.9rem', fontWeight:700 }}>Active Diagnoses & Conditions</h3>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'12px' }}>
          {diagnoses.map((d, i) => (
            <span key={i} className="stat-pill" style={{ padding:'6px 12px', fontSize:'0.8rem' }}>
              {d}
              <Trash2 size={12} style={{ cursor:'pointer', marginLeft:'4px' }} onClick={() => removeDiagnosis(i)} />
            </span>
          ))}
          {diagnoses.length === 0 && <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>No conditions added yet.</span>}
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <input 
            type="text" 
            className="field-input" 
            placeholder="Add condition (e.g., C3 Glomerulopathy)" 
            disabled={saving || extracting}
            value={newDiagnosis}
            onChange={e => setNewDiagnosis(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDiagnosis()}
            style={{ padding:'8px 12px', fontSize:'0.85rem' }}
          />
          <button onClick={addDiagnosis} disabled={saving || extracting} className="btn btn-ghost" style={{ width:'auto', padding:'8px 14px', flexShrink:0 }}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Active Medications Card */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
          <Pill size={18} color="var(--primary)" />
          <h3 style={{ fontSize:'0.9rem', fontWeight:700 }}>Current Medications</h3>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'12px' }}>
          {medications.map((m, i) => (
            <div key={i} style={{
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: '10px', padding: '10px 14px', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--text-primary)' }}>{m.name}</span>
                {m.dosage && <span style={{ fontSize:'0.78rem', color:'var(--text-secondary)', marginLeft:'8px' }}>· {m.dosage}</span>}
              </div>
              <Trash2 size={14} color="var(--rose)" style={{ cursor:'pointer' }} onClick={() => removeMedication(i)} />
            </div>
          ))}
          {medications.length === 0 && <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>No medications listed.</span>}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:'8px' }}>
          <input 
            type="text" 
            className="field-input" 
            placeholder="Medication name (e.g., Repace)" 
            disabled={saving || extracting}
            value={newMedName}
            onChange={e => setNewMedName(e.target.value)}
            style={{ padding:'8px 12px', fontSize:'0.85rem' }}
          />
          <input 
            type="text" 
            className="field-input" 
            placeholder="Dosage (e.g., 50mg 1-0-1)" 
            disabled={saving || extracting}
            value={newMedDosage}
            onChange={e => setNewMedDosage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMedication()}
            style={{ padding:'8px 12px', fontSize:'0.85rem' }}
          />
          <button onClick={addMedication} disabled={saving || extracting} className="btn btn-ghost" style={{ width:'auto', padding:'8px 14px', flexShrink:0 }}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Allergies & Dietary Restrictions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
            <AlertTriangle size={16} color="var(--rose)" />
            <h4 style={{ fontSize:'0.82rem', fontWeight:700 }}>Allergies</h4>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' }}>
            {allergies.map((a, i) => (
              <span key={i} className="stat-pill rose" style={{ fontSize:'0.75rem', padding:'4px 8px' }}>
                {a} <Trash2 size={10} style={{ cursor:'pointer', marginLeft:'2px' }} onClick={() => removeAllergy(i)} />
              </span>
            ))}
            {allergies.length === 0 && <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>None listed</span>}
          </div>
          <div style={{ display:'flex', gap:'4px' }}>
            <input 
              type="text" className="field-input" placeholder="Add allergy"
              value={newAllergy} onChange={e => setNewAllergy(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addAllergy()}
              style={{ padding:'6px 10px', fontSize:'0.78rem' }}
            />
            <button onClick={addAllergy} className="btn btn-ghost" style={{ width:'auto', padding:'6px 10px', flexShrink:0 }}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="card">
          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'10px' }}>
            <Utensils size={16} color="var(--amber)" />
            <h4 style={{ fontSize:'0.82rem', fontWeight:700 }}>Dietary Rules</h4>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' }}>
            {dietary.map((d, i) => (
              <span key={i} className="stat-pill amber" style={{ fontSize:'0.75rem', padding:'4px 8px' }}>
                {d} <Trash2 size={10} style={{ cursor:'pointer', marginLeft:'2px' }} onClick={() => removeDiet(i)} />
              </span>
            ))}
            {dietary.length === 0 && <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>None listed</span>}
          </div>
          <div style={{ display:'flex', gap:'4px' }}>
            <input 
              type="text" className="field-input" placeholder="Add rule"
              value={newDiet} onChange={e => setNewDiet(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDiet()}
              style={{ padding:'6px 10px', fontSize:'0.78rem' }}
            />
            <button onClick={addDiet} className="btn btn-ghost" style={{ width:'auto', padding:'6px 10px', flexShrink:0 }}>
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Clinical Notes Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
          <FileText size={18} color="var(--teal)" />
          <h3 style={{ fontSize:'0.9rem', fontWeight:700 }}>Doctor Notes & Clinical Advice</h3>
        </div>
        <textarea 
          className="field-input" 
          rows={7}
          disabled={saving || extracting}
          placeholder="Enter instructions from your doctor or clinical summary..."
          value={clinicalNotes}
          onChange={e => setClinicalNotes(e.target.value)}
          style={{ resize:'vertical', fontSize:'0.88rem', lineHeight:1.5 }}
        />
      </div>

      {/* Save Button */}
      <button 
        onClick={() => saveProfile()} 
        disabled={saving || extracting}
        className="btn btn-teal"
        style={{ padding:'14px', fontSize:'0.92rem' }}>
        {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
        <span>Save Medical Profile</span>
      </button>
    </div>
  );
}
