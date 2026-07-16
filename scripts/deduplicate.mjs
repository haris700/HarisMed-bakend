// ============================================================
// HarisMed - Deduplication Script
// Removes duplicate reports (same filename) from Firestore
// Keeps the record with the most data / most recent upload
// ============================================================

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

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

async function deduplicate() {
  console.log('\n🧹  HarisMed Deduplication Tool');
  console.log('🔍  Loading all reports from Firestore...\n');

  const snapshot = await getDocs(collection(db, 'reports'));
  const all = [];
  snapshot.forEach(d => all.push({ id: d.id, ...d.data() }));

  console.log(`📄  Total records found: ${all.length}`);

  // Group by normalized filename (lowercase, trim)
  const groups = {};
  for (const report of all) {
    const key = (report.fileName || 'unknown').toLowerCase().trim();
    if (!groups[key]) groups[key] = [];
    groups[key].push(report);
  }

  let deletedCount = 0;
  let keptCount = 0;

  for (const [filename, records] of Object.entries(groups)) {
    if (records.length === 1) {
      keptCount++;
      continue;
    }

    // Sort: prefer records with more filled data (doctor, tests not "To be updated")
    records.sort((a, b) => {
      const aScore = (a.doctor !== 'To be updated' ? 1 : 0) + (a.tests !== 'To be updated' ? 1 : 0);
      const bScore = (b.doctor !== 'To be updated' ? 1 : 0) + (b.tests !== 'To be updated' ? 1 : 0);
      return bScore - aScore; // higher score first = keep
    });

    // Keep the first (best), delete the rest
    const [keep, ...duplicates] = records;
    keptCount++;

    console.log(`\n🔁  Duplicate: "${filename}" (${records.length} copies)`);
    console.log(`   ✅  Keeping: ${keep.id}`);

    for (const dup of duplicates) {
      await deleteDoc(doc(db, 'reports', dup.id));
      console.log(`   🗑️   Deleted: ${dup.id}`);
      deletedCount++;
    }
  }

  console.log('\n=============================');
  console.log(`✅  Kept: ${keptCount} unique reports`);
  console.log(`🗑️   Deleted: ${deletedCount} duplicates`);
  console.log('\n✅  Your database is now clean!\n');
  process.exit(0);
}

deduplicate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
