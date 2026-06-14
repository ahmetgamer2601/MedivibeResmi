// firebase-config.js
// Medivibe — Firebase v10+ Modular SDK Yapılandırması

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-mksVUYTyFLfRb1O0TBZoHVjkWAeSjwQ",
  authDomain: "medivibe-resmi.firebaseapp.com",
  projectId: "medivibe-resmi",
  storageBucket: "medivibe-resmi.firebasestorage.app",
  messagingSenderId: "486046453284",
  appId: "1:486046453284:web:efb5c976322e3f6bf512b1",
  measurementId: "G-9WMY2W05DJ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);