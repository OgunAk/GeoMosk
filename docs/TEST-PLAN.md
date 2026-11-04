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
| E2E | `npm --prefix frontend run e2e` — Playwright 1.64.1 | Çalışan compose + import gerekir; yerelde kurulu Chrome (`channel: chrome`), CI'da Chromium |

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
| `LayerPanel.test.tsx` (5) — Faz 2-3 | Frontend | Sayılar + atıf; katman anahtarı; altlık seçimi; sayfa sınırı uyarısı; hata + tekrar dene |
| `SourceFeatureDetailAndEditTests` (28) — Faz 3 | API + PostGIS | Katman kataloğu; tekil Feature + ETag + kaynak etiketleri; 404 (yok/silinmiş); Türkçe aksan/büyük harf duyarsız arama, `%`/`_` kaçışı; sınır dahil ilçe filtresi; tür/ilçe doğrulaması; PATCH null semantiği + kaynak adı korunur + aramada yerel ad; 412 eski sürüm; 428 If-Match yok; allowlist (geom/osmId), boş/uzun/yanlış tip; 404; 415; HTML metni düz metin |
| `SearchPanel.test.tsx` (5) — Faz 3 | Frontend | Debounce (tek istek), sonuç + vurgu bildirimi, adsız tesis etiketi, seçim, tür/ilçe filtre sorgusu, sınır aşımı, ölçüt temizlenince vurgu kaldırma, sunucu doğrulama mesajı |
| `FeatureEditor.test.tsx` (5) — Faz 3 | Frontend | Yalnız değişen alan + If-Match; boş ad engeli; 412'de kaydetmeme + güncel kaydı yükle; kaynak adına dön (name: null); ağ hatasında taslak korunur |
| `tests/e2e/map.spec.ts` (5) — Faz 3 | E2E (gerçek tarayıcı + compose + gerçek veri) | İki katman + sayılar + atıf, konsol hatası yok; katman aç/kapa + altlık değişiminde katman/görünürlük korunur (OSM ↔ Positron); "nilufer" araması → vurgu + seçim + zoom; haritaya tıklama → detay (temsilî nokta notu); yerel açıklama kaydı yenilemede korunur, sonra geri alınır |
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

| 2026-11-04 | curl, compose API: 3 MiB PATCH gövdesi | 413 (önce 500 bulundu ve düzeltildi); nginx üzerinden de 413. TestServer bu sınırı uygulamadığı için otomatik test yok |
| 2026-11-04 | Playwright CLI ekran görüntüsü (Positron + arama + detay) | `docs/screenshots/faz3-search-details.png`, konsol hatası 0 |

Test verisi ayrımı: gerçek veri `data/samples/osm-bursa/`, sentetik fixture `data/test-fixtures/osm-mini/` (README'de etiketli).

## Bilinen eksikler
- CI: Faz 1 GitHub Actions çalışması yeşil (4/4). Faz 2-3 değişiklikleri (e2e işi dahil) henüz push edilmedi.
- Mobil yerleşim ve klavye-yalnız gezinme E2E'de yok (Faz 7). E2E düzenleme testi paylaşılan veriyi değiştirip geri alır; sıralı çalışır.
- Analiz doğruluk testleri Faz 5-6'da eklenecek.
