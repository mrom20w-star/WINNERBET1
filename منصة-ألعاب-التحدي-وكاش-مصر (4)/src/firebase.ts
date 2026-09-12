import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, push, get, child, Database } from 'firebase/database';
import { getFirestore, Firestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyDcT4KhPWduKq4AzpGhyxxaD2MU4DjCSDQ",
  authDomain: "c8ad7c49-cb5.firebaseapp.com",
  databaseURL: "https://c8ad7c49-cb5-default-rtdb.firebaseio.com",
  projectId: "c8ad7c49-cb5",
  storageBucket: "c8ad7c49-cb5.firebasestorage.app",
  messagingSenderId: "51872434462",
  appId: "1:51872434462:web:998414723144a95dfe610f",
  measurementId: "G-DNEWP38T17"
};

// Initialize Firebase safely
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let rtdb: Database | null = null;
let firestore: Firestore | null = null;

try {
  rtdb = getDatabase(app);
} catch (err) {
  console.warn('Firebase RTDB init notice:', err);
}

try {
  firestore = getFirestore(app);
} catch (err) {
  console.warn('Firebase Firestore init notice:', err);
}

export { rtdb, firestore };
