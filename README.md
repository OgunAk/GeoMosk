# GeoScope

Bursa ilçeleri ve sağlık tesisleri üzerine Web CBS uygulaması (ASP.NET Core + PostgreSQL/PostGIS + React/MapLibre).

> **Durum:** Faz 2 — gerçek veri dikey dilimi. Haritada 17 ilçe sınırı ve 911 sağlık tesisi (OpenStreetMap) gösteriliyor.
> Katman aç/kapa, arama, popup, ikinci altlık, düzenleme, çizim ve analizler sonraki fazlarda.
> Faz durumu: [docs/PROGRESS.md](docs/PROGRESS.md), gereksinimler: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

![Faz 2 harita](docs/screenshots/faz2-map.png)

## Teknolojiler
| Bileşen | Sürüm |
|---|---|
| .NET SDK / ASP.NET Core | 9.0.320 / 9.0 ([ADR-0001](docs/DECISIONS.md)) |
| EF Core + Npgsql + NetTopologySuite | EF Core 9.0.22, Npgsql.EntityFrameworkCore.PostgreSQL 9.0.4 (+ NetTopologySuite), NTS 2.6.0 |
| PostgreSQL + PostGIS | `postgis/postgis:17-3.5` |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, MapLibre GL JS 6.15.0 |
| Import | Node.js 24 + `pg` 8.23.1 |
| Test | xUnit + Testcontainers (gerçek PostGIS), Vitest + Testing Library, Playwright CLI |

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
node scripts/validate-project.mjs --phase 2        # faz kapısı
```

## Mimari ve belgeler
[Mimari](docs/ARCHITECTURE.md) · [Veritabanı](docs/DATABASE.md) · [API](docs/API-CONTRACT.md) · [Veri kaynakları](docs/DATA-SOURCES.md) · [Kararlar](docs/DECISIONS.md) · [Yol haritası](docs/ROADMAP.md) · [Test planı](docs/TEST-PLAN.md)
