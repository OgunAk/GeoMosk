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
