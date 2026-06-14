// firebase-messaging-sw.js
// Service Worker — Firebase Cloud Messaging (Arka Plan Bildirimleri)
//
// ÖNEMLİ: Bu dosya sitenin ROOT klasöründe olmalı (/firebase-messaging-sw.js)
// Alt klasörde olursa SW kapsam dışında kalır ve bildirimler çalışmaz.

importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// ─── Firebase Yapılandırması ───────────────────────────────────────────────
firebase.initializeApp({
  apiKey            : "AIzaSyD-mksVUYTyFLfRb1O0TBZoHVjkWAeSjwQ",
  authDomain        : "medivibe-resmi.firebaseapp.com",
  projectId         : "medivibe-resmi",
  storageBucket     : "medivibe-resmi.firebasestorage.app",
  messagingSenderId : "486046453284",
  appId             : "1:486046453284:web:efb5c976322e3f6bf512b1",
  measurementId     : "G-9WMY2W05DJ"
});

const messaging = firebase.messaging();

// ─── Arka Planda Gelen Bildirimleri Yakala ────────────────────────────────
// Tarayıcı sekmesi kapalı veya arka plandayken bu fonksiyon devreye girer.
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Arka plan mesajı alındı:', payload);

  const baslik  = payload.notification?.title  ?? 'MediVibe Hatırlatma';
  const govde   = payload.notification?.body   ?? 'İlaç saatiniz geldi!';
  const ikon    = payload.notification?.icon   ?? '/logo.png';

  // data payload'dan ekstra veri okuma (opsiyonel)
  const ilacAdi = payload.data?.ilacAdi ?? '';
  const tamGovde = ilacAdi ? `💊 ${ilacAdi} — ${govde}` : govde;

  self.registration.showNotification(baslik, {
    body : tamGovde,
    icon : ikon,
    badge: '/badge.png',       // Mobil bildirim rozeti (opsiyonel)
    tag  : 'medivibe-hatirlatma', // Aynı tag birden fazla bildirim yığılmasını önler
    requireInteraction: true,  // Kullanıcı kapatana kadar bildirim kalır
    data : payload.data ?? {}  // Bildirime tıklanınca kullanmak için
  });
});

// ─── Bildirime Tıklanınca Sayfayı Aç ─────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const hedefUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((pencereler) => {
        // Zaten açık sekme varsa ona odaklan
        for (const pencere of pencereler) {
          if (pencere.url.includes(hedefUrl) && 'focus' in pencere) {
            return pencere.focus();
          }
        }
        // Yoksa yeni sekme aç
        if (clients.openWindow) {
          return clients.openWindow(hedefUrl);
        }
      })
  );
});

// ─── SW Güncelleme Stratejisi (Local Geliştirme İçin) ────────────────────
// SW kurulunca hemen aktif hale geçer, eski SW'yi beklemez.
// Geliştirme ortamında sayfayı yenilediğinde eski SW takılı kalmaz.
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
