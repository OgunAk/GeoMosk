# GeoScope

Bursa'nın 17 ilçesi ve sağlık tesisleri üzerine bir Web CBS uygulaması. Uygulama haritada katman ve altlık yönetimi, arama, öznitelik
düzenleme, kullanıcı çizimleri ve beş mekânsal analiz sunar. Analizlerin hepsi PostGIS ile backend'de çalışır.
Ödev kaynağı: Web CBS ödevi (PDF). Gereksinim izlenebilirliği: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

> **Durum:** Faz 0-7 doğrulandı, Faz 8 (teslim) sürüyor. Ayrıntı: [docs/PROGRESS.md](docs/PROGRESS.md),
> teslim kontrol listesi: [docs/DELIVERY-CHECKLIST.md](docs/DELIVERY-CHECKLIST.md).

![İlçe başına tesis sayısı (choropleth)](docs/screenshots/faz6-choropleth.jpg)

## Amaç ve kapsam
Kullanıcı Bursa'da sağlık tesislerinin dağılımını inceler. Bir ilçedeki ya da bir noktanın çevresindeki tesisleri bulur, en yakın
eczaneyi veya hastaneyi görür, ilçeleri tesis sayısına göre karşılaştırır. Bunun için kendi nokta, çizgi ve alanlarını çizip
saklayabilir. Kapsam dışı: kimlik doğrulama, yol ağı üzerinden mesafe (tüm mesafeler kuş uçuşu), çok kullanıcılı yetkilendirme.

## Özellikler
- **Gerçek veri:** 17 ilçe sınırı (MultiPolygon) ve 911 sağlık tesisi (Point), OpenStreetMap kaynaklı.
- **Harita:**
  - Katmanlar açılıp kapatılabilir; iki altlık vardır: OSM Standart ve OpenFreeMap Positron. Altlık değişince veri katmanları,
    seçim, analiz sonucu ve çizim taslağı korunur.
  - Harita sol tuşla veya orta tuşla sürüklenebilir.
- **Öznitelikler:** Tıklanan ilçe veya tesisin bilgileri yan panelde görünür: tür, ilçe, OSM etiketleri ve OSM bağlantısı.
  Tesisler türe göre haritada gizlenip gösterilebilir.
- **Görünen alana göre yükleme:** Sağlık tesisleri haritada görünen alanın biraz genişletilmiş haliyle (bbox) istenir.
  Kaydırma veya zoom bitince yeni alan yüklenir; küçük kaydırmalar yeni istek doğurmaz. Eski istek iptal edilir. Bir görünümde
  2000'den fazla tesis varsa yakınlaştırma uyarısı çıkar ([ADR-0016](docs/DECISIONS.md)).
- **Arama:**
  - Ada, türe ve ilçeye göre sunucu tarafında, tüm veride arar.
  - Türkçe aksan ve büyük/küçük harf duyarsızdır ("nilufer" → Nilüfer).
  - Sonuçlar vurgulanır; seçilen sonuca yakınlaşılır.
- **Yerel düzenleme:** İçe aktarılan kayıtlara yerel ad ve açıklama verilebilir. Bu düzenlemeler ayrı (override) tablolarda tutulur;
  yeniden import onları ezmez. Eşzamanlı düzenleme ETag/If-Match ile korunur.
- **Kullanıcı çizimleri:**
  - Nokta, çizgi ve alan çizilir; ad (en az 3 karakter) ve açıklamayla kaydedilir.
  - Ayrı bir "Kullanıcı çizimleri" katmanında durur.
  - Geometri sürüklenerek düzenlenir; silme işlemi onay ister.
  - Çizgi ve alan "Çizimi bitir" düğmesiyle ya da Enter tuşuyla bitirilir.
  - Geometri sunucuda yeniden doğrulanır: kendini kesen şekil, ters koordinat ve aşırı köşe sayısı 422 ile reddedilir.
- **Beş analiz** (aşağıda ayrıntılı): alan içindekiler, tampon, en yakın N, metrik ölçüm, ilçe başına sayım (tablo + choropleth).
- **Harici WMS (opsiyonel madde):** "Arazi örtüsü — CORINE 2018 (WMS)" anahtarı, Avrupa Çevre Ajansı'nın (Copernicus) WMS
  servisini haritaya yarı saydam raster olarak ekler. Varsayılan kapalıdır ve altlık değişiminde korunur
  ([ADR-0015](docs/DECISIONS.md)). TUCBS denendi, ancak servisin ağ geçidi istekleri reddetti.
- **Dar ekran ve klavye:**
  - Dar ekranda (375 px) panel kendi içinde kayar ve harita görünür kalır.
  - Klavyeyle arama ve seçim yapılabilir; odak görünürdür.

## Beş analiz ve SRID/birim kararları
Veri EPSG:4326'da saklanır; GeoJSON koordinat sırası `[boylam, enlem]`'dir. 4326 derecesiyle metre hesabı yapılmaz.

| Analiz | Yöntem | Birim / sınır |
|---|---|---|
| A01 Alan içindekiler | `ST_Covers(alan, tesis)` (sınır dahil, varsayılan) / `ST_Within(tesis, alan)` (hariç) | Delik hariç, MultiPolygon'un tüm parçaları dahil |
| A02 Tampon | Seçim `ST_DWithin(geom::geography, …, r)`; çizilen tampon `ST_Buffer(geography)` | Metre (WGS84 sferoidi); çizilen tampon 64 kenarlı yaklaşık çokgendir |
| A03 En yakın N | Tüm adaylarda `ST_Distance(geography)` + `id` bağ kırıcı | Metre, kuş uçuşu; KNN (`<->`) kullanılmaz |
| A04 Ölçüm | `ST_Transform(geom, 32635)` sonrası `ST_Length` / `ST_Area` / `ST_Perimeter` | EPSG:32635 (WGS 84 / UTM 35N); veri 28.09–29.91°D, zonun (24–30°D) içinde; nokta ve zon dışı 422 |
| A05 İlçe başına sayım | Tekil atama: kapsayanlar (`ST_Covers`) içinden önce iç eşleşme (`ST_Contains`), sonra küçük ilçe id; `LEFT JOIN` + `count(tesis_id)` | Her tesis en çok bir ilçede sayılır; tesissiz ilçe 0; atanamayanlar ayrıca raporlanır |

Doğruluk testleri gerçek PostGIS üzerinde koşar ve beklenen değerleri bağımsız formüllerle hesaplar: mesafe ±5 cm, alan ve uzunluk
göreli 1e-5. Gerekçe: [ADR-0012, ADR-0013](docs/DECISIONS.md).

## Teknolojiler
| Bileşen | Sürüm |
|---|---|
| .NET SDK / ASP.NET Core | 9.0.320 / 9.0 ([ADR-0001](docs/DECISIONS.md)) |
| EF Core + Npgsql + NetTopologySuite | EF Core 9.0.22, Npgsql.EntityFrameworkCore.PostgreSQL 9.0.4, NTS 2.6.0 |
| PostgreSQL + PostGIS | `postgis/postgis:17-3.5` |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, MapLibre GL JS 6.15.0, Terra Draw 1.38.0 |
| Import | Node.js 24 + `pg` 8.23.1 |
| Test | xUnit + Testcontainers (gerçek PostGIS), Vitest + Testing Library, Playwright 1.64.1 |

**.NET 9 notu:** Ödev .NET 9'u tercih ediyor. Microsoft destek takvimine göre .NET 9 desteği 10 Kasım 2026'da sona eriyor; bu bilinen
bir kısıttır.

## Mimari
Uygulama katmanlı bir modüler monolittir: `Domain` ← `Application` ← `Infrastructure`. `Api` ince controller'lardan oluşur;
`Infrastructure`'a yalnız DI için bağlanır. Frontend veritabanına bağlanmaz; her şeyi REST API üzerinden yapar. Kaynak verisi
(`districts`, `health_facilities`), yerel düzenlemeler (`*_overrides`) ve kullanıcı çizimleri (`user_features`) ayrı tablolardadır.
API iki rolle çalışır: tabloların sahibi `geoscope` (migration ve import) ve kısıtlı `geoscope_app` (API).
Ayrıntı: [ARCHITECTURE](docs/ARCHITECTURE.md), [DATABASE](docs/DATABASE.md).

## Önkoşullar
- Docker Desktop (Linux container)
- Elle geliştirme veya host'tan import için: .NET SDK 9.0.320 (`global.json`), Node.js ≥ 22.12

## Docker ile kurulum
```bash
cp .env.example .env                               # isteğe bağlı; yoksa aynı yerel varsayılanlar kullanılır
docker compose up --build -d                       # db → migrate (tek seferlik) → api → web
docker compose --profile tools run --rm import     # gerçek veriyi yükler (depodaki snapshot)
```
- Uygulama: http://localhost:8080
- API: http://localhost:5080/api/districts, OpenAPI: http://localhost:5080/openapi/v1.json, sağlık: `/api/health/ready`

Veri importu otomatik değildir. İlk açılışta harita boş gelir ve katman sayıları 0 görünür. Import birden çok kez çalıştırılabilir;
mükerrer kayıt üretmez. Durdurmak için `docker compose down` (veri volume'u korunur).
Giriş bilgisi yoktur: uygulama kimlik doğrulamasızdır ve yalnız `127.0.0.1`'e bağlanır. Anonim yazma API'sini genel internete açmayın.

## Ortam değişkenleri
| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `geoscope` / `geoscope` / `geoscope_dev` | Şema sahibi (migration, import) |
| `GEOSCOPE_APP_PASSWORD` | `geoscope_app_dev` | API'nin kısıtlı rolü `geoscope_app` |
| `DB_PORT` / `API_PORT` / `WEB_PORT` | `5432` / `5080` / `8080` | Host portları (127.0.0.1) |
| `GEOSCOPE_IMPORT_DATABASE_URL` | `postgres://geoscope:geoscope_dev@localhost:5432/geoscope` | Host'tan import |
| `VITE_API_BASE_URL` | boş (aynı origin `/api`) | Farklı origin'deki API için; CORS izinli origin `Cors__AllowedOrigins__0` |

Değerler yalnız yerel geliştirme içindir. `.env` Git dışındadır.

## Veritabanı ve migration
Şema yalnız EF Core migration'larıyla kurulur (`backend/GeoScope.Infrastructure/Persistence/Migrations`). Compose'daki `migrate`
servisi bunları uygular. Elle uygulamak için:
```bash
dotnet tool restore
GEOSCOPE_MIGRATION_CONNECTION="Host=localhost;Port=5432;Database=geoscope;Username=geoscope;Password=geoscope_dev" \
  dotnet tool run dotnet-ef database update --project backend/GeoScope.Infrastructure --startup-project backend/GeoScope.Infrastructure
```
Tablolar, indeksler (GiST ve geography ifade indeksi) ve CHECK kısıtları: [docs/DATABASE.md](docs/DATABASE.md).

## Veri kaynağı, lisans ve import
- **Kaynak:** OpenStreetMap, Overpass API ile indirildi (2026-11-04). İlçeler `admin_level=6` relation (MultiPolygon). Tesisler:
  hastane, klinik, muayenehane, diş hekimi, eczane ve diğer `healthcare=*` nesneleri (Point; bina olarak çizilmişlerse içteki bir nokta).
- **Lisans:** © OpenStreetMap katkıcıları, [ODbL 1.0](https://www.openstreetmap.org/copyright). Altlık karoları ayrıca
  [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) ve OpenFreeMap koşullarına tabidir. Atıf haritada görünür.
- **Depodaki snapshot:** `data/samples/osm-bursa/2026-11-04T17-05-11-619Z/` (≈1 MB, checksum'lı manifest).
  `data/test-fixtures/` altındaki veri **sentetiktir** ve yalnız testler içindir.
- **İndirme ve import** (ayrıntı: [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md)):
  ```bash
  npm ci                                            # kök araç bağımlılıkları (pg)
  npm run import:fetch                              # isteğe bağlı: Overpass'tan güncel snapshot → data/raw/osm/
  export GEOSCOPE_IMPORT_DATABASE_URL=postgres://geoscope:geoscope_dev@localhost:5432/geoscope
  npm run import:load                               # en yeni snapshot: data/raw/osm, yoksa data/samples
  ```
  Import şunları yapar:
  - Checksum'ı doğrular.
  - Geometriyi PostGIS'te kurar ve doğrular.
  - Tek transaction'da yazar.
  - `import_history` tablosuna kalite raporu kaydeder.
  - Kaynaktan kalkan kaydı silmez, "kaynakta silindi" diye işaretler.

  Tekrar import güvenlidir: değişmeyen kayıt güncellenmez, yerel düzenlemeler korunur. Snapshot aktif kaydın yarısından azını
  içeriyorsa (ör. boş Overpass yanıtı) import geri alınır. Bilinçli durumlarda `--allow-mass-delete` kullanılır.

## API
REST + GeoJSON (RFC 7946, `crs` üyesi yok). Hatalar `application/problem+json` biçiminde ve `traceId` içerir.
Sözleşme: [docs/API-CONTRACT.md](docs/API-CONTRACT.md); çalışan şema: `/openapi/v1.json`.

| Yol | İşlev |
|---|---|
| `GET /api/layers`, `/api/districts`, `/api/facilities` | Katman kataloğu; bbox, arama (`q`), tür, ilçe, sayfalama (≤ 2000) |
| `GET/PATCH /api/districts/{id}`, `/api/facilities/{id}` | Detay; yerel ad/açıklama (If-Match) |
| `GET/POST /api/features`, `GET/PATCH/DELETE /api/features/{id}` | Kullanıcı çizimleri |
| `POST /api/analysis/within`, `/buffer`, `/nearest`, `/measure`; `GET /api/analysis/district-stats` | A01-A05 |

## Elle geliştirme
```bash
docker compose up -d db migrate
dotnet run --project backend/GeoScope.Api          # http://localhost:5080 (geoscope_app rolüyle)
npm --prefix frontend ci
npm --prefix frontend run dev                      # http://localhost:5173, /api → 5080
```

## Testler
```bash
npm ci                                             # import entegrasyon testleri Node + pg kullanır
dotnet test backend                                # Docker çalışıyor olmalı (Testcontainers, geçici PostGIS)
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run e2e                      # Playwright: çalışan uygulama + import edilmiş veri (E2E_BASE_URL)
node scripts/validate-project.mjs --full           # tüm faz kapıları
```
Son sonuçlar ve performans ölçümü (10.000 tesiste tüm senaryolar p95 < 75 ms): [docs/TEST-PLAN.md](docs/TEST-PLAN.md).

## Ekran görüntüleri
| | |
|---|---|
| ![Arama ve detay](docs/screenshots/faz3-search-details.png) | ![Harita](docs/screenshots/faz2-map.png) |
| ![Tampon 2000 m](docs/screenshots/faz8-tampon-2000m.png) | ![CORINE 2018 WMS](docs/screenshots/wms-corine-2018.png) |

## Demo senaryosu
1. Temiz kurulum ve import; harita Bursa verisiyle açılır.
2. Katmanları açıp kapatın; "Sade (Positron)" altlığına geçin. "Arazi örtüsü — CORINE 2018 (WMS)" katmanını açın.
3. Bir ilçeye ve bir tesise tıklayın. "nilufer" ve "devlet hastanesi" aramalarını deneyin.
4. Bir tesise yerel açıklama verin; sayfayı yenileyin, açıklama korunur. Yeniden import da bu açıklamayı ezmez.
5. Nokta, çizgi ve alan çizip kaydedin. Birini düzenleyin, sonra silin.
6. Analiz → "Alan içindekiler": Nilüfer seçiliyken çalıştırın.
7. Bir hastane seçin → "Tampon (yakınlık)", 2000 m.
8. "En yakın N" → "Haritada nokta seç" → 5 tesis listelenir.
9. "Ölçüm": bir ilçe ya da çizgi seçin (km/km², EPSG:32635). "İlçe başına tesis sayısı" → Hesapla (tablo ve choropleth).
10. Hata durumu: çizerken kendini kesen bir alan kaydetmeyi deneyin (422 mesajı) ya da bir tesis seçiliyken "Ölçüm" seçin
    ("Desteklenmeyen ölçüm").

## Bilinen kısıtlar
- Mesafeler kuş uçuşudur; yol ağı kullanılmaz.
- Klavye ile çizim (köşe ekleme) desteklenmez; çizim fare veya dokunma ister.
- İlçe sınırları (17) tam çözünürlükte ve tek istekte gelir (gzip ≈ 97 KB); tesisler bbox ile yüklenir. 10.000 tesis
  ölçeğinde uzak zoom'da görünüm 2000 sınırına takılabilir; o durumda yakınlaştırma uyarısı gösterilir.
- WMS katmanı dış servise bağlıdır. Servis yanıt vermezse haritada uyarı çıkar ve diğer katmanlar çalışmaya devam eder.
  CORINE renk lejantı uygulamada gösterilmez.
- En yakın N tam tarama yapar (10.000 tesiste p50 19 ms). 100.000+ kayıtta KNN ile kesin yeniden sıralama değerlendirilir.
- OSM standart karoları yalnız hafif kullanım içindir; yoğun kullanımda kendi karo sunucunuz gerekir.

## Sorun giderme
- **Harita boş, sayılar 0:** import çalıştırılmamıştır → `docker compose --profile tools run --rm import`.
- **"Veritabanı: Hazır değil":** `docker compose ps` ile `db` sağlıklı mı, `migrate` başarıyla bitmiş mi kontrol edin.
- **Eski (Faz 1) volume'da API 500 / yetki hatası:** uygulama rolü yalnız yeni volume'da otomatik oluşur. Bir kez şunu çalıştırın:
  `docker compose exec db sh /docker-entrypoint-initdb.d/10-app-role.sh`.
- **Port çakışması:** `.env` içinde `DB_PORT`, `API_PORT`, `WEB_PORT` değerlerini değiştirin.
- **Altlık karoları yüklenmiyor:** haritada uyarı görünür ve veri katmanları çalışmaya devam eder; diğer altlığı seçin.
- **`dotnet build` dosya kilitli (MSB3027):** çalışan `dotnet run` sürecini durdurup tekrar derleyin.

## Belgeler
[Mimari](docs/ARCHITECTURE.md) · [Veritabanı](docs/DATABASE.md) · [API](docs/API-CONTRACT.md) · [Veri kaynakları](docs/DATA-SOURCES.md) ·
[Kararlar](docs/DECISIONS.md) · [Yol haritası](docs/ROADMAP.md) · [Test planı](docs/TEST-PLAN.md) · [Teslim listesi](docs/DELIVERY-CHECKLIST.md) ·
[Geliştirici kontrol noktaları](docs/DEVELOPER-REVIEW.md)
