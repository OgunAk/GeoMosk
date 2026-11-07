using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GeoMosk.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SearchNormalization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:postgis", ",,");

            // Arama normalleştirmesi: önce unaccent (İ→I, ı→i, ü→u, ş→s, ğ→g, ç→c, ö→o), sonra lower.
            // Sözlük açıkça verildiği için sonuç search_path'ten bağımsızdır; IMMUTABLE ileride ifade indeksine izin verir.
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION public.geomosk_search_normalize(value text)
                RETURNS text
                LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
                AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, value)) $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS public.geomosk_search_normalize(text);");
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:postgis", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,");
        }
    }
}
