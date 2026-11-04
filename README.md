# GeoScope

Bursa ilçeleri ve sağlık tesisleri üzerine Web CBS uygulaması (ASP.NET Core + PostgreSQL/PostGIS + React/MapLibre).

> **Durum:** Faz 1 — çalışan iskelet. Henüz harita, veri, CRUD veya analiz yok; aşağıdaki adımlar yalnızca bugün çalışan kısmı anlatır. Faz durumu: [docs/PROGRESS.md](docs/PROGRESS.md), gereksinimler: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

## Teknolojiler
| Bileşen | Sürüm |
|---|---|
| .NET SDK / ASP.NET Core | 9.0.320 / 9.0 ([ADR-0001](docs/DECISIONS.md)) |
| EF Core + Npgsql + NetTopologySuite | Npgsql.EntityFrameworkCore.PostgreSQL 9.0.4 |
| PostgreSQL + PostGIS | `postgis/postgis:17-3.5` |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| Test | xUnit + Testcontainers (gerçek PostGIS), Vitest + Testing Library |

**.NET 9 notu:** Ödev .NET 9'u tercih ediyor. Microsoft destek takvimine göre .NET 9 desteği 10 Kasım 2026'da sona eriyor; bu bilinen bir kısıttır.

## Önkoşullar
- Docker Desktop (Linux container)
- Elle geliştirme için: .NET SDK 9.0.320 (`global.json`), Node.js ≥ 22.12

## Docker ile çalıştırma
```bash
cp .env.example .env
docker compose up --build -d
```
- Uygulama: http://localhost:8080 (sol panelde API ve PostGIS durumu)
- API: http://localhost:5080/api/health/ready, OpenAPI: http://localhost:5080/openapi/v1.json

Durdurma: `docker compose down` (veri volume'u korunur).

## Elle geliştirme
```bash
docker compose up -d db
dotnet run --project backend/GeoScope.Api          # http://localhost:5080
npm --prefix frontend ci
npm --prefix frontend run dev                      # http://localhost:5173, /api → 5080
```

## Testler
```bash
dotnet test backend                                # Docker çalışıyor olmalı
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run test
node scripts/validate-project.mjs --phase 1        # tüm faz kapısı
```

## Veri kaynağı ve lisans
Faz 2'de eklenecek (kaynak, lisans/atıf, import adımları).

## Mimari
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Yol haritası: [docs/ROADMAP.md](docs/ROADMAP.md) · Test planı: [docs/TEST-PLAN.md](docs/TEST-PLAN.md)
