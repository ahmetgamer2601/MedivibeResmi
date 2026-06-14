import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let tumHastaneler = []; 
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
    "title-onecikanlar": "Ayın Öne Çıkan Hastaneleri",
    "title-tumhastaneler": "Tüm Hastanelerimiz",
    "arama-placeholder": "Hastane adı veya ilçe/adres yazın... (Örn: Merkez)",
    "kart-doktor": "Uzman Doktor",
    "kart-yatak": "Yatak Kapasitesi",
    "kart-ara": "📞 Şimdi Ara",
    "kart-kadro": "👨‍⚕️ Doktor Kadrosu",
    "kart-etiket-onecikan": "⭐ Öne Çıkan",
    "hata-sonuc": "Aradığınız kriterlere uygun klinik bulunamadı kanka. 🔍",
    "hata-veri-yok": "Veritabanında henüz hastane bulunamadı."
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
    "title-onecikanlar": "Featured Hospitals of the Month",
    "title-tumhastaneler": "All Our Hospitals",
    "arama-placeholder": "Type hospital name or district... (e.g. Center)",
    "kart-doktor": "Specialist Doctor",
    "kart-yatak": "Bed Capacity",
    "kart-ara": "📞 Call Now",
    "kart-kadro": "👨‍⚕️ Medical Staff",
    "kart-etiket-onecikan": "⭐ Featured",
    "hata-sonuc": "No clinics found matching your criteria. 🔍",
    "hata-veri-yok": "No hospitals found in the database yet."
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
    "title-onecikanlar": "Top-Krankenhäuser des Monats",
    "title-tumhastaneler": "Alle unsere Krankenhäuser",
    "arama-placeholder": "Krankenhausname oder Bezirk eingeben...",
    "kart-doktor": "Facharzt",
    "kart-yatak": "Bettenkapazität",
    "kart-ara": "📞 Jetzt anrufen",
    "kart-kadro": "👨‍⚕️ Ärzteteam",
    "kart-etiket-onecikan": "⭐ Top",
    "hata-sonuc": "Keine passende Klinik gefunden, Kumpel. 🔍",
    "hata-veri-yok": "Noch keine Krankenhäuser in der Datenbank gefunden."
  }
};

// --- DİL DEĞİŞTİRME MOTORU ---
function sayfayiYerellestir(lang) {
  mevcutDil = lang;
  localStorage.setItem('medivibe-dil', lang);

  // Sabit metinleri güncelle
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const anahtar = element.getAttribute('data-i18n');
    if (dilPaketi[lang][anahtar]) {
      element.innerHTML = dilPaketi[lang][anahtar];
    }
  });

  // Arama input placeholder'ını güncelle
  const aramaInput = document.getElementById('arama-kutusu');
  if (aramaInput) {
    aramaInput.placeholder = dilPaketi[lang]['arama-placeholder'];
  }

  // Select elementinin değerini eşitle
  const languageSelector = document.getElementById('languageSelector');
  if (languageSelector) {
    languageSelector.value = lang;
  }

  // Hafızadaki hastaneleri yeni dille ekrana tekrar bas[cite: 6]
  if (tumHastaneler.length > 0) {
    kartlariEkranaBas(tumHastaneler);
  }
}

// 4. VERİTABANINDAN VERİLERİ ÇEKEN ANA FONKSİYON[cite: 6]
async function hastaneleriYukle() {
  const allContainer = document.getElementById('allHospitals');

  try {
    // İlk açılışta hafızadaki dili uygula
    sayfayiYerellestir(mevcutDil);

    console.log("Firestore bağlantısı başlatılıyor...");
    const querySnapshot = await getDocs(collection(db, "hastaneler"));
    
    if (querySnapshot.empty) {
      if (allContainer) {
        allContainer.innerHTML = `<p class="text-gray-500 text-sm col-span-full text-center">${dilPaketi[mevcutDil]['hata-veri-yok']}</p>`;
      }
      return;
    }

    tumHastaneler = [];
    querySnapshot.forEach((doc) => {
      tumHastaneler.push({
        id: doc.id,
        ...doc.data()
      });
    });

    kartlariEkranaBas(tumHastaneler);
    aramaSisteminiAktifEt();
    dilSeciciSisteminiAktifEt();

  } catch (error) {
    console.error("Firestore hatası:", error);
    if (allContainer) {
      allContainer.innerHTML = `<p class="text-red-500 text-sm col-span-full text-center">Error: ${error.message}</p>`;
    }
  }
}

// 5. KARTLARI DİNAMİK OLARAK HTML'E YAZDIRAN MODÜLER FONKSİYON[cite: 6]
function kartlariEkranaBas(hastaneListesi) {
  const topContainer = document.getElementById('topHospitals');
  const allContainer = document.getElementById('allHospitals');

  if (topContainer) topContainer.innerHTML = '';
  if (allContainer) allContainer.innerHTML = '';

  if (hastaneListesi.length === 0 && allContainer) {
    allContainer.innerHTML = `<p class="text-gray-400 text-sm py-8 col-span-full text-center">${dilPaketi[mevcutDil]['hata-sonuc']}</p>`;
    return;
  }

  hastaneListesi.forEach((hastane) => {
    const id = hastane.id; 
    const detaylar = hastane.detaylar || {};
    const doktorlar = hastane.doktorlar || [];
    
    const resim = detaylar.gorselUrl || 'https://via.placeholder.com/500x300?text=Medivibe+Hospital';
    const adres = detaylar.adres || '---';
    const telefon = detaylar.telefon || '';
    const yatakSayisi = detaylar.yatakSayisi || '---';
    const doktorSayisi = doktorlar.length;
    const isTop = hastane.enIyi === true; 

    const telLink = typeof telefon === 'string' ? telefon.replace(/\s+/g, '') : telefon;

    const kartHTML = `
      <div class="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full border border-gray-100 animate-fadeIn">
        
        <div class="h-44 overflow-hidden relative bg-gray-100">
          <img src="${resim}" alt="${id}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105">
          ${isTop ? `<div class="absolute top-3 right-3 bg-[#00a859] text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm select-none">${dilPaketi[mevcutDil]['kart-etiket-onecikan']}</div>` : ''}
        </div>

        <div class="p-5 flex-grow flex flex-col justify-between">
          <div>
            <h3 class="text-base font-bold text-gray-800 mb-1 tracking-tight">${id}</h3>
            <p class="text-gray-500 text-xs mb-4 flex items-center gap-1">📍 ${adres}</p>

            <div class="grid grid-cols-2 gap-2 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100 text-center select-none">
              <div class="border-r border-gray-200">
                <span class="block text-lg font-bold text-[#00a859]">${doktorSayisi}</span>
                <span class="text-[10px] text-gray-400 font-semibold uppercase">${dilPaketi[mevcutDil]['kart-doktor']}</span>
              </div>
              <div>
                <span class="block text-lg font-bold text-gray-700">${yatakSayisi}</span>
                <span class="text-[10px] text-gray-400 font-semibold uppercase">${dilPaketi[mevcutDil]['kart-yatak']}</span>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-2 mt-2">
            <a href="tel:${telLink}" class="w-full text-center bg-[#00a859] hover:bg-[#008f4c] text-white text-xs font-semibold py-2.5 rounded-xl transition duration-200 shadow-sm">
              ${dilPaketi[mevcutDil]['kart-ara']}
            </a>
            <a href="doktorlar.html?hastane=${encodeURIComponent(id)}" class="w-full text-center bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold py-2.5 rounded-xl transition duration-200 shadow-sm">
              ${dilPaketi[mevcutDil]['kart-kadro']}
            </a>
          </div>
        </div>
      </div>
    `;

    if (isTop && topContainer) {
      topContainer.innerHTML += kartHTML;
    }
    if (allContainer) {
      allContainer.innerHTML += kartHTML;
    }
  });
}

// 6. ANLIK FİLTRELEME VE ARAMA SİSTEMİ[cite: 6]
function aramaSisteminiAktifEt() {
  const aramaInput = document.getElementById('arama-kutusu');
  const featuredSection = document.getElementById('featuredSection');
  const sectionDivider = document.getElementById('sectionDivider');
  
  if (!aramaInput) return;

  aramaInput.addEventListener('input', (e) => {
    const aramaDegeri = e.target.value.toLowerCase().trim();

    if (aramaDegeri !== "") {
      if (featuredSection) featuredSection.classList.add('hidden');
      if (sectionDivider) sectionDivider.classList.add('hidden');
    } else {
      if (featuredSection) featuredSection.classList.remove('hidden');
      if (sectionDivider) sectionDivider.classList.remove('hidden');
    }

    const filtrelenmisHastaneler = tumHastaneler.filter((hastane) => {
      const hastaneAdi = hastane.id.toLowerCase();
      const hastaneAdres = (hastane.detaylar?.adres || "").toLowerCase();
      return hastaneAdi.includes(aramaDegeri) || hastaneAdres.includes(aramaDegeri);
    });

    kartlariEkranaBas(filtrelenmisHastaneler);
  });
}

// 7. DİL SEÇİCİ ETKİNLİK DİNLEYİCİSİ[cite: 6]
function dilSeciciSisteminiAktifEt() {
  const languageSelector = document.getElementById('languageSelector');
  if (languageSelector) {
    languageSelector.addEventListener('change', (e) => {
      sayfayiYerellestir(e.target.value);
    });
  }
}

// Güvenli Yükleme Başlatıcı[cite: 6]
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", hastaneleriYukle);
} else {
  hastaneleriYukle();
}