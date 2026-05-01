import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            "AIzaSyCXO7-oYdwCEm50YG9mSQz9vumWcSjr4Aw",
  authDomain:        "anushree-payroll.firebaseapp.com",
  projectId:         "anushree-payroll",
  storageBucket:     "anushree-payroll.firebasestorage.app",
  messagingSenderId: "259822031671",
  appId:             "1:259822031671:web:5e34028bd89a096922c0b2",
};

const app = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const storage = getStorage(app);
export const auth    = getAuth(app);
