-- A01-A03 analiz sorgularının temsilî planları (uygulamadaki SQL ile aynı ifadeler; parametreler sabitlendi).
-- Çalıştırma: docker compose exec -T db psql -U geoscope -d geoscope -f /dev/stdin < scripts/sql/analysis-plans.sql
-- Not: 911 satırlık tabloda planlayıcı sıralı taramayı seçebilir; bu hata değildir. İndeksin bu ifadelerle
-- KULLANILABİLİR olduğunu göstermek için ikinci bölümde enable_seqscan kapatılır (yalnız bu oturumda).
\pset pager off
ANALYZE health_facilities;
ANALYZE districts;

\echo '=== A03 en yakın N (Bursa merkezi, N=5) ==='
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT f.id, ST_Distance(f.geom::geography, ST_SetSRID(ST_MakePoint(29.06, 40.19), 4326)::geography) AS distance_meters
FROM health_facilities f
WHERE f.source_deleted_at IS NULL
ORDER BY distance_meters, f.id
LIMIT 5;

\echo '=== A02 tampon 2000 m (Bursa merkezi) ==='
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT f.id, ST_Distance(f.geom::geography, ST_SetSRID(ST_MakePoint(29.06, 40.19), 4326)::geography) AS distance_meters
FROM health_facilities f
WHERE f.source_deleted_at IS NULL
  AND ST_DWithin(f.geom::geography, ST_SetSRID(ST_MakePoint(29.06, 40.19), 4326)::geography, 2000)
ORDER BY distance_meters, f.id;

\echo '=== A01 alan içinde (Nilüfer, ST_Covers) ==='
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT f.id FROM health_facilities f
WHERE f.source_deleted_at IS NULL
  AND ST_Covers((SELECT geom FROM districts WHERE source_id = 1273952 /* Nilüfer, OSM relation */), f.geom)
ORDER BY f.id;

SET enable_seqscan = off;
\echo '=== (enable_seqscan=off) A02 tampon: geography ifade indeksi kullanılabilir mi? ==='
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT f.id FROM health_facilities f
WHERE f.source_deleted_at IS NULL
  AND ST_DWithin(f.geom::geography, ST_SetSRID(ST_MakePoint(29.06, 40.19), 4326)::geography, 2000);

\echo '=== (enable_seqscan=off) A01 alan içinde: geometry GiST kullanılabilir mi? ==='
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT f.id FROM health_facilities f
WHERE f.source_deleted_at IS NULL
  AND ST_Covers((SELECT geom FROM districts WHERE source_id = 1273952 /* Nilüfer, OSM relation */), f.geom);
RESET enable_seqscan;

\echo '=== A05 ilçe başına tesis sayısı (tekil atama) ==='
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
WITH f AS (
    SELECT id, geom FROM health_facilities WHERE source_deleted_at IS NULL
), d AS (
    SELECT id, geom FROM districts WHERE source_deleted_at IS NULL
), candidates AS (
    SELECT f.id AS facility_id, d.id AS district_id, ST_Contains(d.geom, f.geom) AS interior,
           count(*) OVER (PARTITION BY f.id) AS match_count
    FROM f JOIN d ON ST_Covers(d.geom, f.geom)
), picked AS (
    SELECT DISTINCT ON (facility_id) facility_id, district_id, match_count
    FROM candidates ORDER BY facility_id, interior DESC, district_id
)
SELECT d.id, count(p.facility_id)::int, (count(p.facility_id) FILTER (WHERE p.match_count > 1))::int
FROM d LEFT JOIN picked p ON p.district_id = d.id
GROUP BY d.id ORDER BY d.id;

\echo '=== A04 ölçüm (Nilüfer, EPSG:32635) ==='
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF)
SELECT ST_Length(t.p), ST_Area(t.p), ST_Perimeter(t.p), ST_Length(t.g), ST_Area(t.g)
FROM (SELECT ST_Transform(geom, 32635) AS p, geom::geography AS g FROM districts WHERE source_id = 1273952) t;
