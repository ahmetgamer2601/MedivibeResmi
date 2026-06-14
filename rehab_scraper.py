"""
MediVibe Rehabilitasyon Merkezi Scraper v1.0
- Stealth mod (bot tespiti engeli)
- 3 dilli kayıt (TR / EN / DE)
- Gece 01:00 otomatik, 3 günde bir
- Firestore: "rehabilitasyon_merkezleri" koleksiyonu
- Duplicate koruması (domain bazlı ID)
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
        logging.FileHandler("rehab_scraper.log", encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)
load_dotenv()

# ── GEMİNİ KEY ROTASYON ──────────────────────────────────────
GEMINI_ANAHTARLAR = [v for k, v in sorted(os.environ.items()) if k.startswith("GEMINI_KEY_") and v]
assert GEMINI_ANAHTARLAR, "HATA: .env dosyasına GEMINI_KEY_1=... ekle"
api_key_rotator = itertools.cycle(GEMINI_ANAHTARLAR)

# ── MERKEZLERİN LİNKLERİ ─────────────────────────────────────
MERKEZ_LINKLERI = [
    "https://fizyomer.com.tr/",
    # Buraya diğer merkezleri ekle:
    # "https://www.ornek-rehab.com/",
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
    
# ── STEALTH ──────────────────────────────────────────────────
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
]
VIEWPORTS = [
    {"width": 1920, "height": 1080},
    {"width": 1440, "height": 900},
    {"width": 1366, "height": 768},
]

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

def gorsel_url_duzenle(src, base_url):
    if not src or src.startswith("data:"):
        return None
    filtreler = ["1x1", "pixel", "tracking", "favicon", ".ico", "analytics",
                 "icon", "logo", "sprite", "arrow", "btn", "button"]
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
def merkez_tara(url):
    log.info(f"🕸️  Taranıyor → {url}")
    metinler, gorseller = [], set()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--disable-dev-shm-usage",
                "--disable-extensions",
            ],
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
        # Bot tespitini engelle
        ctx.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3,4,5]});
            Object.defineProperty(navigator, 'languages', {get: () => ['tr-TR','tr','en-US','en']});
            window.chrome = {runtime: {}};
        """)
        page = ctx.new_page()
        page.set_default_timeout(40000)

        try:
            bekle(0.5, 1.5)
            page.goto(url, wait_until="domcontentloaded")
            bekle(2, 4)
            scroll(page)

            # Ana sayfa metni
            ana_metin = page.locator("body").inner_text()
            metinler.append(f"[ANA SAYFA]\n{ana_metin}")

            # Görseller
            for img in page.locator("img").all():
                src = (img.get_attribute("src") or
                       img.get_attribute("data-src") or
                       img.get_attribute("data-lazy-src"))
                u = gorsel_url_duzenle(src, url)
                if u:
                    gorseller.add(u)

            # Rehabilitasyon odaklı alt sayfa anahtar kelimeleri
            anahtar = [
                "hizmet", "service", "tedavi", "treatment",
                "uzman", "doctor", "hekim", "ekip", "team",
                "iletisim", "contact", "hakkimizda", "about",
                "rehabilitasyon", "rehabilitation", "fizyoterapi", "physiotherapy",
                "terapi", "therapy", "engelli", "yasli", "elderly",
                "bakim", "care", "program", "bolum", "department",
                "teknoloji", "cihaz", "equipment", "hasta", "patient",
            ]

            alt_linkler = set()
            base_netloc = urlparse(url).netloc

            for a in page.locator("a").all():
                try:
                    href = a.get_attribute("href")
                    if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
                        continue
                    href_lower = href.lower()
                    if any(k in href_lower for k in anahtar):
                        if href.startswith("http"):
                            if base_netloc in urlparse(href).netloc:
                                alt_linkler.add(href.split("?")[0].split("#")[0])
                        elif href.startswith("/"):
                            b = urlparse(url)
                            alt_linkler.add(f"{b.scheme}://{b.netloc}{href}")
                except Exception:
                    continue

            # Alt sayfalara gir (max 6)
            for alt_url in list(alt_linkler)[:6]:
                try:
                    bekle(2, 4)
                    log.info(f"   ➡️  {alt_url}")
                    page.goto(alt_url, wait_until="domcontentloaded")
                    bekle(1.5, 3)
                    scroll(page)
                    alt_metin = page.locator("body").inner_text()
                    metinler.append(f"[ALT SAYFA - {alt_url}]\n{alt_metin}")
                    for img in page.locator("img").all():
                        src = (img.get_attribute("src") or
                               img.get_attribute("data-src"))
                        u = gorsel_url_duzenle(src, url)
                        if u:
                            gorseller.add(u)
                except Exception as e:
                    log.warning(f"   ⚠️  Alt sayfa atlandı: {e}")

        except Exception as e:
            log.error(f"❌ Tarama hatası ({url}): {e}")
        finally:
            browser.close()

    birlesik = "\n\n".join(metinler)[:14000]
    gorsel_listesi = [g for g in list(gorseller)[:40] if len(g) < 500]
    log.info(f"   📦 {len(birlesik)} karakter, {len(gorsel_listesi)} görsel")
    return birlesik, gorsel_listesi


# ── GEMİNİ PROMPT ────────────────────────────────────────────
PROMPT_SABLONU = """
Aşağıdaki rehabilitasyon/fizyoterapi merkezi web sitesi verisini analiz et.
YALNIZCA geçerli JSON döndür. Başında veya sonunda hiçbir açıklama, yorum veya markdown (``` gibi) olmayacak.
Tüm metin alanlarını Türkçe (tr), İngilizce (en) ve Almanca (de) olarak doldur.
Bilinmeyen alanlar için null kullan.

Kaynak URL: {url}
Web Sitesi Verisi:
{metin}

Döndüreceğin JSON yapısı:
{{
  "merkez_adi": null,
  "merkez_adi_en": null,
  "merkez_adi_de": null,
  "iletisim": {{
    "telefon": [],
    "email": null,
    "website": "{url}",
    "google_maps": null,
    "whatsapp": null
  }},
  "adres": {{
    "tam_adres": null,
    "tam_adres_en": null,
    "tam_adres_de": null,
    "ilce": null,
    "sehir": null,
    "posta_kodu": null,
    "ulke": "Türkiye",
    "ulke_en": "Turkey",
    "ulke_de": "Türkei"
  }},
  "konum": {{
    "enlem": null,
    "boylam": null
  }},
  "genel_bilgi": {{
    "aciklama": null,
    "aciklama_en": null,
    "aciklama_de": null,
    "kategori": "Rehabilitasyon Merkezi",
    "kategori_en": "Rehabilitation Center",
    "kategori_de": "Rehabilitationszentrum",
    "kurulis_yili": null,
    "yatak_kapasitesi": null,
    "calisma_saatleri": null,
    "calisma_saatleri_en": null,
    "calisma_saatleri_de": null,
    "saglik_turizmi_belgesi": false,
    "akreditasyon": []
  }},
  "hizmetler": {{
    "liste": [],
    "liste_en": [],
    "liste_de": [],
    "uzmanlik_alanlari": [],
    "uzmanlik_alanlari_en": [],
    "uzmanlik_alanlari_de": []
  }},
  "tedavi_yontemleri": {{
    "liste": [],
    "liste_en": [],
    "liste_de": []
  }},
  "hedef_hasta_grubu": {{
    "liste": [],
    "liste_en": [],
    "liste_de": []
  }},
  "ekip": {{
    "uzman_sayisi": null,
    "uzmanlar": []
  }},
  "cihaz_ve_teknoloji": {{
    "liste": [],
    "liste_en": [],
    "liste_de": []
  }},
  "fiyat": {{
    "seans_ucreti": null,
    "para_birimi": "TRY",
    "sgk_anlasma": false,
    "ozel_sigorta": false
  }},
  "seo": {{
    "slug": null,
    "meta_aciklama": null,
    "meta_aciklama_en": null,
    "meta_aciklama_de": null,
    "anahtar_kelimeler": [],
    "anahtar_kelimeler_en": [],
    "anahtar_kelimeler_de": []
  }}
}}
"""

def json_temizle(metin):
    metin = metin.strip()
    metin = re.sub(r"^```(?:json)?\s*", "", metin)
    metin = re.sub(r"\s*```\s*$", "", metin)
    metin = metin.strip()
    bas = metin.find("{")
    son = metin.rfind("}")
    if bas != -1 and son != -1:
        metin = metin[bas:son+1]
    return metin


# ── ANALİZ VE KAYIT ──────────────────────────────────────────
def analiz_ve_kayit(ham_metin, url, gorseller):
    current_key = next(api_key_rotator)
    genai.configure(api_key=current_key)

    prompt = PROMPT_SABLONU.format(url=url, metin=ham_metin)

    for deneme in range(3):
        try:
            log.info(f"🤖 Gemini analizi (deneme {deneme+1})...")
            model = genai.GenerativeModel("gemini-2.5-flash")
            yanit = model.generate_content(prompt)
            yanit_temiz = json_temizle(yanit.text)
            veri = json.loads(yanit_temiz)

            # Zorunlu alan kontrolü
            zorunlu = ["merkez_adi", "merkez_adi_en", "merkez_adi_de", "hizmetler"]
            eksik = [a for a in zorunlu if a not in veri]
            if eksik:
                log.warning(f"  ⚠️  Eksik alanlar: {eksik}, tekrar deneniyor...")
                current_key = next(api_key_rotator)
                genai.configure(api_key=current_key)
                continue

            # Metadata ekle
            veri["gorseller"] = gorseller
            veri["kaynak_url"] = url
            veri["tarama_tarihi"] = firestore.SERVER_TIMESTAMP
            veri["aktif"] = True

            if gorseller:
                veri.setdefault("medya", {})
                veri["medya"]["ana_gorsel"] = gorseller[0]
                veri["medya"]["tum_gorseller"] = gorseller
                veri["medya"]["gorsel_sayisi"] = len(gorseller)

            # Domain bazlı benzersiz ID
            doc_id = re.sub(r"[^a-zA-Z0-9]", "_",
                           urlparse(url).netloc.replace("www.", "")).lower()
            doc_id = re.sub(r"_+", "_", doc_id).strip("_")

            # Firestore'a yaz (merge=True → değişen alanları güncelle, diğerlerini koru)
            doc_ref = db.collection("rehabilitasyon_merkezleri").document(doc_id)
            if doc_ref.get().exists:
                doc_ref.set(veri, merge=True)
                log.info(f"  🔄 Güncellendi → {doc_id}")
            else:
                doc_ref.set(veri)
                log.info(f"  ✅ Yeni kayıt → {doc_id}")

            log.info(f"  🌍 TR: {veri.get('merkez_adi')} | EN: {veri.get('merkez_adi_en')} | DE: {veri.get('merkez_adi_de')}")
            return True

        except json.JSONDecodeError as e:
            log.error(f"  ❌ JSON hatası (deneme {deneme+1}): {e}")
            log.debug(f"  Ham yanıt: {yanit_temiz[:300] if 'yanit_temiz' in locals() else 'YOK'}")
            bekle(2, 4)
        except Exception as e:
            log.error(f"  ❌ Hata (deneme {deneme+1}): {e}")
            bekle(2, 4)

    log.error(f"  💀 3 denemede başarısız: {url}")
    return False


# ── ANA DÖNGÜ ────────────────────────────────────────────────
def tam_tarama_yap():
    log.info("\n" + "="*65)
    log.info("🏥 MediVibe Rehabilitasyon Scraper v1.0 — Başlıyor")
    log.info("="*65)
    basarili = basarisiz = 0

    for i, url in enumerate(MERKEZ_LINKLERI, 1):
        log.info(f"\n[{i}/{len(MERKEZ_LINKLERI)}] {'─'*45}")
        log.info(f"🏥 {url}")
        try:
            ham, gorseller = merkez_tara(url)
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

        if i < len(MERKEZ_LINKLERI):
            sure = random.uniform(10, 20)
            log.info(f"   ⏱️  {sure:.1f}s bekleniyor...")
            time.sleep(sure)

    log.info(f"\n🏁 Bitti → Başarılı: {basarili} | Başarısız: {basarisiz}")
    log.info("="*65)


# ── ZAMANLAYICI (3 günde bir, gece 01:00) ────────────────────
def zamanlayici_baslat():
    son_tarama_dosyasi = ".son_rehab_tarama"

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
            kalan = 3 - gun_farki
            log.info(f"⏳ Henüz erken. Sonraki taramaya {kalan:.1f} gün kaldı.")

    schedule.every().day.at("01:00").do(kontrol)
    log.info("⏰ Zamanlayıcı aktif → Her gece 01:00 kontrol, 3 günde bir tarama")
    log.info("   Hemen çalıştırmak için: python rehab_scraper.py --simdi")
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
        log.info("🕐 Zamanlayıcı mod — Gece 01:00, 3 günde bir")
        t = threading.Thread(target=zamanlayici_baslat, daemon=True)
        t.start()
        t.join()