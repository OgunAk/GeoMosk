#!/usr/bin/env node
// OSM snapshot'ını PostGIS'e yükler: checksum → staging → geometri kurulumu/doğrulama → upsert → kalite raporu.
//   node scripts/import/load-osm.mjs [--snapshot <dizin>] [--connection <postgres://…>]
// Bağlantı: --connection veya GEOSCOPE_IMPORT_DATABASE_URL. Şema migration ile önceden kurulmuş olmalı.
//
// Garanti: iki veri seti tek transaction'da yazılır; hata olursa hiçbir kaynak tablosu değişmez,
// import_history'de "failed" kaydı kalır. Override tabloları ve user_features'a dokunulmaz.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Bursa çalışma alanı (il sınırını kapsayan zarf). Dışındaki kayıt kalite raporunda işaretlenir.
const STUDY_AREA = { minLon: 28.0, minLat: 39.5, maxLon: 30.1, maxLat: 40.8 };
const DUPLICATE_DISTANCE_M = 100;

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function latestSnapshot() {
  for (const base of ['data/raw/osm', 'data/samples/osm-bursa']) {
    const dir = path.join(root, base);
    if (!fs.existsSync(dir)) continue;
    const ids = fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'manifest.json'))).sort();
    if (ids.length) return path.join(dir, ids.at(-1));
  }
  throw new Error('Snapshot bulunamadı; önce `npm run import:fetch` çalıştırın veya --snapshot verin.');
}

function readSnapshot(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const datasets = {};
  for (const name of ['districts', 'facilities']) {
    const meta = manifest.files?.[name];
    if (!meta) throw new Error(`manifest'te ${name} yok`);
    // Manifest güvenilmeyen girdidir: dosya adı snapshot klasörünün dışına çıkamaz.
    if (typeof meta.file !== 'string' || path.basename(meta.file) !== meta.file) {
      throw new Error(`${name}: manifest dosya adı geçersiz (yalnız snapshot klasöründeki dosya adı kabul edilir)`);
    }
    const text = fs.readFileSync(path.join(dir, meta.file), 'utf8');
    const sha = crypto.createHash('sha256').update(text).digest('hex');
    if (sha !== meta.sha256) throw new Error(`${name}: checksum uyuşmuyor (manifest ${meta.sha256.slice(0, 12)}…, dosya ${sha.slice(0, 12)}…)`);
    datasets[name] = { meta, elements: JSON.parse(text).elements };
  }
  return { manifest, datasets };
}

// Overpass koordinatları WGS84 boylam/enlemdir (EPSG:4326). ST_SetSRID burada dönüşüm değil,
// bilinen CRS'nin etiketlenmesidir. Halkalar üye way'lerden ST_BuildArea ile kurulur (iç halkalar delik olur).
const LINE_FROM_COORDS = (coordsExpr) => `ST_SetSRID(ST_MakeLine(ARRAY(
    SELECT ST_MakePoint((c->>'lon')::float8, (c->>'lat')::float8)
    FROM jsonb_array_elements(${coordsExpr}) WITH ORDINALITY AS t(c, ord) ORDER BY ord)), 4326)`;

const AREA_FROM_MEMBERS = (membersExpr) => `(
    SELECT ST_BuildArea(ST_Collect(${LINE_FROM_COORDS("m->'geometry'")}))
    FROM jsonb_array_elements(${membersExpr}) m
    WHERE m->>'type' = 'way' AND m->>'role' IN ('outer', 'inner', '') AND jsonb_array_length(m->'geometry') >= 2)`;

const STAGE_DISTRICTS_SQL = `
CREATE TEMP TABLE stg_districts ON COMMIT DROP AS
WITH src AS (
  SELECT e->>'type' AS osm_type, (e->>'id')::bigint AS osm_id, e->'tags' AS tags,
         ${AREA_FROM_MEMBERS("e->'members'")} AS raw_geom
  FROM jsonb_array_elements($1::jsonb) e
)
SELECT osm_type, osm_id, tags, tags->>'name' AS name,
       raw_geom IS NOT NULL AND ST_IsValid(raw_geom) AS was_valid,
       CASE WHEN raw_geom IS NULL THEN NULL
            ELSE ST_Multi(ST_CollectionExtract(ST_MakeValid(raw_geom), 3)) END AS geom
FROM src;
`;

const STAGE_FACILITIES_SQL = `
CREATE TEMP TABLE stg_facilities ON COMMIT DROP AS
WITH src AS (
  SELECT e->>'type' AS osm_type, (e->>'id')::bigint AS osm_id, e->'tags' AS tags,
         CASE e->>'type'
           WHEN 'node' THEN ST_SetSRID(ST_MakePoint((e->>'lon')::float8, (e->>'lat')::float8), 4326)
           WHEN 'way' THEN (SELECT CASE WHEN ST_IsClosed(l) AND ST_NPoints(l) >= 4 THEN ST_MakePolygon(l) ELSE l END
                            FROM (SELECT ${LINE_FROM_COORDS("e->'geometry'")} AS l) x)
           WHEN 'relation' THEN ${AREA_FROM_MEMBERS("e->'members'")}
         END AS shape
  FROM jsonb_array_elements($1::jsonb) e
)
SELECT osm_type, osm_id, tags, NULLIF(btrim(tags->>'name'), '') AS name,
       CASE
         WHEN tags->>'amenity' IN ('hospital', 'clinic', 'doctors', 'dentist', 'pharmacy') THEN tags->>'amenity'
         WHEN tags->>'healthcare' IN ('hospital', 'clinic', 'dentist', 'pharmacy') THEN tags->>'healthcare'
         WHEN tags->>'healthcare' = 'doctor' THEN 'doctors'
         ELSE 'other_healthcare'
       END AS facility_type,
       CASE WHEN osm_type = 'node' THEN NULL ELSE ST_MakeValid(shape) END AS source_geometry,
       -- Way/relation için temsilî nokta: alanın içinde garanti edilen nokta; giriş kapısı/adres değildir.
       CASE WHEN osm_type = 'node' THEN shape ELSE ST_PointOnSurface(ST_MakeValid(shape)) END AS geom
FROM src;
`;

const REJECT_SQL = `
SELECT 'districts' AS dataset, osm_type, osm_id, 'geometri kurulamadı veya boş' AS reason
FROM stg_districts WHERE geom IS NULL OR ST_IsEmpty(geom)
UNION ALL
SELECT 'districts', osm_type, osm_id, 'ad yok' FROM stg_districts WHERE name IS NULL
UNION ALL
SELECT 'facilities', osm_type, osm_id, 'geometri kurulamadı' FROM stg_facilities
WHERE geom IS NULL OR ST_IsEmpty(geom) OR GeometryType(geom) <> 'POINT'
ORDER BY 1, 2, 3;
`;

// Değişmeyen satırlar güncellenmez (updated_at korunur); ST_AsBinary ile tam geometri karşılaştırması.
const UPSERT_DISTRICTS = `
WITH up AS (
  INSERT INTO districts (source, source_object_type, source_id, name, attributes, geom, source_timestamp, last_import_id)
  SELECT 'osm', osm_type, osm_id, name, tags, geom, $1::timestamptz, $2::bigint
  FROM stg_districts WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom) AND name IS NOT NULL
  ON CONFLICT (source, source_object_type, source_id) DO UPDATE
    SET name = EXCLUDED.name, attributes = EXCLUDED.attributes, geom = EXCLUDED.geom,
        source_timestamp = EXCLUDED.source_timestamp, last_import_id = EXCLUDED.last_import_id,
        source_deleted_at = NULL, updated_at = now()
    WHERE (districts.name, districts.attributes, ST_AsBinary(districts.geom), districts.source_deleted_at)
          IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.attributes, ST_AsBinary(EXCLUDED.geom), NULL::timestamptz)
  RETURNING (xmax = 0) AS inserted
)
SELECT count(*) FILTER (WHERE inserted)::int AS inserted, count(*) FILTER (WHERE NOT inserted)::int AS updated FROM up;
`;

const UPSERT_FACILITIES = `
WITH up AS (
  INSERT INTO health_facilities (source, source_object_type, source_id, name, facility_type, attributes, geom,
                                 source_geometry, source_timestamp, last_import_id)
  SELECT 'osm', osm_type, osm_id, name, facility_type, tags, geom, source_geometry, $1::timestamptz, $2::bigint
  FROM stg_facilities WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom) AND GeometryType(geom) = 'POINT'
  ON CONFLICT (source, source_object_type, source_id) DO UPDATE
    SET name = EXCLUDED.name, facility_type = EXCLUDED.facility_type, attributes = EXCLUDED.attributes,
        geom = EXCLUDED.geom, source_geometry = EXCLUDED.source_geometry,
        source_timestamp = EXCLUDED.source_timestamp, last_import_id = EXCLUDED.last_import_id,
        source_deleted_at = NULL, updated_at = now()
    WHERE (health_facilities.name, health_facilities.facility_type, health_facilities.attributes,
           ST_AsBinary(health_facilities.geom), ST_AsBinary(health_facilities.source_geometry), health_facilities.source_deleted_at)
          IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.facility_type, EXCLUDED.attributes,
           ST_AsBinary(EXCLUDED.geom), ST_AsBinary(EXCLUDED.source_geometry), NULL::timestamptz)
  RETURNING (xmax = 0) AS inserted
)
SELECT count(*) FILTER (WHERE inserted)::int AS inserted, count(*) FILTER (WHERE NOT inserted)::int AS updated FROM up;
`;

// Toplu silme koruması: eksik/boş snapshot (ör. Overpass'ın boş yanıtı) tüm kayıtları "kaynakta silindi" diye işaretlemesin.
// Aktif kaydın yarısından azı snapshot'ta kalıyorsa import geri alınır; bilinçli durumlar için --allow-mass-delete.
const MIN_KEEP_RATIO = 0.5;
async function guardMassDelete(client, table, stg, name) {
  const { rows: [r] } = await client.query(
    `SELECT (SELECT count(*) FROM ${stg})::int AS staged,
            (SELECT count(*) FROM ${table} WHERE source = 'osm' AND source_deleted_at IS NULL)::int AS active`);
  if (r.active > 0 && r.staged < r.active * MIN_KEEP_RATIO && !process.argv.includes('--allow-mass-delete')) {
    throw new Error(`${name}: snapshot ${r.staged} kayıt içeriyor, veritabanında ${r.active} aktif kayıt var. ` +
      'Toplu "silindi" işaretlemesi engellendi; snapshot doğruysa --allow-mass-delete ile tekrar çalıştırın.');
  }
}

// Kaynaktan kalkan kayıt silinmez: override'ları korumak için işaretlenir.
const MARK_DELETED = (table, stg) => `
WITH m AS (
  UPDATE ${table} t SET source_deleted_at = now(), updated_at = now()
  WHERE t.source = 'osm' AND t.source_deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM ${stg} s WHERE s.osm_type = t.source_object_type AND s.osm_id = t.source_id)
  RETURNING 1
) SELECT count(*)::int AS n FROM m;`;

const QUALITY_SQL = `
SELECT jsonb_build_object(
  'districts', (SELECT jsonb_build_object(
      'active', count(*) FILTER (WHERE source_deleted_at IS NULL),
      'markedDeleted', count(*) FILTER (WHERE source_deleted_at IS NOT NULL),
      'srids', jsonb_agg(DISTINCT ST_SRID(geom)),
      'geometryTypes', jsonb_agg(DISTINCT GeometryType(geom)),
      'invalid', count(*) FILTER (WHERE NOT ST_IsValid(geom)),
      'empty', count(*) FILTER (WHERE ST_IsEmpty(geom)),
      'extent', ST_AsText(ST_Extent(geom)),
      'repairedOnImport', (SELECT coalesce(jsonb_agg(osm_id ORDER BY osm_id), '[]') FROM stg_districts WHERE NOT was_valid AND geom IS NOT NULL))
    FROM districts),
  'facilities', (SELECT jsonb_build_object(
      'active', count(*) FILTER (WHERE source_deleted_at IS NULL),
      'markedDeleted', count(*) FILTER (WHERE source_deleted_at IS NOT NULL),
      'srids', jsonb_agg(DISTINCT ST_SRID(geom)),
      'geometryTypes', jsonb_agg(DISTINCT GeometryType(geom)),
      'byType', (SELECT jsonb_object_agg(facility_type, n) FROM (SELECT facility_type, count(*) n FROM health_facilities WHERE source_deleted_at IS NULL GROUP BY 1) x),
      'bySourceObjectType', (SELECT jsonb_object_agg(source_object_type, n) FROM (SELECT source_object_type, count(*) n FROM health_facilities WHERE source_deleted_at IS NULL GROUP BY 1) x),
      'withoutName', count(*) FILTER (WHERE name IS NULL AND source_deleted_at IS NULL),
      'outsideStudyArea', count(*) FILTER (WHERE NOT ST_Covers(ST_MakeEnvelope($1, $2, $3, $4, 4326), geom)),
      'extent', ST_AsText(ST_Extent(geom)))
    FROM health_facilities),
  'facilitiesNotInAnyDistrict', (SELECT count(*) FROM health_facilities f WHERE f.source_deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM districts d WHERE d.source_deleted_at IS NULL AND ST_Covers(d.geom, f.geom))),
  'facilitiesInMultipleDistricts', (SELECT count(*) FROM health_facilities f WHERE f.source_deleted_at IS NULL
      AND (SELECT count(*) FROM districts d WHERE d.source_deleted_at IS NULL AND ST_Covers(d.geom, f.geom)) > 1),
  -- Aynı tesisi farklı OSM nesneleri temsil edebilir; otomatik silinmez, raporlanır.
  'suspectedDuplicates', (SELECT coalesce(jsonb_agg(jsonb_build_array(a.id, b.id, a.name)), '[]') FROM health_facilities a
      JOIN health_facilities b ON a.id < b.id AND lower(a.name) = lower(b.name)
       AND ST_DWithin(a.geom::geography, b.geom::geography, $5)
      WHERE a.source_deleted_at IS NULL AND b.source_deleted_at IS NULL)
) AS report;`;

function safeError(err) {
  // Bağlantı dizesi/parola içermez; yalnızca mesaj ve PostgreSQL kodu.
  return `${err.code ? `[${err.code}] ` : ''}${err.message}`.slice(0, 1900);
}

async function main() {
  const snapshotDir = path.resolve(root, arg('--snapshot') ?? latestSnapshot());
  const connectionString = arg('--connection') ?? process.env.GEOSCOPE_IMPORT_DATABASE_URL;
  if (!connectionString) throw new Error('Bağlantı gerekli: --connection veya GEOSCOPE_IMPORT_DATABASE_URL');

  const { manifest, datasets } = readSnapshot(snapshotDir);
  const client = new pg.Client({ connectionString });
  await client.connect();
  const runIds = {};
  try {
    // Geçmiş kayıtları transaction dışında: rollback olsa da deneme izlenebilir kalır.
    for (const [name, ds] of Object.entries(datasets)) {
      const r = await client.query(
        `INSERT INTO import_history (source, dataset, snapshot_id, checksum, query, source_timestamp, status, processed,
                                     inserted, updated, unchanged, rejected, marked_deleted)
         VALUES ('osm', $1, $2, $3, $4, $5, 'running', $6, 0, 0, 0, 0, 0) RETURNING id`,
        [name, manifest.snapshotId, ds.meta.sha256, ds.meta.query, ds.meta.osmBase, ds.elements.length]);
      runIds[name] = r.rows[0].id;
    }

    await client.query('BEGIN');
    await client.query(STAGE_DISTRICTS_SQL, [JSON.stringify(datasets.districts.elements)]);
    await client.query(STAGE_FACILITIES_SQL, [JSON.stringify(datasets.facilities.elements)]);
    const rejected = (await client.query(REJECT_SQL)).rows;
    const d = (await client.query(UPSERT_DISTRICTS, [datasets.districts.meta.osmBase, runIds.districts])).rows[0];
    const f = (await client.query(UPSERT_FACILITIES, [datasets.facilities.meta.osmBase, runIds.facilities])).rows[0];
    await guardMassDelete(client, 'districts', 'stg_districts', 'districts');
    await guardMassDelete(client, 'health_facilities', 'stg_facilities', 'facilities');
    const dDel = (await client.query(MARK_DELETED('districts', 'stg_districts'))).rows[0].n;
    const fDel = (await client.query(MARK_DELETED('health_facilities', 'stg_facilities'))).rows[0].n;
    const { minLon, minLat, maxLon, maxLat } = STUDY_AREA;
    const quality = (await client.query(QUALITY_SQL, [minLon, minLat, maxLon, maxLat, DUPLICATE_DISTANCE_M])).rows[0].report;
    quality.rejected = rejected;

    // Bir öğe birden çok nedenle reddedilebilir; sayım öğe başına bir kez.
    const rejectedCount = (dataset) => new Set(rejected.filter((r) => r.dataset === dataset).map((r) => `${r.osm_type}/${r.osm_id}`)).size;
    const stats = {
      districts: { ...d, rejected: rejectedCount('districts'), markedDeleted: dDel },
      facilities: { ...f, rejected: rejectedCount('facilities'), markedDeleted: fDel },
    };
    for (const [name, s] of Object.entries(stats)) {
      const processed = datasets[name].elements.length;
      s.unchanged = processed - s.inserted - s.updated - s.rejected;
      await client.query(
        `UPDATE import_history SET status = 'succeeded', finished_at = now(), inserted = $2, updated = $3, unchanged = $4,
           rejected = $5, marked_deleted = $6, quality_report = $7 WHERE id = $1`,
        [runIds[name], s.inserted, s.updated, s.unchanged, s.rejected, s.markedDeleted, quality]);
    }
    await client.query('COMMIT');

    console.log(JSON.stringify({ snapshot: manifest.snapshotId, importIds: runIds, stats, quality }, null, 2));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    for (const id of Object.values(runIds)) {
      await client.query(`UPDATE import_history SET status = 'failed', finished_at = now(), error_summary = $2 WHERE id = $1`,
        [id, safeError(err)]).catch(() => {});
    }
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`Import başarısız: ${safeError(err)}`);
  process.exit(1);
});
