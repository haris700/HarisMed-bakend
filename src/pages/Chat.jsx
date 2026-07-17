import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Bot, User, Send, Loader2, Info } from 'lucide-react';

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi Haris! I have securely accessed your latest kidney health records (PCR, Creatinine, etc). Ask me anything about your diet, trends, or what you should be eating today!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [patientData, setPatientData] = useState([]);
  const messagesEndRef = useRef(null);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '70px' }}>
      
      {/* Header */}
      <div style={{ padding: '20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: 'var(--primary)', color: 'white', padding: '8px', borderRadius: '10px' }}>
          <Bot size={24} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>HarisAI Assistant</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Clinical context active ✨</p>
        </div>
      </div>

      {/* Privacy Warning */}
      <div style={{ background: 'rgba(249,115,22,0.1)', padding: '10px 20px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.75rem', color: '#f97316' }}>
        <Info size={14} />
        <span>Your data is processed securely (DPDP & HIPAA standards). AI advice is not a substitute for your doctor.</span>
      </div>

      {/* Chat Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((m, idx) => (
          <div key={idx} style={{ 
            display: 'flex', 
            gap: '12px', 
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-end'
          }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '50%', 
              background: m.role === 'user' ? 'var(--text)' : 'var(--primary)', 
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
            }}>
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div style={{ 
              background: m.role === 'user' ? 'var(--surface-raised)' : 'linear-gradient(135deg, rgba(200,160,255,0.1) 0%, rgba(167,139,250,0.1) 100%)', 
              padding: '12px 16px', 
              borderRadius: '16px', 
              borderBottomRightRadius: m.role === 'user' ? 0 : '16px',
              borderBottomLeftRadius: m.role === 'assistant' ? 0 : '16px',
              maxWidth: '80%',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              border: m.role === 'assistant' ? '1px solid rgba(167,139,250,0.3)' : '1px solid var(--border)'
            }}>
              {m.content.split('\n').map((line, i) => <p key={i} style={{ margin: '0 0 8px 0', lastChild: { margin: 0 } }}>{line}</p>)}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexDirection: 'row' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Bot size={16} />
            </div>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(200,160,255,0.1) 0%, rgba(167,139,250,0.1) 100%)', 
              padding: '16px 20px', 
              borderRadius: '16px', 
              borderBottomLeftRadius: 0,
              border: '1px solid rgba(167,139,250,0.3)',
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

      {/* Input Area */}
      <div style={{ padding: '20px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your diet or lab trends..." 
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              borderRadius: '24px', 
              border: '1px solid var(--border)', 
              background: 'var(--bg)', 
              color: 'var(--text)',
              fontSize: '0.9rem',
              outline: 'none'
            }} 
            disabled={loading}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || loading}
            style={{ 
              background: input.trim() && !loading ? 'var(--primary)' : 'var(--border)', 
              color: 'white', 
              border: 'none', 
              width: '44px', 
              height: '44px', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              transition: 'background 0.2s'
            }}>
            <Send size={18} />
          </button>
        </form>
      </div>
      
    </div>
  );
}
