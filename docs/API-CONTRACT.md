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

## Uygulanan endpoint'ler

### `GET /api/health/live`
200 `{ "status": "Healthy", "checks": [] }` — yalnızca süreç canlılığı.

### `GET /api/health/ready`
200/503 `{ status, checks: [{ name: "postgis", status, description, data: { postgisVersion } }] }`.
503'te açıklama genel bir metindir; bağlantı ayrıntısı içermez.

### `GET /api/districts?bbox&limit&offset`
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

### `GET /api/facilities?bbox&limit&offset`
| | |
|---|---|
| Geometri | Point |
| properties | `layer: "facilities"`, `name` (null olabilir), `sourceName`, `description`, `facilityType` (hospital/clinic/doctors/dentist/pharmacy/other_healthcare), `osmType`, `osmId`, `representativePoint` (way/relation'dan üretilen nokta ise true) |
| Durumlar | 200, 400 |
| Performans | GiST `ix_health_facilities_geom`; 911 tesis ≈ 277 KB (gzip ≈ 32 KB) |

## Planlanan (henüz yok)
| Faz | Method | Yol |
|---|---|---|
| 3 | GET | `/api/layers` |
| 3 | GET/PATCH | `/api/districts/{id}`, `/api/facilities/{id}` (+ sunucu tarafı `q` araması) |
| 4 | GET/POST/PATCH/DELETE | `/api/features`, `/api/features/{id}` |
| 5 | POST | `/api/analysis/within`, `/api/analysis/buffer`, `/api/analysis/nearest` |
| 6 | POST/GET | `/api/analysis/measure`, `/api/analysis/district-stats` |
