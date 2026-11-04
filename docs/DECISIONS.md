# Teknik kararlar (ADR özeti)

Her karar: bağlam → seçenekler (≤2) → karar → sonuçlar → doğrulama. Büyük kararlar gerektiğinde `docs/adr/` altına ayrı dosya olarak taşınır.

## ADR-0001 — .NET hedef sürümü: .NET 9

- **Durum:** Kabul — geliştirici kararı (4 Kasım 2026, sohbet: ".NET 9 seç"). Faz 1'de `global.json` ve build ile uygulanır.
- **Bağlam:** PDF "tercihen .NET 9" diyor (s.1, tercih). Master prompt §3'e göre .NET 9 (STS) desteği 10 Kasım 2026'da, .NET 10 (LTS) desteği 14 Kasım 2028'de bitiyor (bu tarihler bu oturumda resmî sayfadan yeniden kontrol edilmedi). Başlangıçta makinede yalnızca 8.x ve 10.0.302 SDK'ları vardı.
- **Seçenekler:** (a) .NET 9 — PDF tercihine birebir uyar; destek bitişinden sonra güvenlik yaması gelmez. (b) .NET 10 LTS — uzun destekli, kurulu.
- **Karar:** (a) .NET 9. İlk öneri (b) idi; geliştirici PDF uyumunu önceliklendirdi.
- **Sonuçlar:** `net9.0` hedef; EF Core 9.x, Npgsql EF provider 9.x + NetTopologySuite eklentisi 9.x; `mcr.microsoft.com/dotnet/{sdk,aspnet}:9.0` image'ları. README'de destek bitiş tarihi bilinen kısıt olarak yazılır. Gerekirse .NET 10'a geçiş: hedef framework + paket major'leri.
- **Doğrulama:** Faz 1 `dotnet build` + PostGIS round-trip testi.

## ADR-0002 — Katmanlı modüler monolit

- **Durum:** Kabul (master prompt §22: geliştirici onaylı kayıt).
- **Karar:** `Domain`, `Application`, `Infrastructure`, `Api`, `Tests` projeleri; bağımlılık yönü `.claude/rules/architecture.md`'de. Mikroservis, generic repository, MediatR/CQRS yok.
- **Alt karar (Faz 2, uygulandı):** Domain entity'leri NTS `Geometry`/`Point`/`MultiPolygon` tiplerini doğrudan kullanır (Domain → `NetTopologySuite` 2.6.0; EF/HTTP bağımlılığı yok). Application, GeoJSON DTO'larında (`GeoJsonFeature`) NTS geometrisini taşır; JSON'a çevirme yalnızca API katmanındaki `GeoJsonConverterFactory` (NetTopologySuite.IO.GeoJSON4STJ 4.0.0) ile yapılır. Geometri sarmalayıcısı yazılmadı.

## ADR-0005 — Veri kaynağı ve import yöntemi

- **Durum:** Kabul (Faz 2).
- **Bağlam:** PDF gerçek, açık lisanslı ve iki geometri tipli veri istiyor (D01-D02). Senaryo: Bursa ilçeleri + sağlık tesisleri (master prompt §22).
- **Seçenekler:** (a) OSM/Overpass: tek lisans (ODbL), ilçe ve tesis aynı kaynaktan, sorgu tekrarlanabilir. (b) geoBoundaries ADM2 + ayrı tesis kaynağı: iki lisans ve kimlik eşleme maliyeti; Türkiye için sağlık tesisi noktalarının açık ve toplu bir resmî kaynağı doğrulanamadı.
- **Karar:** (a). İndirme `fetch-osm.mjs` (ham snapshot + checksum'lı manifest); yükleme `load-osm.mjs` (Node + `pg` 8.23.1). Halkalar ve temsilî noktalar PostGIS'te kurulur (`ST_BuildArea`, `ST_MakeValid`, `ST_PointOnSurface`). Böylece ayrı bir OSM→GeoJSON kütüphanesine ve QGIS'e ihtiyaç kalmaz. Snapshot küçük olduğu (≈1 MB) için ODbL atfıyla `data/samples/` altında depoya eklendi; çevrimdışı tekrar üretim mümkün.
- **Sonuçlar:** Import container (`docker compose --profile tools run --rm import`) veya host Node ile çalışır. Yeniden import idempotenttir, override'ları ezmez; silinen kaynak kaydı işaretlenir (`source_deleted_at`).

## ADR-0006 — Veritabanı rolleri ve migration işi

- **Durum:** Kabul (Faz 2).
- **Karar:** API kısıtlı `geoscope_app` rolüyle çalışır (superuser değil; kaynak tablolarında yalnızca okuma). Migration, Compose'daki tek seferlik `migrate` servisiyle (EF migration bundle) şema sahibi rolüyle uygulanır; API açılışında migration çalışmaz. Böylece çok örnekli çalışmada migration yarışı olmaz. Import da şema sahibi rolünü kullanır.
- **Sonuç:** Yeni volume'da rol init script'iyle oluşur. Var olan volume için tek komutluk elle adım belgelendi (`docs/DATABASE.md`).

## ADR-0007 — Altlıklar

- **Durum:** Kabul (Faz 3).
- **Karar:** (1) OSM standart raster (`tile.openstreetmap.org`): yalnız hafif/demo kullanıma uygundur (OSM Tile Usage Policy), görünür atıf ister. (2) OpenFreeMap Positron vektör stili (`https://tiles.openfreemap.org/styles/positron`): anahtar gerektirmez, CORS'a açık, atıf TileJSON'dan otomatik gelir ("OpenFreeMap © OpenMapTiles Data from OpenStreetMap"). 4 Kasım 2026'da stil, font, sprite ve TileJSON 200 döndü.
- **Uygulama:** `setStyle(…, { diff: false })` ve her `style.load` olayında kaynak/katmanlar idempotent yeniden kurulur; görünürlük, vurgu ve seçim React durumundan tekrar uygulanır (E2E ile doğrulandı). Altlık karosu yüklenemezse kullanıcıya uyarı gösterilir, veri katmanları çalışmaya devam eder.

## ADR-0008 — Türkçe arama normalleştirmesi

- **Durum:** Kabul (Faz 3).
- **Bağlam:** Kullanıcılar "nilufer", "INEGOL", "cekirge" yazabilir. PostgreSQL `ILIKE`'ın Türkçe İ/ı eşlemesi veritabanı yereline bağlıdır.
- **Karar:** `unaccent` uzantısı + `geoscope_search_normalize(text) = lower(unaccent('public.unaccent', x))` (IMMUTABLE, migration `SearchNormalization`). Önce aksan kaldırılır (İ→I, ı→i, ü→u, ş→s, ğ→g, ç→c, ö→o), sonra küçük harfe çevrilir. Sorgu ve veri aynı fonksiyondan geçer. LIKE özel karakterleri kaçışlanır.
- **Sonuç:** Arama aksan duyarsızdır ("Ilgaz" ile "ılgaz" aynı sayılır). Bu Türkçe imla açısından kabul edilen bir genişlemedir. 911 satırda sıralı tarama yeterli; trigram/ifade indeksi ölçülen ihtiyaçla Faz 7'de değerlendirilecek.

## ADR-0009 — Kaynak kayıt düzenlemede eşzamanlılık

- **Durum:** Kabul (Faz 3).
- **Karar:** ETag = override satırının PostgreSQL `xmin` değeri (yoksa `"0"`). PATCH'te `If-Match` zorunlu (428), uyuşmazlık 412. Override satırı silinmez: silinip yeniden oluşturulsa sürüm `"0"`'a döner ve eski istemcinin ETag'i yanlışlıkla eşleşirdi (ABA). Eşzamanlı ilk oluşturmada PK çakışması da 412'ye çevrilir.
- **Not:** nginx gzip yanıtta ETag'i zayıflatır (`W/"n"`). Sunucu bu biçimi de kabul eder; sürüm karşılaştırması uygulama içinde yapılır.

## ADR-0010 — Harita veri yükleme stratejisi

- **Durum:** Kabul (Faz 3), Faz 7'de ölçümle yeniden değerlendirilecek.
- **Karar:** 17 ilçe ve 911 tesis tek istekte yüklenir (gzip ile ≈ 115 + 32 KB). `moveend` + bbox yüklemesi şimdilik kullanılmıyor: arama zaten sunucu tarafında tüm veride çalışıyor ve görünüm değişince istek sayısı artmasın isteniyor. API bbox/sayfalamayı destekler; yanıt `hasMore` ise arayüz eksik veriyi bildirir. Veri büyürse bbox yüklemesine geçilir.

## ADR-0003 — Kök araç paketi ve YAML ayrıştırıcı

- **Durum:** Kabul (Faz 0).
- **Bağlam:** Faz 0 doğrulayıcısı agent/skill/rule frontmatter'ını gerçek bir YAML ayrıştırıcıyla denetlemeli; el yapımı eksik parser yazılmamalı (master prompt §4.7).
- **Karar:** Kök `package.json` yalnızca araç script'leri için; tek devDependency `yaml@2.9.1` (11 Eylül 2026 yayını; npm registry'den doğrulandı). Uygulama bağımlılıkları `frontend/package.json` içinde ayrı tutulur.
- **Sonuç:** `npm install` yapılmadıysa hook frontmatter kontrolünü uyarıyla atlar (işi engellemez); `verify-agent-setup.mjs` ise hata verir.

## ADR-0004 — Analiz kapsamı

- **Durum:** Kabul (master prompt §2.2).
- **Karar:** MVP: A01 alan içinde, A02 buffer, A03 en yakın N (PDF'nin "en az üç" koşulu). Güçlü teslim: A04 ölçüm, A05 ilçe başına sayım. Süre kısalırsa önce A04/A05 açıkça ertelenir; zorunlu maddeler azaltılmaz.
