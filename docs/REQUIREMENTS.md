# GeoScope — Gereksinim izlenebilirlik matrisi

**Birincil kaynak:** `ODEV_WEB_CBS.pdf` (2 sayfa). 4 Kasım 2026'da pypdf 5.1.0 ile metni çıkarılıp baştan sona okundu; sayfa/başlık referansları bu çıktıyla doğrulandı. Görsel (render) kontrol yapılamadı: ortamda poppler yok. Metin, master prompt §2.1'deki aktarımla birebir uyumlu; çelişki bulunmadı.

**Kaynak önceliği:** kullanıcının güncel açık kararı → PDF → master prompt proje kararları → önceki plan önerileri.

**Sınıflar:** PDF zorunlu · PDF tercih · PDF seçenek · PDF opsiyonel · değerlendirme ölçütü · bu promptun proje kararı · gelecek geliştirme.
**Durumlar:** bekliyor · devam ediyor · doğrulandı · engelli · kapsam dışı. Kanıtı olmayan satır `doğrulandı` olamaz (`node scripts/validate-project.mjs --phase 0` bunu denetler).

## Matris

| ID | Kaynak/sayfa/başlık | Gereksinim | Sınıf | Teknik karşılık | Faz | Kabul testi | Kanıt/dosya | Durum |
|---|---|---|---|---|---|---|---|---|
| T01 | s.1 Teknoloji Gereksinimleri | Backend .NET Core; tercihen .NET 9 | PDF zorunlu (.NET) + PDF tercih (9) | ASP.NET Core Web API; .NET 9 (ADR-0001, geliştirici kararı) | 1 | `global.json` SDK ile `dotnet build` başarılı | global.json (9.0.320), net9.0; validate-project --phase 1 dotnet build exit 0 | doğrulandı |
| T02 | s.1 Teknoloji Gereksinimleri | PostgreSQL + PostGIS | PDF zorunlu | Compose `db` servisi, sürüm etiketli PostGIS image | 1 | `/api/health/ready` PostGIS sürümünü doğrular; `SELECT postgis_full_version()` | HealthEndpointTests (Testcontainers) + compose'da ready 200 "postgisVersion":"3.5.2" | doğrulandı |
| T03 | s.1 Teknoloji Gereksinimleri | ORM serbest; tercihen EF Core + Npgsql.NetTopologySuite | PDF tercih | EF Core + Npgsql EF provider + NTS; paket adları/sürümleri NuGet'ten doğrulanacak | 1 | Paket uyumu build + spatial round-trip testi | backend/Directory.Packages.props (Npgsql EF 9.0.4 + NTS 9.0.4); build geçti, spatial round-trip Faz 2 | devam ediyor |
| T04 | s.1 Teknoloji Gereksinimleri | Harita MapLibre GL JS | PDF zorunlu | `maplibre-gl` (lockfile ile sabit) | 1 | Tarayıcıda harita render (Playwright) | — | bekliyor |
| T05 | s.1 Teknoloji Gereksinimleri | Frontend serbest (vanilla veya framework) | PDF seçenek | React + TypeScript + Vite (proje kararı P03) | 1 | `npm --prefix frontend run build` başarılı | frontend/ (React + Vite); validate-project --phase 1 build exit 0 | doğrulandı |
| D01 | s.1 §1 Veri Temini | İnternetten açık lisanslı, gerçek konumsal veri | PDF zorunlu | Bursa ilçeleri + sağlık tesisleri; kaynak/lisans `docs/DATA-SOURCES.md` | 2 | Kaynak URL, lisans, indirme zamanı, checksum kayıtlı | — | bekliyor |
| D02 | s.1 §1 Veri Temini | En az iki farklı geometri tipi | PDF zorunlu | İlçe MultiPolygon + tesis Point (dış kaynaktan; kullanıcı çizimleri sayılmaz) | 2 | `GeometryType` sorgusu iki tip döndürür | — | bekliyor |
| D03 | s.1 §1 Veri Temini | Örnek kaynaklar (OSM/Overpass/Geofabrik, İBB, data.gov.tr, Natural Earth, geoBoundaries); konu serbest | PDF seçenek | Kaynak seçimi Faz 2'de gis-specialist incelemesiyle | 2 | Seçim gerekçesi DATA-SOURCES.md'de | — | bekliyor |
| D04 | s.1 §1 Veri Temini | Veri PostgreSQL/PostGIS'e yüklenmeli; araç serbest | PDF zorunlu | `scripts/import/` tekrarlanabilir import (container içinde) | 2 | İki kez import → mükerrer yok, sayılar tutarlı | — | bekliyor |
| D05 | s.1 §1 Veri Temini | Geometri kolonları SRID 4326 ve GIST indeksli | PDF zorunlu | Tip kısıtlı `geometry(...,4326)` kolonlar + GiST (migration) | 2 | `ST_SRID` = 4326 tüm satırlar; `pg_indexes` GiST | — | bekliyor |
| D06 | s.1 §1 Veri Temini | Kaynak, lisans ve yükleme adımları README'de | PDF zorunlu | README + DATA-SOURCES.md | 2, 8 | README'de kaynak başına kayıt; adımlar temiz ortamda çalışır | — | bekliyor |
| M01 | s.1 §2 Harita Ekranı | Açılışta MapLibre harita ekranı | PDF zorunlu | `MapView` | 2 | Açılışta gerçek veriyle harita (Playwright) | — | bekliyor |
| M02 | s.1 §2 Harita Ekranı | Veri setleri aç/kapa katmanlar (GeoJSON servis edilebilir) | PDF zorunlu | `LayerPanel`; backend GeoJSON (proje kararı) | 3 | Katman görünürlüğü değişir; altlık değişiminde korunur | — | bekliyor |
| M03 | s.1 §2 Harita Ekranı | Tıklanan objenin öznitelikleri popup/yan panelde | PDF zorunlu | `FeatureDetailsPanel` | 3 | İlçe ve tesis tıklamasında öznitelikler görünür | — | bekliyor |
| M04 | s.1 §2 Harita Ekranı | Öznitelik arama/filtre, sonuç vurgulama, objeye zoom | PDF zorunlu | `SearchPanel` + sunucu tarafı `q` filtresi + vurgu katmanı + fitBounds | 3 | Bbox dışındaki sonuca zoom; vurgu görünür | — | bekliyor |
| M05 | s.1 §2 Harita Ekranı | En az iki altlık arasında geçiş | PDF zorunlu | `BasemapSwitcher`; iki erişilebilir, atıflı altlık | 3 | Geçiş sonrası veri/çizim/analiz katmanları korunur | — | bekliyor |
| C01 | s.1 §3 Veri Yönetimi | Kayıtların sözel bilgileri (ad, açıklama) düzenlenebilmeli | PDF zorunlu | `district_overrides`/`facility_overrides` + PATCH; kullanıcı kayıtları PATCH | 3 | Düzenleme yenilemede ve tekrar import sonrası korunur | — | bekliyor |
| C02 | s.1 §3 Veri Yönetimi | Point, polyline, polygon çizip kaydetme | PDF zorunlu | Terra Draw; polyline = GeoJSON LineString | 4 | Üç tip çizilir, kaydedilir, yenilemede görünür | — | bekliyor |
| C03 | s.1 §3 Veri Yönetimi | Çizimler ayrı "kullanıcı katmanı" | PDF zorunlu | `user_features` tablosu + ayrı harita katmanı | 4 | Kaynak tablolarına yazılmaz; ayrı katmanda görünür | — | bekliyor |
| C04 | s.1 §3 Veri Yönetimi | Tüm ekleme/güncelleme/silme REST API üzerinden | PDF zorunlu | `POST/PATCH/DELETE /api/features`, `PATCH /api/districts/{id}` ve `/api/facilities/{id}` | 4 | API testleri 201/200/204/404/409/422 | — | bekliyor |
| A00 | s.2 §4 Geometrik Analiz | Beş analizden en az üçü backend'de (PostGIS/NTS), sonuçlar haritada | PDF zorunlu | A01-A03 MVP; A04-A05 güçlü teslim | 5 | Üç analiz gerçek PostGIS testleri + haritada sonuç | — | bekliyor |
| A01 | s.2 §4 Alan içinde kalanlar | Çizilen/seçilen poligon içindeki objeleri listele | PDF seçenek (MVP'de seçildi) | `POST /api/analysis/within`; `ST_Covers` (sınır dahil) / `ST_Within` | 5 | İç/dış/sınır/delik/MultiPolygon fixture'ları | — | bekliyor |
| A02 | s.2 §4 Yakınlık (buffer) | Metre cinsinden tampon; içindekiler ve tampon haritada | PDF seçenek (MVP'de seçildi) | `POST /api/analysis/buffer`; seçim `ST_DWithin(geography)`, görsel `ST_Buffer(geography)` | 5 | Eşik içi/dışı/tam sınır; 0/negatif/üst limit reddi | — | bekliyor |
| A03 | s.2 §4 En yakın N obje | Tıklanan noktaya en yakın N obje, mesafeleriyle | PDF seçenek (MVP'de seçildi) | `POST /api/analysis/nearest`; `ST_Distance(geography)` + `id` bağ kırıcı | 5 | Referans sıralamaya karşı; N sınırları, eşit mesafe | — | bekliyor |
| A04 | s.2 §4 Ölçüm | Uzunluk/alan metrik birimde, uygun metrik SRID ile | PDF seçenek (güçlü teslim) | `POST /api/analysis/measure`; `ST_Transform` → metrik SRID (aday EPSG:32635) | 6 | Bağımsız referans alan/uzunluk, gerekçeli tolerans | — | bekliyor |
| A05 | s.2 §4 Mekânsal birleştirme | Poligon başına nokta sayısı; tablo ve/veya choropleth | PDF seçenek (güçlü teslim) | `GET /api/analysis/district-stats`; tekil atama, `LEFT JOIN` + `COUNT(f.id)` | 6 | Sıfır ilçe, sınır tekil atama, atanmayan sayısı | — | bekliyor |
| O01 | s.2 §5 WMS Servisi (Opsiyonel) | Harici WMS raster kaynak (örn. TUCBS) | PDF opsiyonel | Ana teslim sonrası değerlendirilecek | — | — | — | kapsam dışı |
| L01 | s.2 Teslim | Proje GitHub gibi bir platforma yüklenecek | PDF zorunlu | Yerel git deposu (Faz 0'da `git init`); uzak yayın kullanıcı izniyle | 8 | Uzak URL gerçekten erişilebilir | — | bekliyor |
| L02 | s.2 Teslim | README: kurulum, teknolojiler, veri kaynağı/lisans, import adımları, varsa giriş bilgileri | PDF zorunlu | `README.md` (master prompt §17 başlıkları) | 8 | Temiz ortamda README ile kurulum | — | bekliyor |
| L03 | s.2 Teslim | Import script'i veya SQL dump repoda (büyükse indirme bağlantısı) | PDF zorunlu | `scripts/import/` + checksum'lı indirme manifesti | 2, 8 | Yeni clone'da import çalışır | — | bekliyor |
| Q01 | s.2 Değerlendirmede Dikkat Edilecekler | Katmanlı, okunabilir mimari; anlamlı API | değerlendirme ölçütü | Katmanlı monolit (`.claude/rules/architecture.md`), REST + OpenAPI | 1-7 | Proje referans yönleri + code-reviewer incelemesi | — | bekliyor |
| Q02 | s.2 Değerlendirmede Dikkat Edilecekler | Geometrik doğruluk, bilinçli SRID/birim | değerlendirme ölçütü | `.claude/rules/spatial-data.md`; geography/metrik SRID | 5-6 | Spatial doğruluk test paketi | — | bekliyor |
| Q03 | s.2 Değerlendirmede Dikkat Edilecekler | Büyüyen veri için index, bbox, sayfalama vb. | değerlendirme ölçütü | GiST + geography expression index, bbox, limit/offset, AsNoTracking | 3, 7 | `EXPLAIN (ANALYZE, BUFFERS)` kaydı, p50/p95 ölçümü | — | bekliyor |
| P01 | Master prompt §4 | Claude Code ajan/skill/rule/settings altyapısı | bu promptun proje kararı | `.claude/agents` (7), `.claude/skills` (6 yeni + 2 korunan), `.claude/rules` (6), `.claude/settings.json` | 0 | `node scripts/verify-agent-setup.mjs` exit 0; skill'ler oturumda canlı keşfedildi | docs/PROGRESS.md (Faz 0 raporu) | doğrulandı |
| P02 | Master prompt §4.6 | PostToolUse Write/Edit doğrulama hook'u | bu promptun proje kararı | `scripts/hooks/validate-changed-files.mjs` | 0 | `npm run test:hooks` 17/17; canlı oturumda bozuk JSON'u exit 2 ile yakaladı | docs/PROGRESS.md (Faz 0 raporu) | doğrulandı |
| P03 | Master prompt §3 | React + TypeScript + Vite + Tailwind | bu promptun proje kararı | `frontend/` | 1 | typecheck/lint/test/build | validate-project --phase 1 (4 frontend komutu exit 0) | doğrulandı |
| P04 | Master prompt §3, §12 | Terra Draw + MapLibre adaptörü | bu promptun proje kararı | `frontend/src/features/drawing` | 4 | Erken küçük çizim deneyi + E2E | — | bekliyor |
| P05 | Master prompt §17 | Docker Compose (db/api/web), temiz kurulum | bu promptun proje kararı | `docker-compose.yml`, Dockerfile'lar | 1, 8 | Ayrı Compose projesiyle temiz kurulum | docker-compose.yml; `up --build` + tarayıcı akışı (docs/TEST-PLAN.md); temiz kurulum testi Faz 8 | devam ediyor |
| P06 | Master prompt §17 | CI: build, test, gerçek PostGIS entegrasyonu | bu promptun proje kararı | `.github/workflows/` | 1, 7 | CI çalışması yeşil | .github/workflows/ci.yml yazıldı; uzak depo yok, çalıştırılmadı | devam ediyor |
| P07 | Master prompt §3 | .NET sürüm kararı (.NET 9 desteği 10 Kasım 2026'da bitiyor) | bu promptun proje kararı | ADR-0001: .NET 9 (geliştirici kararı, 4 Kasım 2026) | 1 | `global.json` + build | docs/DECISIONS.md; global.json 9.0.320; build exit 0 | doğrulandı |
| P08 | Master prompt §6, §22 | Senaryo: Bursa ilçeleri + sağlık tesisleri; katmanlı monolit | bu promptun proje kararı | Master prompt §22'de geliştirici onaylı kayıtlı | 2 | Veri uygunluğu Faz 2'de doğrulanır | GEOSCOPE_MASTER_PROMPT.md §22 | devam ediyor |
| P09 | Master prompt §20.2 | Üç geliştirici kontrol noktası (Faz 0*, 4, 8) | bu promptun proje kararı | `docs/DEVELOPER-REVIEW.md` | 4, 8 | Gerçek geliştirici kaydı | — | bekliyor |
| F01 | Master prompt §2.2 | Kullanıcı/rol sistemi, rapor dışa aktarımı, vektör tile, gelişmiş dashboard | gelecek geliştirme | — | — | — | — | kapsam dışı |

\* Faz 0 kontrol noktası master prompt §22 gereği önceden onaylı senaryo/mimari kaydıyla kapanır; ilk etkileşimli kontrol Faz 4 sonunda.

## Açık noktalar
- **PDF görsel kontrolü:** Metin çıkarımı yapıldı; sayfa görünümü (tablo/ikon) render edilemedi. Metinde tablo/şekil olmadığı için ödev uyumluluğuna etkisi düşük; poppler kurulursa tekrar kontrol edilebilir.
- **.NET sürümü:** Geliştirici .NET 9'u seçti (PDF tercihiyle uyumlu). Destek 10 Kasım 2026'da bitiyor; README'de bilinen kısıt olarak yazılacak.
