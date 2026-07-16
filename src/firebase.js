import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAezRo6H_y64arvuzoE6oZeKjTxvdR9seg",
  authDomain: "medical-history-9da37.firebaseapp.com",
  projectId: "medical-history-9da37",
  storageBucket: "medical-history-9da37.firebasestorage.app",
  messagingSenderId: "621956809351",
  appId: "1:621956809351:web:0996ef5d74b18efd72ee22",
};

const app = initializeApp(firebaseConfig);

// Only Firestore needed — free plan, no Auth or Storage
export const db = getFirestore(app);
export default app;
