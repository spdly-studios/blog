// ============================================================
// FIREBASE CONFIGURATION
// Replace these values with your actual Firebase project config
// ============================================================
const firebaseConfig = {
  apiKey:            "AIzaSyA3PFKO5piv3RM3f9PtaAleYA_g7TOLxYk",
  authDomain:        "spdly-website.firebaseapp.com",
  projectId:         "spdly-website",
  storageBucket:     "spdly-website.firebasestorage.app",
  messagingSenderId: "272994532908",
  appId:             "1:272994532908:web:8852742525c619c1cbdb89",
  measurementId:     "G-NEDDRR1XT7"
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

export { app, db, auth, analytics, logEvent };
