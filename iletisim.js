import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Kendi Firebase Bilgilerin
const firebaseConfig = {
  apiKey: "AIzaSyD-mksVUYTyFLfRb1O0TBZoHVjkWAeSjwQ",
  authDomain: "medivibe-resmi.firebaseapp.com",
  projectId: "medivibe-resmi",
  storageBucket: "medivibe-resmi.firebasestorage.app",
  messagingSenderId: "486046453284",
  appId: "1:486046453284:web:efb5c976322e3f6bf512b1",
  measurementId: "G-9WMY2W05DJ"
};

// Uygulamayı Başlat
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Form Elementleri
const form = document.getElementById("iletisimFormu");
const gonderButonu = document.getElementById("gonderButonu");
const butonMetni = document.getElementById("butonMetni");
const butonLoader = document.getElementById("butonLoader");
const basariMesaji = document.getElementById("basariMesaji");

form.addEventListener("submit", async (e) => {
  e.preventDefault(); // Sayfanın yenilenmesini durdur

  // Form Verilerini Al
  const adSoyad = document.getElementById("adsoyad").value;
  const email = document.getElementById("email").value;
  const telefon = document.getElementById("telefon").value;
  const konu = document.getElementById("konu").value;
  const mesaj = document.getElementById("mesaj").value;

  // 1. Butonu Yükleniyor Durumuna Al
  gonderButonu.disabled = true;
  butonMetni.innerText = "Gönderiliyor...";
  butonLoader.classList.remove("hidden");

  try {
    // 2. Verileri Firebase "mesajlar" koleksiyonuna ekle
    await addDoc(collection(db, "mesajlar"), {
      adSoyad: adSoyad,
      email: email,
      telefon: telefon,
      konu: konu,
      mesaj: mesaj,
      okunduMu: false, // İlerde admin panelinde işine yarayacak
      tarih: serverTimestamp() // Sunucu saatini damgala
    });

    // 3. Başarılı Olursa Formu Temizle ve Uyarı Göster
    form.reset();
    basariMesaji.classList.remove("hidden");
    
    // Bildirimi 4 saniye sonra ekrandan sil
    setTimeout(() => {
      basariMesaji.classList.add("hidden");
    }, 4000);

  } catch (error) {
    console.error("Mesaj gönderilirken hata oluştu:", error);
    alert("Bir sorun oluştu. Lütfen tekrar deneyin.");
  } finally {
    // 4. Hata olsa da olmasa da butonu eski haline getir
    gonderButonu.disabled = false;
    butonMetni.innerText = "Mesajı Gönder";
    butonLoader.classList.add("hidden");
  }
});