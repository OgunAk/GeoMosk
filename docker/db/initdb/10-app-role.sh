#!/bin/sh
# postgis image ilk volume oluşturulurken çalıştırır. Var olan volume için elle:
#   docker compose exec db sh /docker-entrypoint-initdb.d/10-app-role.sh
set -eu
: "${GEOSCOPE_APP_USER:?GEOSCOPE_APP_USER gerekli}"
: "${GEOSCOPE_APP_PASSWORD:?GEOSCOPE_APP_PASSWORD gerekli}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_user="$GEOSCOPE_APP_USER" \
  -v app_password="$GEOSCOPE_APP_PASSWORD" \
  -v owner="$POSTGRES_USER" \
  -v dbname="$POSTGRES_DB" \
  -f /geoscope-sql/app-role.sql
