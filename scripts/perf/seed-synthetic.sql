-- SENTETİK PERFORMANS VERİSİ — gerçek kaynak verisi değildir.
-- Yalnız ayrı performans veritabanına (geoscope_perf) uygulanır; uygulama DB'sine (geoscope) çalıştırılmaz.
-- Gerçek OSM import'unun üstüne, tesis sayısını 10.000'e tamamlayacak kadar nokta ekler.
-- Noktalar gerçek ilçe sınırlarının içinde, ilçe alanıyla orantılı ve tohumlu (ST_GeneratePoints seed) → tekrar üretilebilir.
-- Çalıştırma: docker compose exec -T db psql -U geoscope -d geoscope_perf -v ON_ERROR_STOP=1 -f /dev/stdin < scripts/perf/seed-synthetic.sql
\set target 10000
DO $$
BEGIN
  IF current_database() <> 'geoscope_perf' THEN
    RAISE EXCEPTION 'Bu script yalnız geoscope_perf veritabanında çalışır (şu an: %)', current_database();
  END IF;
END $$;

DELETE FROM health_facilities WHERE source = 'synthetic';

WITH need AS (
  SELECT :target - count(*) AS n FROM health_facilities WHERE source_deleted_at IS NULL
), share AS (
  SELECT d.id, d.geom,
         ceil((SELECT n FROM need) * ST_Area(d.geom::geography) / sum(ST_Area(d.geom::geography)) OVER ())::int AS k
  FROM districts d WHERE d.source_deleted_at IS NULL
), pts AS (
  SELECT s.id AS district_id, (ST_Dump(ST_GeneratePoints(s.geom, s.k, s.id::int))).geom AS geom
  FROM share s WHERE s.k > 0
), numbered AS (
  SELECT row_number() OVER (ORDER BY district_id, ST_X(geom), ST_Y(geom)) AS n, geom FROM pts
)
INSERT INTO health_facilities (source, source_object_type, source_id, name, facility_type, attributes, geom, last_import_id)
SELECT 'synthetic', 'node', n, 'SENTETİK tesis ' || n,
       (ARRAY['pharmacy','pharmacy','pharmacy','doctors','dentist','clinic','hospital','other_healthcare'])[1 + (n % 8)],
       '{"synthetic": true}'::jsonb, geom, 0  -- geom zaten 4326 (ilçe geometrisinden üretildi)
FROM numbered
WHERE n <= (SELECT n FROM need);

ANALYZE health_facilities;
SELECT source, count(*) FROM health_facilities GROUP BY source ORDER BY source;
