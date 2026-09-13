import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, push, get, child, Database } from 'firebase/database';
import { getFirestore, Firestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyBYw7X0oQzIfzW3NeFjRX_kA1yjM1-ySF8",
  authDomain: "ssss-de880.firebaseapp.com",
  databaseURL: "https://ssss-de880-default-rtdb.firebaseio.com",
  projectId: "ssss-de880",
  storageBucket: "ssss-de880.firebasestorage.app",
  messagingSenderId: "435440127705",
  appId: "1:435440127705:web:0de52fbaf5a83cb62b78c8",
  measurementId: "G-43959VXYMB"
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
