-- Uygulama çalışma rolü: superuser değil, şema değiştiremez.
-- Kaynak tablolarını okur; yalnızca override ve kullanıcı çizimi tablolarına yazar (yazma izinleri migration'da verilir).
-- Tekrar çalıştırılabilir. psql değişkenleri: app_user, app_password, owner, dbname.

SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'app_user', :'app_password')
\gexec

GRANT CONNECT ON DATABASE :"dbname" TO :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public GRANT SELECT ON TABLES TO :"app_user";

-- Rol, migration'dan sonra oluşturulduysa (var olan volume) yazma izinleri burada da verilir.
-- Migration AppRoleWriteGrants aynı izni rol önceden varsa verir; sıra fark etmez.
SELECT format('GRANT INSERT, UPDATE, DELETE ON %I TO %I', table_name, :'app_user')
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('district_overrides', 'facility_overrides', 'user_features')
\gexec
