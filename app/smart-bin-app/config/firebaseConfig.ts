import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth'; // <--- Thêm dòng này
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAVATaw9DoO7zbdO3F49sr3RZBORoE63bY",
  authDomain: "waste-ai-5606c.firebaseapp.com",
  databaseURL: "https://waste-ai-5606c-default-rtdb.firebaseio.com",
  projectId: "waste-ai-5606c",
  storageBucket: "waste-ai-5606c.firebasestorage.app",
  messagingSenderId: "300394434462",
  appId: "1:300394434462:web:e2a68077ad9f977140d08f",
  measurementId: "G-890KF2RX3F"
};

const app = initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app); 