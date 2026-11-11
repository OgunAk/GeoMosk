# API sözleşmesi

Çalışan OpenAPI: `GET /openapi/v1.json`; tarayıcıdan denenebilir arayüz: `GET /swagger` (Swagger UI, ADR-0018; 8080 ve 5080). Bu belge ve OpenAPI aynı değişiklikte güncellenir; frontend tipleri
`frontend/src/services/*.ts` içindedir. Endpoint adları proje kararıdır (PDF dayatması değildir).

## Ortak kurallar (uygulandı)
- Koordinatlar EPSG:4326, `[boylam, enlem]`; RFC 7946; `crs` üyesi yok.
- Koleksiyon yanıtı `application/geo+json` FeatureCollection + `meta` foreign member: `{ returned, limit, offset, hasMore, nextAfter? }`.
  `hasMore = true` ise yanıt verinin tamamı değildir; istemci bunu göstermek zorundadır.
- Sıralama `id` artan; sayfalama `limit` (varsayılan 250, 1..2000) ile:
  - **Keyset (önerilen, ilçe/tesis):** `after=<id>` yalnız bu id'den büyük kayıtları döndürür. `hasMore` ise `meta.nextAfter` son dönen id'dir;
    bir sonraki istek `after=<nextAfter>` ile yapılır. Birincil anahtar indeksinden devam eder; sayfa derinliği maliyeti artırmaz.
  - **Offset:** `offset` (≥0) ilk N kaydı atlar; derin sayfalarda atlanan satırlar yine taranır. `after` ile birlikte verilirse 400 (`errors.after`).
  - `after` pozitif id olmalı (aksi 400). Kullanıcı çizimlerinde (`/api/features`) yalnız offset vardır.
- `bbox=minLon,minLat,maxLon,maxLat`: nokta ayraçlı ondalık; boylam [-180,180], enlem [-90,90]; `minLon < maxLon`
  (tarih çizgisini aşan kutu desteklenmez → 400), `minLat < maxLat`. Filtre: gerçek geometriyle `ST_Intersects` (yalnızca zarf karşılaştırması değil).
- Hatalar `application/problem+json`; doğrulama hataları 400 + `errors.{alan}` + `traceId`. SQL, stack trace ve bağlantı bilgisi içermez.
- Kaynakta silinmiş (`source_deleted_at` dolu) kayıtlar dönmez.
- İstek gövdesi en çok 2 MiB (Kestrel + nginx); aşılırsa 413 (API: `application/problem+json`; nginx önünde nginx'in kendi 413 sayfası).
- Arama `q`: en çok 100 karakter; görünen ad (yerel ad varsa o) üzerinde "içerir" araması. Büyük/küçük harf ve Türkçe aksan
  duyarsız: SQL `geomosk_search_normalize(x) = lower(unaccent(x))` → "nilufer" ⇒ "Nilüfer", "İLÇE" ⇒ "ilce".
  `%`, `_` ve `\` kaçışlanır (joker değildir). İndeks: aynı ifade üzerinde GIN trigram (`pg_trgm`); kaynak adı ve yerel ad
  (override) dalları ayrı aranıp birleştirilir, böylece her dal kendi indeksini kullanır (ADR-0020).

## Uygulanan endpoint'ler

### `GET /api/health/live`
200 `{ "status": "Healthy", "checks": [] }` — yalnızca süreç canlılığı.

### `GET /api/health/ready`
200/503 `{ status, checks: [{ name: "postgis", status, description, data: { postgisVersion } }] }`.
503'te açıklama genel bir metindir; bağlantı ayrıntısı içermez.

### `GET /api/layers`
200 JSON dizi: `[{ id: "districts"|"facilities", title, geometryType, source: "osm", attribution, editableFields: ["name","description"], featureCount }]`.

### `GET /api/districts?bbox&q&limit&offset&after`
| | |
|---|---|
| Geometri | MultiPolygon |
| properties | `layer: "districts"`, `name` (override varsa o, yoksa kaynak adı), `sourceName`, `description` (override), `osmType`, `osmId` |
| Durumlar | 200, 400 (bbox/limit/offset/after) |
| Performans | GiST `ix_districts_geom`; tam çözünürlükte 17 ilçe ≈ 318 KB (nginx gzip ile ≈ 115 KB). Görüntü sadeleştirmesi Faz 7'de ölçülerek değerlendirilecek |

Örnek: `GET /api/districts?bbox=29.0,40.1,29.2,40.3&limit=2`
```json
{ "type": "FeatureCollection",
  "features": [ { "type": "Feature", "id": 14, "geometry": { "type": "MultiPolygon", "coordinates": [[[[29.05, 40.2], "…"]]] },
                  "properties": { "layer": "districts", "name": "Osmangazi", "sourceName": "Osmangazi", "description": null,
                                  "osmType": "relation", "osmId": 1273954 } } ],
  "meta": { "returned": 2, "limit": 2, "offset": 0, "hasMore": true } }
```
(Şekli gösterir; id ve koordinat değerleri örnektir.)

### `GET /api/facilities?bbox&q&type&districtId&limit&offset&after`
| | |
|---|---|
| Geometri | Point |
| properties | `layer: "facilities"`, `name` (null olabilir), `sourceName`, `description`, `facilityType` (hospital/clinic/doctors/dentist/pharmacy/other_healthcare), `osmType`, `osmId`, `representativePoint` (way/relation'dan üretilen nokta ise true) |
| Filtreler | `type` ∈ hospital/clinic/doctors/dentist/pharmacy/other_healthcare (aksi 400); `districtId` > 0: o ilçenin **sınır dahil** kapsadığı tesisler (`ST_Covers`) |
| Durumlar | 200, 400 |
| Performans | GiST `ix_health_facilities_geom`; 911 tesis ≈ 277 KB (gzip ≈ 32 KB). Ad araması GIN trigram `ix_health_facilities_name_trgm` + `ix_facility_overrides_name_trgm` (ADR-0020) |

### `GET /api/districts/{id}`, `GET /api/facilities/{id}`
200 tek Feature (`application/geo+json`) + `ETag: "<sürüm>"` (yerel düzenleme yoksa `"0"`). Liste özelliklerine ek olarak
`tags` (kaynak OSM etiketleri, değiştirilmemiş), `osmUrl`, `localEditUpdatedAt`; tesislerde `districtName` (kapsayan ilçe,
sınır dahil; birden çoksa en küçük id). 404: bulunamadı veya kaynakta kaldırılmış.

### `PATCH /api/districts/{id}`, `PATCH /api/facilities/{id}` — yerel ad/açıklama (C01)
| | |
|---|---|
| Başlıklar | `Content-Type: application/json` (aksi 415); `If-Match: "<GET'teki ETag>"` **zorunlu** (yoksa 428). Zayıf biçim `W/"n"` kabul edilir: nginx gzip ETag'i zayıflatır |
| Gövde | `{ "name"?: string or null, "description"?: string or null }`, en az bir alan. Gönderilmeyen alan **değişmez**; `name: null` yerel adı kaldırıp **kaynak adına döner**; `description: null` veya `""` açıklamayı **temizler**; `name: ""` → 400 |
| Sınırlar | name ≤ 200 (ilçe) / ≤ 300 (tesis), description ≤ 2000; metin trim edilir |
| Allowlist | Başka her alan (ör. `geom`, `osmId`, `facilityType`) → 400 `errors.{alan}`. Kaynak kimliği, geometri ve tür istemciden değiştirilemez |
| Yanıt | 200 güncel Feature + yeni `ETag`; 404; 412 (sürüm değişmiş: araya başka düzenleme girdi, güncel kaydı yükleyin) |
| Kalıcılık | `district_overrides` / `facility_overrides`; OSM'ye yazılmaz; yeniden import ezmez. Override satırı silinmez: sürüm 0'a dönse eski bir istemcinin ETag'i yanlışlıkla eşleşebilirdi |

Örnek: `PATCH /api/facilities/817` + `If-Match: "0"` + `{"description":"Acil servis 7/24"}` → 200 ve yeni `ETag` (değer örnektir).

## Kullanıcı çizimleri (`/api/features`) — C02-C04

Kaynak (OSM) katmanlarından ayrı `user_features` tablosu. Yalnız Point, LineString (polyline) ve Polygon; EPSG:4326, `[boylam, enlem]`.
Feature `id` UUID metnidir. `properties`: `layer: "user-features"`, `name`, `description`, `geometryType`, `createdAt`, `updatedAt` (ISO 8601, UTC).

| Method | Yol | İstek | Başarılı yanıt | Hatalar |
|---|---|---|---|---|
| GET | `/api/features?bbox&q&limit&offset` | — | 200 FeatureCollection + `meta`; sıra `createdAt`, `id` | 400 |
| GET | `/api/features/{id}` | — | 200 Feature + `ETag` | 404 |
| POST | `/api/features` | RFC 7946 Feature: `{"type":"Feature","geometry":{…},"properties":{"name":"…","description"?:"…"}}` | **201** + `Location: /api/features/{id}` + `ETag` + kaydedilen Feature | 400 biçim, 422 geometri |
| PATCH | `/api/features/{id}` | `{"name"?, "description"?, "geometry"?}` + `If-Match` | 200 + yeni `ETag` (öznitelik ve geometri tek UPDATE'te) | 400, 404, 412, 422, 428 |
| DELETE | `/api/features/{id}` | `If-Match` | **204** | 404, 412, 428 |

**400 (biçim):** gövde nesne değil; `type` "Feature" değil; `geometry`/`properties`/`name` eksik; `name` boş, metin değil, kırpıldıktan sonra 3 karakterden kısa (karakter = grafem; geliştirici kuralı, kontrol noktası 2) veya 200'den uzun;
`description` 2000'den uzun; izin verilmeyen alan (`id` istemciden gönderilemez; `properties` yalnız `name`, `description`); koordinatlar dizi değil.
PATCH'te `name: null` ve `geometry: null` 400 (çizimi silmek için DELETE).

**422 (geometri anlamı):** Point/LineString/Polygon dışındaki tip (Multi*, GeometryCollection sessizce dönüştürülmez); `crs` üyesi;
3 boyutlu konum; sonlu olmayan veya aralık dışı koordinat; LineString < 2 konum ya da tek farklı nokta; Polygon halkası < 4 konum
veya kapalı değil; kendini kesme vb. (NTS `IsValidOp`, mesajda konum); 10 000'den fazla köşe; **Bursa çalışma alanı dışı**
(boylam 28.0–30.1, enlem 39.5–40.8). Sonuncusu çoğunlukla ters koordinat sırasıdır; otomatik düzeltilmez.
Doğrulama sunucuda yapılır; istemci kontrolleri yalnız erken uyarıdır. DB CHECK kısıtları ikinci savunma hattıdır; ihlal ederse (NTS/GEOS geçerlilik kenar durumu) yanıt 422 `errors.geometry` olur, kayıt değişmez. CORS yanıtları `ETag` ve `Location` başlıklarını açığa çıkarır.

Örnek: `POST /api/features` `{"type":"Feature","geometry":{"type":"Point","coordinates":[29.06,40.19]},"properties":{"name":"Deneme çizimi","description":"Kullanıcı geometrisi"}}`
→ 201, `Location: /api/features/<uuid>`.

## Analizler (`/api/analysis/*`) — A01-A03

Hesap tamamen backend'de PostGIS ile yapılır; arayüz yalnız girdiyi toplar ve sonucu gösterir. Ortak yanıt:
`{ "analysis": "within"|"buffer"|"nearest", "input": Feature (alan / tampon poligonu / nokta), "matches": FeatureCollection + meta, "parameters": {…} }`.
`matches` içindeki tesis özellikleri liste uç noktasıyla aynıdır; tampon ve en yakın N'de ek olarak `distanceMeters`
(WGS84 sferoidi üzerinde, kuş uçuşu, yuvarlanmamış), en yakın N'de `rank`.

Girdi seçenekleri — tam olarak biri: `sourceFeature: { layerId: "districts"|"facilities"|"user-features", id }` (geometri
sunucudan okunur; istemci kopyasına güvenilmez) **veya** `geometry` (kullanıcı çizimiyle aynı doğrulama: Point/LineString/Polygon,
4326, Bursa çalışma alanı, geçerlilik). İkisi birden ya da hiçbiri → 400. Tanımsız alan → 400. JSON dışı içerik → 415.

| Uç nokta | Gövde | Semantik | Hatalar |
|---|---|---|---|
| `POST /api/analysis/within` | girdi (alan: ilçe, Polygon kullanıcı çizimi veya Polygon geometri), `includeBoundary` (varsayılan **true**), `limit` (1..2000, varsayılan 500), `types`? (tesis türü dizisi; yoksa tüm türler, boş/geçersiz dizi 400) | Sınır dahil `ST_Covers(alan, tesis)`, hariç `ST_Within(tesis, alan)`. Delikler hariç, MultiPolygon'un tüm parçaları dahil | 400; 404 kaynak yok; 422 kaynak alan değil / geçersiz geometri |
| `POST /api/analysis/buffer` | girdi (her tip), `radiusMeters` (0 < r ≤ 50 000), `excludeSource` (varsayılan true; yalnız kaynak tesisin **id**'si hariç, aynı koordinattaki başka tesis dahil), `limit`, `types`? (tesis türü dizisi; yoksa tüm türler, boş/geçersiz dizi 400) | Seçim `ST_DWithin(geom::geography, kaynak::geography, r)`; sıra (mesafe, id). `input` = `ST_Buffer(geography, r, 'quad_segs=16')` yaklaşık 64 kenarlı çokgen (görsel) | 400 (r ≤ 0, r > 50 000); 404; 422 |
| `POST /api/analysis/nearest` | `point` (GeoJSON Point), `n` (1..100, varsayılan 5), `type`? (tek tür) veya `types`? (tesis türü dizisi; yoksa tüm türler, boş/geçersiz dizi 400); ikisi birlikte 400, `maxDistanceMeters`? (≤ 50 000) | Kesin sıralama: tüm adaylarda `ST_Distance(geography)` + `id` bağ kırıcı, `LIMIT n`. Veri azsa n'den az sonuç; filtre yoksa mesafe sınırı yok | 400 (n dışı, tür); 422 (Point değil, çalışma alanı dışı/ters koordinat) |

Sorgu planları (911 tesis, 2026-11-04): `scripts/sql/analysis-plans.2026-11-04.txt`. Tampon `ix_health_facilities_geog`
(geography ifade indeksi) ile 0.8 ms, alan içinde `ix_health_facilities_geom` (GiST) ile 0.4 ms. En yakın N kesin sıralama
için tüm tabloyu tarayıp sıralar (12 ms); KNN (`<->`) bilinçli olarak kullanılmadı (ADR-0012).

## Ölçüm ve ilçe istatistiği — A04, A05

### `POST /api/analysis/measure` — A04 metrik ölçüm
Gövde: tam olarak biri — `sourceFeature` (ilçe veya LineString/Polygon kullanıcı çizimi) **veya** `geometry` (LineString/Polygon,
kullanıcı çizimiyle aynı doğrulama). Başka alan → 400.

- Hesap: `ST_Transform(geom, 32635)` (WGS 84 / UTM 35N) sonrası düzlemsel `ST_Length` (çizgi), `ST_Area` + `ST_Perimeter` (alan).
  Çevre `ST_Perimeter` ile; `ST_Length(polygon)` kullanılmaz. Gerekçe ve kapsam: ADR-0013.
- Yanıt: ortak analiz yanıtı (`analysis: "measure"`, `input` = ölçülen geometri 4326, `matches` boş) ve
  `measurement: { geometryType, lengthMeters|null, areaSquareMeters|null, perimeterMeters|null, calculationSrid: 32635,
  calculationCrs, method, geodesicCheck: { lengthMeters|null, areaSquareMeters|null, relativeDifference } }`.
  Ham değerler metre/m², yuvarlanmamış; km/km² gösterimi yalnız arayüzde. `geodesicCheck` aynı geometrinin geography (sferoid)
  değeridir; yalnız çapraz kontrol, asıl değer projeksiyondaki ölçümdür. Bursa'da fark %0,1'in altındadır.
- Hatalar: 400 (biçim, ikisi/hiçbiri); 404 kaynak yok; 422 — nokta veya tesis kaynağı ("Desteklenmeyen ölçüm", 0 dönülmez),
  geçersiz geometri, UTM 35N kullanım alanı (24–30°D) dışı (Bursa çalışma alanı 30.1°D'ye uzandığı için erişilebilir bir durum).

### `GET /api/analysis/district-stats?type` — A05 ilçe başına tesis sayısı
- `type` isteğe bağlı tesis türü (`hospital`, `clinic`, `doctors`, `dentist`, `pharmacy`, `other_healthcare`); başka değer → 400.
- **Tekil atama:** her tesis en çok bir ilçede sayılır. Aday ilçeler sınır dahil `ST_Covers(ilçe, tesis)`; önce tesisi iç bölgesinde
  içeren (`ST_Contains`), eşitlikte en küçük ilçe `id`'si. `LEFT JOIN` + `count(tesis_id)`: tesisi olmayan ilçe **0**.
- Yanıt: `{ analysis: "district-stats", facilityType, districts: [{ id, name, facilityCount, multiMatchCount }], totals:
  { facilities, assigned, unassigned, multiMatch }, policy }`. Ad yerel düzenleme (override) varsa onu kullanır.
  `facilities = assigned + unassigned`; ilçe sayılarının toplamı `assigned`'a eşittir (çifte sayım yok). `multiMatch`: birden çok ilçenin
  kapsadığı (sınırda/örtüşmede) ve tek ilçeye atanan tesisler; `unassigned`: hiçbir ilçenin kapsamadığı tesisler.
- Gerçek veri (2026-11-05): 911 tesisin 911'i atandı, atanamayan 0, çoklu eşleşme 0.

Sorgu planları (2026-11-05): `scripts/sql/analysis-plans.2026-11-05.txt` — A05 ilçe başına `ix_health_facilities_geom` (GiST)
ile 6.7 ms; A04 Nilüfer ölçümü 4.0 ms (geometri sayısına değil köşe sayısına bağlı).
