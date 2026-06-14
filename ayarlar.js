// ═══════════════════════════════════════════════════════════
//  ayarlar.js — Medivibe Hesap Ayarları Sayfası Mantığı
//  Firebase v10+ Modüler SDK — app.js'den db ve auth içe aktarılır
// ═══════════════════════════════════════════════════════════

import { db, auth } from './app.js';
import {
  onAuthStateChanged,
  signOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ─── YARDIMCI: TOAST BİLDİRİMİ ────────────────────────────
/**
 * @param {'success'|'error'|'info'} type
 * @param {string} title
 * @param {string} message
 */
function showToast(type, title, message) {
  const toast      = document.getElementById('toast');
  const toastIcon  = document.getElementById('toastIcon');
  const toastTitle = document.getElementById('toastTitle');
  const toastMsg   = document.getElementById('toastMsg');

  const icons = {
    success: `<svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>`,
    error:   `<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
              </svg>`,
    info:    `<svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
              </svg>`
  };

  toastIcon.innerHTML  = icons[type] || icons.info;
  toastTitle.textContent = title;
  toastMsg.textContent   = message;

  toast.classList.remove('hide');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hide'), 4000);
}


// ─── YARDIMCI: TARAYICI ADI ───────────────────────────────
function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Google Chrome';
  if (ua.includes('Firefox'))  return 'Mozilla Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg'))      return 'Microsoft Edge';
  return 'Bilinmiyor';
}


// ─── YARDIMCI: ŞİFRE GÜÇ GÖSTERGESI ─────────────────────
window.updateStrength = function(pw) {
  const wrap  = document.getElementById('strengthWrap');
  const label = document.getElementById('strengthLabel');
  const bars  = [1,2,3,4].map(i => document.getElementById(`s${i}`));

  if (!pw) {
    wrap.classList.add('hidden');
    bars.forEach(b => { b.style.background = '#e5e7eb'; });
    return;
  }

  wrap.classList.remove('hidden');

  let score = 0;
  if (pw.length >= 8)             score++;
  if (/[A-Z]/.test(pw))          score++;
  if (/[0-9]/.test(pw))          score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;

  const configs = [
    { color: '#ef4444', text: 'Çok zayıf' },
    { color: '#f97316', text: 'Zayıf' },
    { color: '#eab308', text: 'Orta' },
    { color: '#22c55e', text: 'Güçlü' },
  ];

  bars.forEach((b, i) => {
    b.style.background = i < score ? configs[score - 1].color : '#e5e7eb';
  });

  label.textContent  = configs[score - 1]?.text || '';
  label.style.color  = configs[score - 1]?.color || '#9ca3af';
};


// ─── YARDIMCI: ŞİFRE EŞLEŞMESİ ──────────────────────────
window.checkMatch = function() {
  const pw1 = document.getElementById('newPassword').value;
  const pw2 = document.getElementById('confirmPassword').value;
  const err = document.getElementById('matchError');
  const ok  = document.getElementById('matchOk');

  if (!pw2) { err.classList.add('hidden'); ok.classList.add('hidden'); return; }

  if (pw1 !== pw2) {
    err.classList.remove('hidden');
    ok.classList.add('hidden');
  } else {
    err.classList.add('hidden');
    ok.classList.remove('hidden');
  }
};


// ─── YARDIMCI: ŞİFRE GÖSTER/GİZLE ───────────────────────
window.togglePw = function(inputId, btn) {
  const input = document.getElementById(inputId);
  const isText = input.type === 'text';
  input.type = isText ? 'password' : 'text';

  // Göz ikonunu değiştir
  btn.innerHTML = isText
    ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round"
           d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"/>
         <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
       </svg>`
    : `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round"
           d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
       </svg>`;
};


// ─── YARDIMCI: MOBİL SİDEBAR ──────────────────────────────
window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('hidden');
};


// ─── SKELETON KALDIR / VERİYİ GÖSTER ─────────────────────
function showProfileData(user, userData) {
  // Skeleton gizle
  document.getElementById('avatarSkeleton').classList.add('hidden');
  document.getElementById('nameSkeleton').classList.add('hidden');

  // Avatar
  const basHarf = userData.firstName ? userData.firstName.charAt(0).toUpperCase() : 'U';
  const avatarReal = document.getElementById('avatarReal');
  avatarReal.textContent = basHarf;
  avatarReal.classList.remove('hidden');
  avatarReal.classList.add('flex');

  // Sidebar avatar
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  sidebarAvatar.textContent = basHarf;

  // Ad bilgileri
  document.getElementById('nameReal').classList.remove('hidden');
  document.getElementById('displayFullName').textContent =
    `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
  document.getElementById('displayEmail').textContent  = user.email || '';
  document.getElementById('sidebarName').textContent   =
    `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Kullanıcı';
  document.getElementById('sidebarEmail').textContent  = user.email || '';

  // Form inputları doldur
  const fnInput = document.getElementById('firstName');
  const lnInput = document.getElementById('lastName');
  fnInput.value       = userData.firstName || '';
  lnInput.value       = userData.lastName  || '';
  fnInput.disabled    = false;
  lnInput.disabled    = false;
  fnInput.placeholder = 'Adınız';
  lnInput.placeholder = 'Soyadınız';

  // Güncelle butonu aktif et
  document.getElementById('updateProfileBtn').disabled = false;

  // Üye tarihi
  if (userData.createdAt) {
    const date = userData.createdAt.toDate
      ? userData.createdAt.toDate()
      : new Date(userData.createdAt);
    const formatted = date.toLocaleDateString('tr-TR', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('memberSinceText').textContent = `Üyelik: ${formatted}`;
    document.getElementById('memberSince').classList.remove('hidden');
  }

  // Tercihler (Firestore'dan gelen prefs varsa uygula)
  if (userData.prefs) {
    const p = userData.prefs;
    setToggle('toggleEmail',    p.emailNotif    ?? true);
    setToggle('toggleReminder', p.reminderNotif ?? true);
    setToggle('toggleSecurity', p.securityAlert ?? false);
    setToggle('toggleWeekly',   p.weeklyReport  ?? false);
    setToggle('togglePromo',    p.promoNotif    ?? true);
  }
}

function setToggle(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}


// ─── OTURUM GİRİŞ BİLGİSİ ────────────────────────────────
function fillSessionInfo() {
  document.getElementById('browserInfo').textContent = getBrowserName();
  document.getElementById('loginTime').textContent   =
    new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}


// ═══════════════════════════════════════════════════════════
//  AUTH DURUMU — ANA KONTROL NOKTASI
// ═══════════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {

  // Giriş yapılmamışsa yönlendir
  if (!user) {
    window.location.href = 'giris.html';
    return;
  }

  fillSessionInfo();

  try {
    const userRef  = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      showProfileData(user, userSnap.data());
    } else {
      // Firestore'da belge yoksa temel e-posta bilgisiyle devam et
      showProfileData(user, { firstName: '', lastName: '' });
      document.getElementById('sidebarEmail').textContent = user.email || '';
      document.getElementById('displayEmail').textContent = user.email || '';
      document.getElementById('firstName').disabled = false;
      document.getElementById('lastName').disabled  = false;
      document.getElementById('updateProfileBtn').disabled = false;
    }
  } catch (err) {
    console.error('Kullanıcı verisi yüklenemedi:', err);
    showToast('error', 'Yükleme Hatası', 'Profil bilgileri alınamadı.');
  }
});


// ═══════════════════════════════════════════════════════════
//  PROFİL GÜNCELLE
// ═══════════════════════════════════════════════════════════
document.getElementById('updateProfileBtn').addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;

  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();

  if (!firstName || !lastName) {
    showToast('error', 'Eksik Bilgi', 'Ad ve soyad alanları boş bırakılamaz.');
    return;
  }

  const btn = document.getElementById('updateProfileBtn');
  btn.disabled   = true;
  btn.innerHTML  = `<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/>
  </svg> Kaydediliyor…`;

  try {
    const userRef = doc(db, 'users', user.uid);
    const snap    = await getDoc(userRef);

    if (snap.exists()) {
      await updateDoc(userRef, { firstName, lastName });
    } else {
      await setDoc(userRef, {
        firstName,
        lastName,
        email: user.email,
        createdAt: serverTimestamp()
      });
    }

    // UI güncelle
    document.getElementById('displayFullName').textContent = `${firstName} ${lastName}`;
    document.getElementById('sidebarName').textContent     = `${firstName} ${lastName}`;
    document.getElementById('avatarReal').textContent = firstName.charAt(0).toUpperCase();
    document.getElementById('sidebarAvatar').textContent   = firstName.charAt(0).toUpperCase();

    showToast('success', 'Profil Güncellendi', 'Bilgileriniz başarıyla kaydedildi.');

  } catch (err) {
    console.error('Profil güncelleme hatası:', err);
    showToast('error', 'Güncelleme Başarısız', err.message || 'Bir hata oluştu.');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/>
    </svg> Bilgileri Güncelle`;
  }
});


// ═══════════════════════════════════════════════════════════
//  ŞİFRE GÜNCELLE
// ═══════════════════════════════════════════════════════════
document.getElementById('updatePasswordBtn').addEventListener('click', async () => {
  const user    = auth.currentUser;
  if (!user) return;

  const newPw   = document.getElementById('newPassword').value;
  const confirmPw = document.getElementById('confirmPassword').value;

  // Doğrulama
  if (!newPw || newPw.length < 8) {
    showToast('error', 'Geçersiz Şifre', 'Şifre en az 8 karakter olmalıdır.');
    return;
  }
  if (newPw !== confirmPw) {
    showToast('error', 'Eşleşmiyor', 'Girdiğiniz şifreler birbiriyle eşleşmiyor.');
    return;
  }

  const btn = document.getElementById('updatePasswordBtn');
  btn.disabled  = true;
  btn.textContent = 'Güncelleniyor…';

  try {
    await updatePassword(user, newPw);

    document.getElementById('newPassword').value     = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('matchOk').classList.add('hidden');
    document.getElementById('strengthWrap').classList.add('hidden');

    showToast('success', 'Şifre Güncellendi', 'Yeni şifreniz başarıyla kaydedildi.');

  } catch (err) {
    console.error('Şifre güncelleme hatası:', err);

    // Firebase hata kodlarını Türkçeleştir
    const messages = {
      'auth/requires-recent-login': 'Güvenlik için lütfen çıkış yapıp tekrar giriş yapın.',
      'auth/weak-password':         'Şifreniz çok zayıf. Daha güçlü bir şifre seçin.',
    };
    const msg = messages[err.code] || err.message || 'Bir hata oluştu.';
    showToast('error', 'Güncelleme Başarısız', msg);

  } finally {
    btn.disabled   = false;
    btn.innerHTML  = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
    </svg> Şifreyi Güncelle`;
  }
});


// ═══════════════════════════════════════════════════════════
//  TERCİHLERİ KAYDET
// ═══════════════════════════════════════════════════════════
document.getElementById('savePrefsBtn').addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;

  const prefs = {
    emailNotif:    document.getElementById('toggleEmail').checked,
    reminderNotif: document.getElementById('toggleReminder').checked,
    securityAlert: document.getElementById('toggleSecurity').checked,
    weeklyReport:  document.getElementById('toggleWeekly').checked,
    promoNotif:    document.getElementById('togglePromo').checked,
  };

  const btn = document.getElementById('savePrefsBtn');
  btn.disabled    = true;
  btn.textContent = 'Kaydediliyor…';

  try {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { prefs });
    showToast('success', 'Tercihler Kaydedildi', 'Bildirim ayarlarınız güncellendi.');
  } catch (err) {
    console.error('Tercih kaydetme hatası:', err);
    showToast('error', 'Kayıt Başarısız', err.message || 'Bir hata oluştu.');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"/>
    </svg> Tercihleri Kaydet`;
  }
});


// ═══════════════════════════════════════════════════════════
//  ÇIKIŞ YAP
// ═══════════════════════════════════════════════════════════
async function handleLogout() {
  try {
    await signOut(auth);
    window.location.href = 'giris.html';
  } catch (err) {
    console.error('Çıkış hatası:', err);
    showToast('error', 'Çıkış Hatası', 'Çıkış yapılırken bir sorun oluştu.');
  }
}

document.getElementById('sidebarLogoutBtn')?.addEventListener('click', handleLogout);
document.getElementById('mainLogoutBtn')?.addEventListener('click', handleLogout);


// ═══════════════════════════════════════════════════════════
//  HESAP SİL
// ═══════════════════════════════════════════════════════════
document.getElementById('deleteAccountBtn')?.addEventListener('click', () => {
  document.getElementById('deleteModal').classList.remove('hidden');
});

document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;

  document.getElementById('confirmDeleteBtn').textContent = 'Siliniyor…';
  document.getElementById('confirmDeleteBtn').disabled = true;

  try {
    // Önce Firestore belgesi sil
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { deletedAt: serverTimestamp(), status: 'deleted' });

    // Sonra Firebase Auth hesabını sil
    await user.delete();

    window.location.href = 'giris.html';

  } catch (err) {
    console.error('Hesap silme hatası:', err);
    document.getElementById('deleteModal').classList.add('hidden');

    if (err.code === 'auth/requires-recent-login') {
      showToast('error', 'Yeniden Giriş Gerekli',
        'Hesap silmek için lütfen çıkış yapıp tekrar giriş yapın.');
    } else {
      showToast('error', 'Silme Başarısız', err.message || 'Bir hata oluştu.');
    }
  }
});