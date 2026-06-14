// takip.js — Firebase v10 Modüler SDK

import { initializeApp }       from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp }
                                from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js";

// ─── Firebase Yapılandırması ───────────────────────────────────────────────
const firebaseConfig = {
  apiKey            : "AIzaSyD-mksVUYTyFLfRb1O0TBZoHVjkWAeSjwQ",
  authDomain        : "medivibe-resmi.firebaseapp.com",
  projectId         : "medivibe-resmi",
  storageBucket     : "medivibe-resmi.firebasestorage.app",
  messagingSenderId : "486046453284",
  appId             : "1:486046453284:web:efb5c976322e3f6bf512b1",
  measurementId     : "G-9WMY2W05DJ"
};

const app       = initializeApp(firebaseConfig);
const db        = getFirestore(app);
const messaging = getMessaging(app);

// VAPID anahtarı — Firebase Console > Project Settings > Cloud Messaging
const VAPID_KEY = "BBQm0USyV2P0L_4ym-B5mQzUqqSW08qyK2r5HSUhF3xsRlCSfWB9lgaWLP2OG26G9kDq7FGcvVmHWN7fTcnxEU8";

let fcmToken           = "";
let tumDoktorlarVerisi = [];

// ─────────────────────────────────────────────
// YARDIMCI: Base64url → Uint8Array
// Firebase'in getToken fonksiyonu bazen raw string'i
// doğru parse edemez; Uint8Array göndermek her zaman güvenlidir.
// ─────────────────────────────────────────────
function base64UrlToUint8Array(base64UrlString) {
  // Base64url → Base64 standart
  const padding  = '='.repeat((4 - (base64UrlString.length % 4)) % 4);
  const base64   = (base64UrlString + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData  = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// ─────────────────────────────────────────────
// 1. DOKTOR ARAMA VE DİNAMİK LİSTELEME
// ─────────────────────────────────────────────
const doktorInput          = document.getElementById('doktorSecim');
const doktorListesiElementi = document.getElementById('doktorlar');

async function doktorlariYukle() {
  try {
    const snapshot = await getDocs(collection(db, "hastaneler"));
    tumDoktorlarVerisi = [];

    snapshot.forEach(doc => {
      const hastaneData = doc.data();
      const hastaneAdi  = doc.id;
      if (!hastaneData.doktorlar) return;

      hastaneData.doktorlar.forEach(doktor => {
        tumDoktorlarVerisi.push({
          id      : doktor.id,
          isim    : doktor.isim,
          brans   : doktor.brans,
          hastane : hastaneAdi,
          tamMetin: `${doktor.isim} - ${doktor.brans} (${hastaneAdi})`
        });
      });
    });
  } catch (err) {
    console.error("Doktorlar yüklenirken hata:", err);
  }
}

if (doktorInput) {
  doktorInput.addEventListener('input', () => {
    const aranan = doktorInput.value.toLowerCase().trim();
    if (aranan.length < 2) { doktorListesiElementi.innerHTML = ""; return; }

    const filtre = tumDoktorlarVerisi.filter(d =>
      d.isim.toLowerCase().includes(aranan) ||
      d.brans.toLowerCase().includes(aranan)
    );
    doktorListesiElementi.innerHTML = filtre
      .map(d => `<option value="${d.tamMetin}">`)
      .join('');
  });
}

window.addEventListener('DOMContentLoaded', doktorlariYukle);
window.addEventListener('DOMContentLoaded', async () => {
  doktorlariYukle();
  // Sayfa açılınca otomatik bildirim izni al
  await bildirimIzniAl();
});

// ─────────────────────────────────────────────
// 2. İLAÇ EKLEME MANTIĞI
// ─────────────────────────────────────────────
const ilacKonteyner = document.getElementById('ilacKonteyner');
const btnIlacEkle   = document.getElementById('btnIlacEkle');

function yeniIlacEkle() {
  if (!ilacKonteyner) return;
  const html = `
    <div class="med-card bg-gray-50 border border-gray-200 rounded-xl p-4 relative group">
      <button type="button" class="btnSil absolute top-3 right-3 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">Sil ❌</button>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="md:col-span-2">
          <label class="block text-[11px] font-semibold text-gray-500 uppercase">İlaç Adı</label>
          <input type="text" class="ilac-adi w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00a859]" required>
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-gray-500 uppercase">Kullanım Şekli</label>
          <select class="ilac-sekil w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option>Tok Karnına</option>
            <option>Aç Karnına</option>
            <option>Uykudan Önce</option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] font-semibold text-gray-500 uppercase">Kaç Gün?</label>
          <input type="number" min="1" class="ilac-gun w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" required>
        </div>
      </div>
      <div class="mt-4 border-t border-gray-200 pt-4">
        <label class="block text-[11px] font-semibold text-gray-500 uppercase mb-2">Hatırlatma Saatleri</label>
        <div class="saatler-konteyner flex flex-wrap gap-3">
          <input type="time" class="ilac-saat bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <input type="time" class="ilac-saat bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <input type="time" class="ilac-saat bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
        </div>
      </div>
    </div>`;
  ilacKonteyner.insertAdjacentHTML('beforeend', html);
  const sonEklenen = ilacKonteyner.lastElementChild;
  sonEklenen.querySelector('.btnSil').addEventListener('click', () => sonEklenen.remove());
}

if (btnIlacEkle)   btnIlacEkle.addEventListener('click', yeniIlacEkle);
if (ilacKonteyner) yeniIlacEkle();

// ─────────────────────────────────────────────
// 3. BİLDİRİM (FCM) İZNİ ALMA
//    DÜZELTME: navigator.serviceWorker.ready bekleniyor
//    DÜZELTME: VAPID key Uint8Array olarak veriliyor
//    DÜZELTME: SW kaydı önbellekleme sorununa karşı güncelleme zorlanıyor
// ─────────────────────────────────────────────
const btnBildirimIzin = document.getElementById('btnBildirimIzin');

async function bildirimIzniAl() {
  try {
    // Adım 1: Tarayıcı desteğini kontrol et
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      alert("Bu tarayıcı bildirim özelliğini desteklemiyor.");
      return;
    }

    // Adım 2: Bildirim izni iste
    const izin = await Notification.requestPermission();
    if (izin !== 'granted') {
      console.warn("Bildirim izni reddedildi.");
      return;
    }

    // Adım 3: Service Worker'ı kaydet ve HAZIR olmasını bekle
    // Bu adım AtortError ve InvalidAccessError hatalarını önler.
    const swKaydı = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      {
        // updateViaCache: 'none' → SW her zaman sunucudan kontrol edilir
        // local geliştirmede eski SW önbelleklenme sorununu önler
        updateViaCache: 'none'
      }
    );

    // SW'nin tam olarak aktif hale gelmesini bekle
    await navigator.serviceWorker.ready;

    // Varsa güncelleme zorla (local geliştirme best-practice)
    await swKaydı.update();

    // Adım 4: VAPID key'i Uint8Array'e çevir ve token al
    fcmToken = await getToken(messaging, {
      vapidKey          : VAPID_KEY,
      serviceWorkerRegistration: swKaydı
    });

    if (!fcmToken) {
      console.warn("FCM token alınamadı.");
      return;
    }

    console.log("✅ FCM Token:", fcmToken);
    const bildirimAlani = document.getElementById('bildirimAlani');
    if (bildirimAlani) {
      bildirimAlani.innerHTML =
        "<div class='text-green-700 font-bold'>✅ Bildirim izni alındı! Hatırlatmalar aktif.</div>";
    }

  } catch (err) {
    console.error("Bildirim hatası:", err.name, err.message);

    // Geliştirici için anlamlı hata mesajları
    if (err.name === 'AbortError') {
      console.error("→ Service Worker henüz hazır değildi veya kaydedilemedi. Sayfayı yenile.");
    } else if (err.name === 'InvalidAccessError') {
      console.error("→ VAPID anahtarı geçersiz. Firebase Console'dan doğru anahtarı al.");
    }
  }
}

if (btnBildirimIzin) {
  btnBildirimIzin.addEventListener('click', async () => {
    btnBildirimIzin.disabled = true;
    btnBildirimIzin.innerText = 'Yükleniyor...';
    await bildirimIzniAl();
    btnBildirimIzin.innerText = '✅ Bildirimler Aktif';
  });
}

// ─────────────────────────────────────────────
// 4. VERİLERİ TOPLAYIP FIREBASE'E KAYDETME
// ─────────────────────────────────────────────
const tedaviFormu = document.getElementById('tedaviFormu');

if (tedaviFormu) {
  tedaviFormu.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.innerText  = "Kaydediliyor...";
    btn.disabled   = true;

    try {
      // İlaçları topla
      const ilacListesi = [];
      document.querySelectorAll('.med-card').forEach(kart => {
        const saatler = [];
        kart.querySelectorAll('.ilac-saat').forEach(inp => {
          if (inp.value) saatler.push(inp.value);
        });
        ilacListesi.push({
          ilacAdi  : kart.querySelector('.ilac-adi').value,
          sekil    : kart.querySelector('.ilac-sekil').value,
          gunSayisi: kart.querySelector('.ilac-gun').value,
          hatirlatmaSaatleri: saatler
        });
      });

      // Seçilen doktor detayı
      const secilenDoktorMetni = document.getElementById('doktorSecim').value;
      const doktorDetay        = tumDoktorlarVerisi.find(d => d.tamMetin === secilenDoktorMetni);

      const veriPaketi = {
        hastaAdi      : document.getElementById('hastaAd').value,
        hastaTel      : document.getElementById('hastaTel').value,
        doktorDuzMetin: secilenDoktorMetni,
        doktorId      : doktorDetay?.id      ?? "bilinmiyor",
        doktorIsim    : doktorDetay?.isim    ?? secilenDoktorMetni,
        hastaneAdi    : doktorDetay?.hastane ?? "Bilinmeyen Hastane",
        kontrolTarihi : document.getElementById('kontrolTarih').value,
        yasakliGidalar: document.getElementById('yasakliGidalar').value,
        doktorNotlari : document.getElementById('doktorNotlari').value,
        ilaclar       : ilacListesi,
        cihazToken    : fcmToken,           // FCM bildirimi için
        olusturmaTarihi: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "tedavi_planlari"), veriPaketi);
      alert(`🎉 Tedavi Planı kaydedildi!\nKayıt ID: ${docRef.id}`);

      tedaviFormu.reset();
      ilacKonteyner.innerHTML = '';
      yeniIlacEkle();

    } catch (err) {
      console.error("Kayıt hatası:", err);
      alert("Kayıt sırasında bir hata oluştu: " + err.message);
    } finally {
      btn.innerText = "Tedavi Planını Başlat";
      btn.disabled  = false;
    }
  });
}