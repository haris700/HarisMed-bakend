import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { Bot, User, Send, Paperclip, ShieldCheck } from 'lucide-react';

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi Haris! I have securely accessed your clinical profile and lab records (PCR, Creatinine, Medications, etc). Ask me anything about your diet, medications, trends, or health guidelines!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [patientData, setPatientData] = useState([]);
  const [patientProfile, setPatientProfile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // 1. Fetch structured health data & medical profile from Firestore (The RAG Knowledge base)
  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const snap = await getDocs(collection(db, 'reports'));
        const data = snap.docs.map(d => {
          const docData = d.data();
          return {
            date: docData.date,
            tests: docData.tests,
            markers: docData.markers
          };
        });
        const recentData = data.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
        setPatientData(recentData);

        // Fetch patient profile (diagnoses, medications, allergies, notes)
        const profileSnap = await getDoc(doc(db, 'profile', 'patient_profile'));
        if (profileSnap.exists()) {
          setPatientProfile(profileSnap.data());
        }
      } catch (err) {
        console.error("Error fetching health data or profile:", err);
      }
    };
    fetchHealthData();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessages = [...messages, { role: 'user', content: input.trim() }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : 'https://harismed-bakend.onrender.com';

    try {
      // 2. Call our secure Render cloud backend with RAG context & Medical Profile
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          patientData: patientData,
          patientProfile: patientProfile
        }),
      });

      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I am having trouble connecting to the medical AI server right now.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setLoading(true); // Triggers the typing indicator to show it's working
    
    // Add temporary scanning message
    const scanMessage = { role: 'assistant', content: `Scanning report "${file.name}" with HarisAI... 🧠` };
    setMessages(prev => [...prev, scanMessage]);

    try {
      // 1. Convert File to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64Data = reader.result;

        try {
          // 2. Call server to extract biomarkers using Gemini 3.5 Flash
          const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:3001'
            : 'https://harismed-bakend.onrender.com';

          const response = await fetch(`${API_BASE}/api/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: base64Data,
              mimeType: file.type
            })
          });

          if (!response.ok) throw new Error("Failed to extract data");
          const extracted = await response.json();

          // 3. Save directly to Firestore Knowledge base
          await addDoc(collection(db, 'reports'), {
            date: extracted.date,
            doctor: 'Extracted by HarisAI',
            tests: extracted.tests,
            fileName: file.name,
            fileData: base64Data, // Save base64 preview for history page
            mimeType: file.type,
            isImage: file.type.startsWith('image/'),
            fileSizeKB: Math.round(file.size / 1024),
            markers: extracted.markers,
            markers_detail: extracted.markers_detail, // Rich metadata for RAG!
            createdAt: new Date()
          });

          // 4. Update local RAG patient context immediately with sanitized data capped at 5 reports
          const sanitizedExtracted = {
            date: extracted.date,
            tests: extracted.tests,
            markers: extracted.markers
          };
          setPatientData(prev => [sanitizedExtracted, ...prev].slice(0, 5));

          // Replace the scanning message with success message
          setMessages(prev => {
            const filtered = prev.filter(m => !m.content.includes("Scanning report"));
            return [
              ...filtered,
              { 
                role: 'assistant', 
                content: `✅ Successfully processed "${file.name}"!\n\nDate: ${extracted.date}\nTest Types: ${extracted.tests.join(', ')}\n\nExtracted Markers:\n${Object.entries(extracted.markers_detail || {}).map(([k, v]) => `- ${k.toUpperCase()}: ${v.value} ${v.unit} (${v.flag})`).join('\n')}\n\nI have automatically updated your RAG Knowledge Graph. Ask me anything about this new test!` 
              }
            ];
          });
        } catch (err) {
          console.error(err);
          setMessages(prev => [
            ...prev.filter(m => !m.content.includes("Scanning report")),
            { role: 'assistant', content: `❌ Error parsing "${file.name}". Please ensure it is a clear medical PDF or image.` }
          ]);
        } finally {
          setUploading(false);
          setLoading(false);
        }
      };
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev.filter(m => !m.content.includes("Scanning report")),
        { role: 'assistant', content: `❌ Failed to read file locally.` }
      ]);
      setUploading(false);
      setLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: '160px' }}>
      
      {/* 1. Header (Sticky & High-Visibility Theme Support) */}
      <div className="page-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        borderBottom: '1px solid var(--border)',
        padding: '14px 16px',
        background: 'var(--bg-surface)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        margin: '0 -16px 16px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            background: 'var(--teal-dim)', 
            border: '1px solid var(--teal-border)', 
            borderRadius: '12px', 
            padding: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={22} color="var(--teal)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              HarisAI Assistant
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ 
                width: '7px', height: '7px', borderRadius: '50%', 
                background: 'var(--green)', display: 'inline-block' 
              }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                RAG Engine & Medical Context Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Security Banner */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '10px 14px',
        marginBottom: '20px',
        fontSize: '0.78rem',
        color: 'var(--text-secondary)',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <ShieldCheck size={18} color="var(--teal)" style={{ flexShrink: 0 }} />
        <span style={{ lineHeight: 1.4 }}>
          <strong>DPDP & HIPAA Compliant:</strong> AI advice is strictly grounded in your lab trends and profile records. Not a substitute for your nephrologist.
        </span>
      </div>

      {/* 3. Messages List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            width: '100%',
            maxWidth: '88%'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: m.role === 'user' ? 'var(--teal-dim)' : 'var(--primary-dim)',
              border: m.role === 'user' ? '1px solid var(--teal-border)' : '1px solid var(--primary-border)',
              color: m.role === 'user' ? 'var(--teal)' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div style={{
              background: m.role === 'user' 
                ? 'var(--teal-dim)' 
                : 'var(--bg-surface)',
              border: m.role === 'user' ? '1px solid var(--teal-border)' : '1px solid var(--border)',
              padding: '12px 16px',
              borderRadius: '16px',
              borderTopRightRadius: m.role === 'user' ? 0 : '16px',
              borderTopLeftRadius: m.role === 'user' ? '16px' : 0,
              fontSize: '0.92rem',
              color: 'var(--text-primary)',
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
              boxShadow: 'var(--shadow-sm)'
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexDirection: 'row' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-dim)', border: '1px solid var(--primary-border)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={16} />
            </div>
            <div style={{ 
              background: 'var(--bg-surface)', 
              padding: '16px 20px', 
              borderRadius: '16px', 
              borderBottomLeftRadius: 0,
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Input Area (Fixed above bottom-nav) */}
      <div style={{ 
        position: 'fixed',
        bottom: 'calc(58px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '680px',
        padding: '12px 16px', 
        background: 'var(--bg-overlay)', 
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        zIndex: 100
      }}>
        <form onSubmit={handleSend} style={{ 
          display: 'flex', 
          alignItems: 'center', 
          width: '100%', 
          background: 'var(--bg-surface)', 
          borderRadius: '24px', 
          border: '1px solid var(--border-strong)',
          padding: '4px 8px 4px 16px',
          gap: '8px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          
          {/* File Input and Button */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
            accept="image/*,application/pdf"
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: loading || uploading ? 'default' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            <Paperclip size={20} />
          </button>

          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={uploading ? "Analyzing report..." : "Ask about your diet or lab trends..."} 
            style={{ 
              flex: 1, 
              padding: '10px 0', 
              border: 'none',
              background: 'transparent', 
              color: 'var(--text-primary)',
              fontSize: '0.92rem',
              outline: 'none'
            }} 
            disabled={loading || uploading}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || loading || uploading}
            style={{ 
              background: input.trim() && !loading && !uploading ? 'var(--teal)' : 'transparent', 
              color: input.trim() && !loading && !uploading ? '#ffffff' : 'var(--text-muted)', 
              border: 'none', 
              width: '36px', 
              height: '36px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: input.trim() && !loading && !uploading ? 'pointer' : 'default',
              transition: 'all 0.2s',
              flexShrink: 0
            }}>
            <Send size={16} />
          </button>
        </form>
      </div>
      
    </div>
  );
}
