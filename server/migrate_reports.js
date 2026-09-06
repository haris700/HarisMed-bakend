import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const firebaseConfig = {
  apiKey: "AIzaSyAezRo6H_y64arvuzoE6oZeKjTxvdR9seg",
  authDomain: "medical-history-9da37.firebaseapp.com",
  projectId: "medical-history-9da37",
  storageBucket: "medical-history-9da37.firebasestorage.app",
  messagingSenderId: "621956809351",
  appId: "1:621956809351:web:0996ef5d74b18efd72ee22",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const geminiKey = (process.env.GEMINI_API_KEY || "").replace(/"/g, '');
const genAI = new GoogleGenerativeAI(geminiKey);

async function generateWithGemini(contents, generationConfig = {}) {
  const models = [
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.7-flash',
    'gemini-3.6-flash'
  ];
  let lastError = null;
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          ...generationConfig
        }
      });
      return { result, modelName };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

const NORMALIZE_KEY = (k) => {
  const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['pcratio', 'pcr', 'upcr', 'urinepcr', 'proteincreatinineratio', 'proteintocreatinineratio', 'urineproteincreatinineratio', 'spoturineproteincreatinineratio', 'protcreatratio', 'pcratio', 'urinepcratio', 'albumincreatinineratio', 'acr', 'uacr'].includes(clean)) {
    return 'pcratio';
  }
  if (['urinerbc', 'rbcurine', 'rbc', 'urideredbloodcells', 'redbloodcells', 'erythrocytes', 'microscopyrbc', 'urinemicroscopyrbc', 'rbcs', 'microscopicrbc'].includes(clean)) {
    return 'urineRbc';
  }
  if (['creatinine', 'serumcreatinine', 'creat', 'screatinine'].includes(clean)) {
    return 'creatinine';
  }
  if (['egfr', 'egfrckdepi', 'gfr', 'estimatedgfr', 'egfrval'].includes(clean)) {
    return 'egfr';
  }
  if (['bun', 'urea', 'bloodurea', 'bloodureanitrogen', 'surea'].includes(clean)) {
    return 'bun';
  }
  if (['urineprotein', 'urineproteinconcentration', 'proteinconcentration', 'urineproteinquant', 'spoturineprotein', 'totalurineprotein', 'urinetotalprotein'].includes(clean)) {
    return 'urineProtein';
  }
  if (['urinedipstickprotein', 'dipstickprotein', 'chemicalprotein', 'proteins', 'protein', 'urinealbumin', 'albuminurine'].includes(clean)) {
    return 'urineDipstickProtein';
  }
  if (['totalprotein', 'serumtotalprotein', 'totprotein', 'tprotein', 'proteinserum', 'totalproteins'].includes(clean)) {
    return 'totalProtein';
  }
  if (['albumin', 'serumalbumin', 'salbumin', 'albumina', 'alb'].includes(clean)) {
    return 'albumin';
  }
  if (['globulin', 'serumglobulin', 'sglobulin', 'glob'].includes(clean)) {
    return 'globulin';
  }
  if (['agratio', 'ag', 'albuminglobulinratio', 'albumintoglobulinratio', 'aandgratio', 'agratiocalculated', 'agcalculated'].includes(clean)) {
    return 'agRatio';
  }
  if (['potassium', 'serumpotassium', 'k', 'spotassium'].includes(clean)) {
    return 'potassium';
  }
  if (['uricacid', 'serumuricacid', 'suricacid', 'uric'].includes(clean)) {
    return 'uricAcid';
  }
  if (['cholesterol', 'totalcholesterol', 'lipidcholesterol', 'scholesterol', 'tchol'].includes(clean)) {
    return 'cholesterol';
  }
  if (['calcium', 'serumcalcium', 'scalcium', 'ca'].includes(clean)) {
    return 'calcium';
  }
  if (['phosphorus', 'serumphosphorus', 'phosphate', 'sphosphorus', 'po4'].includes(clean)) {
    return 'phosphorus';
  }
  if (['sodium', 'serumsodium', 'na', 'ssodium'].includes(clean)) {
    return 'sodium';
  }
  if (['chloride', 'serumchloride', 'cl', 'schloride'].includes(clean)) {
    return 'chloride';
  }
  return k;
};

const prompt = `You are an expert medical data extractor. Extract all biomarkers and test dates from this medical report (Blood panels, Kidney Function Tests, Urine Routine & Microscopy Examination, and Spot Urine Protein-Creatinine Ratio) into a strict JSON object.

CRITICAL BIOMARKER MAPPING RULES:
- 'pcratio': "URINE PROTEIN CREATININE RATIO" (e.g. 2.44 mg/mg, reference "0-0.3", flag "High").
- 'urineProtein': Quantitative "URINE PROTEIN CONCENTRATION" in mg/dL (e.g. 230 mg/dL, reference "<12", flag "High"). Do NOT use dipstick grades here if quantitative mg/dL concentration is available.
- 'urineDipstickProtein': Qualitative / Dipstick Urine Protein under Chemical Examination (e.g. "2+", "1+", "Trace", "Negative").
- 'urineCreatinine': "URINE CREATININE" in mg/dL (e.g. 94.2 mg/dL).
- 'creatinine': Serum Creatinine in mg/dL (e.g. 1.1 or 1.4 mg/dL).
- 'egfr': Estimated Glomerular Filtration Rate (e.g. 72 mL/min).
- 'bun': Blood Urea Nitrogen / Urea in mg/dL (e.g. 43 or 15 mg/dL).
- 'potassium': Serum Potassium in mEq/L (e.g. 4.4 mEq/L).
- 'uricAcid': Serum Uric Acid in mg/dL (e.g. 6.51 mg/dL).
- 'urineRbc': RBC / Red Blood Cells in Urine Microscopic Examination (e.g. "10-15", "0-2", "8-10" /hpf, reference "0-5", flag "High").
- 'totalProtein': Serum TOTAL PROTEIN in g/dL (e.g. 4.67 g/dL, reference "6.4-8.3", flag "Low").
- 'albumin': Serum ALBUMIN in g/dL (e.g. 3.40 g/dL, reference "3.97-4.94", flag "Low").
- 'globulin': Serum GLOBULIN in g/dL (e.g. 1.27 g/dL, reference "2.3-3.5", flag "Low").
- 'agRatio': A/G RATIO / Albumin to Globulin Ratio (e.g. 2.68, reference "1-2", flag "High").
- 'cholesterol': Total Cholesterol in mg/dL (e.g. 233 or 180 mg/dL).
- 'calcium': Serum Calcium in mg/dL (e.g. 8.69 mg/dL).
- 'phosphorus': Serum Phosphorus in mg/dL (e.g. 4.73 mg/dL).
- 'sodium': Serum Sodium in mmol/L or mEq/L (e.g. 140 mmol/L).

Format the JSON exactly like this:
{
  "date": "YYYY-MM-DD",
  "test_types": ["Kidney Function Test", "Protein - Creatinine Ratio, Urine", "Urine Routine Examination"],
  "markers": {
    "pcratio": { "value": 2.44, "unit": "mg/mg", "reference_range": "0-0.3", "flag": "High" },
    "urineProtein": { "value": 230, "unit": "mg/dl", "reference_range": "<12", "flag": "High" },
    "urineDipstickProtein": { "value": "2+", "unit": "Grade", "reference_range": "Negative", "flag": "High" },
    "urineRbc": { "value": "10-15", "unit": "/hpf", "reference_range": "0-5", "flag": "High" },
    "totalProtein": { "value": 4.67, "unit": "g/dL", "reference_range": "6.4-8.3", "flag": "Low" },
    "albumin": { "value": 3.40, "unit": "g/dL", "reference_range": "3.97-4.94", "flag": "Low" },
    "globulin": { "value": 1.27, "unit": "g/dL", "reference_range": "2.3-3.5", "flag": "Low" },
    "agRatio": { "value": 2.68, "unit": "", "reference_range": "1.0-2.0", "flag": "High" }
  }
}
If a value is a range (like "10-15"), keep the exact range string in "value". Do not include markdown formatting, just raw JSON.`;

async function migrate() {
  console.log("🚀 Starting Firestore Lab Reports Re-extraction & Migration...");
  const snap = await getDocs(collection(db, 'reports'));
  console.log(`📑 Found ${snap.docs.length} total reports in Firestore.`);

  let updatedCount = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const docId = docSnap.id;
    console.log(`\n🔍 Checking Report [${docId}] - Date: ${data.date}, Tests: ${data.tests}, File: ${data.fileName || 'none'}`);

    if (!data.fileData) {
      console.log(`   ⏭️ Skipping (no attached fileData).`);
      continue;
    }

    const base64Data = data.fileData.includes('base64,')
      ? data.fileData.split('base64,')[1]
      : data.fileData;
    const mimeType = data.mimeType || (data.isImage ? 'image/jpeg' : 'application/pdf');

    try {
      console.log(`   🤖 Re-extracting with Gemini AI...`);
      const { result, modelName } = await generateWithGemini([
        { role: 'user', parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }] }
      ]);

      const rawText = result.response.text().trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawText);

      const existingMarkers = data.markers || {};
      const existingDetails = data.markers_detail || {};

      const newMarkers = { ...existingMarkers };
      const newDetails = { ...existingDetails };

      let addedFields = [];

      for (const [rawK, v] of Object.entries(extracted.markers || {})) {
        const k = NORMALIZE_KEY(rawK);
        let numericVal = NaN;
        if (typeof v.value === 'number') {
          numericVal = v.value;
        } else if (typeof v.value === 'string') {
          if (v.value.includes('-')) {
            const parts = v.value.split('-').map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
            if (parts.length === 2) numericVal = (parts[0] + parts[1]) / 2;
            else if (parts.length === 1) numericVal = parts[0];
          } else if (v.value.includes('+')) {
            numericVal = parseFloat(v.value);
          } else {
            numericVal = parseFloat(v.value);
          }
        }

        const finalVal = isNaN(numericVal) ? v.value : numericVal;

        // Merge and update
        newMarkers[k] = finalVal;
        newDetails[k] = {
          value: v.value ?? finalVal,
          unit: v.unit || '',
          flag: v.flag || 'Normal',
          reference_range: v.reference_range || ''
        };
        addedFields.push(`${k}: ${v.value}`);
      }

      console.log(`   ✨ Extracted [${modelName}]: ${addedFields.join(', ')}`);

      await updateDoc(doc(db, 'reports', docId), {
        markers: newMarkers,
        markers_detail: newDetails,
      });

      console.log(`   💾 Firestore document [${docId}] successfully updated!`);
      updatedCount++;
    } catch (err) {
      console.error(`   ❌ Failed to re-extract report [${docId}]:`, err.message);
    }
  }

  console.log(`\n🎉 Migration Complete! Successfully updated ${updatedCount} reports.`);
  process.exit(0);
}

migrate().catch(e => {
  console.error("Fatal migration error:", e);
  process.exit(1);
});
