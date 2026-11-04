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

## ADR-0007 — Faz 2 altlığı

- **Durum:** Geçici (Faz 3'te iki altlıkla kesinleşecek).
- **Karar:** OSM standart raster karoları (`tile.openstreetmap.org`), görünür atıfla. Yalnızca hafif/demo kullanım için uygundur (OSM Tile Usage Policy).

## ADR-0003 — Kök araç paketi ve YAML ayrıştırıcı

- **Durum:** Kabul (Faz 0).
- **Bağlam:** Faz 0 doğrulayıcısı agent/skill/rule frontmatter'ını gerçek bir YAML ayrıştırıcıyla denetlemeli; el yapımı eksik parser yazılmamalı (master prompt §4.7).
- **Karar:** Kök `package.json` yalnızca araç script'leri için; tek devDependency `yaml@2.9.1` (11 Eylül 2026 yayını; npm registry'den doğrulandı). Uygulama bağımlılıkları `frontend/package.json` içinde ayrı tutulur.
- **Sonuç:** `npm install` yapılmadıysa hook frontmatter kontrolünü uyarıyla atlar (işi engellemez); `verify-agent-setup.mjs` ise hata verir.

## ADR-0004 — Analiz kapsamı

- **Durum:** Kabul (master prompt §2.2).
- **Karar:** MVP: A01 alan içinde, A02 buffer, A03 en yakın N (PDF'nin "en az üç" koşulu). Güçlü teslim: A04 ölçüm, A05 ilçe başına sayım. Süre kısalırsa önce A04/A05 açıkça ertelenir; zorunlu maddeler azaltılmaz.
