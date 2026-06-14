import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const db = getFirestore(app);

// --- GLOBAL HAFIZA VE AKTİF DİL ---
let aktifDoktorlar = []; 
let mevcutDil = localStorage.getItem('medivibe-dil') || 'tr'; 

// --- DİL SÖZLÜĞÜ (TR - EN - DE) ---
const dilPaketi = {
  tr: {
    "nav-hastaneler": "Hastanelerimiz",
    "nav-tesisler": "Tesisler",
    "nav-bakim": "Bakım Merkezleri",
    "nav-oteller": "Oteller",
    "nav-araclar": "Araçlar",
    "nav-ilac-baslik": "İlaç Takip Sistemi",
    "nav-ilac-ozet": "Tedavi ve hatırlatıcı paneli",
    "nav-doviz-baslik": "Canlı Döviz Çevirici",
    "nav-doviz-ozet": "Anlık borsa kur hesaplayıcı",
    "nav-iletisime-gec": "İletişime Geç",
    "nav-iletisim-etiket": "İletişim",
    "yukleniyor-ekran": "Veriler hazırlanıyor...",
    "hastane-yukleniyor": "Yükleniyor...",
    "hastane-alt-metin": "Bu hastanemizde görev yapan değerli uzman hekimlerimiz.",
    "doktor-yukleniyor": "Doktorlar yükleniyor...",
    "hata-baslik": "Hata",
    "hata-secim": "Lütfen bir hastane seçin kanka. 🔍",
    "hata-tanimsiz": "Bu hastanede henüz doktor tanımlanmamış.",
    "hata-bulunamadi": "Bu hastane veritabanında bulunamadı.",
    "hata-genel": "Veriler yüklenirken bir sorun oluştu."
  },
  en: {
    "nav-hastaneler": "Our Hospitals",
    "nav-tesisler": "Facilities",
    "nav-bakim": "Care Centers",
    "nav-oteller": "Hotels",
    "nav-araclar": "Tools",
    "nav-ilac-baslik": "Medication Tracker",
    "nav-ilac-ozet": "Treatment & reminder panel",
    "nav-doviz-baslik": "Live Currency Converter",
    "nav-doviz-ozet": "Instant exchange calculator",
    "nav-iletisime-gec": "Contact Us",
    "nav-iletisim-etiket": "Contact",
    "yukleniyor-ekran": "Preparing data...",
    "hastane-yukleniyor": "Loading...",
    "hastane-alt-metin": "Our distinguished specialist physicians working in this hospital.",
    "doktor-yukleniyor": "Loading doctors...",
    "hata-baslik": "Error",
    "hata-secim": "Please select a hospital. 🔍",
    "hata-tanimsiz": "No doctors have been defined for this hospital yet.",
    "hata-bulunamadi": "This hospital could not be found in the database.",
    "hata-genel": "A problem occurred while loading data."
  },
  de: {
    "nav-hastaneler": "Unsere Krankenhäuser",
    "nav-tesisler": "Einrichtungen",
    "nav-bakim": "Pflegezentren",
    "nav-oteller": "Hotels",
    "nav-araclar": "Tools",
    "nav-ilac-baslik": "Medikamenten-Tracker",
    "nav-ilac-ozet": "Behandlungs- & Erinnerungspanel",
    "nav-doviz-baslik": "Live-Währungsrechner",
    "nav-doviz-ozet": "Sofortiger Wechselkursrechner",
    "nav-iletisime-gec": "Kontaktieren Sie uns",
    "nav-iletisim-etiket": "Kontakt",
    "yukleniyor-ekran": "Daten werden vorbereitet...",
    "hastane-yukleniyor": "Wird geladen...",
    "hastane-alt-metin": "Unsere angesehenen Fachärzte, die in diesem Krankenhaus tätig sind.",
    "doktor-yukleniyor": "Ärzte werden geladen...",
    "hata-baslik": "Fehler",
    "hata-secim": "Bitte wählen Sie ein Krankenhaus aus. 🔍",
    "hata-tanimsiz": "Für dieses Krankenhaus wurden noch keine Ärzte definiert.",
    "hata-bulunamadi": "Dieses Krankenhaus wurde database nicht gefunden.",
    "hata-genel": "Beim Laden der Daten ist ein Problem aufgetreten."
  }
};

// --- DİL DEĞİŞTİRME MOTORU (GELECEKTEKİ TÜM YAPILARA UYUMLU EMNİYET KİLİTLİ) ---
function sayfayiYerellestir(lang) {
  // Emniyet Kilidi: Eğer gelen dil kodunun karşılığı sözlükte yoksa direkt 'tr'ye döndür
  if (!dilPaketi[lang]) {
    lang = 'tr';
  }

  mevcutDil = lang;
  localStorage.setItem('medivibe-dil', lang);

  // Sayfadaki data-i18n nitelikli tüm elemanları yerelleştir
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const anahtar = element.getAttribute('data-i18n');
    if (dilPaketi[lang][anahtar]) {
      element.innerHTML = dilPaketi[lang][anahtar];
    }
  });

  // Dil seçicinin değerini eşitle
  const languageSelector = document.getElementById('languageSelector');
  if (languageSelector) {
    languageSelector.value = lang;
  }

  // Eğer ekranda basılı doktor verisi varsa, statik alanlar güncellendiği için kartları yeniden tetikle
  if (aktifDoktorlar.length > 0) {
    kartlariEkranaBas(aktifDoktorlar);
  }
}

// --- DOKTORLARI FİRESTORE'DAN ÇEKEN ANA FONKSİYON ---
async function doktorlariYukle() {
  const container = document.getElementById('doktorListesi');
  const header = document.getElementById('hastaneAdiHeader');
  const loader = document.getElementById('loadingScreen');

  // İlk yüklemede hafızadaki dili çalıştır
  sayfayiYerellestir(mevcutDil);

  const urlParams = new URLSearchParams(window.location.search);
  const hastaneAdi = urlParams.get('hastane');
  
  if (!hastaneAdi) {
    if (header) header.innerText = dilPaketi[mevcutDil]['hata-baslik'];
    if (container) container.innerHTML = `<p class='text-red-500 font-medium'>${dilPaketi[mevcutDil]['hata-secim']}</p>`;
    if (loader) loader.classList.add('hidden');
    return;
  }

  // URL'den gelen hastane adını başlığa yaz
  if (header) header.innerText = hastaneAdi;

  try {
    const docRef = doc(db, "hastaneler", hastaneAdi);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      aktifDoktorlar = data.doktorlar || [];
      
      if (aktifDoktorlar.length > 0) {
        kartlariEkranaBas(aktifDoktorlar);
      } else {
        if (container) container.innerHTML = `<p class='text-gray-500 font-medium col-span-full text-center'>${dilPaketi[mevcutDil]['hata-tanimsiz']}</p>`;
      }
    } else {
      if (container) container.innerHTML = `<p class='text-gray-500 font-medium col-span-full text-center'>${dilPaketi[mevcutDil]['hata-bulunamadi']}</p>`;
    }
    
  } catch (error) {
    console.error("Veri çekme hatası:", error);
    if (container) container.innerHTML = `<p class='text-red-500 font-medium col-span-full text-center'>${dilPaketi[mevcutDil]['hata-genel']}</p>`;
  } finally {
    // 1.8 saniye bekletip loader ekranını kapat
    setTimeout(() => {
      if (loader) loader.classList.add('hidden');
    }, 1800);
  }
}

// --- DOKTOR KARTLARINI HTML'E YAZDIRAN FONKSİYON ---
function kartlariEkranaBas(doktorlar) {
  const container = document.getElementById('doktorListesi');
  if (!container) return;

  container.innerHTML = doktorlar.map(doktor => {
    const avatarSVG = `
      <div class="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
        <svg class="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </div>
    `;

    return `
      <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-all duration-300 animate-fadeIn">
        ${doktor.gorsel ? `<img src="${doktor.gorsel}" class="w-16 h-16 rounded-full object-cover flex-shrink-0 border border-gray-100">` : avatarSVG}
        <div>
          <h3 class="font-bold text-gray-900 text-base tracking-tight">${doktor.isim}</h3>
          <p class="text-sm text-[#00a859] font-semibold mt-0.5">${doktor.brans}</p>
        </div>
      </div>
    `;
  }).join('');
}

// --- DİL SEÇİCİ TETİKLEYİCİSİ ---
function dilSeciciSisteminiAktifEt() {
  const languageSelector = document.getElementById('languageSelector');
  if (languageSelector) {
    languageSelector.addEventListener('change', (e) => {
      sayfayiYerellestir(e.target.value);
    });
  }
}

// Sayfa ilk yüklendiğinde çalışacak güvenli tetikleyiciler
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    doktorlariYukle();
    dilSeciciSisteminiAktifEt();
  });
} else {
  doktorlariYukle();
  dilSeciciSisteminiAktifEt();
}