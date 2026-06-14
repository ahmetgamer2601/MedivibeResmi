// Firebase v9+ Modüler İçe Aktarma
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Senin Verdiğin API Bilgileri
const firebaseConfig = {
  apiKey: "AIzaSyD-mksVUYTyFLfRb1O0TBZoHVjkWAeSjwQ",
  authDomain: "medivibe-resmi.firebaseapp.com",
  projectId: "medivibe-resmi",
  storageBucket: "medivibe-resmi.firebasestorage.app",
  messagingSenderId: "486046453284",
  appId: "1:486046453284:web:efb5c976322e3f6bf512b1",
  measurementId: "G-9WMY2W05DJ"
};

// Firebase'i Başlat
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);


// --- KİMLİK DOĞRULAMA VE PROFİL UI YÖNETİMİ ---
const desktopAvatar = document.getElementById('desktopAvatar');
const mobilAvatar = document.getElementById('mobilAvatar');
const mobilUserName = document.getElementById('mobilUserName');
const userDisplayEmail = document.getElementById('userDisplayEmail');

const loggedOutMenu = document.getElementById('loggedOutMenu');
const loggedInMenu = document.getElementById('loggedInMenu');
const mobilLoggedOut = document.getElementById('mobilLoggedOut');
const mobilLoggedIn = document.getElementById('mobilLoggedIn');

const logoutBtn = document.getElementById('logoutBtn');
const mobilLogoutBtn = document.getElementById('mobilLogoutBtn');

let globalTotalClinics = 0;
let globalTotalDoctors = 0;
let globalTotalReviews = 0;

/// Auth Durumunu Dinle
onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (loggedOutMenu) loggedOutMenu.classList.add('hidden');
    if (loggedInMenu) loggedInMenu.classList.remove('hidden');
    if (mobilLoggedOut) mobilLoggedOut.classList.add('hidden');
    if (mobilLoggedIn) mobilLoggedIn.classList.remove('hidden');
    
    if (userDisplayEmail) userDisplayEmail.innerText = user.email;

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const basHarf = userData.firstName ? userData.firstName.charAt(0).toUpperCase() : "U";
        
        if (desktopAvatar) desktopAvatar.innerText = basHarf;
        if (mobilAvatar) mobilAvatar.innerText = basHarf;
        if (mobilUserName) mobilUserName.innerText = `${userData.firstName} ${userData.lastName}`;

        // ── Hem PC hem Mobil Admin Kontrolü ──
        const adminBtn = document.getElementById('adminSupportBtn');
        const mobilAdminBtn = document.getElementById('mobilAdminSupportBtn');

        if (userData.role === "admin") {
          if (adminBtn) adminBtn.classList.remove('hidden');
          if (mobilAdminBtn) mobilAdminBtn.classList.remove('hidden');
        } else {
          if (adminBtn) adminBtn.classList.add('hidden');
          if (mobilAdminBtn) mobilAdminBtn.classList.add('hidden');
        }

      } else {
        if (desktopAvatar) desktopAvatar.innerText = "U";
        if (mobilAvatar) mobilAvatar.innerText = "U";
      }
    } catch (error) {
      console.error("Kullanıcı profil verisi çekilemedi:", error);
    }
  } else {
    if (loggedOutMenu) loggedOutMenu.classList.remove('hidden');
    if (loggedInMenu) loggedInMenu.classList.add('hidden');
    if (mobilLoggedOut) mobilLoggedOut.classList.remove('hidden');
    if (mobilLoggedIn) mobilLoggedIn.classList.add('hidden');

    // Çıkış yapıldığında her iki butonu da gizle
    const adminBtn = document.getElementById('adminSupportBtn');
    const mobilAdminBtn = document.getElementById('mobilAdminSupportBtn');
    
    if (adminBtn) adminBtn.classList.add('hidden');
    if (mobilAdminBtn) mobilAdminBtn.classList.add('hidden');

    const defaultSvg = `<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"></path></svg>`;
    if (desktopAvatar) desktopAvatar.innerHTML = defaultSvg;
    if (mobilAvatar) mobilAvatar.innerHTML = defaultSvg;
  }
});

// Çıkış Yapma Olayı (Sayfayı Temizleyip Yeniler)
const handleLogout = async () => {
  try {
    await signOut(auth);
    window.location.reload();
  } catch (error) {
    console.error("Çıkış yapılırken bir hata oluştu:", error);
  }
};

// Çıkış butonlarını dinlemeye al
if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
if (mobilLogoutBtn) mobilLogoutBtn.addEventListener('click', handleLogout);


// --- İSTATİSTİKLERİ YAPIYA UYGUN OLARAK VERİTABANINDAN ÇEKME FONKSİYONO (KORUNDU) ---
async function istatistikleriGuncelle() {
  try {
    const hastaneSnapshot = await getDocs(collection(db, "hastaneler"));
    globalTotalClinics = hastaneSnapshot.size;

    globalTotalDoctors = 0;
    hastaneSnapshot.forEach((doc) => {
      const hastaneVerisi = doc.data();
      if (hastaneVerisi.doktorlar && Array.isArray(hastaneVerisi.doktorlar)) {
        globalTotalDoctors += hastaneVerisi.doktorlar.length;
      }
    });

    globalTotalReviews = 0;
    updateStatLabels(currentLang);

  } catch (error) {
    console.error("İstatistikler yüklenirken hata oluştu:", error);
  }
}

// İstatistik verilerinin metinlerini dil bazlı güncelleyen alt fonksiyon
function updateStatLabels(lang) {
  const hastaneElement = document.getElementById("toplam-hastane");
  const doktorElement = document.getElementById("toplam-doktor");
  const degerlendirmeElement = document.getElementById("toplam-degerlendirme");

  if (hastaneElement) {
    hastaneElement.innerText = lang === 'tr' ? `${globalTotalClinics} Klinik` : 
                               lang === 'en' ? `${globalTotalClinics} Clinics` : `${globalTotalClinics} Kliniken`;
  }
  if (doktorElement) {
    doktorElement.innerText = lang === 'tr' ? `${globalTotalDoctors} Uzman Doktor` : 
                               lang === 'en' ? `${globalTotalDoctors} Specialist Doctors` : `${globalTotalDoctors} Fachärzte`;
  }
  if (degerlendirmeElement) {
    degerlendirmeElement.innerText = lang === 'tr' ? `${globalTotalReviews} Değerlendirme` : 
                               lang === 'en' ? `${globalTotalReviews} Reviews` : `${globalTotalReviews} Bewertungen`;
  }
}


// --- 1. ÇOK DİLLİ SÖZLÜK (3 DİLE ÇIKARILDI) ---
const dictionary = {
  tr: {
    hastaneler: "Hastanelerimiz",
    tesisler: "Tesisler",
    bakim: "Bakım Merkezleri",
    oteller: "Oteller",
    araclar: "Araçlar",
    iletisim: "İletişim",
    iletisimBtn: "İletişime Geç",
    title: "Tıbbi seyahatler bizimle güvenlidir.",
    placeholder: "Hastalık, işlem, hastane veya doktor adını girin.",
    searchBtn: "Ara",
    noResult: "Sonuç bulunamadı",
    
    // Araçlar Menüsü Elamanları
    ilacTakipBaslik: "İlaç Takip Sistemi",
    ilacTakipAlt: "Tedavi ve hatırlatıcı paneli",
    dovizBaslik: "Canlı Döviz Çevirici",
    dovizAlt: "Anlık borsa kur hesaplayıcı",
    
    // YENİ: Hava Durumu Sistemi Anahtarları
    havaDurumuBaslik: "Küresel Hava Durumu",
    havaDurumuAlt: "Seyahat ve anlık saatlik tahminler",
    
    tıbbiBelgeCeviri: "Tıbbi Belge Çevirisi",
    adminPanelBaslik: "Admin Destek Paneli",
    dilSecimi: "Dil Seçimi",
    hesapYonetimi: "Hesap Yönetimi",
    girisYap: "Giriş Yap",
    hesapOlustur: "Hesap Oluştur",
    kayitOl: "Kayıt Ol",
    baglantiGuvenli: "Bağlantı Güvenli",
    ayarlar: "Ayarlar",
    ayarlarPaneli: "Ayarlar Paneli",
    cikisYap: "Çıkış Yap",
    guvenliCikis: "Güvenli Çıkış",
    kart1Metin: "Ağımızdaki tüm klinikler özenle seçilmiştir. Hastalarımızın güvenli ve standartların üzerinde hizmet alabilmesi için sadece uluslararası sağlık turizmi yetki belgesine sahip kurumlarla çalışıyoruz.",
    kart1Link: "Anlaşmalı hastaneleri incele",
    kart2Metin: "Her hasta talebi, kendi alanında uzman ve sertifikalı hekimlerimiz tarafından titizlikle incelenir. Doğru hastane seçimi ve tedavi sürecinin planlanmasında size profesyonel rehberlik sunarlar.",
    kart2Link: "Tıbbi kadromuzla tanışın",
    kart3Metin: "Şeffaflık en büyük ilkemizdir. Tedavi süreçlerini bizimle tamamlayan hastalarımızın hem olumlu hem de olumsuz tüm gerçek deneyimlerini tarafsız bir şekilde yayınlıyoruz.",
    kart3Link: "İnceleme politikamızı okuyun"
  },

  en: {
    hastaneler: "Our Hospitals",
    tesisler: "Facilities",
    bakim: "Care Centers",
    oteller: "Hotels",
    araclar: "Tools",
    iletisim: "Contact",
    iletisimBtn: "Contact Us",
    title: "Medical travels are safe with us.",
    placeholder: "Enter disease, procedure, hospital or doctor name.",
    searchBtn: "Search",
    noResult: "No results found",
    
    // Tools Menu Items
    ilacTakipBaslik: "Medication Tracker",
    ilacTakipAlt: "Treatment and reminder panel",
    dovizBaslik: "Live Currency Converter",
    dovizAlt: "Instant exchange rate calculator",
    
    // Global Weather System
    havaDurumuBaslik: "Global Weather",
    havaDurumuAlt: "Travel and instant hourly forecasts",
    
    tıbbiBelgeCeviri: "Medical Document Translation",
    adminPanelBaslik: "Admin Support Panel",
    dilSecimi: "Language",
    hesapYonetimi: "Account Management",
    girisYap: "Sign In",
    hesapOlustur: "Create Account",
    kayitOl: "Register",
    baglantiGuvenli: "Secure Connection",
    ayarlar: "Settings",
    ayarlarPaneli: "Settings Panel",
    cikisYap: "Log Out",
    guvenliCikis: "Secure Sign Out",
    kart1Metin: "All clinics in our network are carefully selected. We only work with institutions that hold an international health tourism authorization certificate to ensure our patients receive safe services above standards.",
    kart1Link: "Examine contracted hospitals",
    kart2Metin: "Each patient request is meticulously reviewed by our certified specialist physicians. They offer you professional guidance in choosing the right hospital and planning the treatment process.",
    kart2Link: "Meet our medical team",
    kart3Metin: "Transparency is our primary principle. We impartially publish all real experiences, both positive and negative, of our patients who have completed their treatment processes with us.",
    kart3Link: "Read our review policy"
  },
  de: {
    hastaneler: "Unsere Kliniken",
    tesisler: "Einrichtungen",
    bakim: "Pflegezentren",
    oteller: "Hotels",
    araclar: "Werkzeuge",
    iletisim: "Kontakt",
    iletisimBtn: "Kontaktieren Sie uns",
    title: "Medizinische Reisen sind mit uns sicher.",
    placeholder: "Geben Sie Krankheit, Verfahren, Klinik oder Arztname ein.",
    searchBtn: "Suchen",
    noResult: "Keine Ergebnisse gefunden",
    
    // Werkzeuge Menüelemente
    ilacTakipBaslik: "Medikamenten-Tracker",
    ilacTakipAlt: "Behandlungs- und Erinnerungspanel",
    dovizBaslik: "Live-Währungsrechner",
    dovizAlt: "Echtzeit-Wechselkursrechner",
    
    // Globales Wettersystem
    havaDurumuBaslik: "Globales Wetter",
    havaDurumuAlt: "Reise- und stündliche Vorhersagen",
    
    tıbbiBelgeCeviri: "Medizinische Dokumentenübersetzung",
    adminPanelBaslik: "Admin-Support-Panel",
    dilSecimi: "Sprachauswahl",
    hesapYonetimi: "Kontoverwaltung",
    girisYap: "Einloggen",
    hesapOlustur: "Konto erstellen",
    kayitOl: "Registrieren",
    baglantiGuvenli: "Sichere Verbindung",
    ayarlar: "Einstellungen",
    ayarlarPaneli: "Einstellungs-Panel",
    cikisYap: "Ausloggen",
    guvenliCikis: "Sicherer Logout",
    kart1Metin: "Alle Kliniken in unserem Netzwerk sind sorgfältig ausgewählt. Wir arbeiten nur mit Institutionen zusammen, die über ein internationales Zertifikat für Gesundheitstourismus verfügen, um einen sicheren Service zu gewährleisten.",
    kart1Link: "Vertragskliniken prüfen",
    kart2Metin: "Jede Patientenanfrage wird von unseren zertifizierten Fachärzten sorgfältig geprüft. Sie bieten Ihnen professionelle Unterstützung bei der Auswahl des richtigen Krankenhauses und der Behandlungsplanung.",
    kart2Link: "Lernen Sie unser medizinisches Team kennen",
    kart3Metin: "Transparenz ist unser oberstes Prinzip. Wir veröffentlichen unparteiisch alle echten Erfahrungen, sowohl positive als auch negative, unserer Patienten, die ihre Behandlung abgeschlossen haben.",
    kart3Link: "Lesen Sie unsere Bewertungsrichtlinie"
  }
};

let currentLang = 'tr';
const langSelector = document.getElementById('languageSelector');
const mobilLangSelector = document.getElementById('mobilLanguageSelector');

// Tüm arayüzü dile göre güncelleyen fonksiyon
function changeLanguageUI(selectedLang) {
  currentLang = selectedLang;

  // Seçicileri eşitle (Masaüstü ve Mobil)
  if (langSelector) langSelector.value = selectedLang;
  if (mobilLangSelector) mobilLangSelector.value = selectedLang;

  const d = dictionary[selectedLang];
  if (!d) return;

  // Tüm çoklu öğeleri seçerek güncelle (querySelectorAll ile hem PC hem Mobil güncellenir)
  document.querySelectorAll('.lang-hastaneler').forEach(el => el.innerText = d.hastaneler);
  document.querySelectorAll('.lang-tesisler').forEach(el => el.innerText = d.tesisler);
  document.querySelectorAll('.lang-bakim').forEach(el => el.innerText = d.bakim);
  document.querySelectorAll('.lang-oteller').forEach(el => el.innerText = d.oteller);
  document.querySelectorAll('.lang-araclar').forEach(el => el.innerText = d.araclar);
  document.querySelectorAll('.lang-iletisim').forEach(el => el.innerText = d.iletisim);
  document.querySelectorAll('.lang-iletisim-btn').forEach(el => el.innerText = d.iletisimBtn);
  document.querySelectorAll('.lang-ilac-takip-baslik').forEach(el => el.innerText = d.ilacTakipBaslik);
  document.querySelectorAll('.lang-ilac-takip-alt').forEach(el => el.innerText = d.ilacTakipAlt);
  document.querySelectorAll('.lang-doviz-baslik').forEach(el => el.innerText = d.dovizBaslik);
  document.querySelectorAll('.lang-doviz-alt').forEach(el => el.innerText = d.dovizAlt);
  document.querySelectorAll('.lang-tıbbi-belge-ceviri').forEach(el => el.innerText = d.tıbbiBelgeCeviri);
  document.querySelectorAll('.lang-admin-panel-baslik').forEach(el => el.innerText = d.adminPanelBaslik);
  document.querySelectorAll('.lang-dil-secimi').forEach(el => el.innerText = d.dilSecimi);
  document.querySelectorAll('.lang-hesap-yonetimi').forEach(el => el.innerText = d.hesapYonetimi);
  document.querySelectorAll('.lang-giris-yap').forEach(el => el.innerText = d.girisYap);
  document.querySelectorAll('.lang-hesap-olustur').forEach(el => el.innerText = d.hesapOlustur);
  document.querySelectorAll('.lang-kayit-ol').forEach(el => el.innerText = d.kayitOl);
  document.querySelectorAll('.lang-baglanti-guvenli').forEach(el => el.innerText = d.baglantiGuvenli);
  document.querySelectorAll('.lang-ayarlar').forEach(el => el.innerText = d.ayarlar);
  document.querySelectorAll('.lang-ayarlar-paneli').forEach(el => el.innerText = d.ayarlarPaneli);
  document.querySelectorAll('.lang-cikis-yap').forEach(el => el.innerText = d.cikisYap);
  document.querySelectorAll('.lang-guvenli-cikis').forEach(el => el.innerText = d.guvenliCikis);
// Hava Durumu İçerikleri (Hem Masaüstü Hem Mobil İçin)
  document.querySelectorAll('.lang-hava-durumu-baslik').forEach(el => el.innerText = d.havaDurumuBaslik);
  document.querySelectorAll('.lang-hava-durumu-alt').forEach(el => el.innerText = d.havaDurumuAlt);
  
  // Kart İçerikleri
  document.querySelectorAll('.lang-kart1-metin').forEach(el => el.innerText = d.kart1Metin);
  document.querySelectorAll('.lang-kart1-link').forEach(el => el.innerText = d.kart1Link);
  document.querySelectorAll('.lang-kart2-metin').forEach(el => el.innerText = d.kart2Metin);
  document.querySelectorAll('.lang-kart2-link').forEach(el => el.innerText = d.kart2Link);
  document.querySelectorAll('.lang-kart3-metin').forEach(el => el.innerText = d.kart3Metin);
  document.querySelectorAll('.lang-kart3-link').forEach(el => el.innerText = d.kart3Link);

  // Tekil Öğeler
  const titleEl = document.querySelector('.lang-title');
  if (titleEl) titleEl.innerText = d.title;

  const searchInp = document.getElementById('searchInput');
  if (searchInp) searchInp.placeholder = d.placeholder;

  const searchBtnEl = document.querySelector('.lang-search-btn');
  if (searchBtnEl) searchBtnEl.innerText = d.searchBtn;

  // Sayaç Sayısal Etiketlerini Yenile
  updateStatLabels(selectedLang);
}

// Seçici Tetikleyicileri (Masaüstü ve Mobil Senkronizasyonu Sağlar)
if (langSelector) {
  langSelector.addEventListener('change', (e) => changeLanguageUI(e.target.value));
}
if (mobilLangSelector) {
  mobilLangSelector.addEventListener('change', (e) => changeLanguageUI(e.target.value));
}


// --- CANLI ARAMA (AUTOCOMPLETE) MOTORU ---
const searchInput = document.getElementById('searchInput');
const autocompleteList = document.getElementById('autocompleteList');
let databaseCache = []; 

async function fetchDatabaseData() {
  if (!searchInput) return;

  try {
    const querySnapshot = await getDocs(collection(db, "hastaneler"));
    
    if(querySnapshot.empty) {
      databaseCache = [
        { name: "Özel Ümit Hastanesi", type: "Hastane" },
        { name: "Anadolu Hastanesi", type: "Hastane" },
        { name: "Gürlife", type: "Hastane" },
        { name: "Kardiyoloji", type: "Bölüm" },
        { name: "Diş Implantı", type: "İşlem" }
      ];
      return;
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if(data.hastaneAdi) databaseCache.push({ name: data.hastaneAdi, type: "Hastane", id: doc.id });
      if(data.doktorlar) {
        data.doktorlar.forEach(d => databaseCache.push({ name: typeof d === 'string' ? d : d.isim, type: "Doktor" }));
      }
    });
  } catch (error) {
    console.error("Veri çekme hatası:", error);
  }
}

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.toLowerCase().trim();
    
    if (!autocompleteList) return;
    
    autocompleteList.innerHTML = ''; 

    if (!val) {
      autocompleteList.classList.add('hidden');
      return;
    }

    const matches = databaseCache.filter(item => item.name.toLowerCase().includes(val));

    if (matches.length > 0) {
      matches.slice(0, 5).forEach(match => {
        const li = document.createElement('li');
        li.className = 'autocomplete-item';
        li.innerHTML = `
          <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          <span class="font-bold text-gray-800">${match.name}</span>
          <span class="text-xs text-gray-400 ml-auto bg-gray-100 px-2 py-1 rounded">${match.type}</span>
        `;
        li.addEventListener('click', () => {
          searchInput.value = match.name;
          autocompleteList.classList.add('hidden');
        });
        autocompleteList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.className = 'autocomplete-item text-gray-500 italic';
      li.innerText = (dictionary[currentLang]) ? dictionary[currentLang].noResult : "Sonuç bulunamadı";
      autocompleteList.appendChild(li);
    }

    autocompleteList.classList.remove('hidden');
  });
}

document.addEventListener('click', (e) => {
  if (searchInput && autocompleteList) {
    if (!searchInput.contains(e.target) && !autocompleteList.contains(e.target)) {
      autocompleteList.classList.add('hidden');
    }
  }
});

// Sayfa Açılış Başlatıcıları
fetchDatabaseData();
istatistikleriGuncelle();