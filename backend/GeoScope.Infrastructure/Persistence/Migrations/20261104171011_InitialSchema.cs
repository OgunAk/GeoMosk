using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace GeoScope.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,");

            migrationBuilder.CreateTable(
                name: "districts",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    source_object_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    source_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    attributes = table.Column<string>(type: "jsonb", nullable: false),
                    geom = table.Column<MultiPolygon>(type: "geometry(MultiPolygon,4326)", nullable: false),
                    source_timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_import_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    source_deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_districts", x => x.id);
                    table.CheckConstraint("ck_districts_geom_valid", "NOT ST_IsEmpty(geom) AND ST_IsValid(geom)");
                    table.CheckConstraint("ck_districts_source_object_type", "source_object_type IN ('node','way','relation')");
                });

            migrationBuilder.CreateTable(
                name: "health_facilities",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    source_object_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    source_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    facility_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    attributes = table.Column<string>(type: "jsonb", nullable: false),
                    geom = table.Column<Point>(type: "geometry(Point,4326)", nullable: false),
                    source_geometry = table.Column<Geometry>(type: "geometry(Geometry,4326)", nullable: true),
                    source_timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_import_id = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    source_deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_health_facilities", x => x.id);
                    table.CheckConstraint("ck_health_facilities_facility_type", "facility_type IN ('hospital','clinic','doctors','dentist','pharmacy','other_healthcare')");
                    table.CheckConstraint("ck_health_facilities_geom_not_empty", "NOT ST_IsEmpty(geom)");
                    table.CheckConstraint("ck_health_facilities_source_geometry_srid", "source_geometry IS NULL OR ST_SRID(source_geometry) = 4326");
                    table.CheckConstraint("ck_health_facilities_source_object_type", "source_object_type IN ('node','way','relation')");
                });

            migrationBuilder.CreateTable(
                name: "import_history",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    dataset = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    snapshot_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    checksum = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    query = table.Column<string>(type: "text", nullable: true),
                    source_timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    processed = table.Column<int>(type: "integer", nullable: false),
                    inserted = table.Column<int>(type: "integer", nullable: false),
                    updated = table.Column<int>(type: "integer", nullable: false),
                    unchanged = table.Column<int>(type: "integer", nullable: false),
                    rejected = table.Column<int>(type: "integer", nullable: false),
                    marked_deleted = table.Column<int>(type: "integer", nullable: false),
                    error_summary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    quality_report = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_import_history", x => x.id);
                    table.CheckConstraint("ck_import_history_status", "status IN ('running','succeeded','failed')");
                });

            migrationBuilder.CreateTable(
                name: "user_features",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    geom = table.Column<Geometry>(type: "geometry(Geometry,4326)", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_features", x => x.id);
                    table.CheckConstraint("ck_user_features_geom_type", "GeometryType(geom) IN ('POINT','LINESTRING','POLYGON')");
                    table.CheckConstraint("ck_user_features_geom_valid", "NOT ST_IsEmpty(geom) AND ST_IsValid(geom)");
                });

            migrationBuilder.CreateTable(
                name: "district_overrides",
                columns: table => new
                {
                    district_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_district_overrides", x => x.district_id);
                    table.ForeignKey(
                        name: "fk_district_overrides_districts_district_id",
                        column: x => x.district_id,
                        principalTable: "districts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "facility_overrides",
                columns: table => new
                {
                    facility_id = table.Column<long>(type: "bigint", nullable: false),
                    name = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_facility_overrides", x => x.facility_id);
                    table.ForeignKey(
                        name: "fk_facility_overrides_health_facilities_facility_id",
                        column: x => x.facility_id,
                        principalTable: "health_facilities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_districts_geom",
                table: "districts",
                column: "geom")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "ix_districts_source_source_object_type_source_id",
                table: "districts",
                columns: new[] { "source", "source_object_type", "source_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_health_facilities_facility_type",
                table: "health_facilities",
                column: "facility_type");

            migrationBuilder.CreateIndex(
                name: "ix_health_facilities_geom",
                table: "health_facilities",
                column: "geom")
                .Annotation("Npgsql:IndexMethod", "gist");

            migrationBuilder.CreateIndex(
                name: "ix_health_facilities_source_source_object_type_source_id",
                table: "health_facilities",
                columns: new[] { "source", "source_object_type", "source_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_import_history_dataset_started_at",
                table: "import_history",
                columns: new[] { "dataset", "started_at" });

            migrationBuilder.CreateIndex(
                name: "ix_user_features_geom",
                table: "user_features",
                column: "geom")
                .Annotation("Npgsql:IndexMethod", "gist");

            // ST_DWithin/ST_Distance(geom::geography, …) sorguları geometry GiST'ini kullanamaz;
            // aynı ifadeye eşleşen geography indeksi gerekir (buffer/nearest analizleri).
            migrationBuilder.Sql(
                "CREATE INDEX ix_health_facilities_geog ON health_facilities USING GIST ((geom::geography));");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_health_facilities_geog;");

            migrationBuilder.DropTable(
                name: "district_overrides");

            migrationBuilder.DropTable(
                name: "facility_overrides");

            migrationBuilder.DropTable(
                name: "import_history");

            migrationBuilder.DropTable(
                name: "user_features");

            migrationBuilder.DropTable(
                name: "districts");

            migrationBuilder.DropTable(
                name: "health_facilities");
        }
    }
}
