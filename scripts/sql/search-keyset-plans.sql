-- ADR-0020 kanıtı: ad araması (GIN trigram) ve keyset sayfalama sorgu planları.
-- Yalnız ayrı performans veritabanında (geomosk_perf: 911 gerçek + 9.089 SENTETİK tesis) çalıştırılır.
-- Sorgular API'nin EF Core ile ürettiği SQL'dir (EF komut günlüğünden alındı); parametreler sabit değerle yazıldı.
-- Çalıştırma: docker compose exec -T db psql -U geomosk -d geomosk_perf -f /dev/stdin < scripts/sql/search-keyset-plans.sql
\pset pager off
SELECT current_database() AS db, count(*) AS facilities FROM health_facilities;

\echo '=== 1. Ad araması "devlet" (limit 50): trigram indeksiyle'
EXPLAIN (ANALYZE, COSTS OFF, TIMING ON, SUMMARY ON)
SELECT h1.id
FROM (
    SELECT h.id FROM health_facilities AS h
    WHERE h.source_deleted_at IS NULL AND h.id IN (
        SELECT h0.id FROM health_facilities AS h0
        LEFT JOIN facility_overrides AS f ON h0.id = f.facility_id
        WHERE (f.facility_id IS NULL OR f.name IS NULL)
          AND public.geomosk_search_normalize(h0.name) LIKE '%' || COALESCE(public.geomosk_search_normalize('devlet'), '') || '%' ESCAPE '\'
        UNION ALL
        SELECT f0.facility_id FROM facility_overrides AS f0
        WHERE f0.name IS NOT NULL
          AND public.geomosk_search_normalize(f0.name) LIKE '%' || COALESCE(public.geomosk_search_normalize('devlet'), '') || '%' ESCAPE '\'
    )
    ORDER BY h.id LIMIT 51
) AS h1;

\echo '=== 2. Aynı arama, indeks kullanımı kapalı (karşılaştırma: önceki davranış = sıralı tarama)'
BEGIN;
SET LOCAL enable_bitmapscan = off;
SET LOCAL enable_indexscan = off;
EXPLAIN (ANALYZE, COSTS OFF, TIMING ON, SUMMARY ON)
SELECT h.id FROM health_facilities AS h
WHERE h.source_deleted_at IS NULL
  AND public.geomosk_search_normalize(h.name) LIKE '%' || COALESCE(public.geomosk_search_normalize('devlet'), '') || '%' ESCAPE '\'
ORDER BY h.id LIMIT 51;
ROLLBACK;

\echo '=== 3. Derin sayfa, OFFSET 9000 (limit 100)'
EXPLAIN (ANALYZE, COSTS OFF, TIMING ON, SUMMARY ON)
SELECT h.id FROM health_facilities AS h
WHERE h.source_deleted_at IS NULL
ORDER BY h.id LIMIT 101 OFFSET 9000;

\echo '=== 4. Aynı sayfa, keyset after=9000 (limit 100)'
EXPLAIN (ANALYZE, COSTS OFF, TIMING ON, SUMMARY ON)
SELECT h.id FROM health_facilities AS h
WHERE h.source_deleted_at IS NULL AND h.id > 9000
ORDER BY h.id LIMIT 101;
