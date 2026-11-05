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
| `UserFeatureApiTests` (36) — Faz 4 | API + PostGIS | Üç tip 201 + Location + ETag, SRID 4326, [boylam, enlem]; kaynak tablolarından ayrı; API yeniden başlatmada kalıcılık; oluşturma sırası; 422: MultiPoint, GeometryCollection, açık halka, kendini kesen, ters koordinat (çalışma alanı), 3B, aralık dışı, tek nokta, tekrar eden nokta, crs, 10 001 köşe; 400: biçim, eksik alanlar, boş ad, yabancı alan, istemci id'si, Feature olmayan gövde, bozuk JSON; PATCH atomik ad+geometri, geçersiz geometride hiçbir şey değişmez, null/yabancı alan 400, 412/428; DELETE 428/412/204/404; GUID olmayan rota; DB CHECK ikinci hat |
| `CreateFeatureForm.test.tsx` (5), `UserFeaturePanel.test.tsx` (4) — Faz 4 | Frontend | POST gövdesi RFC 7946; boş ad; 422 mesajı + form korunur; çift gönderim engeli; köşe sınırı uyarısı; onaylı silme + If-Match; silmeden vazgeçme; 412'de güncel kaydı yükleme; geometri düzenleme başlat/vazgeç |
| `DrawingToolbar.test.tsx` (3), `LayerPanel.test.tsx` (+2) — Faz 4 geri bildirimi | Frontend | "Çizimi bitir" düğmesi ve ipucu (çizgi/alan), noktada gösterilmez; tür anahtarları sayılarıyla, tesis katmanı kapalıyken devre dışı |
| `tests/e2e/drawing.spec.ts` (4) — Faz 4 | E2E | Nokta çiz/kaydet/yenile/tıklayıp seç/onayla sil; çizgi (Enter ile bitir, tam 3 köşe) + alan ("Çizimi bitir", 3 köşe + kapanış) çiz, alan köşesini sürükleyip geometriyi kaydet, açıklama düzenle, sil; altlık değişince taslak korunur ve doğru konumla kaydedilir; 503'te taslak ve form korunur, tekrar denemede kaydedilir |
| `AnalysisApiTests` (17) — Faz 5 | Spatial + API + PostGIS | Bağımsız WGS84 referansıyla mesafe (±5 cm); tampon: derece/metre tuzağı (0.02° boylam içeride, enlem dışarıda), 1990/2010 m eşik, kaynak id hariç/aynı koordinat dahil, tampon alanı ≥%99 πr², çizgi kaynağı, r ≤0 / >50 000 → 400; nearest: (mesafe, id) referans sırası, eşit mesafe, N>veri, tür ve maxDistance, n=0/101, ters koordinat ve Point olmayan girdi 422; within: delik, sınır dahil/hariç, MultiPolygon ikinci parça, çizilen ve kullanıcı Polygon kaynağı, nokta kaynak 422, ikisi/hiçbiri 400, geçersiz 422, yok 404, kötü id 400; bilinmeyen alan 400, JSON dışı 415 |
| `AnalysisPanel.test.tsx` (7) — Faz 5 | Frontend | formatDistance (m/km, tr); alan analizinde seçili ilçe ve includeBoundary; nokta seçiliyken alan analizi kapalı; tampon metre sınırları ve gövde; nearest nokta seçme; sonuç sırası/mesafe/tıklama; sunucu 422 mesajı |
| `MeasureAndDistrictStatsApiTests` (11) — Faz 6 | Spatial + API + PostGIS | A04: dörtgen alanı ve çevresi, kuzey-güney çizgi uzunluğu bağımsız referansla (elipsoid alanı × UTM k², göreli 1e-5); merkez meridyenden uzakta projeksiyon–sferoid farkı (−%0,04…−%0,07); delik hariç; iki parçalı ilçe toplamı; nokta, tesis kaynağı ve kullanıcı nokta çizimi 422 "Desteklenmeyen ölçüm"; UTM 35N dışı (30.02°D) 422; 404/400/kendini kesen 422. A05: sınırda iki ilçe → küçük id, sınırda + başka ilçenin içinde → iç eşleşme, tesissiz ilçe 0, atanamayan, silinmiş kayıt sayılmaz, toplamlar tutarlı, override adı, tür filtresi, geçersiz tür 400 + traceId |
| `choropleth.test.ts` (4), `DistrictStatsPanel.test.tsx` (3), `AnalysisPanel.test.tsx` (+3) — Faz 6 | Frontend | Sıfır sınıfı ayrı; sınıflar boşluksuz/örtüşmesiz, tüm ilçeleri kapsar, aynı değer bölünmez; tablo sırası, toplamlar, lejant, satır seçimi, hata; ölçüm isteği, nokta için devre dışı, sonuç km²/km ve SRID |
| `tests/e2e/analysis.spec.ts` (+2) — Faz 6 | E2E (gerçek veri) | Nilüfer ölçümü arayüz = API, EPSG:32635, sferoid farkı < %0,1; ilçe sayımı: ilçe toplamı = atanan, atanan + atanamayan = 911 = tesis listesi, choropleth tüm ilçeleri boyar ve altlık değişiminde korunur, tablodan seçim, kapatınca katman temizlenir; taşma testi "Ölçüm" modunu da kapsar |
| Faz 7 — inceleme bulguları ve sağlamlaştırma | API + PostGIS / Import / Frontend / E2E | SQL injection yükleri aramada düz metin (3 yük, tablo sayısı değişmez, `pg_sleep` çalışmaz); kullanıcı çizimi adı ≥ 3 karakter (+3 durum); tesis detayındaki ilçe A05 tekil atamasıyla aynı; CORS `Access-Control-Expose-Headers: ETag`; boş snapshot toplu "silindi" işaretlemez (import geri alınır, geçmiş `failed`); manifest dosya adı klasör dışına çıkamaz; XSS — HTML içeren ad/açıklama düz metin; kısa adlı eski kayıtta açıklama düzenlenebilir; kullanıcı katmanı 2000 sınırı uyarısı; `accessibility.spec.ts` (3): 375×812'de harita görünür alanda, yatay taşma yok, panel kendi içinde kayar; yalnız klavye ile arama → seçim ve görünür odak; altlık servisi erişilemezken uyarı ve veri katmanları; altlık değişiminden sonra katman sırası (analysis.spec) |
| `analysisSelection.test.ts` (6) — Faz 5 geri bildirimi | Frontend | Başka ilçe/tesis/çizim seçilince sonuç temizlenir; analiz kaynağı veya sonuç listesindeki tesis seçilince korunur; seçimi kaldırmak sonucu silmez |
| `tests/e2e/analysis.spec.ts` (5) — Faz 5 | + Nilüfer analizi → listeden tesis seçimi sonucu korur → haritada başka ilçeye tıklayınca sonuç kaybolur |
| (analiz E2E senaryoları) | E2E (gerçek veri) | Nilüfer içi tesis sayısı = API ilçe filtresi; 2000 m tampon (Polygon, mesafeler ≤2000 ve sıralı); haritadan nokta + en yakın 5 (sıra 1-5, bağlantılar, temizle); analiz için çizilen alan kullanıcı katmanına kaydedilmez |
| `tests/e2e/map.spec.ts` (7) — Faz 3-4 | + tesis türü filtresi haritaya uygulanır ve altlık değişiminde korunur; orta tuşla sürükleme haritayı kaydırır ve seçim açmaz (drawing.spec: alan çizerken orta tuşla kaydırma köşe eklemez) |
| (Faz 3 senaryoları) | E2E (gerçek tarayıcı + compose + gerçek veri) | İki katman + sayılar + atıf, konsol hatası yok; katman aç/kapa + altlık değişiminde katman/görünürlük korunur (OSM ↔ Positron); "nilufer" araması → vurgu + seçim + zoom; haritaya tıklama → detay (temsilî nokta notu); yerel açıklama kaydı yenilemede korunur, sonra geri alınır |
| `scripts/hooks/tests` (20) | Araç | Hook davranışı |

## Manuel / tarayıcı doğrulamaları
| Tarih | Senaryo | Sonuç |
|---|---|---|
| 2026-11-04 | Playwright CLI, `http://127.0.0.1:8080/` (compose) | "Veritabanı: Hazır (PostGIS 3.5.2)", konsol hatası 0; ekran görüntüsü `docs/screenshots/faz1-system-status.png` |
| 2026-11-04 | `docker compose stop db` sırasında `/api/health/ready` | 503, gövdede bağlantı ayrıntısı yok; `start db` sonrası 200 |

## Performans ölçümü (Faz 7, 2026-11-05)

**Ortam:** Windows 10 Pro, Intel Core i5-12450H (12 iş parçacığı), 31,7 GB RAM; PostgreSQL 17 + PostGIS 3.5.2 Docker Desktop
container'ında (aynı makine); API `dotnet run -c Release`, `ASPNETCORE_ENVIRONMENT=Production`, HTTP/1.1, sıkıştırmasız
(üretimde nginx gzip; gzip boyutu ayrıca hesaplandı). İstemci aynı makinede Node 24 `fetch`.
**Yöntem:** `node scripts/perf/measure-api.mjs --runs 60 --concurrency 4`. Her senaryo: API açıldıktan sonra senaryonun ilk isteği
("soğuk"), 3 ısınma, 60 sıralı istek (p50/p95), sonra 4 eşzamanlı istemciyle 60 istek. Ham sonuçlar `scripts/perf/results-*.json`.
**Bütçe (master prompt §13 önerisi):** liste/arama p95 < 500 ms, temel analiz p95 < 1 s.

### 10.000 tesis (911 gerçek + 9.089 SENTETİK) + 17 gerçek ilçe
Ayrı veritabanı `geoscope_perf`: migration + gerçek snapshot import + `scripts/perf/seed-synthetic.sql` (ilçe alanıyla orantılı,
tohumlu `ST_GeneratePoints`; `source = 'synthetic'`, ad "SENTETİK tesis N"). Uygulama veritabanına dokunulmadı.

| Senaryo | Soğuk (ms) | p50 (ms) | p95 (ms) | p50 eşz. ×4 (ms) | p95 eşz. ×4 (ms) | Yanıt KB (gzip KB) |
|---|---|---|---|---|---|---|
| İlçeler (tümü, GeoJSON) | 23.2 | 12.2 | 19.6 | 29.0 | 66.2 | 310.6 (96.8) |
| Tesisler liste limit=2000 | 18.5 | 11.7 | 17.8 | 33.9 | 52.0 | 602.2 (62.6) |
| Tesisler bbox (Bursa merkez) limit=2000 | 22.2 | 5.1 | 8.4 | 9.6 | 13.6 | 122.2 (12.8) |
| Arama "eczane" | 20.1 | 15.8 | 17.4 | 16.5 | 20.2 | 14.5 (1.7) |
| Arama ilçe "nilufer" | 2.6 | 2.7 | 3.3 | 4.0 | 6.6 | 15.1 (5.2) |
| A01 alan içinde (Nilüfer) | 37.4 | 10.2 | 15.3 | 16.9 | 24.3 | 168.3 (22.6) |
| A02 tampon 2000 m (hastane) | 95.2 | 7.7 | 10.1 | 9.9 | 13.7 | 15.0 (3.3) |
| A03 en yakın 10 | 168.7 | 18.7 | 20.5 | 20.8 | 28.1 | 3.7 (0.9) |
| A04 ölçüm (Nilüfer) | 14.5 | 4.7 | 5.5 | 6.1 | 7.9 | 15.7 (5.5) |
| A05 ilçe başına sayım | 69.1 | 51.5 | 73.3 | 85.0 | 122.7 | 1.5 (0.6) |

### Gerçek veri (911 tesis, 17 ilçe; `geoscope_app` rolü)

| Senaryo | Soğuk (ms) | p50 (ms) | p95 (ms) | p50 eşz. ×4 (ms) | p95 eşz. ×4 (ms) | Yanıt KB (gzip KB) |
|---|---|---|---|---|---|---|
| İlçeler (tümü, GeoJSON) | 30.7 | 11.9 | 15.3 | 26.4 | 61.5 | 310.6 (96.8) |
| Tesisler liste limit=2000 | 13.9 | 8.4 | 12.9 | 15.1 | 23.7 | 270.2 (27.4) |
| Tesisler bbox (Bursa merkez) limit=2000 | 36.6 | 4.6 | 8.7 | 8.7 | 12.6 | 96.4 (9.9) |
| Arama "eczane" | 8.5 | 4.9 | 6.6 | 6.4 | 7.7 | 14.5 (1.7) |
| Arama ilçe "nilufer" | 3.4 | 3.1 | 4.9 | 6.5 | 9.1 | 15.1 (5.2) |
| A01 alan içinde (Nilüfer) | 48.2 | 6.2 | 9.8 | 8.9 | 12.4 | 51.3 (9.8) |
| A02 tampon 2000 m (hastane) | 120.9 | 6.2 | 8.2 | 6.4 | 8.9 | 11.6 (2.8) |
| A03 en yakın 10 | 13.1 | 4.6 | 6.6 | 5.8 | 16.6 | 3.7 (0.9) |
| A04 ölçüm (Nilüfer) | 15.0 | 4.9 | 6.0 | 7.4 | 11.8 | 15.7 (5.5) |
| A05 ilçe başına sayım | 25.6 | 9.5 | 15.5 | 11.3 | 14.2 | 1.5 (0.5) |

**Sonuç:** tüm senaryolar bütçenin çok altında (10.000 tesiste en yüksek p95: A05 73 ms; eşzamanlı ×4'te 123 ms). En büyük yanıt
ilçe sınırları (310 KB, gzip 97 KB; tam çözünürlük — sadeleştirme ölçülen ihtiyaç olmadığı için yapılmadı). Liste 2000 sınırında
kesilir ve `hasMore` ile bildirilir (10.000'de 602 KB / gzip 63 KB). En yakın N tam tarama + kesin sıralama 10.000'de p50 19 ms;
doğrusal büyüme varsayımıyla ~100.000 kayıtta ~200 ms — o ölçekte ADR-0012'deki KNN + kesin yeniden sıralama değerlendirilir.
**Frontend paketi** (`npm run build`): uygulama kodu 67 kB (gzip 18 kB), React 219 kB (68), Terra Draw 165 kB (35), MapLibre
1055 kB (287) ayrı parçalarda; MapLibre worker 519 kB. Uyarı eşiği yalnız bölünemeyen MapLibre parçası için 1100 kB.

| 2026-11-04 | Playwright CLI, Faz 2 harita (compose) | 17 ilçe + 911 tesis çizildi, OSM altlığıyla hizalı, tuval 960×651, konsol hatası 0; `docs/screenshots/faz2-map.png` |
| 2026-11-04 | Temiz kurulum: ayrı Compose projesi + yeni volume | rol + migration + container import 17/911, API 200 |

| 2026-11-04 | curl, compose API: 3 MiB PATCH gövdesi | 413 (önce 500 bulundu ve düzeltildi); nginx üzerinden de 413. TestServer bu sınırı uygulamadığı için otomatik test yok |
| 2026-11-04 | Playwright CLI ekran görüntüsü (Positron + arama + detay) | `docs/screenshots/faz3-search-details.png`, konsol hatası 0 |

Test verisi ayrımı: gerçek veri `data/samples/osm-bursa/`, sentetik fixture `data/test-fixtures/osm-mini/` (README'de etiketli).

E2E ortamı notu (Faz 4): Docker Desktop container ağı çalışmadığından Faz 4 E2E'leri `E2E_BASE_URL=http://127.0.0.1:5173` ile
yerel `dotnet run` + Vite (aynı Compose PostGIS) üzerinde koşturuldu; üretim imajı (nginx) ile koşu CI'a kaldı.

## Bilinen eksikler
- CI: Faz 6 commit'i (6a85751) push ve pull_request çalışmaları yeşil (2026-11-05).
- Klavye ile çizim (Terra Draw köşe ekleme) desteklenmez; çizim fare/dokunma gerektirir. Klavye ile arama, seçim, form ve analiz akışı çalışır.
- E2E düzenleme testi paylaşılan veriyi değiştirip geri alır; sıralı çalışır.
- Performans ölçümü tek makinede, ağ gecikmesi olmadan; üretim imajı (nginx) ile ölçüm Faz 8 temiz kurulumunda tekrarlanabilir.
