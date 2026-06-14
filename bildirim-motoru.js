/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         MediVibe — Otomatik Bildirim Motoru v1.0             ║
 * ║  Firebase Admin SDK · FCM · node-cron · İlaç Hatırlatma      ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Kurulum:
 *   npm install firebase-admin node-cron
 *
 * Çalıştırma:
 *   node bildirim-motoru.js
 *
 * Bu motor her dakika çalışır, Firestore'daki tedavi planlarını
 * kontrol eder ve saati gelen ilaçlar için otomatik bildirim gönderir.
 */

require('dotenv').config();

'use strict';

const admin = require('firebase-admin');
const cron  = require('node-cron');
const path  = require('path');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId    : process.env.FIREBASE_PROJECT_ID,
    clientEmail  : process.env.FIREBASE_CLIENT_EMAIL,
    privateKey   : process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});


const db        = admin.firestore();
const messaging = admin.messaging();

console.log('🔥 Firebase Admin bağlandı.');
console.log('⏰ Bildirim motoru başlatıldı — her dakika kontrol edilecek.\n');

// ─────────────────────────────────────────────
//  YARDIMCI: Şu anki saati HH:MM formatında al
// ─────────────────────────────────────────────
function suankiSaat() {
  const now = new Date();
  const saat   = String(now.getHours()).padStart(2, '0');
  const dakika = String(now.getMinutes()).padStart(2, '0');
  return `${saat}:${dakika}`;
}

// ─────────────────────────────────────────────
//  YARDIMCI: Bugün bu bildirim zaten gönderildi mi?
//  (Aynı ilaç için günde 1 kez bildirim gönderir)
// ─────────────────────────────────────────────
const gonderilmisler = new Set(); // { "planId_ilacAdi_saat" }

function gonderildiMi(planId, ilacAdi, saat) {
  const bugun = new Date().toISOString().slice(0, 10); // "2026-06-08"
  const anahtar = `${bugun}_${planId}_${ilacAdi}_${saat}`;
  return gonderilmisler.has(anahtar);
}

function gonderildiIsaretle(planId, ilacAdi, saat) {
  const bugun = new Date().toISOString().slice(0, 10);
  const anahtar = `${bugun}_${planId}_${ilacAdi}_${saat}`;
  gonderilmisler.add(anahtar);
}

// ─────────────────────────────────────────────
//  ANA FONKSİYON: Tüm planları kontrol et
// ─────────────────────────────────────────────
async function ilaclarıKontrolEt() {
  const simdikiSaat = suankiSaat();
  console.log(`🔍 [${simdikiSaat}] Planlar kontrol ediliyor...`);

  try {
    const snapshot = await db.collection('tedavi_planlari').get();

    if (snapshot.empty) {
      console.log('   Kayıtlı tedavi planı bulunamadı.');
      return;
    }

    let gonderilen = 0;

    for (const doc of snapshot.docs) {
      const plan   = doc.data();
      const planId = doc.id;

      // Token yoksa bu planı atla
      if (!plan.cihazToken) continue;

      // Planın bitiş tarihi geçmişse atla (sadece gün karşılaştır, saat değil)
      if (plan.kontrolTarihi) {
        const bitisStr = plan.kontrolTarihi.slice(0, 10); // "2026-06-08"
        const bugun    = new Date().toISOString().slice(0, 10);
        if (bitisStr < bugun) continue;
      }

      // Her ilacı kontrol et
      const ilaclar = plan.ilaclar || [];
      for (const ilac of ilaclar) {
        const saatler = ilac.hatirlatmaSaatleri || [];

        for (const saat of saatler) {
          // Saat eşleşiyor mu?
          if (saat !== simdikiSaat) continue;

          // Bugün zaten gönderildi mi?
          if (gonderildiMi(planId, ilac.ilacAdi, saat)) continue;

          // ── Bildirimi Gönder ──────────────────
          const mesaj = {
            token: plan.cihazToken,
            notification: {
              title: '💊 İlaç Hatırlatması — MediVibe',
              body : `${ilac.ilacAdi} — ${ilac.sekil} almanızın zamanı geldi.`
            },
            data: {
              ilacAdi : ilac.ilacAdi,
              sekil   : ilac.sekil,
              planId  : planId,
              url     : '/takip.html'
            },
            webpush: {
              notification: {
                icon : '/logo.png',
                badge: '/badge.png',
                requireInteraction: 'true',
                tag  : `ilac-${planId}-${ilac.ilacAdi}`
              },
              fcmOptions: {
                link: '/takip.html'
              }
            }
          };

          try {
            await messaging.send(mesaj);
            gonderildiIsaretle(planId, ilac.ilacAdi, saat);
            gonderilen++;

            console.log(
              `  ✅ Bildirim gönderildi → ` +
              `Hasta: ${plan.hastaAdi || 'Bilinmiyor'} | ` +
              `İlaç: ${ilac.ilacAdi} | Saat: ${saat}`
            );

            // Firestore'a bildirim kaydı tut (opsiyonel — istatistik için)
            await db.collection('bildirim_kayitlari').add({
              planId    : planId,
              hastaAdi  : plan.hastaAdi || '',
              ilacAdi   : ilac.ilacAdi,
              gonderimSaati: simdikiSaat,
              tarih     : admin.firestore.FieldValue.serverTimestamp(),
              durum     : 'gonderildi'
            });

          } catch (fcmHata) {
            console.error(
              `  ❌ Bildirim gönderilemedi → ` +
              `Hasta: ${plan.hastaAdi} | İlaç: ${ilac.ilacAdi} | ` +
              `Hata: ${fcmHata.message}`
            );

            // Token geçersizse Firestore'dan temizle
            if (
              fcmHata.code === 'messaging/invalid-registration-token' ||
              fcmHata.code === 'messaging/registration-token-not-registered'
            ) {
              await doc.ref.update({ cihazToken: '' });
              console.warn(`  ⚠ Geçersiz token temizlendi: ${planId}`);
            }
          }
        }
      }
    }

    if (gonderilen === 0) {
      console.log('   Bu dakika gönderilecek bildirim yok.');
    } else {
      console.log(`   ${gonderilen} bildirim gönderildi.`);
    }

  } catch (err) {
    console.error('❌ Firestore okuma hatası:', err.message);
  }
}

// ─────────────────────────────────────────────
//  CRON: Her dakika çalış
// ─────────────────────────────────────────────
cron.schedule('* * * * *', ilaclarıKontrolEt, {
  timezone: 'Europe/Istanbul'
});

// Başlangıçta bir kez hemen çalıştır
ilaclarıKontrolEt();