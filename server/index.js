import express from 'express';
import cors from 'cors';
import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOntologyContext } from './ontology.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Initialize Gemini
const geminiKey = (process.env.GEMINI_API_KEY || "").replace(/"/g, '');
const genAI = new GoogleGenerativeAI(geminiKey);
const aiModel = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

// The RAG Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, patientData, patientProfile } = req.body;

    // 0. Router Agent: Classify Intent (Multi-Agent Routing)
    let ontologyText = "";
    let intentCategory = 'GENERAL';

    if (messages && messages.length > 0) {
      const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')?.content || "";
      if (lastUserMessage) {
        const routerPrompt = `Analyze the medical question and classify it into ONE category: RENAL, LIVER, BLOOD, METABOLIC, or GENERAL. Output ONLY valid JSON: {"intent": "CATEGORY"}\nQuestion: ${lastUserMessage}`;
        try {
          const routerResponse = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant", // Fast, free router model
            messages: [{ role: "system", content: routerPrompt }],
            response_format: { type: "json_object" },
            temperature: 0.1,
          });
          const intentData = JSON.parse(routerResponse.choices[0].message.content);
          console.log("🤖 Router Agent classified intent as:", intentData.intent);
          intentCategory = intentData.intent;
          ontologyText = getOntologyContext(intentData.intent);
        } catch (e) {
          console.error("Router failed, falling back to general:", e);
        }
      }
    }

    // 0.5. Define Masking Rules (Principle of Least Privilege)
    const MARKER_WHITELIST = {
      RENAL: ['creatinine', 'pcratio', 'egfr', 'bun', 'urineProtein', 'potassium', 'urineRbc', 'sodium', 'calcium', 'uricAcid'],
      LIVER: ['ast', 'alt', 'bilirubin', 'albumin', 'alkalinePhosphatase', 'totalProtein'],
      BLOOD: ['hemoglobin', 'wbc', 'rbc', 'platelets'],
      METABOLIC: ['glucose', 'cholesterol', 'uricAcid', 'hba1c'],
      GENERAL: null // null means allow all
    };
    const allowedMarkers = MARKER_WHITELIST[intentCategory.toUpperCase()] || null;

    // 1. Construct the System Prompt (Knowledge Graph context)
    let systemPrompt = `You are "HarisAI", a highly knowledgeable, empathetic, and professional nephrology and dietary assistant for the HarisMed app.
You are helping a patient manage their health records, medications, and diet based on their clinical profile and recent lab results.
${ontologyText}
CRITICAL RULES:
1. Always base your dietary and health suggestions strictly on the patient's provided lab data and medical profile below.
2. If their Potassium is high (>5.0), strongly advise against high-potassium foods (bananas, tomatoes, potatoes, oranges).
3. If their PCR (Protein Creatinine Ratio) is high, advise on a renal diet (controlled protein, low sodium).
4. Consider their active medications and diagnoses when offering advice.
5. Do NOT hallucinate medical advice. Always state: "Please consult your nephrologist before making major dietary or medication changes."
6. CHAIN OF THOUGHT (CoT): If the user asks for a trend, highest, lowest, or a comparison across time, you MUST first explicitly list out all the relevant values and their dates from the provided context. Only AFTER listing them out, state the final answer. Do NOT guess.
7. Be supportive and professional.
`;

    // 1.5 Inject Patient Medical Profile if available
    if (patientProfile && typeof patientProfile === 'object') {
      systemPrompt += `\n### PATIENT MEDICAL PROFILE & CLINICAL CONTEXT ###\n`;
      if (patientProfile.diagnoses && patientProfile.diagnoses.length > 0) {
        systemPrompt += `Active Diagnoses: ${patientProfile.diagnoses.join(', ')}\n`;
      }
      if (patientProfile.medications && patientProfile.medications.length > 0) {
        const medList = patientProfile.medications.map(m => typeof m === 'object' ? `${m.name} (${m.dosage || ''})` : m).join(', ');
        systemPrompt += `Active Medications: ${medList}\n`;
      }
      if (patientProfile.allergies && patientProfile.allergies.length > 0) {
        systemPrompt += `Allergies / Intolerances: ${patientProfile.allergies.join(', ')}\n`;
      }
      if (patientProfile.dietary_restrictions && patientProfile.dietary_restrictions.length > 0) {
        systemPrompt += `Dietary Guidelines: ${patientProfile.dietary_restrictions.join(', ')}\n`;
      }
      if (patientProfile.clinical_notes) {
        systemPrompt += `Doctor / Clinical Notes: ${patientProfile.clinical_notes}\n`;
      }
    }

    systemPrompt += `\n### PATIENT'S CURRENT BIOMARKERS (RAG CONTEXT) ###\n`;
    
    if (patientData && patientData.length > 0) {
      // Sort oldest to newest for chronological AI reasoning
      const sorted = [...patientData].sort((a, b) => a.date.localeCompare(b.date));
      
      const seenEmptyRecords = new Set();
      const uniqueRecords = [];
      
      for (const record of sorted) {
        const hasMarkers = record.markers && Object.keys(record.markers).length > 0;
        const key = `${record.date}-${(record.tests || '')}`;
        
        if (hasMarkers) {
          uniqueRecords.push(record);
        } else if (!seenEmptyRecords.has(key)) {
          uniqueRecords.push(record);
          seenEmptyRecords.add(key);
        }
      }

      uniqueRecords.forEach(record => {
        systemPrompt += `\n--- Date: ${record.date} ---\n`;
        if (record.tests) {
          const testString = Array.isArray(record.tests) ? record.tests.join(', ') : record.tests;
          if (testString && testString !== 'To be updated') {
            systemPrompt += `Test Types (Node Edges): ${testString}\n`;
          }
        }
        systemPrompt += `Markers:\n`;
        const markers = record.markers || {};
        const markersDetail = record.markers_detail || {};
        
        let addedCount = 0;
        for (const [key, value] of Object.entries(markers)) {
           // Security Masking: Skip irrelevant markers based on intent
           if (allowedMarkers && !allowedMarkers.includes(key) && !allowedMarkers.includes(key.toLowerCase())) {
             continue;
           }
           addedCount++;
           
           const detail = markersDetail[key];
           if (detail) {
             systemPrompt += `- ${key.toUpperCase()}: ${detail.value} ${detail.unit || ''} (${detail.flag || 'Normal'}) [Ref: ${detail.reference_range || 'Unknown'}]\n`;
           } else {
             systemPrompt += `- ${key.toUpperCase()}: ${value}\n`;
           }
        }
        if (addedCount === 0) systemPrompt += `- (No relevant markers for this category)\n`;
      });
    } else {
      systemPrompt += `\nNo recent lab data provided.\n`;
    }

    // Format the messages for the OpenAI/Groq API format
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    ];

    // Call the Groq API (using the blazing fast Llama 3.3 70B model)
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: apiMessages,
      temperature: 0.2, // Keep it factual and grounded
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error("Groq API Error:", error);
    res.status(500).json({ error: "Failed to fetch response from AI" });
  }
});

// Mobile Document Auto-Extraction Endpoint (Gemini 3.6 Flash)
app.post('/api/extract', async (req, res) => {
  try {
    const { fileData, mimeType } = req.body;
    if (!fileData || !mimeType) {
      return res.status(400).json({ error: "Missing fileData or mimeType" });
    }

    // Extract base64 payload from data URL
    const base64Data = fileData.includes('base64,') 
      ? fileData.split('base64,')[1] 
      : fileData;

    const prompt = `You are an expert medical data extractor. Extract the date of the test and key biomarkers from this medical report into a strict JSON object.
CRITICAL: You MUST use the exact following keys inside the "markers" object if found: 'pcratio' (Urine Protein Creatinine Ratio), 'creatinine', 'egfr', 'bun' (Urea), 'urineProtein', 'potassium', 'uricAcid', 'urineRbc' (RBC in Urine Microscopy), and 'cholesterol' (Total Cholesterol or Lipid Profile).
Format the JSON exactly like this:
{
  "date": "YYYY-MM-DD",
  "test_types": ["Blood Panel", "Urinalysis"],
  "markers": {
    "creatinine": { "value": 1.4, "unit": "mg/dL", "reference_range": "0.7-1.2", "flag": "High" },
    "pcratio": { "value": 2.6, "unit": "mg/mg", "reference_range": "0-0.3", "flag": "High" },
    "urineRbc": { "value": 8, "unit": "/hpf", "reference_range": "0-5", "flag": "High" },
    "cholesterol": { "value": 180, "unit": "mg/dL", "reference_range": "0-200", "flag": "Normal" }
  }
}
If the date is not found, use today's date (${new Date().toISOString().split('T')[0]}). If a value is not found, omit it. Do not include markdown formatting, just raw JSON.`;

    const aiResult = await aiModel.generateContent({
      contents: [
        { role: 'user', parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }] }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const text = aiResult.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const extractedData = JSON.parse(text);

    // Format markers for the Hybrid Data Model
    const rawMarkers = {};
    const markersDetail = {};
    for (const [k, v] of Object.entries(extractedData.markers || {})) {
      const val = parseFloat(v.value);
      if (!isNaN(val)) {
        rawMarkers[k] = val;
      }
      markersDetail[k] = {
        value: v.value,
        unit: v.unit || '',
        flag: v.flag || 'Normal',
        reference_range: v.reference_range || 'Unknown'
      };
    }

    res.json({
      date: extractedData.date || new Date().toISOString().split('T')[0],
      tests: extractedData.test_types || ["Unknown"],
      markers: rawMarkers,
      markers_detail: markersDetail
    });
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    res.status(500).json({ error: "Failed to extract data from document" });
  }
});

// Prescription & Clinical Summary Auto-Extraction Endpoint (Gemini 3.6 Flash)
app.post('/api/extract-profile', async (req, res) => {
  try {
    const { fileData, mimeType } = req.body;
    if (!fileData || !mimeType) {
      return res.status(400).json({ error: "Missing fileData or mimeType" });
    }

    const base64Data = fileData.includes('base64,') 
      ? fileData.split('base64,')[1] 
      : fileData;

    const prompt = `You are a world-class clinical data extractor reading a doctor's prescription, OP summary, hospital discharge summary, or medical note.
Thoroughly analyze the document and extract ALL key clinical information into a strict JSON object:

1. "diagnoses": Extract all medical conditions, biopsy results, and primary diagnoses (e.g. ["C3 Glomerulopathy (C3GN)", "Proteinuria", "Hypertension"]).
2. "medications": Extract ALL prescribed medications with exact name, strength, and frequency (e.g. [
   { "name": "Tab. Repace 50mg", "dosage": "1-0-1 (1 month)" },
   { "name": "Tab. Dapefy 5mg", "dosage": "0-1-0" },
   { "name": "Tab. Wysolone 40mg", "dosage": "1-0-0 (After Food)" },
   { "name": "Tab. Shelcal 500mg", "dosage": "1-0-1" },
   { "name": "Tab. Aztor 10mg", "dosage": "0-0-1" },
   { "name": "Tab. Pan 40mg", "dosage": "1-0-0 (Before Food)" },
   { "name": "Tab. Bactrim DS", "dosage": "0-1/2-0" }
]).
3. "allergies": Extract any drug or food allergies mentioned (e.g. [] if "No Allergies" or none listed).
4. "dietary_restrictions": Extract any dietary or lifestyle guidelines mentioned.
5. "clinical_notes": Extract a comprehensive, detailed clinical summary including:
   - Plan of Care & Biopsy / Diagnostic history (e.g. Renal biopsy C3 3+, glomeruli sclerosis, urine PCR trends)
   - Vital Signs & Examination (e.g. BP: 150/90, Weight: 73.8kg, no oedema)
   - Medication compliance notes & Doctor's review instructions (e.g. Patient noted irregular with ARB; Review in 1 month with CBC, Creatinine, Na, K, RBS, Urine R/E, Urine PCR).

Return ONLY valid JSON matching this exact structure:
{
  "diagnoses": ["C3 Glomerulopathy", "Hypertension"],
  "medications": [{ "name": "Tab. Repace 50mg", "dosage": "1-0-1" }],
  "allergies": [],
  "dietary_restrictions": [],
  "clinical_notes": "Plan of Care: Renal biopsy shows C3GN... Examination: BP 150/90, wt 73.8kg. Follow up: Review in 1 month with CBC, Creatinine, Na, K, RBS, Urine R/E, Urine PCR."
}
If any field is missing, use [] or "". Do not include markdown code block syntax. Return raw JSON only.`;

    const aiResult = await aiModel.generateContent({
      contents: [
        { role: 'user', parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }] }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const text = aiResult.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const extractedProfile = JSON.parse(text);

    res.json(extractedProfile);
  } catch (error) {
    console.error("Gemini Profile Extraction Error:", error);
    res.status(500).json({ error: "Failed to extract medical profile from document" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🤖 HarisAI Secure Backend (Groq Llama 3) running on port ${PORT}`);
});
