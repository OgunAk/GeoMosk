# Geliştirici kontrol noktaları

Bu dosyaya yalnızca gerçekleşen kayıt yazılır. Geliştirici adına görüş, süre veya test sonucu yazılmaz. Yanıt yoksa durum `geliştirici incelemesi bekliyor`.

| # | Kontrol noktası | Zaman | Karar/bulgu | Geliştiricinin gerekçesi/geri bildirimi | İlgili değişiklik | Test sonucu | Durum |
|---|---|---|---|---|---|---|---|
| 1 | Kapsam/mimari | Faz 0 sonu | Bursa ilçeleri + sağlık tesisleri senaryosu; katmanlı monolit | Master prompt §22'de "geliştirici tarafından onaylanmıştır" kaydı var; bu oturumda ayrıca soru sorulmadı | docs/DECISIONS.md ADR-0002 | — | önceden onaylı (master prompt §22) |
| 2 | Ürün ve kod | Faz 4 sonu (2026-11-04) | Geliştirici uygulamayı denedi. İki iyileştirme istendi; kendi yapacağı değişikliği seçti: "Ad en az 3 karakter" | Bkz. "Geliştirici geri bildirimi (2026-11-04)" | Geri bildirim 1-2 uygulandı. Seçilen değişikliği geliştirici 2026-11-05'te AI'ya bıraktı; AI uyguladı | — | tamamlandı (G3 AI tarafından, geliştirici isteğiyle) |
| 3 | Son kabul | Faz 8 sonu (rehber 2026-11-05) | Manuel demo, teknik açıklama, teslim kapsamı. Otomatik kanıtlar aşağıdaki demo tablosunda | — | Faz 8 (a501f90), PR #6 birleştirildi | Otomatik: backend 141/141, Vitest 62/62, E2E 22/22, `validate-project --full` exit 0. Manuel: — | geliştirici incelemesi bekliyor |

## Kontrol noktası 2 — deneme rehberi (geliştirici dolduracak)

**Denenecek akış:** katman aç/kapa ve altlık değişimi; bir tesise tıklayıp yerel açıklama verme; arama ("nilufer", "devlet hastanesi");
Nokta, Çizgi ve Alan çizip kaydetme; çizimin adını ve geometrisini düzenleme; silme; sayfayı yenileyip kalıcılığı görme.

**Geri bildirim için sorular:** Panel düzeni ve bilgi önceliği anlaşılır mı? Türkçe metinler doğal mı? Çizim ipuçları yeterli mi?
Demo akışında eksik/fazla bir şey var mı?

**Geliştiricinin bizzat yapacağı küçük değişiklik (birini seçin):**
1. Kullanıcı çizimi adına en az 3 karakter kuralı: `UserFeatureRequestParser.ReadName` ve ilgili API testi (400 durumu) + `CreateFeatureForm` ipucu.
2. Arama sonuç sınırını 50'den farklı bir değere taşıyıp yapılandırılabilir yapmak: `SEARCH_LIMIT` (frontend) + `SearchPanel.test.tsx`.
3. Yeni bir tesis türü filtresi kısayolu (ör. "yalnız hastaneler" düğmesi): `SearchPanel.tsx` + bir Vitest testi.

AI desteği açıklama/inceleme ile sınırlı kalır; değişikliği geliştirici yazar. Gerçekleşince bu bölüm ve tablo satırı gerçek kayıtla güncellenir.

### Geliştirici geri bildirimi (2026-11-04, sohbetten aynen)
> "çizgi ve alan seçimi yaparken sonlandırmak için başlangıç noktasına dokunmak yerine daha basit bir bitiriş olmalı, alanda istenen şekli vermek zorlaşıyor, sağlık tesisleride kendi içinde filtrelensin, harici devam et"

Seçilen küçük değişiklik: **1. Kullanıcı çizimi adına en az 3 karakter kuralı** (geliştirici yapacak).

| # | Geri bildirim | Yorum / karşılık | Durum |
|---|---|---|---|
| G1 | Çizgi/alan bitirmek için başlangıç noktasına dokunmak zor | "Çizimi bitir" düğmesi + Enter tuşu (Terra Draw'ın bitirme tuşu tuvale gönderilir); alan otomatik kapanır; ipucu metni güncellendi. Kanıt: `DrawingToolbar.test.tsx` (3), E2E çizgi Enter ile 3 köşe, alan düğmeyle 3 köşe + kapanış | uygulandı (AI), geliştirici yeniden denemesi bekliyor |
| G2 | Sağlık tesisleri kendi içinde (türe göre) filtrelensin | Lejanttaki 6 tür, sayılarıyla haritada aç/kapa anahtarı oldu; vurgu/seçim halkalarına da uygulanır, altlık değişiminde korunur, tesis katmanı kapalıyken devre dışı. Kanıt: `LayerPanel.test.tsx` (+2), E2E "tesis türü filtresi…" | uygulandı (AI), geliştirici yeniden denemesi bekliyor |
| G3 | Seçilen değişiklik: ad en az 3 karakter | Geliştirici 2026-11-05'te "değişikliği sana bırakıyorum" dedi; AI uyguladı: `ReadName` (kırpılmış ad, grafem sayısı ≥ 3, 400), `UserFeatureApiTests` (+3 durum: "ab", "  ab  ", PATCH " x " kaydı değiştirmez; "  Çağ  " kabul), `CreateFeatureForm` ipucu + `aria-invalid`, `UserFeaturePanel` düzenleme mesajı; Vitest +1. Mevcut kısa adlı kayıtlar korunur; kural yalnız yeni ad yazılırken uygulanır | uygulandı |

## Kontrol noktası 3 — son kabul rehberi (geliştirici dolduracak)

Otomatik doğrulamalar ve teslim paketi hazır (DELIVERY-CHECKLIST, PROGRESS Faz 8). Aşağıdakiler geliştirici yapmadan "kabul edildi"
veya "manuel test geçti" yazılmaz.

1. **Manuel demo:** README "Demo senaryosu" 10 adımı kendi makinenizde (`docker compose up --build -d` + import) deneyin.
   Her adım için çalıştı/çalışmadı ve gözleminizi aşağıdaki tabloya yazın.
2. **Teknik sahiplik:** aşağıdaki soruları kendi sözlerinizle yanıtlayın; ilgili koda bakarak gösterin.
3. **Teslim kapsamı:** bilinen kısıtları (README) kabul ediyor musunuz; PR #5 birleştirme, depo erişimi ve lisans kararınız.
4. **İsteğe bağlı (§20.1):** G3'ü AI uyguladığı için, bizzat yapacağınız küçük bir değişiklik (ör. arama sonuç sınırını
   yapılandırılabilir yapmak: `SearchPanel.tsx` + `SearchPanel.test.tsx`, ya da "yalnız hastaneler" kısayolu).

"Otomatik kanıt" sütunu AI'nin çalıştırdığı testlerdir (2026-11-05, temiz kurulumun üretim imajı + yerel); geliştiricinin manuel
denemesi yerine geçmez. "Geliştirici sonucu" ve "Geliştirici notu" sütunlarını yalnız geliştirici doldurur.
Adımlar README'nin 2026-11-08 sadeleştirmesinden önceki 10 adımlık demo senaryosudur (yeni README'de 6 adımda birleştirildi).

| # | Demo adımı (README) | Otomatik kanıt (AI) | Geliştirici sonucu | Geliştirici notu |
|---|---|---|---|---|
| 1 | Temiz kurulum + import, harita gerçek veriyle açılır | Faz 8 temiz kurulum: yeni clone, ayrı Compose projesi, import 17/911, ikinci import değişiklik yok (PROGRESS Faz 8); E2E `harita gerçek veriyle iki katmanı gösterir` | **Yapıldı** | — |
| 2 | Katman aç/kapa, altlık değişimi | E2E `katman aç/kapa ve altlık değişiminde katmanlar ve durum korunur`, `tesis türü filtresi … altlık değişiminde korunur` | **Yapıldı** | — |
| 3 | İlçe/tesise tıklama, arama, vurgu, zoom | E2E `haritada tesise tıklayınca öznitelikler yan panelde görünür`, `Türkçe aksansız arama sonucu vurgular, seçer ve objeye zoom yapar` | **Yapıldı** (ilk deneme kısmen, düzeltme sonrası yeniden denendi 2026-11-07) | İlk deneme: "zoom çift tıkladıkça yapılıyor, tek zoomda yakınlaşması gerek". Geliştirici seçimi: "Yalnız tesislerde yaklaşsın" → AI uyguladı (PR #14): haritada tesise tek tıklama zoom 16'ya yaklaştırır (daha yakındaysa uzaklaşmaz), ilçe tıklaması kamerayı oynatmaz; E2E `tesise tek tıklayınca harita tesise yaklaşır …`. Yeniden deneme: "yapıldı" |
| 4 | Yerel açıklama yenilemede korunur, import ezmez | E2E `yerel açıklama kaydedilir, yenilemede korunur ve geri alınır`; API testi `Source_update_keeps_local_overrides_and_marks_removed_records` | **Yapıldı** | — |
| 5 | Nokta/çizgi/alan çiz, kaydet, düzenle, sil | E2E `nokta çizilir, kaydedilir, yenilemede korunur ve onayla silinir`, `çizgi ve alan çizilir; alanın adı ve geometrisi düzenlenir` | **Yapıldı** | — |
| 6 | Alan içindekiler (Nilüfer) | E2E `ilçe içindeki tesisler, aynı politikadaki API filtresiyle aynı sayıyı verir` (Nilüfer 120) | **Yapıldı** | — |
| 7 | Tampon 2000 m | E2E `tesis çevresinde 2000 m tampon …`; ekran görüntüsü `faz8-tampon-2000m.png` (26 tesis) | **Yapıldı** | — |
| 8 | En yakın 5 | E2E `haritada tıklanan noktaya en yakın 5 tesis artan mesafeyle listelenir`; `faz8-en-yakin-5.png` | **Yapıldı** | — |
| 9 | Ölçüm + ilçe sayımı/choropleth | E2E `A04: ilçe alanı UTM 35N ile ölçülür …`, `A05: ilçe başına tesis sayısı tabloda ve haritada …`; `faz8-olcum-nilufer.png` (524,42 km²) | **Yapıldı** | — |
| 10 | Hata senaryosu | E2E `sunucu hatasında taslak ve form korunur …`, `altlık karo servisi erişilemezse anlaşılır uyarı …`; API testleri: kendini kesen alan 422, nokta ölçümü 422 | **Yapıldı** | — |

Manuel demo: geliştirici 2026-11-06'da README'deki 10 adımı denedi (yeni clone, `GeoMosk-demo` klasörü). `docker-compose.yml` proje adını
`name: geoscope` ile sabitlediği için demo mevcut `geoscope_geoscope-db` volume'unu kullandı; yani geliştirici boş volume'dan kurulum
yapmadı (boş volume kurulumu Faz 8'de AI tarafından ayrı proje adıyla doğrulandı). Import idempotent olduğu için veri değişmedi. Sonuçlar geliştiricinin sohbetteki yanıtından aynen aktarıldı (ekran görüntüleri: tampon, en yakın N, Nilüfer ölçümü 524,42 km²). 3. adım düzeltmeden sonra 2026-11-07'de yeniden denendi: "yapıldı".

**Teslim kapsamı kararları:**

| Karar | Seçenekler / bağlam | Geliştiricinin kararı |
|---|---|---|
| Bilinen kısıtların kabulü | README "Bilinen kısıtlar" (kuş uçuşu mesafe, klavye ile çizim yok, .NET 9 destek sonu 10 Kasım 2026 …) | **Kabul ediyorum** (geliştiricinin sohbetteki yanıtı, 2026-11-05) |
| Depo erişimi | Şu an private; herkese açık yapmak ya da değerlendiriciyi ortak çalışan eklemek | **Herkese açık yapacak** (geliştiricinin sohbetteki yanıtı, 2026-11-05). Ayarı geliştirici değiştirecek; uzak URL açıkça erişilebilir olunca L01 doğrulanır |
| Yazılım lisansı | Yok; ör. MIT ya da lisanssız bırakmak | ~~Lisans eklenmeyecek~~ (2026-11-05). **Güncel: MIT** (2026-11-08). Geliştiricinin sohbetteki yanıtı: "public yapacağım" (MIT önerisine yanıt). `LICENSE`'ta logo, OSM verisi ve üçüncü taraf paketler hariç |
| Bizzat yapılacak küçük değişiklik (§20.1) | G3'ü AI uyguladı; isteğe bağlı yeni değişiklik (ör. arama sonuç sınırı, "yalnız hastaneler" kısayolu) | geliştirici incelemesi bekliyor |
| Proje adı değişikliği | Geliştirici 2026-11-06'da istedi: "projemizin ismi GeoMosk olarak değişecek"; kapsam olarak "Görünen ad" seçildi | **Uygulandı (AI uyguladı, geliştirici isteği)** — ADR-0017. Kod/DB adları GeoScope kaldı. Bu değişikliği AI yaptığı için §20.1'deki "bizzat yapılan değişiklik" sayılmaz |

## Teknik sahiplik soruları (master prompt §20.4)
Geliştirici 2026-11-05'te soruların AI tarafından yanıtlanmasını istedi. Aşağıdaki "AI açıklaması" sütunu **AI'nin** koda dayalı
açıklamasıdır; geliştiricinin kendi sözleriyle yanıtı değildir ve §20.4'ün "geliştirici kendi sözleriyle anlatsın" koşulunu karşılamaz.
"Geliştiricinin yanıtı" sütunu geliştirici yazana kadar `geliştirici incelemesi bekliyor` kalır.

| Soru | Nereye bakmalı | AI açıklaması (geliştirici yanıtı değildir) | Geliştiricinin yanıtı |
|---|---|---|---|
| 1. Veri neden 4326 saklanıyor; metre hesabı nerede, nasıl? | `SourceEntityConfiguration.cs:26,67`; `AnalysisService.cs:58,132` | OSM verisi, GeoJSON (RFC 7946) ve MapLibre 4326 bekler; saklamada dönüşüm yok, kayıp yok. Birim derecedir: Bursa'da 0,02° doğu-batı ≈ 1705 m, kuzey-güney ≈ 2221 m, bu yüzden 4326 sonucu metre sayılmaz. Mesafe: `geom::geography` (WGS84 sferoidi, metre; `ST_DWithin`, `ST_Distance`). Alan/uzunluk: `ST_Transform(geom, 32635)` (UTM 35N, metre) sonrası `ST_Area`/`ST_Length`/`ST_Perimeter`; geography değeri yalnız çapraz kontrol. | (2026-11-08) "1. 4326 boylam ve enlem anlamını taşıyor. OSM' bu sistemi kullanıyor. GeoJSON'da bu standartı kullanmalı. Haritada direkt bu veriyi kullanıyor. 2. Dünyanın şeklinden kaynaklı. 3. Mesafe için geography alan için UTM 35N kullanılıyor." |
| 2. `ST_SetSRID` ile `ST_Transform` farkı? | `load-osm.mjs:52,82`; `AnalysisService.cs:132` | `ST_SetSRID` koordinatlara dokunmaz, yalnız "bu sayılar şu sistemde" etiketini koyar; import'ta OSM koordinatları zaten WGS84 olduğu için doğru kullanım. `ST_Transform` koordinatları matematiksel olarak yeni sisteme hesaplar (derece → UTM metre); ölçümde bu kullanılır. Yanlış örnek: `ST_SetSRID(geom, 32635)` dereceleri metre sanır ve anlamsız sonuç verir. | (2026-11-08) "2. OSM'den gelen sayılar 4326. Bu sayılarda derece ve metre cinsinden eşit olamayacağı için çevrimi gerekli. Direkt derece cinsinden yazılsaydı yerlere göre metrelerde sapma olurdu. Bu yüzden ST_Transform kullanılarak dönüşüm gerçekleştiriliyor. ST_SetSRID ise sayıların türünü gösteriyor" |
| 3. Sınırdaki tesis seçime ve ilçe sayımına nasıl giriyor? | `AnalysisService.WithinAsync`, `DistrictStatsAsync`; `SourceFeatureQueries` (detay ilçesi) | Alan içinde (A01) varsayılan sınır dahil: `ST_Covers(alan, tesis)` sınırdakini alır; "hariç" modu `ST_Within(tesis, alan)`. İlçe sayımında (A05) her tesis tek ilçeye: kapsayan ilçeler (`ST_Covers`) içinden önce iç bölgesinde içeren (`ST_Contains`), eşitlikte küçük ilçe id'si; çoklu eşleşme ve atanamayan ayrıca raporlanır, çifte sayım yok. Tesis detayındaki ilçe adı da aynı kuralı kullanır. Gerçek veride çoklu eşleşme 0. | (2026-11-08) "3. Her tesis bir ilçeye atanıyor. Ortak iki ilçe sınırında bir tesis olabilme ihtimali olduğu için ve total tesis sayısında problem yaratacağı için her tesis bir ilçeye dahil.ST_covers sayesinde dahil oluyor fakat ST_within ile alanın içindeyse dahil oluyor." |
| 4. Nearest sıralaması neden doğru; indeks hangi sorguyu hızlandırıyor? | `NearestAsync`; ADR-0012; `scripts/sql/analysis-plans.2026-11-05.txt` | Tüm adaylar için kesin `ST_Distance(geography)` hesaplanır, `ORDER BY mesafe, id LIMIT n`: sıralama sferoid mesafesine göre, eşit mesafede id ile deterministik. 4326 `<->` (KNN) derece tabanlı olduğu için kullanılmaz. Bu tam taramadır (10.000 tesiste p50 19 ms). İndeksler: `(geom::geography)` GiST ifade indeksi `ST_DWithin`'i (tampon, nearest'te `maxDistance`) hızlandırır; `geom` GiST indeksi `ST_Covers`/`ST_Within`'i (alan içi, ilçe sayımı). EXPLAIN kaydında tampon 0,6 ms, alan 0,5 ms. | (2026-11-08) "Hesaplamalar metre olarak yapıldığı için sıralama doğru oluyor, indeksler alan içinde olan sorgulamaları hızlandırıyor, en yakın N bütün tesisleri tarıyor" |
| 5. Yeni çizim tarayıcıdan DB'ye hangi katmanlardan geçiyor? | aşağıdaki dosya zinciri | `useTerraDraw.ts` (Terra Draw çizimi, "Çizimi bitir") → `CreateFeatureForm.tsx` (ad ≥ 3, açıklama) → `services/userFeatures.ts` (POST `/api/features`, RFC 7946 Feature) → `UserFeaturesController` (ince HTTP katmanı) → `UserFeatureRequestParser` + `UserGeometryParser` (allowlist, tip, `[boylam, enlem]`, Bursa çalışma alanı, geçerlilik, ≤10.000 köşe; hata 400/422) → `UserFeatureStore` (EF Core, `user_features`) → PostGIS CHECK kısıtları (ikinci hat; ihlal 422). Yanıt 201 + `ETag` (xmin). | (2026-11-08) "kullanıcı çizim yapar, ad açıklama doldurulur, API'ye istek gönderilir, istek alınır, denetimlerden geçer, tabloya kaydedilir, problem çıkmazsa kaydedilir" |
| 6. Import neden mükerrer üretmiyor, kullanıcı düzenlemesini neden ezmiyor? | `load-osm.mjs:119-143`; `*_overrides` tabloları | Kaynak anahtarı `(source, source_object_type, source_id)` benzersiz; `INSERT … ON CONFLICT DO UPDATE` aynı kaydı günceller, yenisini eklemez. Güncelleme yalnız değer gerçekten değişmişse (`IS DISTINCT FROM`) yapılır; ikinci import 17/911 "değişmedi". Yerel ad/açıklama ayrı `district_overrides`/`facility_overrides` tablolarında; import bu tablolara hiç yazmaz. Kaynaktan kalkan kayıt silinmez, `source_deleted_at` ile işaretlenir; boş snapshot toplu işaretlemeyi engelleyen koruma var. | (2026-11-08) "her kaydın farklı id'si mevcut. Kullanıcının girdiği kayıtlar farklı tablolarda kaydediliyor. Importtan buraya bir etki yok." |
| 7. Altlık değişiminde katmanlar nasıl korunuyor? | `MapView.tsx` (`styleRevision`, `ensure*`, `enforceLayerOrder`); `useTerraDraw.ts` (`suspend`) | `setStyle` yeni stil yükler ve bizim kaynak/katmanlarımızı siler. `style.load` olayında `styleRevision` artar; ona bağlı efektler kaynakları (`upsertGeoJson`) ve katmanları (`ensure*`, idempotent) yeniden kurar, görünürlük/filtre/seçim/choropleth yeniden uygulanır, `LAYER_ORDER` sırası zorlanır. Çizim taslağı değişimden önce `suspend` ile saklanır, yeni stilde geri yüklenir. E2E testleri altlık değişiminden sonra katmanları, sırayı ve taslağı doğrular. | (2026-11-08) "Sayacımız mevcut, yeni stil girdisinde sayaca bağlı olan kod tekrar çalışıp tesisleri yüklüyor, kullanıcı girdileri uygulanıyor, çizimler saklanıyor suspend ile birlikte sonra geri geliyor." |
| 8. Bir testi bozup hatanın sebebini nasıl bulursunuz; yeni filtre nasıl eklenir? | `MeasureAndDistrictStatsApiTests.cs`; `FeatureQuery` → `SourceFeatureQueries` → `SearchPanel` | Hata ayıklama: `dotnet test backend --filter "FullyQualifiedName~TestAdı"` ile tek testi çalıştır; xUnit mesajı beklenen/gelen değeri gösterir (testlerdeki göreli fark mesajları gibi). Testcontainers gerçek PostGIS kullanır, gerekirse aynı SQL'i psql'de EXPLAIN ile denenir; frontend'de Vitest/Playwright hata görüntüsü ve iz (`test-results/`). Yeni filtre: `FeatureQuery` (Application) parametre + doğrulama → `SourceFeatureQueries` (parametreli `Where`) → controller sorgu parametresi → `API-CONTRACT.md` → `services/sourceLayers.ts` tipi + `SearchPanel` arayüzü → API testi + Vitest. | (2026-11-08) "ilk olarak testi tek çalıştırıp, çıktısını gözlemlerim. Sonrasında db'de denerim. Frontend tarafında kaydı düşen ilgili dosyayı görüntülerim. Backendden başlayarak frontende kadar ilerlerim bu şekilde yeni filtre eklerim" |
