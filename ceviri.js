const fileInput = document.getElementById('file-input');
const uploadArea = document.getElementById('upload-area');
const loadingArea = document.getElementById('loading-area');
const resultArea = document.getElementById('result-area');
const originalTextEl = document.getElementById('original-text');
const translatedTextEl = document.getElementById('translated-text');
const dilSecici = document.getElementById('hedef-dil');

let globalOkunanMetin = ""; // Metni hafızada tutmak için global değişken

// 1. FOTOĞRAF YÜKLENDİĞİNDE
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadArea.classList.add('hidden');
    loadingArea.classList.remove('hidden');
    loadingArea.classList.add('flex');

    try {
        // Tesseract ile Görseli Oku (Türkçe ve İngilizce karakter desteğiyle)
        const worker = await Tesseract.createWorker('tur+eng');
        const ret = await worker.recognize(file);
        globalOkunanMetin = ret.data.text.trim();
        await worker.terminate();

        if (!globalOkunanMetin) {
            alert("Görselde okunabilir bir yazı bulunamadı. Lütfen daha net bir fotoğraf çekin.");
            sifirla();
            return;
        }

        originalTextEl.innerText = globalOkunanMetin;

        // Okuma bittikten sonra çeviri fonksiyonunu çağır (Seçili olan dile göre)
        await metniCevir(globalOkunanMetin, dilSecici.value);

        // Sonuç ekranını göster
        loadingArea.classList.remove('flex');
        loadingArea.classList.add('hidden');
        resultArea.classList.remove('hidden');

    } catch (error) {
        console.error("OCR Hatası:", error);
        alert("Görsel okunurken bir hata oluştu.");
        sifirla();
    }
});

// 2. KULLANICI DİL DEĞİŞTİRDİĞİNDE ANINDA YENİDEN ÇEVİR
dilSecici.addEventListener('change', async (e) => {
    if (globalOkunanMetin) {
        translatedTextEl.innerText = "Çevriliyor..."; // Küçük bir yükleme hissi
        await metniCevir(globalOkunanMetin, e.target.value);
    }
});

// 3. ÇEVİRİ API FONKSİYONU
async function metniCevir(metin, hedefDil) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${hedefDil}&dt=t&q=${encodeURIComponent(metin)}`;
        const response = await fetch(url);
        const data = await response.json();
        
        let translatedText = "";
        data[0].forEach(item => {
            translatedText += item[0] + " ";
        });

        translatedTextEl.innerText = translatedText.trim();
    } catch (error) {
        console.error("Çeviri Hatası:", error);
        translatedTextEl.innerText = "Çeviri sırasında bir hata oluştu. Lütfen bağlantınızı kontrol edin.";
    }
}

// 4. ARAYÜZÜ SIFIRLAMA
function sifirla() {
    fileInput.value = "";
    globalOkunanMetin = "";
    uploadArea.classList.remove('hidden');
    loadingArea.classList.add('hidden');
    loadingArea.classList.remove('flex');
    resultArea.classList.add('hidden');
}

// 5. SESLİ OKUMA (Seçilen Dile Göre Okur)
document.getElementById('btn-sesli-oku').addEventListener('click', () => {
    const metin = translatedTextEl.innerText;
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(metin);
        // Hangi dil seçiliyse o aksanda okumasını sağlar (Örn: 'en', 'ar', 'ru')
        utterance.lang = dilSecici.value; 
        window.speechSynthesis.speak(utterance);
    } else {
        alert("Tarayıcınız sesli okuma özelliğini desteklemiyor.");
    }
});

// 6. KOPYALA
document.getElementById('btn-kopyala').addEventListener('click', () => {
    navigator.clipboard.writeText(translatedTextEl.innerText);
    const btn = document.getElementById('btn-kopyala');
    btn.innerHTML = "✓ Kopyalandı";
    setTimeout(() => { btn.innerHTML = "📋 Kopyala"; }, 2000);
});

// 7. PDF KAYDET / YAZDIR
document.getElementById('btn-pdf-indir').addEventListener('click', () => {
    window.print();
});