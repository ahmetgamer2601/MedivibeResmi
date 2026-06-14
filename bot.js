

require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const admin = require('firebase-admin');
const cron = require('node-cron');
const fs = require('fs');

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId  : process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey : process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

// 🕒 ANTİ-BAN KALKANI
const rastgeleGecikme = () => {
  const sure = Math.floor(Math.random() * 3000) + 2000; 
  return new Promise(resolve => setTimeout(resolve, sure));
};

// 📝 LOG SİSTEMİ
const logTut = (mesaj) => {
  const tarih = new Date().toLocaleString('tr-TR');
  const logMetni = `[${tarih}] - ${mesaj}\n`;
  fs.appendFileSync('medivibe-rapor.txt', logMetni, 'utf8'); 
  console.log(mesaj);
};

// ⚙️ HASTANE AYAR MERKEZİ
const HASTANE_AYARLARI = [
  {
    kategoriAdi: "GURLIFE HASTANESİ",
    url: "https://gurlife.com.tr/doktorlarimiz.php",
    isimSelec: "h3",
    sayfali: false // Tek sayfalık site
  },
  {
    kategoriAdi: "ÖZEL ÜMİT HASTANESİ",
    url: "https://umithastanesi.com.tr/doctors",
    isimSelec: ".doctor-card h4", 
    sayfali: true // 📄 Bu hastanede sayfalama var! Bot otomatik ?page=1, 2, 3 gezecek.
  },
  
  {
    kategoriAdi: "ÖZEL ESKİŞEHİR ANADOLU HASTANESİ",
    url: "https://ozelanadoluhastanesi.com/tr/doktorlarimiz?lang=tr",
    isimSelec: ".doctor-name, h3", // Hem isim class'ını hem de başlıkları hedefliyoruz
    sayfali: true 
  },
  {
    kategoriAdi: "ACIBADEM ESKİŞEHİR HASTANESİ",
    url: "https://www.acibadem.com.tr/hastaneler/eskisehir-hastanesi/doktorlarimiz/",
    isimSelec: ".doctor-item .name, .doctor-card h4", // Acıbadem'in yapısı için iki farklı aday
    sayfali: true 
  }
];

// 🕵️‍♂️ SAYFALAMA DESTEKLİ EVRENSEL TARAMA MOTORU
async function tekHastaneTara(hastane) {
  let doktorlarHavuzu = [];
  let sayfa = 1;
  let devamEt = true;
  const karaListe = ['menü', 'yönetim', 'giriş', 'linkler', 'takip', 'bizi', 'iletişim', 'kurumsal', 'e-randevu', 'e-sonuç', 'anasayfa', 'bize ulaşın', 'sosyal', 'oops', 'bulunamadı', 'hata', 'detay', 'incele', 'profil', 'özgeçmiş', 'randevu', 'tıkla', 'gör', 'daha', 'fazla', 'bilgi'];

  // Branş temizleme fonksiyonu
  const bransTemizle = (metin, $, element) => {
    let temiz = metin
      .replace(/\b(profesör|doçent|operatör|uzman|doktor|prof|doç|op|dr|uzm)\b\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const gecersizMi = karaListe.some(kelime => temiz.toLowerCase().includes(kelime));
    if (gecersizMi || temiz.length < 3 || temiz.length > 50) {
      return null;
    }
    return temiz;
  };

  logTut(`🚀 ${hastane.kategoriAdi} tarama görevi başlatıldı...`);

  // Sayfaları tek tek gezmek için döngü başlatıyoruz
  while (devamEt) {
    let gecerliUrl = hastane.url;
    
    // Eğer hastane sayfalıysa URL'in sonuna sayfa parametresini ekle
    if (hastane.sayfali) {
      gecerliUrl += gecerliUrl.includes('?') ? `&page=${sayfa}` : `?page=${sayfa}`;
      logTut(`🔎 Sayfa ${sayfa} taranıyor: ${gecerliUrl}`);
    }

    try {
      await rastgeleGecikme(); 
      const { data } = await axios.get(gecerliUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        timeout: 15000 
      });

      const $ = cheerio.load(data);
      let buSayfadaBulunanDoktorSayisi = 0;

      // 1. ADIM: Klasik Seçici Yöntemi
      if (hastane.isimSelec) {
        $(hastane.isimSelec).each((index, element) => {
          if ($(element).closest('footer, nav, .menu, #header').length > 0) return;
          
          const isim = $(element).text().trim();
          const isimGecersiz = karaListe.some(kelime => isim.toLowerCase().includes(kelime));

          if (isim && isim.length > 3 && isim.length < 50 && !isimGecersiz) {
            // Eğer bu doktoru daha önce eklemediysek işleme al
            if (!doktorlarHavuzu.some(d => d.isim === isim)) {
              let kartMetni = $(element).parent().text().replace(isim, '');
              let brans = bransTemizle(kartMetni, $, element);
              
              if (!brans) {
                brans = bransTemizle($(element).next().text(), $, element) || bransTemizle($(element).closest('.doctor-card, .card, div').find('[class*="brans"], [class*="dep"], [class*="title"], p, span').text(), $, element);
              }

              if (!brans) brans = "Uzman Doktor";

              const doktorId = isim.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');
              doktorlarHavuzu.push({ id: doktorId, isim: isim, brans: brans });
              buSayfadaBulunanDoktorSayisi++;
            }
          }
        });
      }

      // 2. ADIM: Akıllı Yedek Plan (Seçici o sayfada hiçbir şey bulamazsa devreye girer)
      if (buSayfadaBulunanDoktorSayisi === 0) {
        $('h1, h2, h3, h4, h5, h6, div, p, span, strong, a').each((index, element) => {
          if ($(element).closest('footer, nav, .menu, #header, script, style').length > 0) return;

          let hamMetin = $(element).text().trim();
          
          if (/\b(dr\.|uzm\.|prof\.|doç\.|op\.)/i.test(hamMetin) && hamMetin.length > 5 && hamMetin.length < 60) {
            if (karaListe.some(kelime => hamMetin.toLowerCase().includes(kelime))) return;

            let temizIsim = hamMetin.replace(/\s+/g, ' ').trim();
            
            if (!doktorlarHavuzu.some(d => d.isim === temizIsim)) {
              let bransAdayi = $(element).parent().find('[class*="brans"], [class*="dep"], [class*="title"], p, span').not(element).text();
              let brans = bransTemizle(bransAdayi, $, element) || bransTemizle($(element).next().text(), $, element);
              
              if (!brans || brans === temizIsim) brans = "Uzman Hekim";

              const doktorId = temizIsim.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');
              doktorlarHavuzu.push({ id: doktorId, isim: temizIsim, brans: brans });
              buSayfadaBulunanDoktorSayisi++;
            }
          }
        });
      }

      logTut(`📄 Sayfa ${sayfa} tamamlandı. Bu sayfadan ${buSayfadaBulunanDoktorSayisi} yeni doktor eklendi.`);

      // DÖNGÜ KONTROLÜ:
      // Eğer hastane sayfalı değilse VEYA bu sayfada hiç yeni doktor bulamadıysak döngüyü kır.
      if (!hastane.sayfali || buSayfadaBulunanDoktorSayisi === 0 || sayfa >= 20) {
        devamEt = false;
      } else {
        sayfa++; // Bir sonraki sayfaya geç
      }

    } catch (error) {
      logTut(`❌ HATA: ${hastane.kategoriAdi} Sayfa ${sayfa} çekilirken sorun çıktı: ${error.message}`);
      devamEt = false; // Hata durumunda döngüyü durdur
    }
  }

  logTut(`✅ BİTTİ: ${hastane.kategoriAdi} toplam ${doktorlarHavuzu.length} doktor ile tamamlandı.`);
  return { kategori: hastane.kategoriAdi, veri: doktorlarHavuzu };
}

// 🚀 ANA YÖNETİM MOTORU
async function anaMotoruCalistir() {
  logTut("\n============================================================");
  logTut("🚀 MEDIVIBE PAGINATION (SAYFALAMA) DESTEKLİ MOTOR BAŞLADI...");
  
  const tumGorevler = HASTANE_AYARLARI.map(hastane => tekHastaneTara(hastane));
  const sonuclar = await Promise.all(tumGorevler);

  for (const sonuc of sonuclar) {
    // Veri varsa işleme başla
    if (sonuc.veri && sonuc.veri.length > 0) {
      try {
        // merge: true ile mevcut verilerin (yatak sayısı, adres gibi) silinmesini engelliyoruz
        await db.collection('hastaneler').doc(sonuc.kategori).set({
          hastaneAdi: sonuc.kategori,
          guncellemeTarihi: admin.firestore.FieldValue.serverTimestamp(),
          doktorlar: sonuc.veri
        }, { merge: true });

        logTut(`✅ BAŞARILI: ${sonuc.kategori} veritabanına senkronize edildi.`);
      } catch (dbError) {
        logTut(`❌ HATA: ${sonuc.kategori} güncellenemedi. Detay: ${dbError.message}`);
      }
    } else {
      logTut(`⚠️ UYARI: ${sonuc.kategori} için veri bulunamadı, atlanıyor.`);
    }
  }

  // İşlem sonu raporu
  logTut("🏁 İŞLEM TAMAMLANDI: Tüm taramalar ve senkronizasyonlar bitirildi.");
  logTut("============================================================\n");


process.exit(0); 
}

// ⏰ CRON JOB (Her gece 03:00)
cron.schedule('0 3 * * *', () => {
  anaMotoruCalistir();
});

// Anında çalıştır
anaMotoruCalistir();