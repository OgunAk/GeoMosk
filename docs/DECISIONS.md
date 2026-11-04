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

## ADR-0011 — Çizim aracı ve kullanıcı geometrisi doğrulaması

- **Durum:** Kabul (Faz 4).
- **Çizim:** terra-draw 1.38.0 + terra-draw-maplibre-gl-adapter 1.5.0 (peer: maplibre-gl >= 4). API kurulu paketin tip tanımlarından doğrulandı. Point, LineString, Polygon ve Select modları kullanılıyor; Select'te sürükleme, ara noktadan köşe ekleme ve köşe silme açık. `setStyle` adaptörün katmanlarını da sildiği için altlık değişmeden önce taslak saklanır, örnek durdurulur ve yeni stilde yeni bir örnekle geri yüklenir (E2E ile doğrulandı).
- **Doğrulama:** Sunucu, istemciye güvenmeden kendi ayrıştırıcısıyla (`UserGeometryParser`) doğrular. Genel GeoJSON dönüştürücüsü `crs`, Multi* ve 3B girdiyi sessizce kabul edebileceği için kullanılmadı. Biçim hatası 400, geometri anlamı hatası 422. Geçersiz şekil `ST_MakeValid` ile onarılmaz. Bursa çalışma alanı dışı reddedilir: ters koordinatı yakalamanın ölçülebilir yolu (master prompt §8.3).
- **Eşzamanlılık:** ETag = `xmin`; PATCH ve DELETE'te `If-Match` zorunlu. DELETE tek SQL'de sürüm koşuluyla yapılır (`ExecuteDelete`).
- **Arayüz:** Taslak, kayıttan ayrı tutulur. Kayıt başarısız olursa taslak ve form korunur. Geometri düzenlenirken kayıtlı hali gizlenir (aynı şekil iki kez görünmez). Tıklama toleransı ±5 px; ince çizgiler seçilebilir (E2E'de bulundu).

## ADR-0012 — MVP analizlerinin semantiği (A01-A03)

- **Durum:** Kabul (Faz 5).
- **A01:** Varsayılan sınır dahil (`ST_Covers`), kullanıcı seçimiyle hariç (`ST_Within`). Kaynak ilçe (MultiPolygon) ya da Polygon kullanıcı çizimi; ya da çizilen poligon. Tesis noktası kaynak olamaz (422).
- **A02:** Seçim `ST_DWithin(geography)` ile metre cinsinden (WGS84 sferoidi). Çizilen tampon `ST_Buffer(geography, r, quad_segs=16)` yaklaşık çokgendir ve seçimde kullanılmaz; alanı πr²'nin %99'undan büyük (test). Kaynak tesis id ile hariç tutulur; aynı koordinattaki farklı tesis elenmez.
- **A03:** Tüm adaylarda `ST_Distance(geography)` + `id` ile kesin sıralama. 4326 `<->` derece tabanlıdır; sferoid sıralamasıyla aynı sonucu garanti etmez. 911 kayıtta tam tarama 12 ms olduğu için KNN eklenmedi. Büyük veride önce KNN aday kümesi + kesin yeniden sıralama, referans sorguya karşı testle değerlendirilecek (Faz 7).
- **Doğruluk kanıtı:** Beklenen mesafeler PostGIS'ten bağımsız WGS84 meridyen/paralel yayı formülüyle hesaplanır (`GeodesicReference`); fark 5 cm toleransın altında. Aynı ölçüde 0.02° boylam (~1705 m) tampon içinde, 0.02° enlem (~2221 m) dışında kalır; derece ile metre karıştırılsa bu test başarısız olurdu.
- **Arayüz:** Ölçüm ve mesafe değerleri yalnız backend'den gelir. Bağlantı çizgileri kuş uçuşu ilişkiyi gösterir ve rota olmadığı belirtilir. Analiz için çizilen alan kullanıcı katmanına kaydedilmez.

## ADR-0013 — Ölçüm projeksiyonu (A04) ve ilçe sayımında tekil atama (A05)

- **Durum:** Kabul (Faz 6).
- **Bağlam:** PDF ölçüm için uygun metrik SRID ister; 4326 derecesiyle ve EPSG:3857 ile ölçüm yapılmaz. İlçe sayımında sınırdaki tesis
  iki ilçede sayılmamalı (master prompt §8.7-8.9, §10).
- **Veri kapsamı (2026-11-05, `ST_Extent`):** ilçeler 28.088–29.910°D, 39.594–40.614°K; tesisler 28.184–29.723°D.
- **Karar (A04):** EPSG:32635 (WGS 84 / UTM 35N, merkez meridyen 27°D, k₀ = 0.9996, kullanım alanı 24–30°D). Veri tamamen zonun içinde.
  Ölçek faktörü Bursa'da k ≈ 0.99970–1.00020 → alan ölçeği k² ≈ 0.9994–1.0004 (en kötü %0,06), uzunlukta %0,03.
  - Değerlendirilen alternatifler: TUREF / TM27 (EPSG:5253, 25.5–28.5°D) ve TM30 (EPSG:5254, 28.5–31.5°D) 3° dilimli ulusal
    projeksiyonlardır; Bursa iki dilime bölünür (batı ucu 28.09°D) ve TUREF datumu ayrıca dönüşüm gerektirir. EPSG:3857 ölçüm için reddedildi.
  - Kullanım alanı dışı (boylam < 24 veya > 30) geometri 422 ile reddedilir; Bursa çalışma alanı 30.1°D'ye uzandığından bu durum gerçekten
    oluşabilir. Sessiz yaklaşık ölçüm yapılmaz.
  - Geography (sferoid) değeri yanıtta yalnız çapraz kontrol olarak döner; PDF'nin metrik SRID beklentisi projeksiyondaki ölçümle karşılanır.
- **Karar (A05):** her tesis en çok bir ilçeye: sınır dahil kapsayan ilçeler (`ST_Covers`) içinden önce iç eşleşme (`ST_Contains`),
  sonra en küçük ilçe id. Atanamayan ve çoklu eşleşen sayıları ayrıca raporlanır; `count(*)` değil `count(tesis_id)`.
  Choropleth: 0 ayrı nötr sınıf, sıfırdan büyük değerler en çok 4 kuantil sınıf (aynı değer bölünmez); tablo ve lejant sayıları
  gösterir, renk tek bilgi taşıyıcısı değildir. Ad/sayı bilgisi harita açılır penceresi yerine yan paneldeki tabloda verilir;
  tablodan ilçe seçimi haritada seçer ve zoom yapar, haritadan seçilen ilçenin satırı vurgulanır.
- **Doğrulama:** bağımsız referans — elipsoid dörtgen alanı (kapalı formül) × UTM ölçek faktörü k² (Snyder 1987); göreli tolerans 1e-5
  (gerekçesi testte). 28.2°D'de projeksiyon ile sferoid farkı (≈ −%0,055) testte ayrıca beklenir.

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
