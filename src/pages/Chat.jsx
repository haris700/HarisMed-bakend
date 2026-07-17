import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { Bot, User, Send, Loader2, Info, Paperclip } from 'lucide-react';

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi Haris! I have securely accessed your latest kidney health records (PCR, Creatinine, etc). Ask me anything about your diet, trends, or what you should be eating today!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [patientData, setPatientData] = useState([]);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // 1. Fetch structured health data from Firestore (The RAG Knowledge base)
  useEffect(() => {
    const fetchHealthData = async () => {
      try {
        const snap = await getDocs(collection(db, 'reports'));
        const data = snap.docs.map(doc => {
          const d = doc.data();
          // CRITICAL: Strip out the massive base64 PDF/image data before sending to AI
          // We only want to send the lightweight structured Knowledge Graph
          return {
            date: d.date,
            tests: d.tests,
            markers: d.markers
          };
        });
        // Sort by date descending and grab up to 50 recent reports for deep historical context
        const recentData = data.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
        setPatientData(recentData);
      } catch (err) {
        console.error("Error fetching health data:", err);
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

    try {
      // 2. Call our secure Render cloud backend
      const response = await fetch('https://harismed-bakend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          patientData: patientData // Inject the RAG context
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
          // 2. Call Render to extract biomarkers using Gemini 3.5 Flash
          const response = await fetch('https://harismed-bakend.onrender.com/api/extract', {
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

          // 4. Update local RAG patient context immediately
          setPatientData(prev => [extracted, ...prev]);

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
      
      {/* 1. Header (Sticky) */}
      <div className="page-header" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid var(--border)',
        padding: '14px 16px',
        background: 'rgba(9, 13, 22, 0.85)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        margin: '0 -16px 20px'
      }}>
        <div style={{ background: 'var(--primary-dim)', border: '1px solid var(--primary-border)', borderRadius: '10px', padding: '8px' }}>
          <Bot size={20} color="var(--primary)" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>HarisAI Assistant</h1>
          <p style={{ fontSize: '0.72rem', color: 'var(--teal)', fontWeight: 600 }}>Clinical context active ✨</p>
        </div>
      </div>

      <div style={{
        background: 'rgba(251,191,36,0.05)',
        border: '1px solid rgba(251,191,36,0.15)',
        borderRadius: '10px',
        padding: '10px 14px',
        marginBottom: '20px',
        fontSize: '0.8rem',
        color: 'var(--amber)',
        display: 'flex',
        gap: '8px',
        alignItems: 'center'
      }}>
        <span>🛡️</span>
        <span>Your data is processed securely (DPDP & HIPAA standards). AI advice is not a substitute for your doctor.</span>
      </div>

      {/* 2. Messages List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            width: '100%',
            maxWidth: '85%'
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
                ? 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.03) 100%)' 
                : 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(99,102,241,0.03) 100%)',
              border: m.role === 'user' ? '1px solid var(--teal-border)' : '1px solid var(--primary-border)',
              padding: '12px 16px',
              borderRadius: '16px',
              borderTopRightRadius: m.role === 'user' ? 0 : '16px',
              borderTopLeftRadius: m.role === 'user' ? '16px' : 0,
              fontSize: '0.92rem',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              whiteSpace: 'pre-line'
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
              background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(99,102,241,0.03) 100%)', 
              padding: '16px 20px', 
              borderRadius: '16px', 
              borderBottomLeftRadius: 0,
              border: '1px solid var(--primary-border)',
              display: 'flex',
              alignItems: 'center'
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

      {/* 3. Input Area (Fixed above bottom-nav) */}
      <div style={{ 
        position: 'fixed',
        bottom: 'calc(58px + env(safe-area-inset-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '680px',
        padding: '12px 16px', 
        background: 'rgba(9, 13, 22, 0.95)', 
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
          gap: '8px'
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
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-raised)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
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
              color: input.trim() && !loading && !uploading ? 'var(--text-inverse)' : 'var(--text-muted)', 
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
