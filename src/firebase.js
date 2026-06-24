import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCQGVadCheVwOx2_2CHSA-75JvNLzgA958",
  authDomain: "crm-fulltent.firebaseapp.com",
  projectId: "crm-fulltent",
  storageBucket: "crm-fulltent.firebasestorage.app",
  messagingSenderId: "932060517697",
  appId: "1:932060517697:web:7ecda2553ad394d2c93dc0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
