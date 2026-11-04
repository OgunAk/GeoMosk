# Test fixture'ları — SENTETİK

Bu dizindeki veriler **gerçek yer veya tesis değildir**. Yalnızca otomatik testler için elle tasarlanmıştır ve
gerçek veri gereksinimini (D01) karşıladığı söylenemez. Gerçek veri: `data/samples/osm-bursa/`.

## `osm-mini/` (Overpass JSON biçimi)
| Öğe | Amaç |
|---|---|
| relation 1 "Sentetik İlçe A" | Dış halka iki way'den birleşir; içinde delik (inner) var |
| relation 2 "Sentetik İlçe B" | A ile boylam 29.10 sınırını paylaşır |
| node 10 / node 15 | Aynı ad, ~30 m: olası mükerrer raporu |
| node 11 | A'nın deliğinde: hiçbir ilçede değil |
| node 12 | Ortak sınırda: iki ilçe tarafından kapsanır (tekil atama testi) |
| node 13 | `healthcare=doctor`, amenity yok → `doctors`; v2'de kaldırılır (silinmiş işaretleme) |
| way 20 | Kapalı alan → `ST_PointOnSurface` temsilî noktası |

`v2`: node 10 yeniden adlandırılır, node 13 kaldırılır. Checksum'lar `manifest.json` içindedir; dosya değişirse import reddeder.
