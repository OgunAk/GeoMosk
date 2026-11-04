# API sözleşmesi

Çalışan OpenAPI: `GET /openapi/v1.json`. Bu belge ve OpenAPI aynı değişiklikte güncellenir; frontend tipleri
`frontend/src/services/*.ts` içindedir. Endpoint adları proje kararıdır (PDF dayatması değildir).

## Ortak kurallar (uygulandı)
- Koordinatlar EPSG:4326, `[boylam, enlem]`; RFC 7946; `crs` üyesi yok.
- Koleksiyon yanıtı `application/geo+json` FeatureCollection + `meta` foreign member: `{ returned, limit, offset, hasMore }`.
  `hasMore = true` ise yanıt verinin tamamı değildir; istemci bunu göstermek zorundadır.
- Sıralama `id` artan; sayfalama `limit` (varsayılan 250, 1..2000) + `offset` (≥0).
- `bbox=minLon,minLat,maxLon,maxLat`: nokta ayraçlı ondalık; boylam [-180,180], enlem [-90,90]; `minLon < maxLon`
  (tarih çizgisini aşan kutu desteklenmez → 400), `minLat < maxLat`. Filtre: gerçek geometriyle `ST_Intersects` (yalnızca zarf karşılaştırması değil).
- Hatalar `application/problem+json`; doğrulama hataları 400 + `errors.{alan}` + `traceId`. SQL, stack trace ve bağlantı bilgisi içermez.
- Kaynakta silinmiş (`source_deleted_at` dolu) kayıtlar dönmez.
- İstek gövdesi en çok 2 MiB (Kestrel + nginx); aşılırsa 413 (API: `application/problem+json`; nginx önünde nginx'in kendi 413 sayfası).
- Arama `q`: en çok 100 karakter; görünen ad (yerel ad varsa o) üzerinde "içerir" araması. Büyük/küçük harf ve Türkçe aksan
  duyarsız: SQL `geoscope_search_normalize(x) = lower(unaccent(x))` → "nilufer" ⇒ "Nilüfer", "İLÇE" ⇒ "ilce".
  `%`, `_` ve `\` kaçışlanır (joker değildir).

## Uygulanan endpoint'ler

### `GET /api/health/live`
200 `{ "status": "Healthy", "checks": [] }` — yalnızca süreç canlılığı.

### `GET /api/health/ready`
200/503 `{ status, checks: [{ name: "postgis", status, description, data: { postgisVersion } }] }`.
503'te açıklama genel bir metindir; bağlantı ayrıntısı içermez.

### `GET /api/layers`
200 JSON dizi: `[{ id: "districts"|"facilities", title, geometryType, source: "osm", attribution, editableFields: ["name","description"], featureCount }]`.

### `GET /api/districts?bbox&q&limit&offset`
| | |
|---|---|
| Geometri | MultiPolygon |
| properties | `layer: "districts"`, `name` (override varsa o, yoksa kaynak adı), `sourceName`, `description` (override), `osmType`, `osmId` |
| Durumlar | 200, 400 (bbox/limit/offset) |
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

### `GET /api/facilities?bbox&q&type&districtId&limit&offset`
| | |
|---|---|
| Geometri | Point |
| properties | `layer: "facilities"`, `name` (null olabilir), `sourceName`, `description`, `facilityType` (hospital/clinic/doctors/dentist/pharmacy/other_healthcare), `osmType`, `osmId`, `representativePoint` (way/relation'dan üretilen nokta ise true) |
| Filtreler | `type` ∈ hospital/clinic/doctors/dentist/pharmacy/other_healthcare (aksi 400); `districtId` > 0: o ilçenin **sınır dahil** kapsadığı tesisler (`ST_Covers`) |
| Durumlar | 200, 400 |
| Performans | GiST `ix_health_facilities_geom`; 911 tesis ≈ 277 KB (gzip ≈ 32 KB). Arama 911 satırda sıralı tarama; trigram indeksi ölçülen ihtiyaç olmadan eklenmedi |

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

## Planlanan (henüz yok)
| Faz | Method | Yol |
|---|---|---|
| 4 | GET/POST/PATCH/DELETE | `/api/features`, `/api/features/{id}` |
| 5 | POST | `/api/analysis/within`, `/api/analysis/buffer`, `/api/analysis/nearest` |
| 6 | POST/GET | `/api/analysis/measure`, `/api/analysis/district-stats` |
