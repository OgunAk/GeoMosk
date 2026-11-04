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
| `GeoScope.Domain` | Entity ve domain kuralları | — | Boş (entity'ler Faz 2) |
| `GeoScope.Application` | DTO, port arayüzleri, validasyon | Domain | `Health/IDatabaseStatusProbe` |
| `GeoScope.Infrastructure` | EF Core DbContext, PostGIS sorguları, migration, import | Application, Domain | `GeoScopeDbContext` (Npgsql + NTS), `PostGisStatusProbe`, `AddInfrastructure` |
| `GeoScope.Api` | HTTP, DI composition root, ProblemDetails, OpenAPI, CORS, health | Application, Infrastructure (yalnız DI) | `Program.cs`, `Health/*` |
| `GeoScope.Tests` | Unit, mimari, entegrasyon (Testcontainers PostGIS) | hepsi | health API testleri, katman bağımlılık testleri |

Bağımlılık yönleri `LayerDependencyTests` ile derlenmiş referanslar üzerinden test edilir.

### Uygulanmış çapraz kesitler
- `AddProblemDetails` + `UseExceptionHandler` + `UseStatusCodePages`: bilinmeyen route ve hatalar `application/problem+json`.
- Health: `/api/health/live` (yalnız süreç), `/api/health/ready` (`postgis_lib_version()` sorgusu; hata ayrıntısı loga, yanıta değil).
- OpenAPI: `/openapi/v1.json` (Microsoft.AspNetCore.OpenApi 9.0.22).
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
