import dotenv from 'dotenv';
dotenv.config({ path: '../server/.env' });

const API_KEY = process.env.GEMINI_API_KEY;

async function checkModels() {
  console.log("Checking available models for key:", API_KEY.substring(0, 10) + "...");
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.error("API Error:", JSON.stringify(data.error, null, 2));
      return;
    }
    
    if (data.models) {
      const modelNames = data.models.map(m => m.name).filter(name => name.includes('gemini'));
      console.log("Available Gemini models:");
      console.log(modelNames.join('\n'));
    } else {
      console.log("No models returned:", data);
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

checkModels();
