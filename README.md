# GeoScope

Bursa ilçeleri ve sağlık tesisleri üzerine Web CBS uygulaması (ASP.NET Core + PostgreSQL/PostGIS + React/MapLibre).

> **Durum:** Faz 5 tamamlandı: çizim/CRUD ve üç geometrik analiz (alan içi, tampon, en yakın N). Ölçüm (A04) ve ilçe başına sayım (A05) sonraki fazda.
> Faz durumu: [docs/PROGRESS.md](docs/PROGRESS.md), gereksinimler: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

## Özellikler (bugün çalışan)
- Gerçek veri: Bursa'nın 17 ilçe sınırı (MultiPolygon) ve 911 sağlık tesisi (Point), OpenStreetMap.
- Katmanları açıp kapatma; iki altlık (OSM Standart / OpenFreeMap Positron). Altlık değişince veri katmanları, görünürlük ve seçim korunur.
- Haritada tıklanan ilçe/tesisin öznitelikleri yan panelde: tür, ilçe, kaynak OSM etiketleri ve bağlantısı.
- Sunucu tarafı arama ve filtre (ad, tesis türü, ilçe). Büyük/küçük harf ve Türkçe aksan duyarsızdır ("nilufer" → Nilüfer). Sonuçlar vurgulanır, seçilen sonuca zoom yapılır.
- Harita sol tuş ya da orta tuşla (tekerleğe basılı tutarak) sürüklenerek kaydırılır.
- Sağlık tesisleri türe göre (hastane, eczane…) haritada ayrı ayrı gizlenip gösterilebilir.
- Haritada nokta, çizgi ve alan çizilip ad/açıklamayla kaydedilebilir. Çizgi ve alan "Çizimi bitir" düğmesi ya da Enter tuşuyla bitirilir. Çizimler ayrı "Kullanıcı çizimleri" katmanındadır; geometri sürüklenerek düzenlenir, onayla silinir. Tüm işlemler REST API (`/api/features`) üzerinden yapılır ve geometri sunucuda yeniden doğrulanır.
- İçe aktarılan kayıtlara yerel ad/açıklama verilebilir.
- **Analizler (PostGIS, backend):**
  - *Alan içindekiler:* seçili ilçe/alan çizimi ya da haritada çizilen alan içindeki tesisler; sınır dahil (`ST_Covers`) veya hariç (`ST_Within`).
  - *Tampon:* seçili obje çevresinde metre cinsinden mesafe; seçim `ST_DWithin(geography)`, tampon haritada yaklaşık çokgen olarak gösterilir.
  - *En yakın N:* haritada tıklanan noktaya en yakın N tesis, kuş uçuşu metre/km ve sırayla. Kesin sferoid sıralaması kullanılır, derece tabanlı KNN değil. OSM verisi değişmez, yeniden import bu düzenlemeyi ezmez. Eşzamanlı düzenleme ETag/If-Match ile korunur.

![Arama ve detay paneli](docs/screenshots/faz3-search-details.png)

## Teknolojiler
| Bileşen | Sürüm |
|---|---|
| .NET SDK / ASP.NET Core | 9.0.320 / 9.0 ([ADR-0001](docs/DECISIONS.md)) |
| EF Core + Npgsql + NetTopologySuite | EF Core 9.0.22, Npgsql.EntityFrameworkCore.PostgreSQL 9.0.4 (+ NetTopologySuite), NTS 2.6.0 |
| PostgreSQL + PostGIS | `postgis/postgis:17-3.5` |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, MapLibre GL JS 6.15.0 |
| Import | Node.js 24 + `pg` 8.23.1 |
| Test | xUnit + Testcontainers (gerçek PostGIS), Vitest + Testing Library, Playwright 1.64.1 |

**.NET 9 notu:** Ödev .NET 9'u tercih ediyor. Microsoft destek takvimine göre .NET 9 desteği 10 Kasım 2026'da sona eriyor; bu bilinen bir kısıttır.

## Önkoşullar
- Docker Desktop (Linux container)
- Elle geliştirme / host'tan import için: .NET SDK 9.0.320 (`global.json`), Node.js ≥ 22.12

## Docker ile çalıştırma
```bash
cp .env.example .env
docker compose up --build -d                       # db → migrate (tek seferlik) → api → web
docker compose --profile tools run --rm import     # gerçek veriyi yükler (depodaki snapshot)
```
- Uygulama: http://localhost:8080
- API: http://localhost:5080/api/districts, OpenAPI: http://localhost:5080/openapi/v1.json

Veri importu otomatik değildir; ilk açılışta harita boş gelir ve yan panelde katman sayıları 0 görünür. Import birden çok kez çalıştırılabilir; mükerrer kayıt üretmez.
Durdurma: `docker compose down` (veri volume'u korunur).

> **Faz 1'den kalan volume:** Uygulama rolü (`geoscope_app`) yalnızca yeni volume'da otomatik oluşur. Faz 1 volume'u kullanıyorsanız bir kez çalıştırın:
> `docker compose exec db sh /docker-entrypoint-initdb.d/10-app-role.sh`

## Veri kaynağı, lisans ve import
- **Kaynak:** OpenStreetMap, Overpass API ile indirildi (2026-11-04). İlçeler `admin_level=6` relation (MultiPolygon). Tesisler: hastane, klinik, muayenehane, diş hekimi, eczane ve diğer `healthcare=*` nesneleri (Point).
- **Lisans:** © OpenStreetMap katkıcıları, [ODbL 1.0](https://www.openstreetmap.org/copyright). Altlık karoları ayrıca [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) koşullarına tabidir.
- **Depodaki snapshot:** `data/samples/osm-bursa/2026-11-04T17-05-11-619Z/` (≈1 MB, checksum'lı manifest).
- **Adımlar** (ayrıntı: [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md)):
  ```bash
  npm ci                                            # kök araç bağımlılıkları (pg)
  npm run import:fetch                              # isteğe bağlı: Overpass'tan güncel snapshot → data/raw/osm/
  export GEOSCOPE_IMPORT_DATABASE_URL=postgres://geoscope:geoscope_dev@localhost:5432/geoscope
  npm run import:load                               # en yeni snapshot: data/raw/osm, yoksa data/samples
  ```
  Snapshot aktif kaynak kaydının yarısından azını içeriyorsa (ör. boş Overpass yanıtı) import geri alınır; bilinçli durumda `--allow-mass-delete`.
  Import checksum'ı doğrular, geometriyi PostGIS'te kurar ve doğrular (EPSG:4326, GiST indeksli tablolar), tek transaction'da yazar ve `import_history` tablosuna kalite raporu kaydeder.

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
dotnet test backend                                # Docker çalışıyor olmalı (Testcontainers)
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run e2e                      # Playwright: çalışan compose + import edilmiş veri gerekir
node scripts/validate-project.mjs --phase 3        # faz kapısı (e2e dahil)
```

## Mimari ve belgeler
[Mimari](docs/ARCHITECTURE.md) · [Veritabanı](docs/DATABASE.md) · [API](docs/API-CONTRACT.md) · [Veri kaynakları](docs/DATA-SOURCES.md) · [Kararlar](docs/DECISIONS.md) · [Yol haritası](docs/ROADMAP.md) · [Test planı](docs/TEST-PLAN.md)
