using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GeoMosk.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SearchTrigramIndexes : Migration
    {
        // Ad araması '%…%' LIKE'tır; B-tree bunu kullanamaz. Sorgudaki ifadeyle birebir aynı ifade üzerinde GIN trigram
        // indeksi kurulur (geomosk_search_normalize IMMUTABLE). Yerel adlar override tablolarında olduğu için onlara da (ADR-0020).
        private static readonly (string Index, string Table)[] TrigramIndexes =
        [
            ("ix_districts_name_trgm", "districts"),
            ("ix_district_overrides_name_trgm", "district_overrides"),
            ("ix_health_facilities_name_trgm", "health_facilities"),
            ("ix_facility_overrides_name_trgm", "facility_overrides"),
        ];

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:postgis", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:postgis", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,");

            foreach (var (index, table) in TrigramIndexes)
                migrationBuilder.Sql(
                    $"CREATE INDEX {index} ON {table} USING GIN (public.geomosk_search_normalize(name) public.gin_trgm_ops);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var (index, _) in TrigramIndexes)
                migrationBuilder.Sql($"DROP INDEX IF EXISTS {index};");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:postgis", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,");
        }
    }
}
