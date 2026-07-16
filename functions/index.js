const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const { Groq } = require("groq-sdk");
require("dotenv").config();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post("/chat", async (req, res) => {
  try {
    const { messages, patientData } = req.body;

    let systemPrompt = `You are "HarisAI", a highly knowledgeable, empathetic, and professional nephrology and dietary assistant for the HarisMed app.
You are helping a patient manage their health records and diet based on their recent lab results.

CRITICAL RULES:
1. Always base your dietary and health suggestions strictly on the patient's provided lab data below.
2. If their Potassium is high (>5.0), strongly advise against high-potassium foods (bananas, tomatoes, potatoes, oranges).
3. If their PCR (Protein Creatinine Ratio) is high, advise on a renal diet (controlled protein, low sodium).
4. Do NOT hallucinate medical advice. Always state: "Please consult your nephrologist before making major dietary changes."
5. Be supportive and warm.

### PATIENT'S CURRENT BIOMARKERS (RAG CONTEXT) ###
`;
    
    if (patientData && patientData.length > 0) {
      patientData.forEach(record => {
        systemPrompt += `\nDate: ${record.date}\n`;
        const markers = record.markers || {};
        for (const [key, value] of Object.entries(markers)) {
           systemPrompt += `- ${key.toUpperCase()}: ${value}\n`;
        }
      });
    } else {
      systemPrompt += `\nNo recent lab data provided.\n`;
    }

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: apiMessages,
      temperature: 0.2, 
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error("Groq API Error:", error);
    res.status(500).json({ error: "Failed to fetch response from AI" });
  }
});

exports.api = onRequest(app);
