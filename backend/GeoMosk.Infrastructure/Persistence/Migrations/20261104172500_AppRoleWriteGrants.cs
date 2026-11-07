using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GeoMosk.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Uygulama rolüne (docker/db/sql/app-role.sql) yalnızca yerel düzenleme tablolarında yazma izni verir.
    /// Rol yoksa (ör. Testcontainers) işlem yapılmaz.
    /// </summary>
    [DbContext(typeof(GeoMoskDbContext))]
    [Migration("20261104172500_AppRoleWriteGrants")]
    public partial class AppRoleWriteGrants : Migration
    {
        private const string AppRole = "geomosk_app";

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"""
                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{AppRole}') THEN
                    GRANT SELECT ON ALL TABLES IN SCHEMA public TO {AppRole};
                    GRANT INSERT, UPDATE, DELETE ON district_overrides, facility_overrides, user_features TO {AppRole};
                  END IF;
                END $$;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql($"""
                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{AppRole}') THEN
                    REVOKE INSERT, UPDATE, DELETE ON district_overrides, facility_overrides, user_features FROM {AppRole};
                  END IF;
                END $$;
                """);
        }
    }
}
