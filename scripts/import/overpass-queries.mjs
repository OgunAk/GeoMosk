// Bursa veri seti için Overpass sorguları. Değişiklik → docs/DATA-SOURCES.md ve yeni snapshot.
// Alan filtresi: Bursa il sınırı (admin_level=4). İlçe = admin_level=6 (Türkiye OSM ilçe düzeyi).

const PROVINCE = 'area["boundary"="administrative"]["admin_level"="4"]["name"="Bursa"]->.prov;';

export const FACILITY_AMENITIES = ['hospital', 'clinic', 'doctors', 'dentist', 'pharmacy'];

export const QUERIES = {
  // out geom: üye way'lerin koordinatları ilişki içinde gelir; halkalar PostGIS'te kurulur.
  districts: `[out:json][timeout:180];
${PROVINCE}
rel(area.prov)["boundary"="administrative"]["admin_level"="6"];
out geom;`,

  // amenity sağlık türleri + amenity etiketi olmayan healthcare=* nesneleri. nwr: node/way/relation.
  facilities: `[out:json][timeout:180];
${PROVINCE}
(
  nwr(area.prov)["amenity"~"^(${FACILITY_AMENITIES.join('|')})$"];
  nwr(area.prov)["healthcare"]["amenity"!~"."];
);
out geom;`,
};
