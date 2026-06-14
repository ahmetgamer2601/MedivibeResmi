// giris.js — Medivibe Giriş Modülü (ES6 Module)

import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ── DOM Referansları ──────────────────────────────────────────────────────────
const emailEl        = document.getElementById("email");
const passwordEl     = document.getElementById("password");
const togglePwBtn    = document.getElementById("toggle-pw");
const eyeOpen        = document.getElementById("eye-open");
const eyeClosed      = document.getElementById("eye-closed");
const rememberMe     = document.getElementById("remember-me");
const submitBtn      = document.getElementById("submit-btn");
const btnText        = document.getElementById("btn-text");
const btnArrow       = document.getElementById("btn-arrow");
const btnSpinner     = document.getElementById("btn-spinner");
const alertBox       = document.getElementById("alert-box");
const successOverlay = document.getElementById("success-overlay");
const forgotPwLink   = document.getElementById("forgot-pw");
const forgotModal    = document.getElementById("forgot-modal");
const closeForgotX   = document.getElementById("close-forgot-x");
const closeForgotBtn = document.getElementById("close-forgot-btn");
const sendResetBtn   = document.getElementById("send-reset-btn");
const forgotEmailEl  = document.getElementById("forgot-email");
const forgotAlert    = document.getElementById("forgot-alert");

// ── Beni Hatırla: E-posta Ön Doldurma ────────────────────────────────────────
const SAVED_EMAIL_KEY = "medivibe_remembered_email";

const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
if (savedEmail) {
  emailEl.value = savedEmail;
  rememberMe.checked = true;
}

// ── Göster / Gizle ────────────────────────────────────────────────────────────
togglePwBtn.addEventListener("click", () => {
  const hidden = passwordEl.type === "password";
  passwordEl.type = hidden ? "text" : "password";
  eyeOpen.classList.toggle("hidden", hidden);
  eyeClosed.classList.toggle("hidden", !hidden);
});

// ── Alert ─────────────────────────────────────────────────────────────────────
function showAlert(el, msg, type = "error") {
  el.classList.remove(
    "hidden",
    "bg-red-50", "border-red-200", "text-red-700",
    "bg-green-50", "border-green-200", "text-green-700",
    "bg-blue-50", "border-blue-200", "text-blue-700"
  );
  if (type === "error") {
    el.classList.add("bg-red-50", "border-red-200", "text-red-700");
  } else if (type === "success") {
    el.classList.add("bg-green-50", "border-green-200", "text-green-700");
  } else {
    el.classList.add("bg-blue-50", "border-blue-200", "text-blue-700");
  }
  el.textContent = msg;
  el.classList.add("shake");
  el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
}

// ── Loading State ─────────────────────────────────────────────────────────────
function setLoading(on) {
  submitBtn.disabled = on;
  btnText.textContent = on ? "Giriş yapılıyor…" : "Giriş Yap";
  btnArrow.classList.toggle("hidden", on);
  btnSpinner.classList.toggle("hidden", !on);
}

// ── Başarı Animasyonu ─────────────────────────────────────────────────────────
function showSuccessAndRedirect() {
  successOverlay.classList.add("active");
  setTimeout(() => { window.location.href = "index.html"; }, 2500);
}

// ── Hata Mesajları ────────────────────────────────────────────────────────────
const ERROR_MESSAGES = {
  "auth/user-not-found":          "Bu e-posta adresine kayıtlı bir hesap bulunamadı.",
  "auth/wrong-password":          "Girdiğiniz parola hatalı. Lütfen tekrar deneyin.",
  "auth/invalid-credential":      "E-posta veya parola hatalı. Lütfen bilgilerinizi kontrol edin.",
  "auth/invalid-email":           "Geçersiz e-posta adresi formatı.",
  "auth/user-disabled":           "Bu hesap devre dışı bırakılmıştır. Destek ekibiyle iletişime geçin.",
  "auth/too-many-requests":       "Çok fazla başarısız deneme. Lütfen birkaç dakika bekleyin.",
  "auth/network-request-failed":  "Ağ hatası. İnternet bağlantınızı kontrol edin.",
};

// ── Form Gönderimi ────────────────────────────────────────────────────────────
submitBtn.addEventListener("click", async () => {
  const email    = emailEl.value.trim();
  const password = passwordEl.value;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAlert(alertBox, "Geçerli bir e-posta adresi girin.");
    return;
  }
  if (!password) {
    showAlert(alertBox, "Lütfen parolanızı girin.");
    return;
  }

  setLoading(true);
  alertBox.classList.add("hidden");

  try {
    await signInWithEmailAndPassword(auth, email, password);

    // Beni Hatırla
    if (rememberMe.checked) {
      localStorage.setItem(SAVED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY);
    }

    showSuccessAndRedirect();
  } catch (err) {
    setLoading(false);
    const msg = ERROR_MESSAGES[err.code] || `Giriş başarısız: ${err.message}`;
    showAlert(alertBox, msg);
  }
});

// ── Şifremi Unuttum Modal ─────────────────────────────────────────────────────
forgotPwLink.addEventListener("click", (e) => {
  e.preventDefault();
  forgotModal.classList.remove("hidden");
  forgotAlert.classList.add("hidden");
  forgotEmailEl.value = emailEl.value; // mevcut e-postayı kopyala
});

function closeForgotModal() { forgotModal.classList.add("hidden"); }
closeForgotX.addEventListener("click", closeForgotModal);
closeForgotBtn.addEventListener("click", closeForgotModal);
forgotModal.addEventListener("click", (e) => { if (e.target === forgotModal) closeForgotModal(); });

sendResetBtn.addEventListener("click", async () => {
  const resetEmail = forgotEmailEl.value.trim();

  if (!resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
    showAlert(forgotAlert, "Lütfen geçerli bir e-posta adresi girin.");
    return;
  }

  sendResetBtn.disabled = true;
  sendResetBtn.textContent = "Gönderiliyor…";
  forgotAlert.classList.add("hidden");

  try {
    await sendPasswordResetEmail(auth, resetEmail);
    showAlert(
      forgotAlert,
      `Sıfırlama bağlantısı ${resetEmail} adresine gönderildi. Gelen kutunuzu kontrol edin.`,
      "success"
    );
    sendResetBtn.textContent = "Gönderildi ✓";
    setTimeout(() => { closeForgotModal(); sendResetBtn.disabled = false; sendResetBtn.textContent = "Gönder"; }, 3000);
  } catch (err) {
    sendResetBtn.disabled = false;
    sendResetBtn.textContent = "Gönder";
    const msg = ERROR_MESSAGES[err.code] || "Bir hata oluştu. Lütfen tekrar deneyin.";
    showAlert(forgotAlert, msg);
  }
});

// Enter tuşu desteği
[emailEl, passwordEl].forEach(el => {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitBtn.click();
  });
});