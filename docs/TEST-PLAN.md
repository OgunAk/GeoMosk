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
| `MigrationTests` (13) — Faz 2 | Entegrasyon | Tekrar migration no-op; kolon typmod'ları (4326); GiST + geography indeksi; CHECK'lerin kendini kesen/Multi*/boş geometriyi ve yanlış SRID'yi reddi; Point/LineString/Polygon kabulü |
| `ImportPipelineTests` (4) — Faz 2 | Entegrasyon (Node import + PostGIS) | Halka birleşimi + delik; delikteki nokta kapsanmaz; temsilî nokta alan içinde; tür eşleme; kalite raporu sayıları; idempotent tekrar import (updated_at değişmez); override korunur + silinen kayıt işaretlenir; bozuk checksum reddi ve veri değişmemesi |
| `SourceLayerApiTests` (14) — Faz 2 | API + PostGIS | RFC 7946 şekli, `crs` yok, [boylam, enlem]; silinmiş kayıt dönmez; bbox gerçek kesişim (delikteki kutu ilçeyi döndürmez); sayfalama hasMore + stabil sıra; bbox/limit/offset doğrulama 400 + traceId; OpenAPI geometri şeması |
| `LayerSummary.test.tsx` (3) — Faz 2 | Frontend | Sayılar + atıf; sayfa sınırı aşımında uyarı; hata + tekrar dene |
| `scripts/hooks/tests` (20) | Araç | Hook davranışı |

## Manuel / tarayıcı doğrulamaları
| Tarih | Senaryo | Sonuç |
|---|---|---|
| 2026-11-04 | Playwright CLI, `http://127.0.0.1:8080/` (compose) | "Veritabanı: Hazır (PostGIS 3.5.2)", konsol hatası 0; ekran görüntüsü `docs/screenshots/faz1-system-status.png` |
| 2026-11-04 | `docker compose stop db` sırasında `/api/health/ready` | 503, gövdede bağlantı ayrıntısı yok; `start db` sonrası 200 |

## Performans bütçesi (ölçülmedi)
Öneri: 10.000 tesis ile liste/arama p95 <500 ms, temel analiz p95 <1 s (PDF şartı değil). Faz 7'de donanım, veri sayısı, soğuk/sıcak, p50/p95 ve payload ile ölçülecek.

| 2026-11-04 | Playwright CLI, Faz 2 harita (compose) | 17 ilçe + 911 tesis çizildi, OSM altlığıyla hizalı, tuval 960×651, konsol hatası 0; `docs/screenshots/faz2-map.png` |
| 2026-11-04 | Temiz kurulum: ayrı Compose projesi + yeni volume | rol + migration + container import 17/911, API 200 |

Test verisi ayrımı: gerçek veri `data/samples/osm-bursa/`, sentetik fixture `data/test-fixtures/osm-mini/` (README'de etiketli).

## Bilinen eksikler
- CI: Faz 1 GitHub Actions çalışması yeşil (4/4). Faz 2 değişiklikleri henüz push edilmedi.
- Mobil yerleşim tarayıcıda denenmedi. Kalıcı Playwright E2E testleri Faz 3'te eklenecek.
- Analiz doğruluk testleri Faz 5-6'da eklenecek.
