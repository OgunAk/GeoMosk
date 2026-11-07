# GeoMosk — İlerleme kaydı

## Kısa durum (5 Kasım 2026; güncelleme 8 Kasım 2026)
- **Ad değişikliği (2026-11-06, geliştirici isteği):** proje adı GeoScope → **GeoMosk** (görünen ad, ADR-0017).
- **Büyük veri önlemleri (2026-11-08, geliştirici isteği):** ad araması için GIN trigram indeksleri ve keyset sayfalama (`after`/`nextAfter`), ADR-0020. Backend 154/154; 10.000 tesiste arama 14,7 → 0,28 ms, derin sayfa 1,7 → 0,07 ms (TEST-PLAN).
- **Tam yeniden adlandırma (2026-11-08, geliştirici isteği):** kod, veritabanı, rol, ortam değişkeni ve Compose adları da GeoMosk (ADR-0019); temiz kurulum gerekir.
- **Ek geliştirmeler (2026-11-06):** harici WMS katmanı (ADR-0015, PR #8) ve tesislerin bbox ile yüklenmesi (ADR-0016, PR #10) master'a birleşti; CI 4/4.
- **Son doğrulanan faz:** Faz 8 — Teslim, teknik kapı (`validate-project --full` exit 0, E2E üretim imajına karşı). **Geliştirici son kabulü (kontrol noktası 3) verildi (2026-11-08: "kabul"); depo herkese açık (`OgunAk/GeoMosk`).**
- **Geliştirici kontrol noktası 2:** Geri bildirim G1/G2 uygulandı. G3 ("ad en az 3 karakter") geliştirici 2026-11-05'te AI'ya bıraktı; uygulandı (backend 134/134, Vitest 58/58).
- **Ek istek (2026-11-04):** orta tuşla sürükleyerek harita kaydırma uygulandı (useMiddleMousePan, E2E).
- **Geliştirici bildirimi (2026-11-05):** başka ilçe seçilince eski analiz sonucu kalıyordu → `keepAnalysisFor` kuralı: yalnız analiz kaynağı veya sonuç listesindeki tesis seçilince sonuç korunur, aksi halde temizlenir (Vitest 6 + E2E). Commit 734d642.
- **Geliştirici bildirimi (2026-11-05):** "En yakın N" modunda "Haritada nokta seç" düğmesi ve Tür kutusu 320 px yan panelde taşıyordu → nokta bilgisi/düğme ayrı satır, N+Tür ızgarası (`minmax(0,1fr)`), seçim kutusu `min-w-0`; E2E: üç modda ve nokta seçildikten sonra içerik alanını aşan öğe yok. Commit 734d642.
- **Git:** `master` = Faz 0-8 ve sonraki geliştirmeler (GitHub `OgunAk/GeoMosk`; PR #1-#17 geliştirici tarafından birleştirildi, CI yeşil). Depo herkese açık (2026-11-08).
- **Çalışan ortam:** compose `db` ayakta (gerçek veri). Compose `api`/`web` durdurulmuş (Docker Desktop container ağı sorunu); API `dotnet run` (5080) + Vite (5173) yerelde.
- **Sonraki adım (geliştirici):** kontrol noktası 3 — manuel demo, teknik sahiplik soruları (DEVELOPER-REVIEW), depo erişimi/lisans kararı (DELIVERY-CHECKLIST).
- **Açık kalan (bilinçli) kısıtlar:** klavye ile çizim yok; ilçe GeoJSON tam çözünürlük (gzip 97 KB, ölçülen ihtiyaç yok); arama trigram indeksi gerekmedi (10.000'de p95 17 ms); nearest 100.000+ kayıtta KNN değerlendirilir (ADR-0012).
- **İlgili master prompt bölümleri:** §17 (Docker/CI/teslim), §18 (demo), §19 (DoD), §20.2 (kontrol noktası 3), §22.

## Faz 8 raporu

```text
Faz: 8 — Teslim
Durum: teknik kapı doğrulandı; geliştirici son kabulü (kontrol noktası 3) bekliyor
Karşılanan gereksinimler: D06, L02, L03, P05 doğrulandı; L01 devam ediyor (depo yayımlandı ama private; erişim kararı geliştiricide);
  P09 devam ediyor (kontrol noktası 3).
Oluşturulan/değişen dosyalar:
  README.md (§17 başlıkları: amaç, beş analiz + SRID, ortam, migration, API, demo, kısıtlar, sorun giderme)
  docs/DELIVERY-CHECKLIST.md (yeni), docs/DEVELOPER-REVIEW.md (kontrol noktası 3 rehberi + teknik sahiplik soruları ve kod işaretçileri),
  docs/FILE-MANIFEST.md, REQUIREMENTS, TEST-PLAN, DECISIONS (ADR-0014 nginx), ROADMAP
  frontend/nginx.conf (Docker DNS resolver — temiz kurulum bulgusu)
  docs/screenshots/faz8-{tampon-2000m,en-yakin-5,olcum-nilufer,dar-ekran}.png (üretim imajından, Playwright)
Çalıştırılan komutlar ve sonuç/exit code:
  git clone (029445b) → docker compose -p geomosk-clean up --build -d (DB/API/WEB portları 55432/55080/58080, .env yok) → exit 0;
    Docker Desktop ağı bu kez çalıştı, imajlar sıfırdan derlendi
  /api/health/ready → 200 (PostGIS 3.5.2); import 1 → 17/911 eklendi; import 2 → 0 ekleme/0 güncelleme (17/911 değişmedi)
  geomosk_app rolü superuser değil
  E2E_BASE_URL=http://127.0.0.1:58080 npm --prefix frontend run e2e → 22/22 (üretim imajı, nginx — önceki fazlarda yapılamayan doğrulama)
  db + api restart → BULGU: web /api 502 (nginx eski API IP'sini önbellekte tutuyordu) → resolver 127.0.0.11 + değişkenli proxy_pass;
    web yeniden derlendi → restart sonrası 200, kullanıcı çizimi kalıcı; E2E tekrar 22/22
  validate-project --full: ilk koşu 2 HATA (dotnet build/test: çalışan yerel API DLL kilidi MSB3027 — ortam, kod değil) →
    yerel API durduruldu, E2E üretim yığınına karşı → GEÇTİ, exit 0 (backend 141/141 dahil)
Veri/CRS/analiz kanıtları: değişmedi; ekran görüntüsünde Nilüfer 524,42 km² (EPSG:32635), sferoid farkı −%0,021.
İnceleme bulguları ve çözümleri: nginx DNS önbelleği (yukarıda).
Çalıştırılamayan kontroller ve nedeni: geliştirici manuel demosu ve teknik sahiplik yanıtları (geliştiricide); uzak depo herkese açık değil.
Temizlik: geomosk-clean container'ları durduruldu; volume `geomosk-clean_geomosk-db` ve `geomosk_perf` DB'si geliştirici onayı için bırakıldı.
Kalan risk/engel: değerlendirici erişimi (private repo); .NET 9 destek sonu 10 Kasım 2026.
Sonraki somut adım: kontrol noktası 3 (geliştirici).
```

## Faz 7 raporu

```text
Faz: 7 — Sağlamlaştırma
Durum: doğrulandı
Karşılanan gereksinimler: Q01, Q03, P06 doğrulandı (Q02 Faz 6'da). Geliştirici değişikliği G3 ("ad en az 3 karakter") geliştiricinin
  isteğiyle AI tarafından uygulandı.
Oluşturulan/değişen dosyalar:
  G3: Application/UserFeatures/UserFeatureRequests (MinNameLength, grafem sayısı), services/userFeatures (USER_NAME_MIN, nameLength),
    CreateFeatureForm (ipucu + aria-invalid), UserFeaturePanel; testler UserFeatureApiTests (+3), CreateFeatureForm.test (+1)
  Performans: scripts/perf/measure-api.mjs, seed-synthetic.sql (yalnız geomosk_perf; başka DB'de hata verir), results-*.json
  İnceleme düzeltmeleri: scripts/import/load-osm.mjs (toplu silme koruması, manifest dosya adı), Api/Program.cs (CORS ETag/Location),
    SourceFeatureQueries (tek ilçe atama kuralı), AnalysisService (A05 toplamı aynı SQL'de), UserFeatureStore + IUserFeatureStore +
    UserFeaturesController (CHECK ihlali → 422), MapView + layerIds (LAYER_ORDER), UserFeaturePanel (kısa adlı eski kayıt),
    LayerPanel + App (kullanıcı katmanı sınır uyarısı, geç gelen analiz yanıtı)
  Erişilebilirlik/UI: AppLayout (dar ekranda panel ≤40vh, harita kalan alan), index.css (:focus-visible), vite.config (paket bölme)
  Testler: MeasureAndDistrictStatsApiTests (+2), ImportPipelineTests (+2), SourceFeatureDetailAndEditTests (+3 SQL injection),
    ImportRunner UTF-8 çıktı, GeoMoskApiFactory ek ayar; Vitest +5 (XSS, kısa ad, sınır uyarısı); e2e accessibility.spec (3) +
    analysis.spec katman sırası
  docs: TEST-PLAN (performans ölçümü), DECISIONS ADR-0014, API-CONTRACT, REQUIREMENTS, README, DEVELOPER-REVIEW
Çalıştırılan komutlar ve sonuç/exit code:
  Bağımsız code-reviewer incelemesi (salt-okunur): kritik/yüksek 0, orta 4, düşük 6 → hepsi düzeltildi
  dotnet test backend → 141/141 (ara bulgular: G3 kuralı "Ad" adlı test verisini doğru reddetti → test verisi düzeltildi;
    import testi Node UTF-8 hata metnini OEM kod sayfasıyla okuyordu → ImportRunner UTF-8)
  npm --prefix frontend run typecheck / lint / test (62/62) / build → exit 0 (lint: vite.config regex kaçışı düzeltildi)
  E2E → 22/22 (ilk koşuda altlık-servis testi 0 kaynak öğesi gördü: veri işlenmeden okunuyordu → yoklama ile beklendi)
  Performans: node scripts/perf/measure-api.mjs (10.000 ve gerçek veri) → tüm p95 < 75 ms (TEST-PLAN)
  node scripts/validate-project.mjs --phase 7 (E2E_BASE_URL=http://127.0.0.1:5173) → GEÇTİ, exit 0
Veri/CRS/analiz kanıtları: değişmedi (Faz 5-6); A05 toplam eşitliği tek SQL ifadesinde.
İnceleme bulguları ve çözümleri: yukarıda; ayrıntı ADR-0014.
Çalıştırılamayan kontroller ve nedeni: üretim imajıyla (nginx) E2E ve performans — Docker Desktop ağı; CI ve Faz 8 temiz kurulumunda.
Kalan risk/engel: klavye ile çizim yok (bilinçli); ölçüm tek makinede.
Sonraki somut adım: Faz 8.
```

## Faz 6 raporu

```text
Faz: 6 — Güçlü teslim analizleri
Durum: doğrulandı
Karşılanan gereksinimler: A04, A05, Q02 doğrulandı; Q03 devam ediyor (p50/p95 Faz 7).
Oluşturulan/değişen dosyalar:
  backend: Application/Analysis (MeasureRequest, MetricProjection EPSG:32635 + kullanım alanı, MeasurementResult/GeodesicCheck,
    DistrictStats DTO'ları, ParseMeasure), Infrastructure/Analysis/AnalysisService (MeasureAsync: ST_Transform + ST_Length/ST_Area/
    ST_Perimeter, geography çapraz kontrol; DistrictStatsAsync: tekil atama CTE), Api/Controllers/AnalysisController (measure, district-stats)
  backend testleri: Analysis/TransverseMercatorReference (elipsoid dörtgen alanı + UTM ölçek faktörü, bağımsız),
    Analysis/MeasureAndDistrictStatsApiTests (11)
  frontend: services/analysis (runMeasure, fetchDistrictStats, formatArea, tipler), AnalysisPanel ("Ölçüm" modu + sonuç),
    analysis/choropleth.ts (sınıflar), analysis/DistrictStatsPanel (tablo, lejant, tür filtresi), MapView (lyr-districts-choropleth),
    layerIds, App (ilçe istatistiği durumu, tablodan seçim/zoom)
  frontend testleri: choropleth.test.ts (4), DistrictStatsPanel.test.tsx (3), AnalysisPanel.test.tsx (+3); e2e analysis.spec (+2),
    map.spec katman sayısı 17
  scripts: validate-project faz 6 dosyaları; sql/analysis-plans.sql (+A04/A05) ve analysis-plans.2026-11-05.txt
  docs: API-CONTRACT, DECISIONS ADR-0013, REQUIREMENTS, TEST-PLAN, screenshots/faz6-choropleth.jpg
Çalıştırılan komutlar ve sonuç/exit code:
  ST_Extent (gerçek veri): ilçeler 28.088–29.910°D → tamamen UTM 35N (24–30°D) içinde
  dotnet build backend → exit 0 (0 hata)
  dotnet test --filter MeasureAndDistrictStats → 11/11 (ilk koşu)
  dotnet test backend → 131/131
  npm --prefix frontend run typecheck / lint → exit 0; test → 57/57 (ilk koşuda test başlığındaki tırnak sözdizimi hatası düzeltildi)
  E2E (E2E_BASE_URL=http://127.0.0.1:5173) → ilk koşu 16/19: üçü test kurgusu — taşma testinde "Ölçüm" modundan sonra nokta seçimi
    "En yakın N"e dönmüyordu; EPSG metni panelde iki yerde (ipucu + sonuç) eşleşiyordu; altlık değişirken choropleth katmanı geçici
    olarak yokken getFilter hata fırlatıyordu (yoklama -1 döndürecek şekilde düzeltildi). Düzeltme sonrası analysis.spec 8/8, tam paket 19/19
  node scripts/validate-project.mjs --phase 6 (E2E_BASE_URL=http://127.0.0.1:5173) → GEÇTİ, exit 0
Veri/CRS/analiz kanıtları:
  A04: 0.01°×0.01° dörtgen alanı ve çevresi, 2.2 km çizgi, delikli alan, iki parçalı ilçe — bağımsız referansla göreli fark < 1e-5;
  28.2°D'de projeksiyon–sferoid farkı −%0,04…−%0,07 aralığında (yalnız geography kullanılsaydı test başarısız olurdu);
  gerçek veri: İznik 711,61 km² (sferoid 711,25 km², +%0,05), Nilüfer E2E'de arayüz = API, |fark| < %0,1.
  A05: gerçek veri 911 tesis → 911 atandı, 0 atanamayan, 0 çoklu eşleşme; ilçe toplamı = atanan; sentetik sınır/örtüşme senaryoları testli.
  Sorgu planı: A05 GiST ile 6.7 ms, A04 4.0 ms.
İnceleme bulguları ve çözümleri: yukarıda. Alt ajan incelemesi yapılmadı (Faz 7'de code-reviewer).
Çalıştırılamayan kontroller ve nedeni: üretim imajıyla E2E (Docker Desktop ağı; CI'da çalışır).
Kalan risk/engel: choropleth sınıfları kuantil (17 ilçe); ad/sayı bilgisi harita açılır penceresi yerine yan panel tablosunda (ADR-0013).
Sonraki somut adım: Faz 7.
```

## Faz 5 raporu

```text
Faz: 5 — Üç MVP analizi
Durum: doğrulandı
Karşılanan gereksinimler: A00, A01, A02, A03 doğrulandı; Q02, Q03 devam ediyor (A04 ve ölçüm Faz 6-7).
Oluşturulan/değişen dosyalar:
  backend: Application/Analysis (AnalysisRequests: girdi/limit doğrulama, IAnalysisService), Infrastructure/Analysis/AnalysisService
    (ST_Covers/ST_Within, ST_DWithin + ST_Distance geography, ST_Buffer geography; parametreli ADO.NET), Api/Controllers/AnalysisController;
    SourceFeatureQueries.FacilityRow internal (aynı tesis özellikleri)
  backend testleri: Analysis/GeodesicReference (bağımsız WGS84 yay formülleri), Analysis/AnalysisApiTests (17)
  frontend: services/analysis.ts (+formatDistance), features/analysis/AnalysisPanel (girdi, sonuç listesi), MapView (analiz kaynağı/katmanları,
    kuş uçuşu bağlantılar, nokta seçme modu), App (analiz için alan çizme kayıt formuna gitmez), layerIds/mapStyle
  frontend testleri: AnalysisPanel.test.tsx (7); tests/e2e/analysis.spec.ts (4); map.spec katman sayısı 16
  scripts/sql/analysis-plans.sql + analysis-plans.2026-11-04.txt (EXPLAIN ANALYZE BUFFERS)
  docs: API-CONTRACT (analizler), DECISIONS ADR-0012
Çalıştırılan komutlar ve sonuç/exit code:
  dotnet test backend → 120/120 (ilk koşuda 16/17; başarısız olan test verimdeydi: kare 29.295'ten başlıyordu, "Batı 0.01" 29.29'da gerçekten dışarıda — API doğruydu)
  Ara bulgu: dotnet run süreci derleme çıktısını kilitledi (MSB3027) → API durdurulup yeniden başlatıldı
  npm --prefix frontend run typecheck / lint / test (40/40) → exit 0 (lint: ref'in hook'tan sonra tanımlanması → en üste taşındı)
  E2E (E2E_BASE_URL=http://127.0.0.1:5173) → 15/15 (analysis 4 + drawing 4 + map 7)
  EXPLAIN: ilk koşu geçersizdi (PowerShell betiği yanlış kodlamayla okudu, 'Nilüfer' eşleşmedi, 0 satır) → OSM id ile ve bash üzerinden yeniden alındı
  node scripts/validate-project.mjs --phase 5 (E2E_BASE_URL=http://127.0.0.1:5173) → GEÇTİ, exit 0
Veri/CRS/analiz kanıtları:
  Mesafeler bağımsız referansla ±5 cm; 0.02° boylam ≈ 1705 m (tampon içi) / 0.02° enlem ≈ 2221 m (tampon dışı) aynı testte;
  1990 m içeride, 2010 m dışarıda; tampon çokgeni alanı ≥ %99 πr²; eşit mesafede id bağ kırıcı; delik/sınır/MultiPolygon;
  gerçek veri: Nilüfer içinde 120 tesis = /api/facilities?districtId sonucu (aynı ST_Covers politikası).
İnceleme bulguları ve çözümleri: yukarıda. Alt ajan incelemesi yapılmadı.
Çalıştırılamayan kontroller ve nedeni: üretim imajıyla E2E ve CI (push yok, Docker ağı).
Kalan risk/engel: nearest büyük veride tam tarama (ölçülecek); Docker Desktop ağı.
Sonraki somut adım: Faz 6.
```

## Faz 4 raporu

```text
Faz: 4 — Çizim ve CRUD
Durum: doğrulandı (teknik kapı); geliştirici kontrol noktası 2 bekliyor
Karşılanan gereksinimler: C02, C03, C04, P04 doğrulandı.
Oluşturulan/değişen dosyalar:
  backend: Application/UserFeatures (UserGeometryParser, UserFeatureRequests, IUserFeatureStore),
    Infrastructure/Features/UserFeatureStore, Api/Controllers/UserFeaturesController; GeoJsonFeature.Id → object (UUID)
  backend testleri: UserFeatureApiTests (36 durum)
  frontend: terra-draw 1.38.0 + adaptör 1.5.0; features/drawing (useTerraDraw, useUserFeatures, DrawingToolbar,
    CreateFeatureForm, UserFeaturePanel); MapView (kullanıcı katmanı, çizim, ±5 px tıklama toleransı); LayerPanel
    (kullanıcı katmanı anahtarı); services/userFeatures; App bağlantıları
  frontend testleri: CreateFeatureForm 5, UserFeaturePanel 4, LayerPanel +1 (Vitest 28/28); tests/e2e/drawing.spec.ts 4
  docs: API-CONTRACT (kullanıcı çizimleri), DECISIONS ADR-0011, DEVELOPER-REVIEW (deneme rehberi)
Çalıştırılan komutlar ve sonuç/exit code:
  dotnet test backend → 103/103 (36 yeni test ilk koşuda geçti)
  npm --prefix frontend run typecheck / lint / test (28/28) → exit 0. Lint bulguları: useTerraDraw'da render sırasında
    ref okuma ve cleanup'ta ref.current; düzeltme sırasında gerçek hata bulundu: cleanup altlık değişiminden önce saklanan
    taslağı siliyordu → örneğe özgü durdurma bayrağıyla düzeltildi
  E2E (E2E_BASE_URL=http://127.0.0.1:5173; API dotnet run + Vite) → 9/9 (drawing 4 + map 5). Bulgular:
    ince çizgiye tıklama altındaki ilçeyi seçiyordu → ±5 px tolerans + açık katman önceliği;
    test kurgusu: zoom/koordinatlar harita dışına düşüyordu, kullanıcı katmanı yüklenmeden tıklama, "Düzenle" tam eşleşme
  docker compose build api web → BAŞARISIZ (Docker Desktop ağı: auth.docker.io DNS, ardından container içinde npm ci ağ hatası).
    Kod hatası değil; üretim imajı bu oturumda doğrulanamadı, push sonrası CI e2e işi doğrulayacak.
  node scripts/validate-project.mjs --phase 4 (E2E_BASE_URL=http://127.0.0.1:5173) → GEÇTİ, exit 0
Veri/CRS/analiz kanıtları: kaydedilen noktanın ST_X/ST_Y'si girilen [boylam, enlem] ile aynı (API testi + E2E ±0.001°);
  ters sıra [40.19, 29.06] → 422 çalışma alanı mesajı.
İnceleme bulguları ve çözümleri: yukarıda. Alt ajan incelemesi yapılmadı.
Çalıştırılamayan kontroller ve nedeni: Compose üretim imajıyla E2E (Docker ağı); mobil/klavye ile çizim; CI (push yok).
Kalan risk/engel: Docker Desktop ağ sorunu (kullanıcı ortamı). Terra Draw köşe silme/ara nokta ekleme E2E'de ayrıca denenmedi.
Sonraki somut adım: geliştirici denemesi ve seçilen küçük değişiklik; ardından Faz 5.
```

## Faz 3 raporu

```text
Faz: 3 — Katman, arama ve API
Durum: doğrulandı
Karşılanan gereksinimler: M02, M03, M04, M05, C01 doğrulandı; Q01 devam ediyor (bağımsız inceleme Faz 7).
Oluşturulan/değişen dosyalar:
  backend: FeatureQuery (q/type/districtId), OverridePatch(+Parser), IOverrideCommands, LayerInfo/VersionedFeature;
    SourceFeatureQueries (katalog, tekil, arama, ilçe filtresi), OverrideCommands (xmin sürüm, ABA önlemi),
    SearchFunctions + migration SearchNormalization (unaccent + geomosk_search_normalize), Http/ETags,
    SourceLayersController (GET layers/{id}, PATCH), Program (2 MiB gövde sınırı, BadHttpRequestException durum kodu)
  backend testleri: SourceFeatureDetailAndEditTests (28 durum); test DB'lerinde Pooling=false
  frontend: MapView (iki altlık, style.load ile idempotent yeniden kurulum, vurgu/seçim katmanları, tıklama),
    LayerPanel (aç/kapa + altlık), SearchPanel (+displayName), FeatureDetailsPanel, FeatureEditor, useFeatureDetail,
    useDebouncedValue, geometry.bboxOf, services (requestJson+ETag, search/fetch/patch)
  frontend testleri: LayerPanel 5, SearchPanel 5, FeatureEditor 5 (Vitest); tests/e2e/map.spec.ts 5 (Playwright 1.64.1)
  docs: API-CONTRACT, DECISIONS (ADR-0007 güncel, 0008-0010), DATABASE, DATA-SOURCES; CI'a e2e işi
Çalıştırılan komutlar ve sonuç/exit code:
  OpenFreeMap stil/font/sprite/TileJSON → 200, CORS *
  dotnet test backend → 67/67. Ara bulgular: (1) toplu çalıştırmada 53300 "too many clients" — her test DB'si için
    havuzda kalan bağlantılar → test DB'lerinde havuz kapatıldı; (2) 42804 "CASE types integer and xid" — override
    sürüm projeksiyonu → nullable xid; (3) silinmiş kayıt testinin kurgusu düzeltildi (v1→v2 import)
  npm --prefix frontend run typecheck / lint / test (18/18) / e2e (5/5) → exit 0. Ara bulgular: lint
    set-state-in-effect (durum istek anahtarından türetildi); debounce'a nesne verilmesi sonsuz render riski (metin anahtarı);
    E2E'de kayıt bitmeden sayfa yenilenip PATCH iptal ediliyordu (test kaydın tamamlanmasını bekleyecek şekilde düzeltildi)
  curl: 3 MiB PATCH → önce 500 (bulgu), BadHttpRequestException durum kodu korunarak → 413 (API ve nginx üzerinden)
  curl: If-Match olmadan PATCH → 428 problem+json + traceId
  Gerçek veri: "nilufer" → Nilüfer; "devlet hastanesi" → 18 sonuç (Çekirge, Bursa, Karacabey Eski Devlet Hastanesi…)
  node scripts/validate-project.mjs --phase 3 → GEÇTİ, exit 0
Veri/CRS/analiz kanıtları: ilçe filtresi sınır dahil (ST_Covers): ortak sınırdaki tesis iki ilçede, delikteki tesis hiçbirinde (test).
İnceleme bulguları ve çözümleri: yukarıda. Alt ajan incelemesi yapılmadı.
Çalıştırılamayan kontroller ve nedeni: Faz 2-3 CI çalışması (push edilmedi); mobil yerleşim E2E'de yok; ekran okuyucu ile manuel test yapılmadı.
Kalan risk/engel: OpenFreeMap ücretsiz hizmet, süreklilik garantisi yok (uyarı + diğer altlık).
Sonraki somut adım: Faz 4 (Terra Draw deneyi).
```

## Faz 2 raporu

```text
Faz: 2 — Gerçek veri dikey dilimi
Durum: doğrulandı
Karşılanan gereksinimler: T03, T04, D01, D02, D03, D04, D05, M01 doğrulandı; D06, L03, Q03, P05, P06 devam ediyor.
Oluşturulan/değişen dosyalar:
  scripts/import/{overpass-queries,fetch-osm,load-osm}.mjs, scripts/import/Dockerfile, .dockerignore
  data/samples/osm-bursa/2026-11-04T17-05-11-619Z/ (gerçek, ODbL), data/raw/osm-bursa.manifest.json
  data/test-fixtures/osm-mini/{v1,v2} (SENTETİK, README ile etiketli)
  backend: Domain entity'leri (District, HealthFacility, overrides, UserFeature, ImportRun), EF yapılandırmaları,
    migration'lar InitialSchema + AppRoleWriteGrants, DesignTimeDbContextFactory, SourceFeatureQueries,
    SourceLayersController (GET /api/districts, /api/facilities), GeometrySchemaTransformer; .config/dotnet-tools.json (dotnet-ef 9.0.22)
  docker/db/{initdb/10-app-role.sh, sql/app-role.sql}; docker-compose.yml (migrate, import servisleri); Dockerfile migrator aşaması
  frontend: MapView, layerIds, mapStyle, maplibreSetup, useSourceLayers, LayerSummary (+test), services/sourceLayers.ts; nginx gzip + .mjs MIME
  docs: DATA-SOURCES, DATABASE, API-CONTRACT; DECISIONS (ADR-0005..0007); README; CI'a Node adımı
Çalıştırılan komutlar ve sonuç/exit code:
  node scripts/import/fetch-osm.mjs → exit 0; iki sorgu da ilk denemede Overpass 502, yeniden denemede başarılı;
    districts 17 relation, facilities 911 (816 node/94 way/1 relation)
  dotnet tool run dotnet-ef migrations add InitialSchema → başarılı
  docker compose up -d --build db migrate → migrate Exited (0), 2 migration uygulandı
  10-app-role.sh (var olan volume) → geomosk_app rolsuper=f; yazma yalnız 3 tabloda (information_schema kanıtı)
  load-osm.mjs 1. deneme → exit 1, import_history sayaç kolonlarında NOT NULL (transaction öncesi; veri yok) → düzeltildi
  load-osm.mjs 2. deneme → exit 1 "cannot insert multiple commands into a prepared statement"; import_history'de 2 'failed',
    kaynak tabloları 0 satır (rollback kanıtı) → staging sorgusu ikiye bölündü
  load-osm.mjs 3. deneme → exit 0: 17 + 911 eklendi, reddedilen 0, geçersiz 0, hiçbir ilçede olmayan tesis 0, olası mükerrer 3
  load-osm.mjs 4. deneme (aynı snapshot) → ekleme 0, güncelleme 0, değişmeyen 17/911; satır sayısı 911 = farklı kaynak anahtarı 911
  dotnet build backend → 0 uyarı (MSB3277 EF Core sürüm çakışması bulundu, EF Core 9.0.22 açıkça sabitlendi, MSB3277 artık hata)
  dotnet test backend → 41/41 (ilk çalıştırmalarda: aynı adla CREATE DATABASE, [Produces] nedeniyle problem+json yerine
    geo+json, doğrulama yanıtında traceId eksikliği bulundu ve düzeltildi; geometry_columns'ın yanıltıcı tipi test kaynağı değiştirildi)
  npm --prefix frontend run typecheck / lint / test (6/6) / build → exit 0 (500 KB chunk uyarısı)
  curl :8080/api/districts → 200 application/geo+json 318 042 B (gzip 115 169 B); facilities 276 663 B (gzip 31 835 B);
    limit=0 → 400 application/problem+json
  Playwright CLI: ilk denemede harita boş — (1) MapLibre worker 404 → setWorkerUrl + Vite ?url, (2) nginx .mjs'i
    application/octet-stream sunuyordu → .mjs için text/javascript, (3) maplibre-gl.css katmansız
    position:relative Tailwind "absolute"ı eziyordu → kap açık boyutla. Son durum: tuval 960×651, konsol hatası 0, ekran görüntüsü alındı.
  Temiz kurulum: docker compose -p geomosk-cleancheck (yeni volume, farklı portlar) up → init script rolü oluşturdu,
    migration 3 tabloya yazma izni verdi, import container'ı 17/911 ekledi, web üzerinden API 200; yalnız bu proje down -v ile kaldırıldı.
  node scripts/validate-project.mjs --phase 2 → GEÇTİ, exit 0
Veri/CRS/analiz kanıtları: tüm geometriler SRID 4326; ilçe extent boylam 28.09–29.91 / enlem 39.59–40.61; bbox sorgusunda
  koordinatlar [29.04, 40.19] biçiminde (boylam, enlem); harita sınırları OSM altlığıyla örtüşüyor; deliğin içindeki
  bbox ilçeyi döndürmüyor (gerçek geometri kesişimi testi).
İnceleme bulguları ve çözümleri: yukarıdaki komut satırlarında. Alt ajan incelemesi yapılmadı.
Çalıştırılamayan kontroller ve nedeni: Faz 2 CI çalışması (push edilmedi). Mobil yerleşim tarayıcıda denenmedi.
  Resmî Sağlık Bakanlığı listesiyle kapsam karşılaştırması yapılmadı (DATA-SOURCES "Bilinen eksikler").
Kalan risk/engel: OSM karo politikası yoğun kullanıma uygun değil (Faz 3 altlık kararı).
Sonraki somut adım: Faz 3.
```

## Faz 1 raporu

```text
Faz: 1 — Çalışan iskelet
Durum: doğrulandı (CI uzakta çalıştırılmadı)
Karşılanan gereksinimler: T01, T02, T05, P03, P07 doğrulandı; T03, P05, P06 devam ediyor.
Oluşturulan/değişen dosyalar: global.json; backend/ (GeoMosk.sln, Directory.Build.props,
  Directory.Packages.props, 5 proje, Dockerfile, .dockerignore); frontend/ (Vite react-ts şablonu
  create-vite@9.3.1, Tailwind 4.3.3, Vitest 4.1.12, SystemStatus, AppLayout, apiClient, Dockerfile,
  nginx.conf); docker-compose.yml; .env.example; .github/workflows/ci.yml; .gitattributes;
  docs/ARCHITECTURE.md, ROADMAP.md, TEST-PLAN.md; README.md; hook'a JSONC desteği (+3 test).
Çalıştırılan komutlar ve sonuç/exit code:
  winget install Microsoft.DotNet.SDK.9 → 9.0.320 kuruldu, exit 0
  dotnet build backend → 0 uyarı, 0 hata (ilk denemede Testcontainers kullanımdan kalkmış kurucu
    uyarısı TreatWarningsAsErrors ile hata verdi → image parametreli kurucuya geçildi)
  dotnet test backend → 8 başarılı, 0 başarısız (gerçek postgis/postgis:17-3.5 container)
  npm --prefix frontend run typecheck / lint / test (3/3) / build → hepsi exit 0
  npm run test:hooks → 20/20
  docker compose config --quiet → exit 0; docker compose up --build -d → exit 0
  GET :8080/api/health/live → 200; /api/health/ready → 200 postgisVersion 3.5.2; :5080/openapi/v1.json → 200
  docker compose stop db → ready 503, gövdede bağlantı ayrıntısı yok; start db → 200
  playwright-cli open http://127.0.0.1:8080/ → "Veritabanı: Hazır (PostGIS 3.5.2)", konsol hatası 0,
    ekran görüntüsü docs/screenshots/faz1-system-status.png
  node scripts/validate-project.mjs --phase 1 → GEÇTİ, exit 0
Veri/CRS/analiz kanıtları: yok (Faz 2+).
İnceleme bulguları ve çözümleri: Hook iki gerçek sorunu yakaladı: dotnet şablonlarından gelen BOM'lu
  JSON/csproj (temizlendi) ve tsconfig JSONC yanlış alarmı (hook düzeltildi, test eklendi). Hook ayrıca
  test dosyasındaki sahte özel anahtar kalıbını yakaladı (kalıp çalışma anında birleştirilecek şekilde
  değiştirildi). Alt ajan incelemesi yapılmadı (iskelet, kritik spatial/CRUD kodu yok).
Çalıştırılamayan kontroller ve nedeni: GitHub Actions CI — uzak depo yok. Temiz kurulum (ayrı Compose
  projesi + yeni volume) Faz 8'de. MapLibre/WebGL henüz yok.
Kalan risk/engel: .NET 9 desteği 10 Kasım 2026'da bitiyor (README'de kısıt olarak yazıldı).
  Compose DB kullanıcısı superuser (postgis image varsayılanı) → Faz 2'de ayrı uygulama rolü.
Sonraki somut adım: Faz 2 veri kaynağı doğrulaması.
```

## Faz 0 raporu

```text
Faz: 0 — Analiz ve ajan altyapısı
Durum: doğrulandı (statik kapı) — runtime keşfi kısmi, aşağıda
Karşılanan gereksinimler: P01, P02 (proje kararı satırları). PDF satırları (T/D/M/C/A/L/Q) matriste
  izlenebilir; hiçbiri henüz uygulanmadı → "bekliyor".
Oluşturulan/değişen dosyalar: docs/FILE-MANIFEST.md'deki tablo (7 ajan, 6 skill, 6 rule, settings,
  3 script + ortak lib + hook testleri, 5 belge, kök package.json). Korunanlar: .claude/CLAUDE.md,
  playwright-cli ve graphify skill'leri (graphify disable-model-invocation: true denetleniyor),
  docs/AI-TOOLS.md, .graphifyignore. .gitignore'a yalnızca ekleme yapıldı.
Çalıştırılan komutlar ve sonuç/exit code:
  claude --version → 2.1.318 (Claude Code)
  dotnet --list-sdks → 8.0.400, 8.0.427, 10.0.302
  node --version → v24.21.0; npm 11.19.0; git 2.53.0; Docker CLI 29.6.2 (daemon kapalı)
  pypdf 5.1.0 (scratchpad) ile PDF metin çıkarımı → 2 sayfa okundu (poppler yok; görsel render yapılamadı)
  npm install → added 1 package (yaml 2.9.1), exit 0
  npm run test:hooks → 17 test, 17 geçti, 0 başarısız, exit 0
    (ilk çalıştırmada 1 gerçek hata yakalandı: TextDecoder BOM'u siliyordu → ignoreBOM: true ile düzeltildi)
  node scripts/verify-agent-setup.mjs → 35 dosya, 0 hata, 0 uyarı, exit 0
    (ilk çalıştırmada "planlanan" işareti olmayan 3 tanımsız npm komutu referansı yakalandı ve düzeltildi)
  node scripts/validate-project.mjs --phase 0 → GEÇTİ, exit 0
  node scripts/validate-project.mjs --phase 1 → 7 eksik dosya raporladı (beklenen: Faz 1 uygulanmadı)
Veri/CRS/analiz kanıtları: yok (Faz 2+).
İnceleme bulguları ve çözümleri: Bağımsız alt ajan incelemesi yapılmadı (yeni ajan tanımları bu oturumda
  yüklü değil; ana ajan kontrol listelerini uyguladı).
Çalıştırılamayan kontroller ve nedeni:
  - (Sonradan gözlendi) Ajan runtime keşfi: 7 proje ajanı aynı oturumda bir sonraki kullanıcı mesajında
    Agent aracının tür listesine eklendi; code-reviewer için "Tools: Read, Grep, Glob, Bash" kısıtı görüldü.
  - Koşulsuz rules (architecture, security) ve güncellenen CLAUDE.md: oturum başında yüklenir; yeni oturumda geçerli.
    Yol bazlı rules: ilgili dizinler (backend/, frontend/) Faz 1'de oluşunca eşleşme gözlenecek.
  - settings.json permissions.deny: .env dosyası olmadığından canlı denenmedi (statik geçerli).
  - PDF görsel (sayfa render) kontrolü: poppler yok.
Runtime'da gözlenenler:
  - Skill keşfi: 6 yeni proje skill'i yazıldıktan sonra bu oturumun skill listesine canlı eklendi.
  - Hook: .claude/settings.json'daki PostToolUse(Write|Edit) hook'u, kasıtlı bozuk JSON prob dosyası
    (hook-probe.tmp.json, sonra silindi) yazıldığında tetiklendi; "JSON parse hatası: Unexpected end of
    JSON input" mesajıyla exit 2 döndü ve Claude'a iletildi. Bu, settings.json'ın yüklendiğini de gösterir.
Kalan risk/engel: Docker daemon kapalı (Faz 1 PostGIS); .NET 10 vs PDF'nin .NET 9 tercihi (ADR-0001);
  Bursa verisinin lisans/kapsam uygunluğu Faz 2'de doğrulanacak.
Sonraki somut adım: Docker Desktop'ı başlat → Faz 1 iskeleti.
```

## Faz geçmişi
| Faz | Durum | Tarih | Kanıt |
|---|---|---|---|
| 0 | doğrulandı (statik) / runtime kısmi | 2026-11-04 | Yukarıdaki rapor |
| 1 | doğrulandı (CI uzakta çalışmadı) | 2026-11-04 | Faz 1 raporu |
| 2 | doğrulandı | 2026-11-04 | Faz 2 raporu |
| 3 | doğrulandı | 2026-11-04 | Faz 3 raporu |
| 4 | doğrulandı (geliştirici kontrolü bekliyor) | 2026-11-04 | Faz 4 raporu |
| 5 | doğrulandı | 2026-11-04 | Faz 5 raporu |
| 6 | bekliyor | — | — |
