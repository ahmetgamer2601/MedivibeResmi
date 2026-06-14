"""
MediVibe Hotel Scraper v3.0
- Stealth mod
- 3 dilli kayıt (TR / EN / DE) — garantili
- Gece 02:00 otomatik, 3 günde bir
- Sadeleştirilmiş prompt → JSON parse garantisi
"""

import os, time, random, itertools, json, re, logging, schedule, threading
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
import google.generativeai as genai

# ── LOGGING ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("scraper.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)
load_dotenv()

# ── GEMİNİ KEY ROTASYON ──────────────────────────────────────
GEMINI_ANAHTARLAR = [v for k, v in sorted(os.environ.items()) if k.startswith("GEMINI_KEY_") and v]
assert GEMINI_ANAHTARLAR, "HATA: .env dosyasına GEMINI_KEY_1=... ekle"
api_key_rotator = itertools.cycle(GEMINI_ANAHTARLAR)

# ── OTEL LİNKLERİ ────────────────────────────────────────────
OTEL_LINKLERI = [
    "https://hangovercentralhotel.com/",
    "https://www.arusotel.com.tr/",
        "https://www.dedeman.com/oteller/smart-by-dedeman-eskisehir?gad_source=1&gad_campaignid=23428432974&gbraid=0AAAAAqxfzqkoLlSiFP9fIHDNe42POZ2U-&gclid=Cj0KCQjw3K7RBhDJARIsAKRtP5QlWBR64kssAe6zjcLp87jLxxJXDrv0HopnK1NUmh2wxiPlGQXYzukaAugZEALw_wcB",
    "https://dedepark.com/",
    "https://www.grandeartehotels.com/",
]

# ── FİREBASE ─────────────────────────────────────────────────
if not firebase_admin._apps:
    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": os.environ.get("FIREBASE_PROJECT_ID"),
        "private_key": os.environ.get("FIREBASE_PRIVATE_KEY").replace("\\n", "\n"),
        "client_email": os.environ.get("FIREBASE_CLIENT_EMAIL"),
        "token_uri": "https://oauth2.googleapis.com/token"
    })
    firebase_admin.initialize_app(cred)
db = firestore.client()


# ── STEALTH ──────────────────────────────────────────────────
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
]
VIEWPORTS = [{"width": 1920, "height": 1080}, {"width": 1440, "height": 900}, {"width": 1366, "height": 768}]

def bekle(a=1.5, b=4.0):
    time.sleep(random.uniform(a, b))

def scroll(page):
    try:
        yukseklik = page.evaluate("document.body.scrollHeight")
        pos = 0
        while pos < yukseklik:
            pos += random.randint(250, 500)
            page.evaluate(f"window.scrollTo(0,{pos})")
            time.sleep(random.uniform(0.1, 0.3))
    except Exception:
        pass

def gorsel_url(src, base_url):
    if not src or src.startswith("data:"):
        return None
    filtreler = ["1x1", "pixel", "tracking", "favicon", ".ico", "analytics"]
    if any(f in src.lower() for f in filtreler):
        return None
    if src.startswith("http"):
        return src
    b = urlparse(base_url)
    if src.startswith("//"):
        return f"{b.scheme}:{src}"
    if src.startswith("/"):
        return f"{b.scheme}://{b.netloc}{src}"
    return f"{b.scheme}://{b.netloc}/{src}"

# ── TARAMA ───────────────────────────────────────────────────
def otel_tara(url):
    log.info(f"🕸️  Taranıyor → {url}")
    metinler, gorseller = [], set()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled", "--disable-infobars"],
        )
        ctx = browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport=random.choice(VIEWPORTS),
            locale="tr-TR",
            timezone_id="Europe/Istanbul",
            extra_http_headers={
                "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "DNT": "1",
            },
        )
        ctx.add_init_script("""
            Object.defineProperty(navigator,'webdriver',{get:()=>undefined});
            Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3,4,5]});
            window.chrome={runtime:{}};
        """)
        page = ctx.new_page()
        page.set_default_timeout(35000)

        try:
            bekle(0.5, 1.5)
            page.goto(url, wait_until="domcontentloaded")
            bekle(2, 3.5)
            scroll(page)
            metinler.append(f"[ANA SAYFA]\n{page.locator('body').inner_text()}")

            for img in page.locator("img").all():
                src = img.get_attribute("src") or img.get_attribute("data-src") or img.get_attribute("data-lazy-src")
                u = gorsel_url(src, url)
                if u:
                    gorseller.add(u)

            # Alt sayfa tespiti
            anahtar = ["about","hakkimizda","contact","iletisim","room","oda","gallery","galeri",
                       "spa","restaurant","restoran","facilities","olanaklar","suite","konaklama","accommodation"]
            alt_linkler = set()
            base_netloc = urlparse(url).netloc
            for a in page.locator("a").all():
                href = a.get_attribute("href")
                if not href or href.startswith(("#","mailto:","tel:")):
                    continue
                if any(k in href.lower() for k in anahtar):
                    if href.startswith("http"):
                        if base_netloc in urlparse(href).netloc:
                            alt_linkler.add(href)
                    elif href.startswith("/"):
                        b = urlparse(url)
                        alt_linkler.add(f"{b.scheme}://{b.netloc}{href}")

            for alt_url in list(alt_linkler)[:5]:
                try:
                    bekle(1.5, 3)
                    log.info(f"   ➡️  {alt_url}")
                    page.goto(alt_url, wait_until="domcontentloaded")
                    bekle(1, 2.5)
                    scroll(page)
                    metinler.append(f"[ALT SAYFA - {alt_url}]\n{page.locator('body').inner_text()}")
                    for img in page.locator("img").all():
                        src = img.get_attribute("src") or img.get_attribute("data-src")
                        u = gorsel_url(src, url)
                        if u:
                            gorseller.add(u)
                except Exception as e:
                    log.warning(f"   ⚠️  Alt sayfa atlandı: {e}")

        except Exception as e:
            log.error(f"❌ Tarama hatası ({url}): {e}")
        finally:
            browser.close()

    return "\n\n".join(metinler)[:12000], [g for g in list(gorseller)[:50] if len(g) < 500]


# ── GEMİNİ ANALİZ ────────────────────────────────────────────
PROMPT_SABLONU = """
Aşağıdaki otel web sitesi verisini analiz et. YALNIZCA geçerli JSON döndür.
Başında veya sonunda kesinlikle hiçbir açıklama, yorum veya markdown işareti (``` gibi) olmayacak.
Tüm metin alanlarını Türkçe (tr), İngilizce (en) ve Almanca (de) olarak doldur.
Bilinmeyen sayısal değerler için null, bilinmeyen metinler için null kullan.

Kaynak URL: {url}
Web Sitesi Verisi:
{metin}

Döndüreceğin JSON yapısı tam olarak şu şekilde olmalı:
{{
  "otel_adi": "...",
  "otel_adi_en": "...",
  "otel_adi_de": "...",
  "iletisim": {{
    "telefon": null,
    "email": null,
    "website": "{url}"
  }},
  "adres": {{
    "tam_adres": null,
    "tam_adres_en": null,
    "tam_adres_de": null,
    "sehir": "Eskişehir",
    "sehir_en": "Eskisehir",
    "sehir_de": "Eskisehir",
    "ilce": null,
    "posta_kodu": null,
    "ulke": "Türkiye",
    "ulke_en": "Turkey",
    "ulke_de": "Türkei"
  }},
  "konum": {{
    "enlem": 39.7767,
    "boylam": 30.5206
  }},
  "genel_bilgi": {{
    "yildiz": null,
    "aciklama": "Oteli tanıtan Türkçe 2-3 cümle.",
    "aciklama_en": "2-3 sentences describing the hotel in English.",
    "aciklama_de": "2-3 Sätze zur Beschreibung des Hotels auf Deutsch.",
    "kategori": "Otel",
    "kategori_en": "Hotel",
    "kategori_de": "Hotel",
    "check_in": null,
    "check_out": null,
    "evcil_hayvan": false,
    "sigara": false
  }},
  "fiyat": {{
    "min_fiyat": null,
    "max_fiyat": null,
    "para_birimi": "TRY"
  }},
  "oda_tipleri": [
    {{
      "ad": "Standart Oda",
      "ad_en": "Standard Room",
      "ad_de": "Standardzimmer",
      "aciklama": null,
      "aciklama_en": null,
      "aciklama_de": null,
      "kapasite": 2,
      "yatak_tipi": null,
      "metrekare": null
    }}
  ],
  "olanaklar": [],
  "olanaklar_en": [],
  "olanaklar_de": [],
  "seo": {{
    "slug": "otel-adi-eskisehir",
    "meta_aciklama": "Eskişehir'de konaklama.",
    "meta_aciklama_en": "Accommodation in Eskisehir.",
    "meta_aciklama_de": "Unterkunft in Eskisehir."
  }}
}}
"""

def json_temizle(metin):
    """Gemini'nin döndürdüğü metinden JSON'u güvenli şekilde çıkar."""
    metin = metin.strip()
    # Fence temizle
    metin = re.sub(r"^```(?:json)?\s*", "", metin)
    metin = re.sub(r"\s*```\s*$", "", metin)
    metin = metin.strip()
    # JSON bloğunu bul (ilk { ile son } arasını al)
    bas = metin.find("{")
    son = metin.rfind("}")
    if bas != -1 and son != -1:
        metin = metin[bas:son+1]
    return metin

def analiz_ve_kayit(ham_metin, url, gorseller):
    current_key = next(api_key_rotator)
    genai.configure(api_key=current_key)

    prompt = PROMPT_SABLONU.format(url=url, metin=ham_metin)

    for deneme in range(3):  # 3 deneme hakkı
        try:
            log.info(f"🤖 Gemini analizi (deneme {deneme+1})...")
            model = genai.GenerativeModel("gemini-2.5-flash")
            yanit = model.generate_content(prompt)
            yanit_temiz = json_temizle(yanit.text)

            otel_veri = json.loads(yanit_temiz)

            # 3 dil kontrolü — zorunlu alanlar var mı?
            zorunlu = ["otel_adi", "otel_adi_en", "otel_adi_de", "olanaklar", "olanaklar_en", "olanaklar_de"]
            eksik = [a for a in zorunlu if a not in otel_veri]
            if eksik:
                log.warning(f"  ⚠️  Eksik alanlar: {eksik}, tekrar deneniyor...")
                continue

            # Metadata
            otel_veri["gorseller"] = gorseller
            otel_veri["kaynak_url"] = url
            otel_veri["tarama_tarihi"] = firestore.SERVER_TIMESTAMP
            otel_veri["aktif"] = True
            if gorseller:
                otel_veri.setdefault("medya", {})
                otel_veri["medya"]["ana_gorsel"] = gorseller[0]
                otel_veri["medya"]["tum_gorseller"] = gorseller
                otel_veri["medya"]["gorsel_sayisi"] = len(gorseller)

            # Firestore ID
            doc_id = re.sub(r"[^a-zA-Z0-9]", "_", urlparse(url).netloc.replace("www.", "")).lower()
            doc_id = re.sub(r"_+", "_", doc_id).strip("_")

            doc_ref = db.collection("oteller").document(doc_id)
            if doc_ref.get().exists:
                doc_ref.set(otel_veri, merge=True)
                log.info(f"  🔄 Güncellendi → {doc_id}")
            else:
                doc_ref.set(otel_veri)
                log.info(f"  ✅ Yeni kayıt → {doc_id}")

            # Kayıt doğrulama logu
            log.info(f"  🌍 TR: {otel_veri.get('otel_adi')} | EN: {otel_veri.get('otel_adi_en')} | DE: {otel_veri.get('otel_adi_de')}")
            return True

        except json.JSONDecodeError as e:
            log.error(f"  ❌ JSON parse hatası (deneme {deneme+1}): {e}")
            log.debug(f"  Ham yanıt başı: {yanit_temiz[:300] if 'yanit_temiz' in locals() else 'YOK'}")
            bekle(2, 4)
        except Exception as e:
            log.error(f"  ❌ Genel hata (deneme {deneme+1}): {e}")
            bekle(2, 4)

    log.error(f"  💀 3 denemede de başarısız: {url}")
    return False


# ── ANA DÖNGÜ ────────────────────────────────────────────────
def tam_tarama_yap():
    log.info("\n" + "="*65)
    log.info("🚀 MediVibe Hotel Scraper v3.0 — Başlıyor")
    log.info("="*65)
    basarili = basarisiz = 0

    for i, url in enumerate(OTEL_LINKLERI, 1):
        log.info(f"\n[{i}/{len(OTEL_LINKLERI)}] {'─'*45}")
        log.info(f"🏨 {url}")
        try:
            ham, gorseller = otel_tara(url)
            if ham:
                if analiz_ve_kayit(ham, url, gorseller):
                    basarili += 1
                else:
                    basarisiz += 1
            else:
                log.warning("  ⚠️  İçerik alınamadı.")
                basarisiz += 1
        except KeyboardInterrupt:
            log.info("⛔ Durduruldu.")
            break
        except Exception as e:
            log.error(f"💥 Kritik hata ({url}): {e}")
            basarisiz += 1

        if i < len(OTEL_LINKLERI):
            sure = random.uniform(8, 18)
            log.info(f"   ⏱️  {sure:.1f}s bekleniyor...")
            time.sleep(sure)

    log.info(f"\n🏁 Bitti → Başarılı: {basarili} | Başarısız: {basarisiz}")
    log.info("="*65)


# ── ZAMANLAYICI ──────────────────────────────────────────────
def zamanlayici_baslat():
    son_tarama_dosyasi = ".son_tarama"

    def kontrol():
        simdi = time.time()
        son = 0
        if os.path.exists(son_tarama_dosyasi):
            try:
                son = float(open(son_tarama_dosyasi).read().strip())
            except Exception:
                pass
        gun_farki = (simdi - son) / 86400
        if gun_farki >= 3:
            log.info(f"⏰ {gun_farki:.1f} gün geçti, tarama başlatılıyor...")
            tam_tarama_yap()
            open(son_tarama_dosyasi, "w").write(str(simdi))
        else:
            log.info(f"⏳ {gun_farki:.1f} gün geçti, henüz erken. ({3-gun_farki:.1f} gün kaldı)")

    schedule.every().day.at("02:00").do(kontrol)
    log.info("⏰ Zamanlayıcı aktif → Her gece 02:00 kontrol, 3 günde bir tarama")
    while True:
        schedule.run_pending()
        time.sleep(60)


# ── GİRİŞ NOKTASI ────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    if "--simdi" in sys.argv:
        log.info("🔧 Manuel mod: Hemen başlıyor...")
        tam_tarama_yap()
    else:
        log.info("🕐 Zamanlayıcı mod (gece 02:00, 3 günde bir)")
        log.info("   Hemen çalıştırmak için: python hotel_scraper.py --simdi")
        t = threading.Thread(target=zamanlayici_baslat, daemon=True)
        t.start()
        t.join()