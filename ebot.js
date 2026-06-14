/**
 * ============================================================
 * BAKIM MERKEZİ WEB SCRAPER BOT — LIGHTWEIGHT (CHROME-FREE) v2
 * MULTI-LANGUAGE (TR, EN, DE) INTEGRATION ENGINE
 * node ebot.js --tek-sefer
 * node ebot.js --url <url>
 * ============================================================
 */

require('dotenv').config();

"use strict";

const axios   = require("axios");
const cheerio = require("cheerio");
const fetch   = require("node-fetch");
const https   = require("https");
const { URL } = require("url");

/* ─────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────── */
const CONFIG = {
  geminiAnahtarlar: [
  process.env.GEMINI_KEY_1,
  process.env.GEMINI_KEY_2,
  process.env.GEMINI_KEY_3,
  process.env.GEMINI_KEY_4,
],

firebase: {
  apiKey           : process.env.FIREBASE_API_KEY,
  authDomain       : process.env.FIREBASE_AUTH_DOMAIN,
  projectId        : process.env.FIREBASE_PROJECT_ID,
  storageBucket    : process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId            : process.env.FIREBASE_APP_ID,
  measurementId    : process.env.FIREBASE_MEASUREMENT_ID
},


  taramaKoleksiyon    : "bakimMerkezleri",
  geminiModel         : "gemini-2.5-flash",
  maksimumAltLink     : 4, 
  istekZamanAsimiMs   : 45000,

  altLinkAnahtarlar: [
    "hakkimizda", "iletisim", "hizmet", "bakim", "oda", "fiyat", "ucret", "galeri", "foto",
    "about", "contact", "services", "care", "room", "price", "gallery", "nursing", "senior"
  ],

  linkler: [
    "https://www.avrupasb.com.tr/",
    "https://www.idilbakimevi.com.tr/",
    "https://www.izmiryaslibakimevi.com/",
    "https://www.marmarahuzurevi.com.tr/",
    "https://www.bursahuzurevi.com/",
    "https://www.antalyahuzurevi.com.tr/",
    "https://www.nezihhuzurevi.com/",
    "https://www.gokturkhuzurevi.com/",
    "https://www.merihhuzurevi.com/",
    "https://www.aselbakimevi.com/"
  ]
};

// Axios default ayarlar (SSL hatalarını yoksay ve User-Agent taklit et)
const axiosInstance = axios.create({
  timeout: CONFIG.istekZamanAsimiMs,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
  },
  httpsAgent: new https.Agent({ rejectUnauthorized: false })
});

/* ─────────────────────────────────────────────
   KEY ROTATION MANAGEMENT
───────────────────────────────────────────── */
const keySistemi = { aktifIdx: 0, blokluKeyler: new Set() };

function getGecerliKey() {
  for (let i = 0; i < CONFIG.geminiAnahtarlar.length; i++) {
    const kontrolIdx = (keySistemi.aktifIdx + i) % CONFIG.geminiAnahtarlar.length;
    if (!keySistemi.blokluKeyler.has(kontrolIdx)) {
      keySistemi.aktifIdx = kontrolIdx;
      return { key: CONFIG.geminiAnahtarlar[kontrolIdx], idx: kontrolIdx };
    }
  }
  return null;
}

function keyBlokeEt(idx) {
  keySistemi.blokluKeyler.add(idx);
  console.warn(`⚠️ [KEY MANAGER] Anahtar #${idx + 1} limite takıldı. 65 saniye dinlendiriliyor...`);
  setTimeout(() => {
    keySistemi.blokluKeyler.delete(idx);
    console.log(`✅ [KEY MANAGER] Anahtar #${idx + 1} yeniden kullanıma hazır.`);
  }, 65000);
}

/* ─────────────────────────────────────────────
   FIRESTORE REST API IMPLEMENTATION
───────────────────────────────────────────── */
async function firestoreUpsert(koleksiyon, docId, veri) {
  const url = `https://firestore.googleapis.com/v1/projects/${CONFIG.firebase.projectId}/databases/(default)/documents/${koleksiyon}/${docId}`;
  
  // JSON verisini Firestore REST formatına (fields map) eşleyen fonksiyon
  function restFormatinaCevir(obj) {
    const fields = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined || val === null) continue;
      if (typeof val === "string") {
        fields[key] = { stringValue: val };
      } else if (typeof val === "number") {
        fields[key] = val % 1 === 0 ? { integerValue: String(val) } : { doubleValue: val };
      } else if (typeof val === "boolean") {
        fields[key] = { booleanValue: val };
      } else if (Array.isArray(val)) {
        fields[key] = {
          arrayValue: {
            values: val.map(v => typeof v === "number" ? (v % 1 === 0 ? { integerValue: String(v) } : { doubleValue: v }) : { stringValue: String(v) })
          }
        };
      } else if (typeof val === "object") {
        // Eğer map yapısı (odalar vs.) varsa mapValue olarak gönderiyoruz
        fields[key] = { mapValue: restFormatinaCevir(val) };
      }
    }
    return { fields };
  }

  const payload = restFormatinaCevir(veri);
  
  // Önce doküman var mı kontrol et (Upsert simülasyonu için)
  try {
    await axios.get(url);
    // Varsa PATCH ile üzerine yaz / güncelle
    await axios.patch(`${url}?updateMask.fieldPaths=${Object.keys(veri).join("&updateMask.fieldPaths=")}`, payload);
  } catch (e) {
    if (e.response && e.response.status === 404) {
      // Yoksa POST/PATCH ile yeni oluştur
      await axios.patch(url, payload);
    } else {
      throw e;
    }
  }
}

/* ─────────────────────────────────────────────
   AI ENGINE (DIRECT 3 LANGUAGES)
───────────────────────────────────────────── */
async function yapayZekaGezegeni(hamMetin, kaynakUrl, keyBilgisi) {
  const prompt = `Sen uluslararası sağlık, yaşlı bakımı ve huzurevi turizmi platformu (MediVibe) için çalışan veri madenciliği botusun.
Aşağıda ham metni verilen web sitesinden kurumun tüm kritik yapısal verilerini çıkar.
Tüm metinleri analiz et ve Türkçe, İngilizce ile Almanca alanları profesyonel bir şekilde doldur/çevir.

Kaynak URL: ${kaynakUrl}
Ayıklanacak Ham Web Verisi:
"${hamMetin}"

KURALLAR:
1) Yalnızca saf JSON döndür, önüne arkasına markdown (\`\`\`json) veya açıklama ekleme.
2) "bakimTurleri", "bakimTurleri_en" ve "bakimTurleri_de" listelerinde (Örn: Yaşlı Bakımı, Huzurevi, Demans Bakımı, Felçli Hasta Rehabilitasyonu) gibi kurumun sunduğu bakım türlerini dillerine uygun biçimde dizi olarak listele.
3) "odalar", "odalar_en" ve "odalar_de" alanları nesne (Map) yapısındadır. Oda tipi (Tek Kişilik Oda, Süit vb.) dillerine uygun çevrilsin, fiyat veya bilgi kısmı aynen kalsın.

NİHAİ JSON ŞABLONU:
{
  "merkezAdi": "Kurumun Türkçe Adı",
  "merkezAdi_en": "English Name of Center",
  "merkezAdi_de": "Deutscher Name des Zentrums",
  "telefon": "string veya Bulunmadı",
  "email": "string veya Bulunmadı",
  "adres": "Detaylı Türkçe Adres veya Bulunmadı",
  "adres_en": "Detailed English Address or Not Found",
  "adres_de": "Detaillierte deutsche Adresse oder Nicht Gefunden",
  "sehir": "string (Örn: İstanbul)",
  "ilce": "string (Örn: Kadıköy)",
  "bakimTurleri": ["Huzurevi", "Yatalak Hasta Bakımı"],
  "bakimTurleri_en": ["Nursing Home", "Bedridden Patient Care"],
  "bakimTurleri_de": ["Altersheim", "Pflege Bettlägeriger Patienten"],
  "odalar": {"Tek Kişilik Oda": "Fiyat veya Bilgi Mevcut Değil"},
  "odalar_en": {"Single Room": "Fiyat veya Bilgi Mevcut Değil"},
  "odalar_de": {"Einzelzimmer": "Fiyat veya Bilgi Mevcut Değil"},
  "ozellikler": ["7/24 Doktor", "Geniş Bahçe", "Fizyoterapi"],
  "ozellikler_en": ["24/7 Doctor", "Large Garden", "Physiotherapy"],
  "ozellikler_de": ["24/7 Arzt", "Großer Garten", "Physiotherapie"],
  "aciklama": "Kurumu tanıtan kısa Türkçe açıklama.",
  "aciklama_en": "Short English description introducing the center.",
  "aciklama_de": "Kurze deutsche Beschreibung zur Vorstellung des Zentrums."
}`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${keyBilgisi.key}`;
  
  const response = await axios.post(endpoint, {
    contents: [{ parts: [{ text: prompt }] }]
  }, { headers: { "Content-Type": "application/json" } });

  let temizJsonText = response.data.candidates[0].content.parts[0].text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(temizJsonText);
}

async function guvenliAiCagrisi(hamMetin, kaynakUrl) {
  for (let deneme = 0; deneme < 3; deneme++) {
    const aktifKeyBilgisi = getGecerliKey();
    if (!aktifKeyBilgisi) {
      console.log("⏳ [SYS] Tüm API anahtarları sınırda. 65 saniye komple duraklatılıyor...");
      await new Promise(r => setTimeout(r, 65000));
      continue;
    }

    try {
      console.log(`🤖 [AI] Gemini Analizi Başlıyor (Anahtar #${aktifKeyBilgisi.idx + 1})...`);
      return await yapayZekaGezegeni(hamMetin, kaynakUrl, aktifKeyBilgisi);
    } catch (err) {
      if (err.response && err.response.status === 429) {
        keyBlokeEt(aktifKeyBilgisi.idx);
        keySistemi.aktifIdx = (aktifKeyBilgisi.idx + 1) % CONFIG.geminiAnahtarlar.length;
      } else {
        throw err;
      }
    }
  }
  throw new Error("❌ 3 denemede de Gemini üzerinden veri anlamlandırılamadı.");
}

/* ─────────────────────────────────────────────
   CRAWLER ENGINE (AXIOS + CHEERIO)
───────────────────────────────────────────── */
function metinTemizle(htmlIcerik) {
  const $ = cheerio.load(htmlIcerik);
  $("script, style, noscript, iframe, footer, header, nav, link, meta").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

async function siteyiKazi(anaUrl) {
  console.log(`\n🕸️ [CRAWLER] İşlem Başlıyor: ${anaUrl}`);
  const taranacakLinkler = new Set([anaUrl]);
  const tarananLinkler = new Set();
  const toplananMetinler = [];
  const toplananGorseller = new Set();

  try {
    // 1. Ana Sayfayı Çek
    console.log("📄 [NET] Ana sayfa indiriliyor...");
    const anaResponse = await axiosInstance.get(anaUrl);
    const html = anaResponse.data;
    
    toplananMetinler.push(`[ANA SAYFA METNİ]\n${metinTemizle(html)}`);
    
    const $ = cheerio.load(html);
    const parsedAnaUrl = new URL(anaUrl);

    // Görselleri Topla
    $("img").each((i, el) => {
      let src = $(el).attr("src") || $(el).attr("data-src");
      if (src) {
        try { toplananGorseller.add(new URL(src, anaUrl).href); } catch(e){}
      }
    });

    // Alt Linkleri Çıkar ve Filtrele
    $("a[href]").each((i, el) => {
      const href = $(el).attr("href").trim();
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("tel:") || href.startsWith("mailto:")) return;

      try {
        const tamUrl = new URL(href, anaUrl);
        if (tamUrl.hostname === parsedAnaUrl.hostname) {
          const eslesmeVarMi = CONFIG.altLinkAnahtarlar.some(anahtar => 
            tamUrl.pathname.toLowerCase().includes(anahtar) || $(el).text().toLowerCase().includes(anahtar)
          );
          if (eslesmeVarMi && tamUrl.href !== anaUrl) {
            taranacakLinkler.add(tamUrl.href);
          }
        }
      } catch(e) {}
    });

    tarananLinkler.add(anaUrl);

    // 2. Alt Sayfaları Derinlemesine Tara
    const kuyruk = [...taranacakLinkler].filter(l => l !== anaUrl).slice(0, CONFIG.maksimumAltLink);
    console.log(`🔗 [NET] Keşfedilen kritik alt sayfa sayısı: ${kuyruk.length}`);

    for (const altLink of kuyruk) {
      console.log(`   ➡️ Alt sayfa taranıyor: ${altLink}`);
      tarananLinkler.add(altLink);
      // Sitelere çok yüklenip ban yememek için kısa bekleme süresi
      await new Promise(r => setTimeout(r, 2000));

      try {
        const altRes = await axiosInstance.get(altLink);
        toplananMetinler.push(`[ALT SAYFA METNİ - ${altLink}]\n${metinTemizle(altRes.data)}`);
        
        const $sub = cheerio.load(altRes.data);
        $sub("img").each((i, el) => {
          let src = $sub(el).attr("src") || $sub(el).attr("data-src");
          if (src) { try { toplananGorseller.add(new URL(src, altLink).href); } catch(e){} }
        });
      } catch (err) {
        console.warn(`   ❌ Atlandı (${altLink}): ${err.message}`);
      }
    }

    // 3. Verileri Birleştir ve Yapay Zekaya Gönder
    const birlesikMetin = toplananMetinler.join("\n\n").slice(0, 10000);
    const aiCiktisi = await guvenliAiCagrisi(birlesikMetin, anaUrl);

    // Ortak Alanları Enjekte Et
    aiCiktisi.gorseller = [...toplananGorseller].slice(0, 25);
    aiCiktisi.kaynakUrl = anaUrl;
    aiCiktisi.taramaTarihi = new Date().toISOString();
    aiCiktisi.tarananSayfaSayisi = tarananLinkler.size;

    console.log("📊 [AI SUCCESS] Çıkarılan 3 Dilli Veri Paketi Hazır.");
    
    // Firestore Uyumlu ID Üretimi (Örn: www_avrupasb_com_tr)
    const docId = anaUrl.replace(/^https?:\/\//i, "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    
    await firestoreUpsert(CONFIG.taramaKoleksiyon, docId, aiCiktisi);
    console.log(`🔥 [DB SUCCESS] Firebase Güncellendi! ID: [${docId}]`);

  } catch (error) {
    console.error(`❌ [ERROR] ${anaUrl} taranırken kritik hata: ${error.message}`);
  }
}

/* ─────────────────────────────────────────────
   CLI ENTRY POINT
───────────────────────────────────────────── */
async function main() {
  const args = process.argv.slice(2);
  let hedefListesi = [];

  if (args.includes("--tek-sefer")) {
    hedefListesi = CONFIG.linkler;
    console.log(`🚀 [ENGINE] MediVibe Bakım Botu Başlatıldı. Sırada ${hedefListesi.length} site var.`);
  } else if (args.includes("--url")) {
    const urlIdx = args.indexOf("--url") + 1;
    if (!args[urlIdx]) {
      console.error("❌ Hata: Parametre olarak geçerli bir URL girmelisin kanka!");
      process.exit(1);
    }
    hedefListesi = [args[urlIdx]];
  } else {
    console.log("❌ Hata! Lütfen geçerli bir komutla çalıştır:");
    console.log("👉 Örnek 1: node ebot.js --tek-sefer");
    console.log("👉 Örnek 2: node ebot.js --url https://site-adi.com");
    process.exit(1);
  }

  for (let i = 0; i < hedefListesi.length; i++) {
    await siteyiKazi(hedefListesi[i]);
    if (i < hedefListesi.length - 1) {
      console.log("\n💤 [SYS] Diğer siteye geçmeden önce 5 saniye dinleniliyor...");
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  console.log("\n🏁 [ENGINE] Tüm tarama ve 3 dilli veri işleme süreçleri başarıyla tamamlandı.");
}

main();