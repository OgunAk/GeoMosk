# Veritabanı

PostgreSQL 17 + PostGIS 3.5 (`postgis/postgis:17-3.5`). Şema yalnızca EF Core migration'larıyla yönetilir
(`backend/GeoMosk.Infrastructure/Persistence/Migrations`); `EnsureCreated` kullanılmaz. Adlandırma snake_case
(EFCore.NamingConventions 9.0.0). Zaman damgaları `timestamptz`, UTC.

## Roller
| Rol | Kullanan | Yetki |
|---|---|---|
| `POSTGRES_USER` (varsayılan `geomosk`) | `migrate` işi, import | Şema sahibi. postgis image'ında superuser'dır; yalnızca kurulum/migration/import için kullanılır |
| `geomosk_app` | API (`api` servisi) | `NOSUPERUSER NOCREATEDB NOCREATEROLE`. Tüm tablolarda SELECT; INSERT/UPDATE/DELETE yalnızca `district_overrides`, `facility_overrides`, `user_features` |

- Rol oluşturma: `docker/db/sql/app-role.sql`. Yeni volume'da `docker/db/initdb/10-app-role.sh` otomatik çalışır; var olan volume için:
  `docker compose exec db sh /docker-entrypoint-initdb.d/10-app-role.sh`. Script tekrar çalıştırılabilir.
- Yazma izinleri iki yoldan verilir, böylece sıra fark etmez: rol migration'dan önce varsa migration `AppRoleWriteGrants`, sonra oluşturulursa rol script'i.
- `CREATE EXTENSION postgis`: postgis image'ı veritabanında kurar; migration ayrıca `CREATE EXTENSION IF NOT EXISTS postgis` içerir.

## Tablolar

### `districts` — ilçe sınırları (kaynak verisi)
| Kolon | Tip | Null | Not |
|---|---|---|---|
| id | bigint identity always | hayır | PK |
| source | varchar(32) | hayır | `osm` |
| source_object_type | varchar(16) | hayır | CHECK node/way/relation |
| source_id | bigint | hayır | OSM ID |
| name | varchar(200) | hayır | kaynak adı |
| attributes | jsonb | hayır | kaynak etiketleri, değiştirilmemiş |
| geom | geometry(MultiPolygon,4326) | hayır | CHECK `NOT ST_IsEmpty AND ST_IsValid` |
| source_timestamp | timestamptz | evet | Overpass osm_base |
| last_import_id | bigint | hayır | son değiştiren import |
| created_at / updated_at | timestamptz | hayır | default now() |
| source_deleted_at | timestamptz | evet | kaynakta artık yoksa |

Unique: `(source, source_object_type, source_id)`. İndeksler: `ix_districts_geom` GiST, `ix_districts_name_trgm` GIN trigram
(`geomosk_search_normalize(name)`; ad araması, ADR-0020). `district_overrides.name` için `ix_district_overrides_name_trgm`.

### `health_facilities` — sağlık tesisleri (kaynak verisi)
`districts` ile aynı kaynak/zaman kolonları ve ayrıca:
| Kolon | Tip | Null | Not |
|---|---|---|---|
| name | varchar(300) | evet | 12 kayıtta ad yok |
| facility_type | varchar(32) | hayır | CHECK hospital/clinic/doctors/dentist/pharmacy/other_healthcare |
| geom | geometry(Point,4326) | hayır | way/relation için ST_PointOnSurface; CHECK `NOT ST_IsEmpty` |
| source_geometry | geometry(Geometry,4326) | evet | way/relation'ın özgün şekli; CHECK SRID 4326 |

İndeksler: `ix_health_facilities_geom` GiST, `ix_health_facilities_geog` GiST **`((geom::geography))`** (buffer/nearest sorgularında `geom::geography` ifadesiyle eşleşir), `ix_health_facilities_facility_type` B-tree, `ix_health_facilities_name_trgm` GIN trigram (ad araması; `facility_overrides` için
`ix_facility_overrides_name_trgm`), unique kaynak anahtarı.

### `district_overrides`, `facility_overrides` — yerel sözel düzenleme
| Kolon | Tip | Not |
|---|---|---|
| district_id / facility_id | bigint | PK + FK (cascade) |
| name | varchar | `NULL` = kaynak adını kullan |
| description | varchar(2000) | `NULL` = açıklama yok |
| updated_at | timestamptz | |
| xmin (Version) | xid | iyimser eşzamanlılık (EF row version) |

Import bu tablolara yazmaz. PATCH semantiği (`docs/API-CONTRACT.md`): `name: null` = kaynak adına dön, `description: null` = temizle,
gönderilmeyen alan = değişmez. Satır silinmez; `xmin` ETag olarak kullanılır (ADR-0009).

### `user_features` — kullanıcı çizimleri
| Kolon | Tip | Not |
|---|---|---|
| id | uuid | default `gen_random_uuid()` |
| name | varchar(200) | |
| description | varchar(2000) | null olabilir |
| geom | geometry(Geometry,4326) | CHECK `GeometryType(geom) IN ('POINT','LINESTRING','POLYGON')`, `NOT ST_IsEmpty AND ST_IsValid` |
| created_at / updated_at | timestamptz | |
| xmin (Version) | xid | eşzamanlılık |

İndeks: `ix_user_features_geom` GiST. Not: PostGIS `geometry_columns` görünümü bu kolonda tipi CHECK ifadesinden tahmin edip yanıltıcı biçimde `POINT` gösterir. Gerçek typmod `format_type` ile `geometry(Geometry,4326)`'dır (test: `MigrationTests`).

### `import_history`
id, source, dataset (districts/facilities), snapshot_id, checksum (sha256), query, source_timestamp, started_at, finished_at,
status (CHECK running/succeeded/failed), processed/inserted/updated/unchanged/rejected/marked_deleted, error_summary (≤2000, sır içermez),
quality_report (jsonb). İndeks `(dataset, started_at)`. Başarısız denemeler transaction dışında kaydedilir.

## Migration'lar
| Migration | İçerik | Down etkisi |
|---|---|---|
| `20261104171011_InitialSchema` | Tüm tablolar, CHECK'ler, GiST + geography indeksi | Tabloları siler (veri kaybı) |
| `20261104172500_AppRoleWriteGrants` | `geomosk_app` varsa yazma izinleri | İzinleri geri alır |
| `20261104183939_SearchNormalization` | `CREATE EXTENSION unaccent`; `public.geomosk_search_normalize(text)` (IMMUTABLE, `lower(unaccent(...))`) | Fonksiyonu siler (uzantı kalır) |
| `20261107224118_SearchTrigramIndexes` | `CREATE EXTENSION pg_trgm`; dört GIN trigram indeksi (`districts`, `district_overrides`, `health_facilities`, `facility_overrides`) | İndeksleri siler (veri kaybı yok) |

Uygulama: `docker compose up` sırasında `migrate` servisi (EF migration bundle, şema sahibi rolü). Elle:
`dotnet tool run dotnet-ef database update --project backend/GeoMosk.Infrastructure --startup-project backend/GeoMosk.Infrastructure`
(`GEOMOSK_MIGRATION_CONNECTION` ortam değişkeniyle).

## Doğrulama
`MigrationTests`: tekrar uygulama (no-op), kolon typmod'ları, GiST/geography/trigram indeksleri, arama ifadesinin trigram indeksine eşleşmesi, CHECK'lerin geçersiz/kendini kesen/Multi*/boş geometriyi ve yanlış SRID'yi reddetmesi, Point/LineString/Polygon'un kabulü.
Sorgu planı (EXPLAIN) ölçümleri ilgili analiz fazlarında `scripts/sql/` altına kaydedilecek.
