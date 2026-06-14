// kayit.js — Medivibe Kayıt Modülü (ES6 Module)

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── DOM Referansları ──────────────────────────────────────────────────────────
const firstNameEl   = document.getElementById("firstName");
const lastNameEl    = document.getElementById("lastName");
const emailEl       = document.getElementById("email");
const passwordEl    = document.getElementById("password");
const togglePwBtn   = document.getElementById("toggle-pw");
const eyeOpen       = document.getElementById("eye-open");
const eyeClosed     = document.getElementById("eye-closed");
const kvkkCheckbox  = document.getElementById("kvkk-checkbox");
const submitBtn     = document.getElementById("submit-btn");
const btnText       = document.getElementById("btn-text");
const btnArrow      = document.getElementById("btn-arrow");
const btnSpinner    = document.getElementById("btn-spinner");
const alertBox      = document.getElementById("alert-box");
const successOverlay= document.getElementById("success-overlay");
const openKvkkLink  = document.getElementById("open-kvkk");
const kvkkModal     = document.getElementById("kvkk-modal");
const closeModalX   = document.getElementById("close-modal-x");
const closeModalBtn = document.getElementById("close-modal-btn");
const acceptModalBtn= document.getElementById("accept-modal-btn");
const bars          = [1,2,3,4].map(i => document.getElementById(`bar${i}`));
const strengthLabel = document.getElementById("strength-label");

// ── Şifre Gücü ───────────────────────────────────────────────────────────────
const STRENGTH_CONFIG = [
  { label: "Zayıf",  color: "#ef4444" },  // 1 bar
  { label: "Orta",   color: "#f97316" },  // 2 bars
  { label: "İyi",    color: "#eab308" },  // 3 bars
  { label: "Güçlü",  color: "#00a859" },  // 4 bars
];

let currentStrength = 0;

function calcStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score; // 0–4
}

function renderStrength(pw) {
  const score = calcStrength(pw);
  currentStrength = score;

  bars.forEach((bar, idx) => {
    if (pw.length === 0) {
      bar.style.width = "0%";
      bar.style.backgroundColor = "#e5e7eb";
    } else if (idx < score) {
      bar.style.width = "100%";
      bar.style.backgroundColor = STRENGTH_CONFIG[score - 1].color;
    } else {
      bar.style.width = "0%";
      bar.style.backgroundColor = "#e5e7eb";
    }
  });

  if (pw.length === 0) {
    strengthLabel.textContent = "Güçlülük Seviyesi";
    strengthLabel.style.color = "#9ca3af";
  } else {
    const cfg = STRENGTH_CONFIG[score - 1] || STRENGTH_CONFIG[0];
    strengthLabel.textContent = cfg.label;
    strengthLabel.style.color = cfg.color;
  }

  refreshSubmitState();
}

// ── Buton Durumu ──────────────────────────────────────────────────────────────
function refreshSubmitState() {
  const ok = currentStrength >= 3 && kvkkCheckbox.checked;
  submitBtn.disabled = !ok;
}

// ── Göster / Gizle ────────────────────────────────────────────────────────────
togglePwBtn.addEventListener("click", () => {
  const hidden = passwordEl.type === "password";
  passwordEl.type = hidden ? "text" : "password";
  eyeOpen.classList.toggle("hidden", hidden);
  eyeClosed.classList.toggle("hidden", !hidden);
});

// ── Event Listeners ───────────────────────────────────────────────────────────
passwordEl.addEventListener("input", () => renderStrength(passwordEl.value));
kvkkCheckbox.addEventListener("change", refreshSubmitState);

// ── KVKK Modal ────────────────────────────────────────────────────────────────
function openModal() { kvkkModal.classList.remove("hidden"); }
function closeModal() { kvkkModal.classList.add("hidden"); }

openKvkkLink.addEventListener("click", (e) => { e.preventDefault(); openModal(); });
closeModalX.addEventListener("click", closeModal);
closeModalBtn.addEventListener("click", closeModal);
acceptModalBtn.addEventListener("click", () => {
  kvkkCheckbox.checked = true;
  closeModal();
  refreshSubmitState();
});
kvkkModal.addEventListener("click", (e) => { if (e.target === kvkkModal) closeModal(); });

// ── Alert ─────────────────────────────────────────────────────────────────────
function showAlert(msg, type = "error") {
  alertBox.classList.remove("hidden", "bg-red-50", "border-red-200", "text-red-700", "bg-green-50", "border-green-200", "text-green-700");
  if (type === "error") {
    alertBox.classList.add("bg-red-50", "border-red-200", "text-red-700");
  } else {
    alertBox.classList.add("bg-green-50", "border-green-200", "text-green-700");
  }
  alertBox.textContent = msg;
  alertBox.classList.add("shake");
  alertBox.addEventListener("animationend", () => alertBox.classList.remove("shake"), { once: true });
}

// ── Loading State ─────────────────────────────────────────────────────────────
function setLoading(on) {
  submitBtn.disabled = on;
  btnText.textContent = on ? "Kaydediliyor…" : "Güvenli Kaydı Tamamla";
  btnArrow.classList.toggle("hidden", on);
  btnSpinner.classList.toggle("hidden", !on);
}

// ── Başarı Animasyonu ─────────────────────────────────────────────────────────
function showSuccessAndRedirect() {
  successOverlay.classList.add("active");
  setTimeout(() => { window.location.href = "index.html"; }, 2500);
}

// ── Form Gönderimi ────────────────────────────────────────────────────────────
submitBtn.addEventListener("click", async () => {
  const firstName = firstNameEl.value.trim();
  const lastName  = lastNameEl.value.trim();
  const email     = emailEl.value.trim();
  const password  = passwordEl.value;

  // Temel doğrulama
  if (!firstName || !lastName) {
    showAlert("Lütfen ad ve soyadınızı girin.");
    return;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAlert("Geçerli bir e-posta adresi girin.");
    return;
  }
  if (currentStrength < 3) {
    showAlert("Parolanız en az 'İyi' seviyesinde olmalıdır.");
    return;
  }
  if (!kvkkCheckbox.checked) {
    showAlert("Devam etmek için sözleşmeyi onaylamanız gerekmektedir.");
    return;
  }

  setLoading(true);
  alertBox.classList.add("hidden");

  try {
    // Firebase Auth kaydı
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const user = credential.user;

    // Firestore'a kullanıcı verisi kaydet
    await setDoc(doc(db, "users", user.uid), {
      firstName,
      lastName,
      email,
      createdAt: serverTimestamp(),
    });

    showSuccessAndRedirect();
  } catch (err) {
    setLoading(false);
    const messages = {
      "auth/email-already-in-use": "Bu e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.",
      "auth/invalid-email":        "Geçersiz e-posta adresi formatı.",
      "auth/weak-password":        "Parola çok zayıf. Lütfen daha güçlü bir parola seçin.",
      "auth/network-request-failed": "Ağ hatası. İnternet bağlantınızı kontrol edin.",
    };
    showAlert(messages[err.code] || `Bir hata oluştu: ${err.message}`);
  }
});