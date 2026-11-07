#!/bin/sh
# postgis image ilk volume oluşturulurken çalıştırır. Var olan volume için elle:
#   docker compose exec db sh /docker-entrypoint-initdb.d/10-app-role.sh
set -eu
: "${GEOMOSK_APP_USER:?GEOMOSK_APP_USER gerekli}"
: "${GEOMOSK_APP_PASSWORD:?GEOMOSK_APP_PASSWORD gerekli}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_user="$GEOMOSK_APP_USER" \
  -v app_password="$GEOMOSK_APP_PASSWORD" \
  -v owner="$POSTGRES_USER" \
  -v dbname="$POSTGRES_DB" \
  -f /geomosk-sql/app-role.sql
