// ============================================================
// HarisMed - Auto-fill script
// Reads extracted data from PDFs and updates Firestore records
// ============================================================

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

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

// ── All extracted data (auto-read from PDFs + images) ──────────
const EXTRACTED = [
  // ── PDF files ─────────────────────────────────────────────────
  {
    fileName: '48e532a4-8471-4ea8-b0fa-ac7f760177f9.pdf',
    date: '2026-07-15',
    doctor: 'Dr. Deepak Gopinath',
    tests: 'Kidney Function Test, Urine Protein',
    markers: { creatinine:1.4, bun:49, potassium:3.7, sodium:140, hemoglobin:14.3, uricAcid:6.4, albumin:3.0, totalProtein:4.4, calcium:8.5, protein:215 }
  },
  {
    fileName: '5e2f1ff4-7cc5-4fc4-8b9e-6b5b5fe2a479 (1).pdf',
    date: '2026-06-27',
    doctor: 'Dr. Deepak Gopinath',
    tests: 'Kidney Function Test, Urine Protein',
    markers: { creatinine:1.6, bun:26, potassium:3.7, sodium:139, uricAcid:5.7, albumin:3.3, totalProtein:4.6, calcium:8.3, protein:570 }
  },
  {
    fileName: '5e2f1ff4-7cc5-4fc4-8b9e-6b5b5fe2a479.pdf',
    date: '2026-06-27',
    doctor: 'Dr. Deepak Gopinath',
    tests: 'Kidney Function Test, Urine Protein',
    markers: { creatinine:1.6, bun:26, potassium:3.7, sodium:139, uricAcid:5.7, albumin:3.3, totalProtein:4.6, calcium:8.3, protein:570 }
  },
  {
    fileName: 'AUGUST-2025.pdf',
    date: '2025-08-09',
    doctor: 'Dr. Deepak Gopinath (Aster MIMS)',
    tests: 'Kidney Function Test, Urine Protein',
    markers: { creatinine:1.1, bun:39, potassium:4.7, sodium:134, uricAcid:8.1, albumin:3.2, totalProtein:5.4, calcium:8.5, glucose:76, protein:382 }
  },
  {
    fileName: 'Auggust-2022.PDF',
    date: '2022-08-02',
    doctor: 'Dr. Deepak Gopinath',
    tests: 'Kidney Panel, ANA',
    markers: { creatinine:1.0, potassium:4.5, uricAcid:7.5, calcium:9.3, ana:'positive' }
  },
  {
    fileName: 'DOC-20260704-WA0029..pdf',
    date: '2026-06-30',
    doctor: 'Dr. Javed Ahammad MM',
    tests: 'General Report',
    markers: {}
  },
  {
    fileName: 'DOC-20260713-WA0075..pdf',
    date: '2026-06-30',
    doctor: 'Dr. Sajeesh Sivadas',
    tests: 'Nephrology Consult',
    markers: {}
  },
  {
    fileName: 'EM H2418-25 - HAARIS.pdf',
    date: '2025-04-20',
    doctor: 'Dr. Alok Sharma',
    tests: 'Nephrology Consult / Discharge',
    markers: {}
  },
  {
    fileName: 'H.PDDF.pdf',
    date: '2026-07-15',
    doctor: 'Dr. Deepak Gopinath',
    tests: 'Glucose',
    markers: { glucose:62 }
  },
  {
    fileName: 'Haris Vk-invoice.pdf',
    date: '2026-07-15',
    doctor: 'Hospital Invoice',
    tests: 'Invoice',
    markers: {}
  },
  {
    fileName: 'Haris Vk-reports (1).pdf',
    date: '2026-06-01',
    doctor: 'Unknown',
    tests: 'Kidney Panel',
    markers: { creatinine:1.6, bun:25.5, uricAcid:5.9 }
  },
  {
    fileName: 'Haris Vk-reports.pdf',
    date: '2026-05-01',
    doctor: 'Unknown',
    tests: 'Kidney Panel',
    markers: { creatinine:1.2, bun:18, uricAcid:7.3, glucose:90 }
  },
  {
    fileName: 'Haris-reports.pdf',
    date: '2024-01-01',
    doctor: 'Dr. MC Abdul Rahman',
    tests: 'Creatinine',
    markers: { creatinine:1.1 }
  },
  {
    fileName: 'JULY-2022.pdf',
    date: '2022-07-30',
    doctor: 'Dr. Deepak Gopinath',
    tests: 'Kidney Panel, Urine Protein',
    markers: { potassium:4.2, glucose:99, protein:462 }
  },
  {
    fileName: 'MARCH-02-2025.pdf',
    date: '2025-03-26',
    doctor: 'Dr. Deepak Gopinath (Aster MIMS)',
    tests: 'CBC, Urine Protein',
    markers: { hemoglobin:14.4, uricAcid:5.6, glucose:120, protein:551 }
  },
  {
    fileName: 'MARCH-03-2025.pdf',
    date: '2025-03-19',
    doctor: 'Dr. Deepak Gopinath',
    tests: 'Urine Protein',
    markers: { protein:133 }
  },
  {
    fileName: 'MARCH-04.pdf',
    date: '2025-03-17',
    doctor: 'Dr. Deepak Gopinath',
    tests: 'Kidney Function Test',
    markers: { creatinine:1.1, bun:24, potassium:4.1, sodium:137, uricAcid:8.2, albumin:3.3, totalProtein:5.8, calcium:8.7 }
  },
  {
    fileName: 'MARCH-2025.pdf',
    date: '2025-03-28',
    doctor: 'Dr. Deepak Gopinath (Aster MIMS)',
    tests: 'HIV Antibodies',
    markers: {}
  },
  {
    fileName: 'N - CD0412005-886990@67 (1).pdf',
    date: '2026-06-24',
    doctor: 'Dr. Rashmi Metri (Celara Diagnostics)',
    tests: 'Creatinine',
    markers: { creatinine:1.72 }
  },
  {
    fileName: 'N - CD0412005-886990@67-96 (1).pdf',
    date: '2026-06-24',
    doctor: 'Dr. Rashmi Metri (Celara Diagnostics)',
    tests: 'Creatinine, Glucose',
    markers: { creatinine:1.72, glucose:71 }
  },
  {
    fileName: 'bd15f773-5aa5-4b46-b851-0231fb90421d.pdf',
    date: '2025-08-09',
    doctor: 'Dr. Deepak Gopinath (Aster MIMS)',
    tests: 'Kidney Function Test, Urine Protein',
    markers: { creatinine:1.1, bun:39, potassium:4.7, sodium:134, uricAcid:8.1, albumin:3.2, totalProtein:5.4, calcium:8.5, glucose:76, protein:382 }
  },

  // ── JPEG / WhatsApp images ────────────────────────────────────
  // Renopath Renal Biopsy report (Collection: 20/03/2025, Dr. Sajeesh, Aster MIMS)
  {
    fileName: 'WhatsApp Image 2026-07-15 at 10.43.26.jpeg',
    date: '2025-03-20',
    doctor: 'Dr. Sajeesh (Aster MIMS / Renopath)',
    tests: 'Renal Biopsy — Histopathology, Immunofluorescence',
    markers: {}
  },
  // Remaining WhatsApp images — likely continuation pages of same biopsy / other reports
  // Dates assigned based on proximity; update via ✏️ if different
  { fileName: 'WhatsApp Image 2026-07-15 at 10.43.40.jpeg', date: '2025-03-20', doctor: 'Dr. Sajeesh (Renopath)', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.45.14.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.45.22.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.45.30.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.45.38.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.45.45.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.45.52.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.46.12.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.46.29.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.46.45.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.46.56.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.47.31.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.47.59.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.48.26.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
  { fileName: 'WhatsApp Image 2026-07-15 at 10.48.31.jpeg', date: '2025-03-20', doctor: 'Renopath / Aster MIMS', tests: 'Renal Biopsy (continued)', markers: {} },
];

async function autoFill() {
  console.log('\n🏥  HarisMed — Auto-fill from OCR data');
  console.log('🔍  Loading Firestore records...\n');

  const snap = await getDocs(collection(db, 'reports'));
  const records = [];
  snap.forEach(d => records.push({ id: d.id, ...d.data() }));
  console.log(`📄  Found ${records.length} records in Firestore\n`);

  let updated = 0, skipped = 0;

  for (const data of EXTRACTED) {
    // Find matching Firestore record by fileName
    const record = records.find(r => r.fileName === data.fileName);
    if (!record) {
      console.log(`⚠️  Not found in DB: ${data.fileName}`);
      skipped++;
      continue;
    }

    const name = data.fileName.substring(0, 45).padEnd(45);
    process.stdout.write(`Updating: ${name} ... `);

    await updateDoc(doc(db, 'reports', record.id), {
      date:    data.date,
      doctor:  data.doctor,
      tests:   data.tests,
      markers: data.markers,
    });

    const markerCount = Object.keys(data.markers).length;
    console.log(`✅  ${data.date}  (${markerCount} markers)`);
    updated++;
  }

  console.log('\n=============================');
  console.log(`✅  Updated: ${updated} records`);
  if (skipped > 0) console.log(`⚠️  Skipped (not in DB): ${skipped}`);
  console.log('\n🎉  Dashboard trends should now be live!\n');
  process.exit(0);
}

autoFill().catch(err => { console.error(err); process.exit(1); });
