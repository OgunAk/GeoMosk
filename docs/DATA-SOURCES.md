# Veri kaynakları

## Özet
| Veri seti | Geometri | Kaynak | Lisans | Kayıt (snapshot 2026-11-04) |
|---|---|---|---|---|
| Bursa ilçe sınırları | MultiPolygon | OpenStreetMap, Overpass API | ODbL 1.0 | 17 relation |
| Bursa sağlık tesisleri | Point (temsilî nokta dahil) | OpenStreetMap, Overpass API | ODbL 1.0 | 911 (816 node, 94 way, 1 relation) |

PDF D02 (en az iki farklı geometri tipi) dış kaynaktan karşılanır: poligon + nokta. Kullanıcı çizimleri bu sayıma dahil değildir.

## Lisans ve atıf
- **Veri:** © OpenStreetMap katkıcıları, [Open Database License (ODbL) 1.0](https://www.openstreetmap.org/copyright). Atıf haritada (altlık atfı) ve yan panelde ("Veri: © OpenStreetMap katkıcıları, ODbL") gösterilir. Depodaki snapshot (`data/samples/osm-bursa/`) ODbL kapsamında yeniden dağıtılan bir veritabanı türevidir; aynı lisansla paylaşılır.
- **Yazılım lisansı** ve **altlık karo hizmeti koşulları** ayrıdır. İki altlık (ADR-0007):
  - `tile.openstreetmap.org` raster karoları: [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) yalnızca hafif kullanıma izin verir ve görünür atıf ister; yoğun/üretim kullanımı için uygun değildir.
  - [OpenFreeMap](https://openfreemap.org) Positron vektör stili: anahtar gerektirmez; atıf "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" haritada otomatik gösterilir. Ücretsiz hizmetin süreklilik garantisi yoktur; erişilemezse uygulama uyarı gösterir ve diğer altlık kullanılabilir.

## Edinme
- **Uç nokta:** `https://overpass-api.de/api/interpreter` (POST). Script: `scripts/import/fetch-osm.mjs`, sorgular: `scripts/import/overpass-queries.mjs`.
- **Alan filtresi:** `area["boundary"="administrative"]["admin_level"="4"]["name"="Bursa"]` (Bursa il sınırı).
- **İlçeler:** il alanındaki `boundary=administrative` + `admin_level=6` relation'ları, `out geom` (üye way koordinatlarıyla).
- **Tesisler:** `amenity ∈ {hospital, clinic, doctors, dentist, pharmacy}` olan node/way/relation'lar **ve** `amenity` etiketi olmayan `healthcare=*` nesneleri, `out geom`.
- **Dayanıklılık:** Overpass yoğunlukta 429/502/504 döner. Script 5 denemeye kadar artan beklemeyle (10/20/30/40 s) tekrar dener, sorgular arasında 5 s bekler. 2026-11-04 indirmesinde her iki sorgu ilk denemede 502 aldı ve ikinci denemede tamamlandı.
- **Kaynak CRS:** Overpass koordinatları WGS84 boylam/enlem; EPSG:4326 olarak etiketlenir (`ST_SetSRID`, dönüşüm yok).

## Snapshot (depodaki gerçek veri)
`data/samples/osm-bursa/2026-11-04T17-05-11-619Z/` — `fetch-osm.mjs` çıktısının değiştirilmemiş kopyası. Son indirmenin manifesti `data/raw/osm-bursa.manifest.json` dosyasındadır; ham indirmeler (`data/raw/osm/`) Git dışında tutulur.

| Dosya | osm_base | SHA-256 | Bayt | Öğe |
|---|---|---|---|---|
| `districts.json` | 2026-11-04T17:04:44Z | `99d8e0a7526be27eb96897f5a1ca3198e0d38e04ced7acfd27c090c536db83fb` | 775 692 | 17 relation |
| `facilities.json` | 2026-11-04T17:05:45Z | `04b02ed44630bd711e5bc9b2739b8b82f987b1dbf849172c2636649aa605140d` | 292 046 | 816 node, 94 way, 1 relation |

Import, dosya checksum'ı manifestle uyuşmazsa çalışmaz.

## Dönüşümler (`scripts/import/load-osm.mjs`)
1. **İlçe poligonu:** relation'ın `outer`/`inner` üye way'leri LineString'e çevrilir, `ST_BuildArea(ST_Collect(...))` ile halkalar kurulur (iç halkalar delik olur), `ST_MakeValid` + `ST_CollectionExtract(…, 3)` + `ST_Multi` ile MultiPolygon'a normalleştirilir. Onarım gereken kayıtlar kalite raporunda `repairedOnImport` olarak listelenir (2026-11-04 snapshot'ında yok).
2. **Tesis noktası:** node doğrudan nokta. Way: kapalıysa poligon, değilse çizgi; relation: ilçeyle aynı yöntemle alan. Way/relation için `geom = ST_PointOnSurface(...)`. Bu **temsilî noktadır**; alanın içinde olması garantilidir ama giriş kapısı veya adres değildir. Özgün şekil `source_geometry` kolonunda tutulur; API `representativePoint: true` ile işaretler.
3. **Tesis türü:** `amenity` değeri; yoksa `healthcare=clinic|hospital|dentist|pharmacy` aynı türe, `healthcare=doctor` → `doctors`, diğerleri → `other_healthcare`. Özgün etiketler `attributes` (jsonb) kolonunda değiştirilmeden saklanır.
4. **Kimlik:** `(source, source_object_type, source_id)` = (`osm`, node|way|relation, OSM ID). OSM'de node/way/relation ID uzayları ayrıdır.
5. **Mükerrer politikası:** Aynı tesisi farklı OSM nesneleri temsil edebilir. Otomatik silme/birleştirme yapılmaz. Aynı ad (büyük/küçük harf duyarsız) ve 100 m içindeki çiftler kalite raporunda `suspectedDuplicates` olarak listelenir.
6. **Yeniden import:** değişmeyen kayıt güncellenmez; değişen kaynak alanları güncellenir; override tablolarına (`district_overrides`, `facility_overrides`) ve `user_features`'a dokunulmaz. Kaynakta artık olmayan kayıt silinmez, `source_deleted_at` ile işaretlenir ve API'de gösterilmez (yerel notlar korunur).
7. **Atomiklik:** iki veri seti tek transaction'da yazılır. Hata durumunda kaynak tabloları değişmez, `import_history`'de `failed` ve güvenli hata özeti kalır.

## Kalite raporu — 2026-11-04 snapshot'ı, ilk import
| Kontrol | Sonuç |
|---|---|
| İlçe sayısı / SRID / tip | 17 / 4326 / MULTIPOLYGON |
| Geçersiz veya boş ilçe geometrisi | 0 / 0 (onarım gerekmedi) |
| İlçe kapsamı (extent) | boylam 28.0877–29.9100, enlem 39.5935–40.6144 |
| Tesis sayısı / SRID / tip | 911 / 4326 / POINT |
| Tür dağılımı | eczane 765, hastane 55, klinik 51, diş hekimi 16, muayenehane 6, diğer 18 |
| Adı olmayan tesis | 12 |
| Çalışma alanı (28.0–30.1 boylam, 39.5–40.8 enlem) dışında | 0 |
| Hiçbir ilçede olmayan / birden fazla ilçede olan tesis | 0 / 0 |
| Olası mükerrer çift | 3 (ör. "Harmancık Devlet Hastanesi" iki ayrı OSM nesnesi) |
| Reddedilen kayıt | 0 |
| Aynı snapshot'ın ikinci importu | ekleme 0, güncelleme 0, değişmeyen 17 + 911 |

**İlçe sayısı kontrolü:** Overpass sonucu 17 ilçe (İznik, Orhangazi, Yenişehir, İnegöl, Kestel, Keles, Büyükorhan, Harmancık, Mustafakemalpaşa, Karacabey, Orhaneli, Nilüfer, Mudanya, Osmangazi, Yıldırım, Gürsu, Gemlik). Bu, Bursa'nın 17 ilçeli idari yapısıyla uyumlu.

## Bilinen eksikler
- OSM gönüllü verisidir. Tesis kapsamı resmî Sağlık Bakanlığı kayıtlarıyla karşılaştırılmadı; eczaneler (765) baskındır, bazı aile sağlığı merkezleri etiketlenmemiş olabilir.
- 12 tesisin adı yok. Arayüzde "Adsız tesis" olarak gösterilir; ad araması bunları bulmaz, tür/ilçe filtresi bulur.
- Way/relation tesislerinin noktası temsilîdir (bkz. Dönüşümler 2).
- 3 olası mükerrer çift otomatik birleştirilmedi.
- İlçe sınırları OSM'deki idari sınırlardır; resmî kadastro/HGM sınırlarıyla birebir aynı olmayabilir.
