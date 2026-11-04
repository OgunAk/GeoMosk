# Test planı

Kurallar: `.claude/rules/testing.md`. Bu belge mevcut testleri ve komutları kaydeder; çalıştırılmamış test "geçti" yazılmaz.

## Ortam
- Windows 10 Pro, .NET SDK 9.0.320, Node 24.21.0, Docker 29.6.2 (Linux container).
- Entegrasyon DB'si: Testcontainers ile geçici `postgis/postgis:17-3.5` (compose ile aynı etiket); kullanıcı DB'sine dokunulmaz.

## Komutlar
| Seviye | Komut | Not |
|---|---|---|
| Altyapı | `node scripts/verify-agent-setup.mjs`, `npm run test:hooks` | Faz 0 |
| Backend | `dotnet build backend`, `dotnet test backend` | Docker gerekli (Testcontainers) |
| Frontend | `npm --prefix frontend run typecheck`, `lint`, `test`, `build` | Vitest + jsdom |
| Compose | `docker compose config --quiet`, `docker compose up --build -d` | |
| Faz kapısı | `node scripts/validate-project.mjs --phase N` | Yukarıdakileri çalıştırır |
| E2E | (planlanan, Faz 3) `npm --prefix frontend run e2e` — Playwright | |

## Mevcut testler (Faz 1)
| Test | Seviye | Doğruladığı |
|---|---|---|
| `HealthEndpointTests.Ready_reports_postgis_version_when_database_is_available` | API + gerçek PostGIS | ready 200, PostGIS sürümü 3.5.x |
| `…Ready_returns_503_without_leaking_connection_details…` | API | DB yokken 503, bağlantı ayrıntısı sızmıyor |
| `…Live_is_healthy_even_when_database_is_unreachable` | API | live yalnız süreç |
| `…OpenApi_document_is_served` | API | `/openapi/v1.json` |
| `…Unknown_api_route_returns_problem_details` | API | 404 `application/problem+json` |
| `LayerDependencyTests` (3) | Mimari | Katman referans yönleri |
| `SystemStatus.test.tsx` (3) | Frontend | Hazır, 503 ve ağ hatası + tekrar dene durumları |
| `scripts/hooks/tests` (20) | Araç | Hook davranışı |

## Manuel / tarayıcı doğrulamaları
| Tarih | Senaryo | Sonuç |
|---|---|---|
| 2026-11-04 | Playwright CLI, `http://127.0.0.1:8080/` (compose) | "Veritabanı: Hazır (PostGIS 3.5.2)", konsol hatası 0; ekran görüntüsü `docs/screenshots/faz1-system-status.png` |
| 2026-11-04 | `docker compose stop db` sırasında `/api/health/ready` | 503, gövdede bağlantı ayrıntısı yok; `start db` sonrası 200 |

## Performans bütçesi (ölçülmedi)
Öneri: 10.000 tesis ile liste/arama p95 <500 ms, temel analiz p95 <1 s (PDF şartı değil). Faz 7'de donanım, veri sayısı, soğuk/sıcak, p50/p95 ve payload ile ölçülecek.

## Bilinen eksikler
- CI iş akışı (`.github/workflows/ci.yml`) yazıldı; uzak depo olmadığı için GitHub'da çalıştırılmadı.
- Spatial doğruluk, migration, import ve E2E testleri ilgili fazlarda eklenecek.
