# rn-story-kit — Tasarım Dokümanı

Tarih: 2026-11-17
Durum: Taslak (onay bekliyor)

## 1. Amaç ve Neden

React Native uygulamalarına Instagram kalitesinde story deneyimi ekleyen, sıfırdan yazılmış, bağımsız bir kütüphane. Hedef "çalışıyor" değil, "Instagram'dan ayırt edilemeyecek kadar akıcı" bir his. Kütüphane npm'de yayınlanacak kalitede olacak: tam TypeScript, testli, dokümanlı, örnek uygulamalı.

Proje başka hiçbir story kütüphanesinden kod, API veya yapı almaz. Davranış kararlarında belirsizlik olursa kaynak kullanıcıdır.

## 2. Hedefler

- 60/120 fps animasyonlar; tüm jest ve animasyon mantığı UI thread'inde (Reanimated worklet).
- Instagram'daki etkileşimlerin tamamı (bkz. §5).
- Okundu bilgisi: story bazında, kalıcı, sunucuyla senkronlanabilir.
- Tema ile değişen halka renk paletleri + medyadan türetilen arka plan gradient'i.
- Medya yüklenmeden önce düşük kaliteli bulanık önizleme, yumuşak geçiş.
- Header, footer, içerik katmanı gibi parçalar tüketici tarafından değiştirilebilir.

## 3. Hedef Olmayanlar

- Story oluşturma/düzenleme (kamera, sticker, metin ekleme).
- Sunucu, backend, CDN veya upload altyapısı.
- Thumbhash üretimi (tüketicinin sunucusu üretir; kütüphane sadece tüketir).
- Web desteği (ilk sürümde).
- Eski Mimari (Old Architecture) ve RN < 0.76 desteği.

## 4. Anti-hedefler (teknik olarak çalışsa bile başarısızlık sayılır)

- Herhangi bir geçişte gözle görülür takılma (JS thread'e bağlı animasyon).
- Medya yüklenirken siyah/boş ekran.
- Video tamponlanırken progress bar'ın ilerlemeye devam etmesi.
- Basılı tutma ile dokunma veya sürükleme ile dokunmanın karışması.
- Tüketiciyi ağır, zorunlu bir native bağımlılığa (ör. Skia) mahkûm etmek.

## 5. Etkileşim Davranışları

### 5.1 Story içinde gezinme (dokunma)
- Ekranın sağ ~%70'ine dokunma: aynı kullanıcının sonraki story'si. Kullanıcının son story'sindeyse sonraki kullanıcıya geçilir (küp geçişiyle). Son kullanıcının son story'sindeyse görüntüleyici kapanır (`onClose`).
- Sol ~%30'a dokunma: önceki story. Kullanıcının ilk story'sindeyse önceki kullanıcının **son görüntülenen / son** story'sine geçilir. İlk kullanıcının ilk story'sindeyse story baştan başlar.
- Oranlar config ile değiştirilebilir.

### 5.2 Kullanıcılar arası geçiş (sürükleme)
- Birden fazla kullanıcının story'si varsa yatay sürükleme ile önceki/sonraki kullanıcıya geçilir.
- Sürükleme parmağı takip eder (interaktif küp dönüşü). Bırakıldığında mesafe veya hız eşiği aşılmışsa geçişi tamamlar, aşılmamışsa yay (spring) animasyonuyla geri döner.
- Yön: sonraki kullanıcı sağda, önceki kullanıcı solda durur. Parmak sola çekilince sağdaki (sonraki) kullanıcı gelir, sağa çekilince soldaki (önceki) kullanıcı gelir — Instagram ile aynı.
- Önceki kullanıcının story'lerinin hepsi okunmuş olsa bile sürüklemeyle ona tekrar gidilebilir; bu durumda ilk story'sinden başlar.
- Yatay sürükleme görüntüleyiciyi asla kapatmaz. İlk kullanıcıda önceki yönüne, son kullanıcıda sonraki yönüne sürükleme rubber-band direnciyle sınırlanır ve bırakınca yerine geri yaylanır. Kapatmanın tek jesti aşağı çekmedir (§5.3).
- Sürükleme başladığı anda aktif story duraklar; geçiş tamamlanınca yeni kullanıcının story'si başlar, iptal edilirse kaldığı yerden devam eder.

### 5.3 Diğer jestler
- Basılı tutma: story duraklar, header/footer/progress bar solarak gizlenir. Bırakınca devam eder ve UI geri gelir.
- Aşağı çekme: görüntüleyici parmağı takip ederek küçülür ve arka plan solar; eşik aşılırsa kapanır, aşılmazsa geri yerine oturur.
- Yukarı çekme: `onSwipeUp` callback'i (ör. link açma, yanıt alanı). Varsayılan davranış yok.

### 5.4 Açılış / kapanış
- Story balonundan açılışta görüntüleyici balonun konumundan büyüyerek tam ekrana gelir; kapanışta, o anki kullanıcının balonuna geri küçülür (balonun konumu ölçülebiliyorsa; ölçülemiyorsa ekran ortasına solarak kapanır).

### 5.5 Medya ve zamanlama
- Fotoğraf: varsayılan süre 5 sn (story bazında override edilebilir).
- Video: süre videonun kendi süresidir; tamponlama sırasında progress bar durur.
- Uygulama arka plana geçince veya görüntüleyici ekranda değilken story duraklar.
- Sıradaki story ve sonraki kullanıcının ilk story'si önceden yüklenir.

## 6. Okundu Bilgisi

- Birim: story ID'si. Bir story, gösterimi başladığı anda (medya yüklenip ilk kare görüldüğünde) "görüldü" sayılır.
- Kullanıcı halkası: o kullanıcının tüm story'leri görüldüyse gri, en az bir okunmamış varsa renkli.
- Görüntüleyici açıldığında bir kullanıcının ilk okunmamış story'sinden başlanır (hepsi okunduysa ilkinden).
- Halka okunmuşa geçerken renkten griye animasyonla döner (görüntüleyici kapandıktan sonra görünür olan halkalar için).
- Liste sıralaması: okunmamış story'si olan kullanıcılar başa (opsiyonel, `sortUnseenFirst`, varsayılan açık).
- Kalıcılık: `SeenStorage` adaptör arayüzü (`get`, `set`, `getAll` — senkron veya async). Hazır adaptörler: bellek içi (varsayılan), MMKV, AsyncStorage. MMKV/AsyncStorage opsiyonel peer dependency'dir; kullanılmıyorsa kurulmak zorunda değildir.
- Sunucu senkronu: `onSeen(storyId, userId)` callback'i. Tüketici başlangıçta sunucudan gelen okunmuş listesini (`initialSeen`) verebilir; story verisinde `seen: true` alanı da kabul edilir.

## 7. Renkler ve Tema

### 7.1 Halka paletleri
- Okunmamış halka: çok duraklı (multi-stop) açısal/çizgisel gradient (react-native-svg).
- Okunmuş halka: tek renk (varsayılan gri).
- Hazır paletler (ör. klasik Instagram tonu, okyanus, gün batımı, monokrom) + tüketicinin kendi paleti.
- Kullanıcı bazında özel halka (ör. "yakın arkadaşlar" yeşili): story verisinde `ringVariant` veya doğrudan palet override.
- Tema `StoryThemeProvider` ile verilir; açık/koyu mod için ayrı değerler tanımlanabilir. Progress bar, header metinleri gibi diğer renkler de temadan gelir.

### 7.2 Medya arka planı
- Medya ekranı tam kaplamadığında (ör. yatay fotoğraf), arkasında medyanın baskın renklerinden üretilmiş dikey gradient gösterilir.
- Renk kaynağı öncelik sırası: (1) veride açıkça verilen `colors`, (2) `thumbhash`'ten çözülen ortalama/baskın renkler, (3) temadaki varsayılan arka plan.
- Thumbhash çözümü saf JS'tir; ek native modül gerekmez.

## 8. Yükleme Öncesi Önizleme (Thumbnail)

- Her medya öğesi `thumbhash` (önerilen, ~30 byte metin) veya `thumbnail` (düşük kaliteli görsel URL'i) alabilir.
- Medya yüklenene kadar bulanık önizleme tam ekranda gösterilir; yüklenince çapraz solma (cross-fade) ile asıl medyaya geçilir. Video için önizleme ilk kare oynayana kadar kalır.
- Hiçbiri verilmemişse arka plan gradient'i + ince yükleme göstergesi.
- Önizleme gösterilirken progress bar ilerlemez.

## 9. Yaklaşımlar

| Yaklaşım | Artı | Eksi |
|---|---|---|
| **A. Reanimated 4 + Gesture Handler + react-native-svg** (seçildi) | Tüm animasyonlar UI thread'inde; Instagram etkileşimlerinin tamamı yapılabilir; yaygın, Expo uyumlu bağımlılıklar; tüketici kendi bileşenlerini kolayca takar | New Architecture ve RN ≥ 0.76 zorunlu |
| B. Skia tabanlı render | Shader, blur, gösterişli geçişler | ~6MB ağır bağımlılık, video ile entegrasyon zor, tüketiciye Skia'yı dayatır |
| C. Native (Swift/Kotlin) | En yüksek performans tavanı | 3-4 kat maliyet; özel header/footer takmak çok zor; iki platform ayrı bakım |

**Seçim:** A. Kullanıcı Instagram tarzı bir story için önerimi sordu; A önerildi ve kabul edildi. B'nin görsel artısı bağımlılık yükünü karşılamıyor; C esnekliği öldürüyor.

## 10. Kararlaştırılan Teknik Çerçeve

- Platform: React Native ≥ 0.76, New Architecture, iOS + Android. Expo (dev build) ve bare RN desteklenir.
- Dil: TypeScript (strict).
- Animasyon/jest: `react-native-reanimated` 4, `react-native-gesture-handler` 2.
- Halka çizimi: `react-native-svg`.
- Görsel: `expo-image` (thumbhash placeholder ve cross-fade desteği nedeniyle). *(Builder kararı olarak değiştirilebilir; gerekçe yazılmalı.)*
- Video: `react-native-video` v6 veya `expo-video` — builder seçer, seçimi ve gerekçesini dokümana ekler. Seçilen kütüphane tamponlama olayları ve önceden yükleme sağlamalı.
- Paket adı / klasör: `rn-story-kit`, `~/Documents/GitHub/rn-story-kit` (geçici ad; yayın öncesi değişebilir).
- Repo yapısı: kütüphane + `example/` uygulaması (tüm özellikleri gösteren demo).

## 11. Builder'a Bırakılanlar

- Bileşen/hook mimarisi ve public API'nin tam şekli (bileşen adları, prop'lar). Kısıt: tek kullanıcı ve çoklu kullanıcı senaryoları desteklenmeli; header, footer, içerik katmanı, progress bar render prop/bileşen olarak değiştirilebilmeli; imperative ref ile (next, prev, pause, resume, close, goToUser) kontrol edilebilmeli.
- Animasyon eğrileri, spring parametreleri, eşik değerleri (makul varsayılanlar + config).
- Build aracı (ör. react-native-builder-bob), test altyapısı, lint, CI, release akışı.
- Önceden yükleme stratejisinin ayrıntıları ve bellek sınırları.

## 12. Builder Check Sonrası Verilen Kararlar (Claude'un kararı — kullanıcı düzeltebilir)

- **Katman:** Görüntüleyici RN `Modal` içinde değil, uygulama köküne konan `StoryProvider` altındaki tam ekran overlay'de render edilir. Neden: büyüme/küçülme animasyonu ve Gesture Handler Android'de Modal içinde sorunlu.
- **Okundu kuralı:** Story, aktif story olarak ilk karesi ekranda göründüğü anda görüldü sayılır. Kısmen izlenmiş veya duraklatılmış story de görüldü sayılır. Küp sürüklemesi sırasında yan kullanıcının önizlemesi görüldü saymaz. `onSeen` her story için yalnızca bir kez tetiklenir; geri dönüp tekrar izlemek yeniden tetiklemez.
- **Veri ve ölçek:** Veri bellekte dizi olarak verilir. Aynı anda en fazla 3 kullanıcı sayfası (önceki, aktif, sonraki) mount edilir. Daha fazla kullanıcı yüklemek için `onEndReached` callback'i olur. Hedef ölçek: yüzlerce kullanıcı, kullanıcı başına ~50 story.
- **Video oynatıcı sınırı:** Aynı anda en fazla 2 canlı oynatıcı olur (aktif + önceden yüklenen). Küp geçişinde yan kullanıcı videosu thumbhash/ilk kare ile gösterilir, geçiş tamamlanınca oynatılır.
- **Performans hedefi:** Orta segment Android (ör. 4 yıllık cihaz) ve iPhone'da geçişlerde düşen kare olmaması. `example` içinde bir performans ekranı olur; jest ve animasyon kodu JS thread'e dokunmaz.
- **Sürümler:** Reanimated 4 (`react-native-worklets` ile), Expo SDK 54+ / RN 0.76+ tabanı. Expo Go desteklenmez, dev build gerekir.

## 13. Kullanıcı Kararları (builder check sonrası)

- **Story balon listesi kütüphaneyle gelir.** `StoryList` (yatay kayan kullanıcı balonları, okundu/okunmadı halkası, `sortUnseenFirst`, halka renk animasyonu) kütüphanenin parçasıdır. Balonlar kendi konumlarını userId ile bir kayıt defterine bildirir; görüntüleyici açılış/kapanış animasyonu için bu konumu kullanır. Tüketici kendi liste UI'ını kullanmak isterse `StoryRing` bileşeni ayrı olarak da dışa aktarılır ve `open(userId, rect?)` ile görüntüleyici açılabilir.
- **Kapanma iki yolla olur:** aşağı çekme ve header'daki her zaman görünür X (kapat) butonu. Yatay sürükleme her zaman kullanıcılar arası gezinmedir (§5.2). X butonu varsayılan header'da sağ üsttedir; dokunma alanı en az 44x44 pt'dir ve dokunuşu sol/sağ gezinme alanına sızmaz. Basılı tutma sırasında UI gizlenince X de gizlenir. Tüketici header'ı değiştirirse kapatma `close()` (props/ref) ile yapılır. Kapanış animasyonu aşağı çekmeyle aynıdır (balona küçülme).
