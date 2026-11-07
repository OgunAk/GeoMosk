# Mimari

Katmanlı modüler monolit (ADR-0002). Bu belge **uygulanmış** yapıyı ve planlanan ekleri ayırarak anlatır.

## Çalışma zamanı

```text
Tarayıcı ──► web (nginx 1.30.6, statik React build)
               │  /api/*  (aynı origin; container adları tarayıcıya sızmaz)
               ▼
            api (ASP.NET Core 9, port 8080) ──► db (PostgreSQL 17 + PostGIS 3.5)
```

- Geliştirmede: Vite dev sunucusu (5173) `/api` isteklerini `VITE_DEV_API_PROXY` (varsayılan `http://localhost:5080`) adresine aktarır.
- Compose portları yalnızca `127.0.0.1`'e bağlıdır; anonim yazma API'si dış ağa açılmaz.

## Backend katmanları (uygulandı: Faz 1)

| Proje | Sorumluluk | Referanslar | Faz 1 içeriği |
|---|---|---|---|
| `GeoMosk.Domain` | Entity ve domain kuralları | — | Boş (entity'ler Faz 2) |
| `GeoMosk.Application` | DTO, port arayüzleri, validasyon | Domain | `Health/IDatabaseStatusProbe` |
| `GeoMosk.Infrastructure` | EF Core DbContext, PostGIS sorguları, migration, import | Application, Domain | `GeoMoskDbContext` (Npgsql + NTS), `PostGisStatusProbe`, `AddInfrastructure` |
| `GeoMosk.Api` | HTTP, DI composition root, ProblemDetails, OpenAPI, CORS, health | Application, Infrastructure (yalnız DI) | `Program.cs`, `Health/*` |
| `GeoMosk.Tests` | Unit, mimari, entegrasyon (Testcontainers PostGIS) | hepsi | health API testleri, katman bağımlılık testleri |

Bağımlılık yönleri `LayerDependencyTests` ile derlenmiş referanslar üzerinden test edilir.

### Uygulanmış çapraz kesitler
- `AddProblemDetails` + `UseExceptionHandler` + `UseStatusCodePages`: bilinmeyen route ve hatalar `application/problem+json`.
- Health: `/api/health/live` (yalnız süreç), `/api/health/ready` (`postgis_lib_version()` sorgusu; hata ayrıntısı loga, yanıta değil).
- OpenAPI: `/openapi/v1.json` (Microsoft.AspNetCore.OpenApi 9.0.22); arayüz `/swagger` (Swashbuckle.AspNetCore.SwaggerUI 10.3.1, ADR-0018).
- CORS: `Cors:AllowedOrigins` konfigürasyonu; yöntemler GET/POST/PATCH/DELETE.
- Sürüm sabitleme: `global.json` (SDK 9.0.320), `Directory.Packages.props` (merkezi paket sürümleri), `TreatWarningsAsErrors`.

### Planlanan (henüz yok)
- Faz 2: Domain entity'leri, migration'lar (tip kısıtlı 4326 kolonlar, GiST + geography expression index), import pipeline, ayrı uygulama DB rolü (superuser olmayan).
- Faz 3+: GeoJSON controller'ları, request correlation/trace id log alanları, limit konfigürasyonu.

## Frontend (uygulandı: Faz 1)

| Yol | İçerik |
|---|---|
| `src/components/AppLayout.tsx` | Başlık + sol panel + ana alan; mobilde dikey yerleşim |
| `src/features/health/SystemStatus.tsx` | API/DB hazırlık durumu; yükleniyor/hata/503 ayrı; tekrar dene |
| `src/services/apiClient.ts`, `health.ts` | `fetch` + `AbortSignal`, `ApiError`; health sözleşme tipleri |

Planlanan: `src/features/{map,layers,search,drawing,analysis}` (Faz 2-6), MapLibre GL JS (T04), Terra Draw (P04).

## Veri akışı ilkeleri
Bkz. `.claude/rules/spatial-data.md` (4326 saklama, metrik hesap geography/metrik SRID, kaynak/kullanıcı verisi ayrımı).

## Ortam değişkenleri
| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `geomosk` / `geomosk` / `geomosk_dev` | Şema sahibi (migration, import) |
| `GEOMOSK_APP_PASSWORD` | `geomosk_app_dev` | API'nin kısıtlı rolü `geomosk_app` |
| `DB_PORT` / `API_PORT` / `WEB_PORT` | `5432` / `5080` / `8080` | Host portları (127.0.0.1) |
| `GEOMOSK_IMPORT_DATABASE_URL` | `postgres://geomosk:geomosk_dev@localhost:5432/geomosk` | Host'tan import |
| `VITE_API_BASE_URL` | boş (aynı origin `/api`) | Farklı origin'deki API için; CORS izinli origin `Cors__AllowedOrigins__0` |

Değerler yalnız yerel geliştirme içindir; `.env` Git dışındadır. Elle migration komutu: [DATABASE](DATABASE.md).

## Sorun giderme
- **Harita boş, sayılar 0:** import çalıştırılmamıştır → `docker compose --profile tools run --rm import`.
- **"Veritabanı: Hazır değil":** `docker compose ps` ile `db` sağlıklı mı, `migrate` başarıyla bitmiş mi kontrol edin.
- **Eski volume'da API 500 / yetki hatası:** uygulama rolü yalnız yeni volume'da otomatik oluşur. Bir kez:
  `docker compose exec db sh /docker-entrypoint-initdb.d/10-app-role.sh`.
- **Port çakışması:** `.env` içinde `DB_PORT`, `API_PORT`, `WEB_PORT` değerlerini değiştirin.
- **Altlık karoları yüklenmiyor:** haritada uyarı görünür, veri katmanları çalışır; diğer altlığı seçin.
- **`dotnet build` dosya kilitli (MSB3027):** çalışan `dotnet run` sürecini durdurup tekrar derleyin.
- **Aynı makinede ikinci klon:** `docker-compose.yml`'deki `name: geomosk` nedeniyle klonlar aynı veri volume'unu paylaşır;
  bir klonda `down -v` hepsinin verisini siler.
