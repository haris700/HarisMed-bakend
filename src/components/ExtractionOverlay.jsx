import React, { useState, useEffect } from 'react';
import { Sparkles, ShieldCheck, Cpu, FileText, CheckCircle2 } from 'lucide-react';

const HEALTH_TIPS = [
  {
    title: "💡 Urine PCR Insight",
    text: "Urine PCR (Protein-to-Creatinine Ratio) accurately measures kidney protein leakage without requiring a full 24-hour collection."
  },
  {
    title: "💧 Hydration & Kidney Function",
    text: "Adequate hydration helps your kidneys clear sodium, urea, and toxins efficiently from the bloodstream."
  },
  {
    title: "🥗 Sodium Management",
    text: "Keeping daily sodium under 2,000 mg (1 teaspoon of salt) helps maintain normal blood pressure and reduces kidney workload."
  },
  {
    title: "🔬 Understanding eGFR",
    text: "eGFR calculates filtering capacity based on serum creatinine. Values above 60 indicate normal or mild stage filtering."
  },
  {
    title: "💊 Medication Safety",
    text: "Always inform your nephrologist about over-the-counter pain relievers, as NSAIDs can lower renal blood flow."
  },
  {
    title: "🍌 Potassium & Heart Rhythm",
    text: "If serum Potassium is high (>5.0 mEq/L), limiting high-potassium foods protects cardiac electrical stability."
  }
];

const STEPS = [
  { label: "Optimizing & Compressing Scan", icon: FileText, percent: 25 },
  { label: "Gemini AI Multimodal OCR Analysis", icon: Cpu, percent: 55 },
  { label: "Extracting Biomarkers & Clinical Guidelines", icon: Sparkles, percent: 85 },
  { label: "Structuring Medical Profile", icon: ShieldCheck, percent: 98 }
];

export default function ExtractionOverlay({ title = "Scanning Medical Document" }) {
  const [tipIndex, setTipIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  // Rotate health tips every 2.8 seconds
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % HEALTH_TIPS.length);
    }, 2800);
    return () => clearInterval(tipInterval);
  }, []);

  // Advance progress steps
  useEffect(() => {
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 1600);
    return () => clearInterval(stepInterval);
  }, []);

  const activeTip = HEALTH_TIPS[tipIndex];
  const activeStep = STEPS[currentStep];

  return (
    <div className="extraction-overlay-backdrop">
      <div className="extraction-overlay-card">
        {/* Scanner Header */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div className="scanner-badge">
            <Sparkles size={15} color="var(--teal)" />
            <span>HarisAI Real-time OCR</span>
          </div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
            {title}
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Please wait while Gemini AI parses your document...
          </p>
        </div>

        {/* Radar Scanner Animation */}
        <div className="radar-container">
          <div className="radar-pulse-ring ring-1"></div>
          <div className="radar-pulse-ring ring-2"></div>
          <div className="radar-core">
            <Cpu size={32} color="var(--teal)" className="radar-icon-pulse" />
          </div>
          <div className="radar-sweep"></div>
        </div>

        {/* Step Progress Bar */}
        <div style={{ width: '100%', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--teal)', marginBottom: '6px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <activeStep.icon size={14} />
              {activeStep.label}
            </span>
            <span>{activeStep.percent}%</span>
          </div>
          <div style={{ height: '7px', background: 'var(--bg-raised)', borderRadius: '100px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div
              style={{
                height: '100%',
                width: `${activeStep.percent}%`,
                background: 'linear-gradient(90deg, var(--teal) 0%, var(--primary) 100%)',
                borderRadius: '100px',
                transition: 'width 0.6s ease'
              }}
            />
          </div>

          {/* Mini Checklist */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '10px' }}>
            {STEPS.map((s, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '0.7rem', color: idx <= currentStep ? 'var(--teal)' : 'var(--text-muted)',
                fontWeight: idx <= currentStep ? 600 : 400
              }}>
                <CheckCircle2 size={12} color={idx <= currentStep ? 'var(--teal)' : 'var(--text-muted)'} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label.split(' ')[0]} {s.label.split(' ')[1]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive Health Tip Carousel */}
        <div className="health-tip-box">
          <p className="health-tip-title">{activeTip.title}</p>
          <p className="health-tip-text">{activeTip.text}</p>
          <div className="health-tip-dots">
            {HEALTH_TIPS.map((_, i) => (
              <span key={i} className={`health-tip-dot ${i === tipIndex ? 'active' : ''}`} />
            ))}
          </div>
        </div>

        {/* Lock Notice */}
        <div style={{
          marginTop: '14px', fontSize: '0.72rem', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', textAlign: 'center'
        }}>
          <ShieldCheck size={13} color="var(--teal)" />
          <span>Page actions & inputs are locked until extraction completes</span>
        </div>
      </div>
    </div>
  );
}
