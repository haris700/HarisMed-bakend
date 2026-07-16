// ============================================================
// HarisMed - Batch Upload Script (Firestore only - 100% Free)
// Stores files as base64 directly in Firestore documents
// No Firebase Storage needed!
// ============================================================

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';

// ---- Your Firebase Config ----
const firebaseConfig = {
  apiKey: "AIzaSyAezRo6H_y64arvuzoE6oZeKjTxvdR9seg",
  authDomain: "medical-history-9da37.firebaseapp.com",
  projectId: "medical-history-9da37",
  storageBucket: "medical-history-9da37.firebasestorage.app",
  messagingSenderId: "621956809351",
  appId: "1:621956809351:web:0996ef5d74b18efd72ee22",
  measurementId: "G-1L898F2C93"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---- Folder containing all your medical files ----
const REPORTS_FOLDER = '/Users/harisvk/Desktop/MyMedicalRepots';

// Firestore max document size is 1MB. Base64 adds ~33% overhead.
// So max safe original file size is ~750KB
const MAX_FILE_SIZE_BYTES = 750 * 1024;

// ---- Helper: Guess a date from a filename ----
function guessTitleAndDate(filename) {
  const name = filename.replace(/\.[^/.]+$/, '');
  const monthNames = ['january','february','march','april','may','june',
                      'july','august','september','october','november','december'];
  const lower = name.toLowerCase();

  for (const month of monthNames) {
    if (lower.includes(month)) {
      const yearMatch = name.match(/20\d{2}/);
      const year = yearMatch ? yearMatch[0] : '2025';
      const monthIndex = monthNames.indexOf(month);
      // Try to find a specific day too (e.g. MARCH-02-2025)
      const dayMatch = name.match(/[-_](\d{2})[-_]/);
      const day = dayMatch ? dayMatch[1] : '01';
      return { date: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}` };
    }
  }

  // WhatsApp pattern: 2026-07-15
  const waMatch = name.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (waMatch) {
    return { date: `${waMatch[1]}-${waMatch[2]}-${waMatch[3]}` };
  }

  return { date: new Date().toISOString().split('T')[0] };
}

// ---- Helper: Determine MIME type ----
function getMimeType(ext) {
  const map = {
    '.pdf':  'application/pdf',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

// ---- Main Upload Function ----
async function uploadAll() {
  console.log('\n🏥  HarisMed Batch Uploader (Firestore Free Mode)');
  console.log(`📁  Scanning: ${REPORTS_FOLDER}\n`);

  const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const files = readdirSync(REPORTS_FOLDER).filter(f => {
    const ext = extname(f);
    return validExtensions.includes(ext.toLowerCase());
  });

  console.log(`📄  Found ${files.length} files to upload...\n`);

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = join(REPORTS_FOLDER, filename);
    const ext = extname(filename);
    const mimeType = getMimeType(ext);
    const { date } = guessTitleAndDate(filename);
    const isImage = ['.jpg', '.jpeg', '.png'].includes(ext.toLowerCase());

    process.stdout.write(`[${i + 1}/${files.length}] ${filename.substring(0, 45).padEnd(45)} `);

    try {
      const fileBuffer = readFileSync(filePath);
      const fileSizeKB = Math.round(fileBuffer.length / 1024);

      // Check file size
      if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
        console.log(`⚠️  SKIPPED (${fileSizeKB}KB > 750KB limit)`);
        skippedCount++;
        continue;
      }

      // Convert to base64
      const base64Data = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Data}`;

      // Save to Firestore (with base64 file embedded)
      await addDoc(collection(db, 'reports'), {
        date,
        doctor: 'To be updated',
        tests: 'To be updated',
        fileName: filename,
        fileData: dataUrl,      // Full base64 file stored here
        mimeType,
        isImage,
        fileSizeKB,
        markers: {
          ana:        null,
          chf:        null,
          antiChf:    null,
          creatinine: null,
        },
        createdAt: serverTimestamp()
      });

      console.log(`✅  ${date}  (${fileSizeKB}KB)`);
      successCount++;
    } catch (err) {
      console.log(`❌  FAILED: ${err.message}`);
      failCount++;
    }
  }

  console.log('\n=============================');
  console.log(`✅  Successfully uploaded: ${successCount}`);
  if (skippedCount > 0) console.log(`⚠️  Skipped (too large): ${skippedCount}`);
  if (failCount > 0)    console.log(`❌  Failed: ${failCount}`);
  console.log('\n🎉  All done! Open your app to review.');
  console.log('   → http://localhost:5173/history\n');
  process.exit(0);
}

uploadAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
