// admin-login.js — Admin authentication
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ============================================================
// FIREBASE INIT — Replace with your config
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ============================================================
// THEME
// ============================================================
(function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
})();

// ============================================================
// AUTH STATE — redirect if already logged in
// ============================================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace("/admin/dashboard.html");
  }
});

// ============================================================
// LOGIN FORM
// ============================================================
const loginBtn = document.getElementById("loginBtn");
const loginBtnText = document.getElementById("loginBtnText");
const loginBtnLoader = document.getElementById("loginBtnLoader");
const loginError = document.getElementById("loginError");
const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");

function setLoading(state) {
  loginBtn.disabled = state;
  loginBtnText.textContent = state ? "Signing in..." : "Sign in";
  loginBtnLoader.classList.toggle("hidden", !state);
}

function showError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove("hidden");
}

function clearError() {
  loginError.classList.add("hidden");
}

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  clearError();

  if (!email || !password) {
    showError("Please enter email and password.");
    return;
  }

  setLoading(true);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.replace("/admin/dashboard.html");
  } catch (err) {
    setLoading(false);
    const messages = {
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-email": "Invalid email address.",
      "auth/too-many-requests": "Too many failed attempts. Try again later.",
      "auth/invalid-credential": "Invalid email or password."
    };
    showError(messages[err.code] || "Sign in failed. Check your credentials.");
  }
});

// Enter key to submit
[emailInput, passwordInput].forEach(el => {
  el.addEventListener("keydown", e => {
    if (e.key === "Enter") loginBtn.click();
  });
});
