# GeoScope — İlerleme kaydı

## Kısa durum (4 Kasım 2026)
- **Son doğrulanan faz:** Faz 3 — Katman, arama ve API (`validate-project --phase 3` exit 0).
- **Git:** `master` = Faz 0-1 (GitHub). Faz 2 `faz-2-veri` dalında commit'li (09392ec, push edilmedi). Faz 3 `faz-3-katman-arama` dalında, henüz commit edilmedi.
- **Çalışan ortam:** compose db/migrate/api/web ayakta; volume `geoscope_geoscope-db` gerçek veriyle dolu (17 ilçe, 911 tesis). E2E testleri bu ortama karşı koşar.
- **Sonraki adım:** Faz 4 — Terra Draw (P04) erken deneyi; `/api/features` CRUD (C02-C04); kullanıcı katmanı; ardından **geliştirici kontrol noktası 2** (docs/DEVELOPER-REVIEW.md).
- **Faz 7'ye taşınan notlar:** MapLibre paketi 500 KB üstü (kod bölme); ilçe GeoJSON tam çözünürlükte (gzip 115 KB); arama için trigram indeksi ölçümü; bbox yüklemesi (ADR-0010).
- **İlgili master prompt bölümleri:** §9 (API), §12 (çizim/CRUD), §8 (GeoJSON doğrulama).

## Faz 3 raporu

```text
Faz: 3 — Katman, arama ve API
Durum: doğrulandı
Karşılanan gereksinimler: M02, M03, M04, M05, C01 doğrulandı; Q01 devam ediyor (bağımsız inceleme Faz 7).
Oluşturulan/değişen dosyalar:
  backend: FeatureQuery (q/type/districtId), OverridePatch(+Parser), IOverrideCommands, LayerInfo/VersionedFeature;
    SourceFeatureQueries (katalog, tekil, arama, ilçe filtresi), OverrideCommands (xmin sürüm, ABA önlemi),
    SearchFunctions + migration SearchNormalization (unaccent + geoscope_search_normalize), Http/ETags,
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
  10-app-role.sh (var olan volume) → geoscope_app rolsuper=f; yazma yalnız 3 tabloda (information_schema kanıtı)
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
  Temiz kurulum: docker compose -p geoscope-cleancheck (yeni volume, farklı portlar) up → init script rolü oluşturdu,
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
Oluşturulan/değişen dosyalar: global.json; backend/ (GeoScope.sln, Directory.Build.props,
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
| 4 | bekliyor | — | — |
