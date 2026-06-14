require('dotenv').config();

/**
 * MediVibe Core Crawler
 * AI-Driven Multi-Language Data Extraction & Firebase Upsert Engine
 */

'use strict';
const puppeteer = require('puppeteer');
const axios     = require('axios');
const cron      = require('node-cron');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, serverTimestamp } = require('firebase/firestore');

// ─────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────
const CONFIG = {
  geminiAnahtarlar: [
  process.env.GEMINI_KEY_1,
  process.env.GEMINI_KEY_2,
  process.env.GEMINI_KEY_3,
  process.env.GEMINI_KEY_4,
  process.env.GEMINI_KEY_5,
  process.env.GEMINI_KEY_6,
  process.env.GEMINI_KEY_7,
],
  
  geminiModel: "gemini-2.5-flash",

 firebase: {
  apiKey           : process.env.FIREBASE_API_KEY,
  authDomain       : process.env.FIREBASE_AUTH_DOMAIN,
  projectId        : process.env.FIREBASE_PROJECT_ID,
  storageBucket    : process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId            : process.env.FIREBASE_APP_ID,
  measurementId    : process.env.FIREBASE_MEASUREMENT_ID
},

  koleksiyon  : "tesisler",
  cronZamani  : "0 3 * * *",
  zamanDilimi : "Europe/Istanbul",

  crawler: {
    maxAltSayfa      : 3,
    requestTimeoutMs : 60000, 
  },

  altSayfaAnahtarlar: [
    "fiyat", "price", "tarife", "oda", "room", "suite",
    "iletisim", "contact", "rezervasyon", "booking",
    "hizmet", "service", "tedavi", "treatment", "spa", "hakkimizda", "termal"
  ],

  linkler: [
   "https://www.orucoglu.com/",
   "https://www.korelthermal.com/?gad_source=1&gad_campaignid=21275995124&gbraid=0AAAAAqicXYC3CPwrzqtv-QSsgi97ncj9W&gclid=Cj0KCQjw3K7RBhDJARIsAKRtP5RHOUWGI0B-qG2qMlKcwu65Z1JeQXXQEhGiD0gGISvwnX97nvYIGqoaAhXmEALw_wcB",
   "https://www.pamthermal.com/?gad_source=1&gad_campaignid=21901023769&gbraid=0AAAAAo2SeQUrlGDLceS4yxwq4Iy_63H-F&gclid=Cj0KCQjw3K7RBhDJARIsAKRtP5TqI-s2vKi1N1uy4X94SfjQ1yrnIeJK16tmQOCOziSGgLavqL3ZMUsaArPhEALw_wcB",
   "https://www.dogathermalhotel.com/?gad_source=1&gad_campaignid=19482537784&gbraid=0AAAAApDeQkgmQC_UyNfYQh_jbkkR83Ouq&gclid=Cj0KCQjw3K7RBhDJARIsAKRtP5TS6Z58QbLL2P0poevXe_e5cY4KQKsQHelt7GGfKJr2AXhCM4T0LQYaAvp1EALw_wcB",
   "https://www.camhotel.com.tr/tr/?gad_source=1&gad_campaignid=22828417099&gbraid=0AAAAADKeJckmB2Of4D2mIef08kQwH1zte&gclid=Cj0KCQjw3K7RBhDJARIsAKRtP5TU8ocF0OywfqUw0T9ULSjkOyUiHfIDUFLeDG1wz7UTKb-TWA9zSbQaAk_JEALw_wcB",
   "https://limakthermal.com/?gad_source=1&gad_campaignid=22741818897&gbraid=0AAAABAbfzfkz8mBacwrMC2ESxeAyFiXUj&gclid=Cj0KCQjw3K7RBhDJARIsAKRtP5Tigs2Pls3LC-W2C_pPC-CfDELLDHnWQYq3lg6KRSSp7qDHNzglDMAaApRYEALw_wcB",
   "https://www.tasigoeskisehir.com/",
   "https://www.istanbulmedikaltermal.com/?gad_source=1&gad_campaignid=22010188934&gbraid=0AAAAA-nZlyCuRapt_Z10G8VTIjgyXcUyH&gclid=Cj0KCQjw3K7RBhDJARIsAKRtP5T8Wajhu5bgiBHNUi6ieljve2DjeyClP0_yQsHQKiED6v3ghpA3Xk0aAjSCEALw_wcB",
   "https://formtermalotel.com/",
   "https://www.venushotels.com.tr/?gad_source=1&gad_campaignid=23872980428&gbraid=0AAAABDsgyIMzK9SkG8Pt5Bbwkz-ruj5KT&gclid=Cj0KCQjw3K7RBhDJARIsAKRtP5TACJqxd2DqHBLgbw2s_8AujsUqev4arIYzlYIbTfeRaUCbLbGdWycaAkPZEALw_wcB",
   "https://www.ikbalthermal.com/?gad_source=1&gad_campaignid=15851233644&gbraid=0AAAAAoX031W2GSJWQj-huRcy6sun-7bVr&gclid=Cj0KCQjw3K7RBhDJARIsAKRtP5TM0oHDPNrUId6VD0MeWnp0hHyM9hTij71xshmSU0E1vAO-sGwWbgAaAvpiEALw_wcB",
   "https://www.kangal.gov.tr/kangal-balikli-kaplica"
  ]
};

const firebaseApp = initializeApp(CONFIG.firebase);
const db = getFirestore(firebaseApp);
console.log('🔥 DB Connection Active.');

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function delay(minMs = 3000, maxMs = 6000) {
  const time = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(r => setTimeout(r, time));
}

// ─────────────────────────────────────────────
// ENGINE: PUPPETEER
// ─────────────────────────────────────────────
async function initBrowser() {
  return await puppeteer.launch({
    headless: 'new',
    executablePath: '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ]
  });
}

async function setupPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Connection': 'keep-alive',
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  await page.setViewport({ width: 1920, height: 1080 });
  return page;
}

async function scrapePageData(browser, url) {
  const page = await setupPage(browser);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.crawler.requestTimeoutMs });
    
    const textContent = await page.evaluate(() => {
      document.querySelectorAll('script, style, noscript, iframe, nav, footer, header').forEach(el => el.remove());
      return (document.body.innerText || '').replace(/\s+/g, ' ').trim();
    });

    const images = await page.evaluate((baseUrl) => {
      return Array.from(document.querySelectorAll('img[src], img[data-src]')).map(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (!src) return null;
        try { return new URL(src, baseUrl).href; } catch { return null; }
      }).filter(Boolean);
    }, url);

    const host = new URL(url).hostname;
    const subLinks = await page.evaluate((keywords, targetHost) => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const validLinks = new Set();
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
        try {
          const fullUrl = new URL(href, document.baseURI).href;
          if (new URL(fullUrl).hostname === targetHost && keywords.some(kw => (href + ' ' + (a.textContent || '')).toLowerCase().includes(kw))) {
            validLinks.add(fullUrl);
          }
        } catch { continue; }
      }
      return [...validLinks];
    }, CONFIG.altSayfaAnahtarlar, host);

    return { text: textContent.slice(0, 8000), images: [...new Set(images)].slice(0, 40), links: subLinks.slice(0, CONFIG.crawler.maxAltSayfa) };
  } finally {
    await page.close();
  }
}

// ─────────────────────────────────────────────
// ENGINE: AI PROCESSOR & KEY ROTATION
// ─────────────────────────────────────────────
const keyManager = { activeIdx: 0, blocked: new Set() };

function getActiveKey() {
  for (let i = 0; i < CONFIG.geminiAnahtarlar.length; i++) {
    const idx = (keyManager.activeIdx + i) % CONFIG.geminiAnahtarlar.length;
    if (!keyManager.blocked.has(idx)) {
      keyManager.activeIdx = idx;
      return { key: CONFIG.geminiAnahtarlar[idx], idx };
    }
  }
  return null;
}

function blockKey(idx) {
  keyManager.blocked.add(idx);
  setTimeout(() => { keyManager.blocked.delete(idx); console.log(`[SYS] Key #${idx + 1} restored.`); }, 65000);
}

// ARTIK GEMINI DOĞRUDAN 3 DİLDE JSON VERİYOR
async function parseWithAI(text, url, keyIdx) {
  const payload = `Sen uluslararası sağlık turizmi veritabanı için çalışan profesyonel bir veri çıkarım botusun.
Aşağıdaki tesis sayfasından kritik bilgileri Türkçe, İngilizce ve Almanca olarak çıkar. 
Verilen metinden anlam çıkarımı yap ve ilgili dillerdeki alanları eksiksiz, profesyonelce doldur/çevir.

URL: ${url}
Metin: "${text}"

Kurallar:
- Sadece geçerli, saf JSON döndür. Markdown veya ek metin kullanma.
- Tesisin yıldız sayısı (örn: "5 Yıldızlı") geçiyorsa belirt, yoksa "Bulunmadı" yaz.
- Şifalı suyun/kaplıcanın hangi hastalıklara (romatizma, sedef vb.) iyi geldiğini detaylıca dizi halinde yaz.
- "odalar", "odalar_en" ve "odalar_de" içindeki Fiyat/Bilgi kısımlarında para birimlerine veya ifadelere dokunma, sadece oda türlerini ilgili dile çevir.

Şablon:
{
  "tesisAdi": "Türkçe İsim",
  "tesisAdi_en": "English Name",
  "tesisAdi_de": "Deutscher Name",
  "yildizSayisi": "string veya Bulunmadı",
  "telefon": ["numara1", "numara2"],
  "adres": "Türkçe Adres veya Bulunmadı",
  "adres_en": "English Address or Not Found",
  "adres_de": "Deutsche Adresse oder Nicht Gefunden",
  "sehir": "string (Örn: Afyonkarahisar)",
  "email": "string veya Bulunmadı",
  "odalar": {"Standart Oda": "Fiyat veya Bilgi"},
  "odalar_en": {"Standard Room": "Fiyat veya Bilgi"},
  "odalar_de": {"Standardzimmer": "Fiyat veya Bilgi"},
  "iyiGelenHastaliklar": ["romatizma", "sedef"],
  "iyiGelenHastaliklar_en": ["rheumatism", "psoriasis"],
  "iyiGelenHastaliklar_de": ["Rheuma", "Schuppenflechte"],
  "ozellikler": ["spa", "kapalı havuz"],
  "ozellikler_en": ["spa", "indoor pool"],
  "ozellikler_de": ["Spa", "Hallenbad"],
  "aciklama": "Kısa Türkçe açıklama",
  "aciklama_en": "Short English description",
  "aciklama_de": "Kurze deutsche Beschreibung"
}`;

  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${CONFIG.geminiAnahtarlar[keyIdx]}`,
    { contents: [{ parts: [{ text: payload }] }] },
    { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
  );

  let raw = res.data.candidates[0].content.parts[0].text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(raw); } catch { return { _raw: raw }; }
}

async function processDataSafe(text, url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = getActiveKey();
    if (!current) {
      console.warn(`[SYS] Rate limit hit on all keys. Awaiting reset (65s)...`);
      await delay(65000, 65000);
      continue;
    }
    try {
      console.log(`[AI] Processing with Key #${current.idx + 1}...`);
      console.log(`[AI] Gemini'den yanıt bekleniyor (Timeout: 60sn)...`);
      return await parseWithAI(text, url, current.idx);
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.warn(`[AI] Key #${current.idx + 1} exhausted. Rotating...`);
        blockKey(current.idx);
        keyManager.activeIdx = (current.idx + 1) % CONFIG.geminiAnahtarlar.length;
      } else { throw err; }
    }
  }
  return { _error: 'AI Processing Failed' };
}

// ─────────────────────────────────────────────
// CORE WORKFLOW
// ─────────────────────────────────────────────
async function upsertRecord(data) {
  const col = collection(db, CONFIG.koleksiyon);
  const q = query(col, where('kaynakUrl', '==', data.kaynakUrl));
  const snap = await getDocs(q);

  if (snap.empty) {
    data.olusturmaTarihi = serverTimestamp();
    data.guncellenmeTarihi = serverTimestamp();
    const ref = await addDoc(col, data);
    console.log(`[DB] Created: ${ref.id}`);
  } else {
    data.guncellenmeTarihi = serverTimestamp();
    await updateDoc(snap.docs[0].ref, data);
    console.log(`[DB] Updated: ${snap.docs[0].id}`);
  }
}

async function scanFacility(targetUrl) {
  console.log(`\n--- Target: ${targetUrl} ---`);
  let browser = null;

  try {
    browser = await initBrowser();
    const allText = [];
    const allImages = [];
    const visited = new Set();

    console.log('[Net] Fetching root...');
    const rootData = await scrapePageData(browser, targetUrl);
    visited.add(targetUrl);
    allText.push(`[ROOT]\n${rootData.text}`);
    allImages.push(...rootData.images);

    const queue = rootData.links.filter(l => !visited.has(l));
    console.log(`[Net] Found ${queue.length} deep links.`);

    for (let i = 0; i < queue.length; i++) {
      visited.add(queue[i]);
      console.log(`[Net] Fetching sub: ${queue[i]}`);
      await delay(2000, 4000);
      try {
        const subData = await scrapePageData(browser, queue[i]);
        allText.push(`[SUB]\n${subData.text}`);
        allImages.push(...subData.images);
      } catch (e) {
        console.warn(`[Net] Skipped ${queue[i]}`);
      }
    }

    const payloadText = allText.join('\n\n').replace(/\s+/g, ' ').trim().slice(0, 8000);
    const finalData = await processDataSafe(payloadText, targetUrl);
    
    finalData.gorseller = [...new Set(allImages)].slice(0, 40);
    finalData.kaynakUrl = targetUrl;
    finalData.taramaTarihi = new Date().toISOString();
    
    return finalData;
  } catch(e) {
    console.error(`[Error] Target Failed: ${e.message}`);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

async function runQueue() {
  console.log(`\n=== Engine Started | Queue: ${CONFIG.linkler.length} ===`);
  for (let i = 0; i < CONFIG.linkler.length; i++) {
    const data = await scanFacility(CONFIG.linkler[i]);
    if (data) await upsertRecord(data);
    if (i < CONFIG.linkler.length - 1) await delay(4000, 8000);
  }
  console.log('=== Engine Halted ===\n');
}

// ─────────────────────────────────────────────
// CLI ENTRY
// ─────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--url') && args[args.indexOf('--url') + 1]) {
  scanFacility(args[args.indexOf('--url') + 1]).then(d => { if(d) upsertRecord(d); process.exit(0); });
} else if (args.includes('--tek-sefer')) {
  runQueue().then(() => process.exit(0));
} else if (args.includes('--simdi')) {
  runQueue().then(() => cron.schedule(CONFIG.cronZamani, runQueue, { timezone: CONFIG.zamanDilimi }));
} else {
  console.log(`[Sys] Cron Standby: ${CONFIG.cronZamani}`);
  cron.schedule(CONFIG.cronZamani, runQueue, { timezone: CONFIG.zamanDilimi });
}