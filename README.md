# GeoMosk

Bursa'nın 17 ilçesi ve 911 sağlık tesisi üzerine bir Web CBS uygulaması. Veri, gerçek OpenStreetMap verisidir.
Haritada katman ve altlık yönetimi, arama, öznitelik düzenleme, kullanıcı çizimleri ve beş mekânsal analiz sunar.
Analizlerin hepsi backend'de PostGIS ile çalışır.

![İlçe başına tesis sayısı (choropleth)](docs/screenshots/faz6-choropleth.jpg)

> Kod içindeki adlar eski kod adı **GeoScope** ile kalır: `GeoScope.*` .NET projeleri, `geoscope` veritabanı, `GEOSCOPE_*`
> ortam değişkenleri ve depo adresi ([ADR-0017](docs/DECISIONS.md)).

## Hızlı başlangıç
Gerekli olan yalnız **Docker Desktop**'tır; .NET veya Node.js kurmanız gerekmez.

```bash
git clone https://github.com/OgunAk/GeoScope.git
cd GeoScope
docker compose up --build -d                       # db → migrate → api → web
docker compose --profile tools run --rm import     # gerçek OSM verisini yükler
```

| Adres | İçerik |
|---|---|
| http://localhost:8080 | Uygulama (katman panelinde 17 ilçe ve 911 tesis görünmelidir) |
| http://localhost:8080/swagger | API arayüzü (Swagger UI, tarayıcıdan istek gönderilebilir) |
| http://localhost:5080/openapi/v1.json | OpenAPI şeması |

Durdurmak için `docker compose down` (veri korunur). `docker compose down -v` veritabanını siler.

`.env` dosyası isteğe bağlıdır; yoksa `.env.example`'daki yerel varsayılanlar kullanılır. Port çakışmasında
`cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`) ile kopyalayıp `DB_PORT`, `API_PORT`, `WEB_PORT` değerlerini
değiştirin.

## Giriş bilgileri
- **Uygulama:** kullanıcı adı ya da parola yoktur. Uygulama kimlik doğrulamasızdır (ödevde istenmiyor) ve yalnız
  `127.0.0.1`'e bağlanır.
- **Veritabanı** (yerel geliştirme varsayılanları, `localhost:5432`, veritabanı `geoscope`):

  | Rol | Kullanıcı / parola | Kullanım |
  |---|---|---|
  | Şema sahibi | `geoscope` / `geoscope_dev` | Migration ve import |
  | Uygulama | `geoscope_app` / `geoscope_app_dev` | API (kısıtlı yetki, superuser değil) |

## Özellikler
- **Harita:** katmanlar açılıp kapatılır; iki altlık vardır (OSM Standart, OpenFreeMap Positron). Altlık değişince katmanlar,
  seçim, analiz sonucu ve yarım çizim korunur. İsteğe bağlı harici WMS katmanı: CORINE 2018 arazi örtüsü.
- **Öznitelikler:** tıklanan ilçe ya da tesisin bilgileri yan panelde görünür. Tesise tıklayınca harita yaklaşır.
- **Arama:** ad, tür ve ilçeye göre sunucuda arar; Türkçe aksan duyarsızdır ("nilufer" → Nilüfer).
- **Yerel düzenleme:** kayıtlara yerel ad ve açıklama verilir. Bu düzenlemeler ayrı tabloda tutulur, yeniden import onları ezmez.
- **Kullanıcı çizimleri:** nokta, çizgi ve alan çizilir, kaydedilir, düzenlenir, silinir. Geometri sunucuda yeniden
  doğrulanır; kendini kesen şekil ya da ters koordinat 422 ile reddedilir.
- **Beş analiz:**

  | Analiz | Yöntem | Birim / sınır |
  |---|---|---|
  | Alan içindekiler | `ST_Covers(alan, tesis)` (sınır dahil) / `ST_Within` (hariç) | MultiPolygon'un tüm parçaları; delik hariç |
  | Tampon | `ST_DWithin(geography, r)` | Metre (WGS84 sferoidi) |
  | En yakın N | `ST_Distance(geography)` + `id` ile sıralama | Metre, kuş uçuşu |
  | Ölçüm | `ST_Transform(geom, 32635)` sonrası `ST_Length` / `ST_Area` | EPSG:32635 (UTM 35N) |
  | İlçe başına sayım | Her tesis tek ilçeye atanır; tablo + choropleth | Ortak sınırdaki tesis iki kez sayılmaz |

  Veri EPSG:4326'da saklanır; dereceyle metre hesabı yapılmaz. Doğruluk testleri gerçek PostGIS üzerinde koşar.

## Teknolojiler
| Bileşen | Sürüm |
|---|---|
| Backend | ASP.NET Core Web API, .NET 9 (SDK 9.0.320), C# |
| Veri erişimi | EF Core 9.0.22, Npgsql 9.0.4, NetTopologySuite 2.6.0 |
| Veritabanı | PostgreSQL 17 + PostGIS 3.5 (`postgis/postgis:17-3.5`) |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, MapLibre GL JS 6.15.0, Terra Draw 1.38.0 |
| Import | Node.js 24 + `pg` 8.23.1 |
| Test | xUnit + Testcontainers (gerçek PostGIS), Vitest + Testing Library, Playwright |
| Çalıştırma | Docker Compose, nginx, GitHub Actions CI |

Mimari: katmanlı modüler monolit (`Domain` ← `Application` ← `Infrastructure` ← `Api`). Frontend veritabanına bağlanmaz,
her şeyi REST API üzerinden yapar. Ayrıntı: [ARCHITECTURE](docs/ARCHITECTURE.md), [DATABASE](docs/DATABASE.md),
[API-CONTRACT](docs/API-CONTRACT.md).

## Veri kaynağı ve lisans
- **Kaynak:** OpenStreetMap, Overpass API ile 2026-11-04'te indirildi. İlçeler `admin_level=6` sınırları; tesisler hastane,
  klinik, diş hekimi, eczane ve diğer `healthcare=*` nesneleri.
- **Veri lisansı:** © OpenStreetMap katkıcıları, [ODbL 1.0](https://www.openstreetmap.org/copyright). Atıf haritada görünür.
  Altlık karoları [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) ve OpenFreeMap koşullarına tabidir.
- **Yazılım lisansı:** [MIT](LICENSE). MOSK Bilişim logosu (`frontend/public/geomosk-logo.png`), OSM verisi ve üçüncü taraf
  paketler bu lisansın dışındadır.
- `data/test-fixtures/` altındaki veri **sentetiktir** ve yalnız testlerde kullanılır.

Ayrıntı: [DATA-SOURCES](docs/DATA-SOURCES.md).

## Verinin veritabanına yüklenmesi
SQL dump kullanılmaz. Ham veri ve onu yükleyen script repodadır (≈1 MB, indirme bağlantısı gerekmez):

| Dosya | İşlev |
|---|---|
| `data/samples/osm-bursa/2026-11-04T17-05-11-619Z/` | OSM snapshot'ı: ilçeler, tesisler ve SHA-256 checksum'lı manifest |
| `scripts/import/load-osm.mjs` | Snapshot'ı PostGIS'e yükler |
| `scripts/import/fetch-osm.mjs` | İsteğe bağlı: Overpass'tan yeni snapshot indirir |

**Docker ile (önerilen):** `docker compose --profile tools run --rm import`

**Host'tan (Node.js ≥ 22.12):**
```bash
docker compose up -d db migrate
npm ci
export GEOSCOPE_IMPORT_DATABASE_URL=postgres://geoscope:geoscope_dev@localhost:5432/geoscope
# PowerShell: $env:GEOSCOPE_IMPORT_DATABASE_URL = "postgres://geoscope:geoscope_dev@localhost:5432/geoscope"
npm run import:load
```

Import checksum'ı doğrular, geometriyi PostGIS'te kurup doğrular ve tek transaction'da yazar. Tekrar çalıştırmak güvenlidir:
kopya kayıt oluşmaz, yerel düzenlemeler korunur. Sonuç http://localhost:5080/api/layers adresinden de görülebilir
(`featureCount`: 17 ve 911).

## Elle geliştirme ve testler
```bash
docker compose up -d db migrate
dotnet run --project backend/GeoScope.Api          # http://localhost:5080
npm --prefix frontend ci
npm --prefix frontend run dev                      # http://localhost:5173

dotnet test backend                                # Docker gerekli (Testcontainers, geçici PostGIS)
npm --prefix frontend run test                     # Vitest; ayrıca: typecheck, lint, e2e (Playwright)
```
Test sonuçları ve performans ölçümü: [TEST-PLAN](docs/TEST-PLAN.md).

## Demo senaryosu
1. Katmanları açıp kapatın, "Sade (Positron)" altlığına geçin.
2. Bir ilçeye ve bir tesise tıklayın; "nilufer" ve "devlet hastanesi" aramalarını deneyin.
3. Bir tesise yerel açıklama verin, sayfayı yenileyin: açıklama korunur.
4. Nokta, çizgi ve alan çizip kaydedin; birini düzenleyin, sonra silin.
5. Analiz: Nilüfer seçiliyken "Alan içindekiler"; bir hastane için 2000 m "Tampon"; haritadan nokta seçip "En yakın N";
   bir ilçe için "Ölçüm"; "İlçe başına tesis sayısı" → Hesapla.
6. Hata durumu: kendini kesen bir alan kaydetmeyi deneyin (422 mesajı).

## Bilinen kısıtlar
- Mesafeler kuş uçuşudur; yol ağı kullanılmaz.
- Çizim fare ya da dokunma ister; klavyeyle köşe eklenemez.
- WMS katmanı dış servise bağlıdır; servis yanıt vermezse uyarı çıkar, diğer katmanlar çalışır.
- .NET 9 desteği 10 Kasım 2026'da sona eriyor; .NET 9 ödevin tercihiydi.

## Geliştirme süreci ve yapay zekâ kullanımı
Proje, geliştirici (OgunAk) yönetiminde **Claude Code** (Anthropic) yapay zekâ asistanıyla geliştirildi. Kapsam, mimari
seçimler ve ürün kararları geliştiricinindir; kodun ve belgelerin büyük kısmını yapay zekâ yazdı. Commit'lerdeki
`Co-Authored-By: Claude` satırları bunu gösterir.

- **Geliştiricinin kendi incelemesi:** manuel demo sonuçları ve teknik sorulara verdiği yanıtlar, yapay zekâ açıklamalarından
  ayrı sütunda: [DEVELOPER-REVIEW](docs/DEVELOPER-REVIEW.md).
- **Kararlar:** [DECISIONS](docs/DECISIONS.md) (ADR'ler).
- **Süreç kayıtları:** uygulamayı çalıştırmak için gerekmez.

  | Yol | İçerik |
  |---|---|
  | `CLAUDE.md`, `.claude/` | Yapay zekâ asistanının proje talimatları, kuralları, ajan ve skill tanımları |
  | `GEOSCOPE_MASTER_PROMPT.md` | Projenin başında yazılan kapsam ve kalite tanımı |
  | `docs/REQUIREMENTS.md`, `PROGRESS.md`, `ROADMAP.md` | Gereksinim izlenebilirliği ve faz kayıtları |
  | `docs/FILE-MANIFEST.md`, `AI-TOOLS.md`, `DELIVERY-CHECKLIST.md` | Dosya envanteri, araç kurulumu, teslim kontrol listesi |
  | `scripts/validate-project.mjs`, `scripts/hooks/` | Faz kapısı ve dosya denetimi script'leri |

## Ödev teslim maddeleri
| Madde | Bölüm |
|---|---|
| Proje GitHub'a yüklenir | https://github.com/OgunAk/GeoScope |
| Kurulum adımları | [Hızlı başlangıç](#hızlı-başlangıç) |
| Kullanılan teknolojiler | [Teknolojiler](#teknolojiler) |
| Veri kaynağı ve lisansı | [Veri kaynağı ve lisans](#veri-kaynağı-ve-lisans) |
| Verinin veritabanına yüklenme adımları; import script'i | [Verinin veritabanına yüklenmesi](#verinin-veritabanına-yüklenmesi) |
| Giriş bilgileri | [Giriş bilgileri](#giriş-bilgileri) |
