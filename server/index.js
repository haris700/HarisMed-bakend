import express from 'express';
import cors from 'cors';
import { Groq } from 'groq-sdk';
import dotenv from 'dotenv';
import { getOntologyContext } from './ontology.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// The RAG Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, patientData } = req.body;

    // 0. Router Agent: Classify Intent (Multi-Agent Routing)
    let ontologyText = "";
    if (messages && messages.length > 0) {
      const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')?.content || "";
      if (lastUserMessage) {
        const routerPrompt = `Analyze the medical question and classify it into ONE category: RENAL, LIVER, BLOOD, METABOLIC, or GENERAL. Output ONLY valid JSON: {"intent": "CATEGORY"}\nQuestion: ${lastUserMessage}`;
        try {
          const routerResponse = await groq.chat.completions.create({
            model: "llama-3-8b-8192", // Fast, free router model
            messages: [{ role: "system", content: routerPrompt }],
            response_format: { type: "json_object" },
            temperature: 0.1,
          });
          const intentData = JSON.parse(routerResponse.choices[0].message.content);
          console.log("🤖 Router Agent classified intent as:", intentData.intent);
          ontologyText = getOntologyContext(intentData.intent);
        } catch (e) {
          console.error("Router failed, falling back to general:", e);
        }
      }
    }

    // 1. Construct the System Prompt (Knowledge Graph context)
    let systemPrompt = `You are "HarisAI", a highly knowledgeable, empathetic, and professional nephrology and dietary assistant for the HarisMed app.
You are helping a patient manage their health records and diet based on their recent lab results.
${ontologyText}
CRITICAL RULES:
1. Always base your dietary and health suggestions strictly on the patient's provided lab data below.
2. If their Potassium is high (>5.0), strongly advise against high-potassium foods (bananas, tomatoes, potatoes, oranges).
3. If their PCR (Protein Creatinine Ratio) is high, advise on a renal diet (controlled protein, low sodium).
4. Do NOT hallucinate medical advice. Always state: "Please consult your nephrologist before making major dietary changes."
5. CHAIN OF THOUGHT (CoT): If the user asks for a trend, highest, lowest, or a comparison across time, you MUST first explicitly list out all the relevant values and their dates from the provided context. Only AFTER listing them out, state the final answer. Do NOT guess.
6. Be supportive and professional.

### PATIENT'S CURRENT BIOMARKERS (RAG CONTEXT) ###
`;
    
    if (patientData && patientData.length > 0) {
      patientData.forEach(record => {
        systemPrompt += `\n--- Date: ${record.date} ---\n`;
        if (record.tests) {
          const testString = Array.isArray(record.tests) ? record.tests.join(', ') : record.tests;
          if (testString && testString !== 'To be updated') {
            systemPrompt += `Test Types (Node Edges): ${testString}\n`;
          }
        }
        systemPrompt += `Markers:\n`;
        const markers = record.markers || {};
        for (const [key, value] of Object.entries(markers)) {
           systemPrompt += `- ${key.toUpperCase()}: ${value}\n`;
        }
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🤖 HarisAI Secure Backend (Groq Llama 3) running on port ${PORT}`);
});
