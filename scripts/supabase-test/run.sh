#!/usr/bin/env bash
# Runs src/lib/db/supabase-store.integration.test.ts against a real Postgres +
# PostgREST (the same REST layer Supabase uses). Requirements: a local
# Postgres you can `psql` into as a superuser, and a `postgrest` binary
# (https://github.com/PostgREST/postgrest/releases) on PATH or in $POSTGREST.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=${SITEFLOW_TEST_DB:-siteflow_it}
PSQL=${PSQL:-psql}
POSTGREST=${POSTGREST:-postgrest}
SECRET=siteflow-integration-test-secret-at-least-32-chars
PORT=${PGRST_PORT:-3901}
PROXY_PORT=${PROXY_PORT:-3902}

$PSQL -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
$PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f scripts/supabase-test/stub.sql
# every migration in order, except pg_cron scheduling (extension not available on plain Postgres)
for f in $(ls supabase/migrations/*.sql | grep -v _cron); do
  $PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f" 2>&1 | grep -v -E "NOTICE|WARNING|HINT" || true
done
$PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f scripts/supabase-test/grants.sql

HOST=${PGHOST:-localhost}
cat > /tmp/siteflow-postgrest.conf <<CONF
db-uri = "postgres://authenticator:authenticator@$HOST:5432/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = $PORT
db-max-rows = 1000
CONF
$POSTGREST /tmp/siteflow-postgrest.conf > /tmp/siteflow-postgrest.log 2>&1 &
PGRST_PID=$!
trap 'kill $PGRST_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.5; done

SITEFLOW_IT=1 SITEFLOW_IT_SECRET=$SECRET SITEFLOW_IT_PGRST=http://localhost:$PORT SITEFLOW_IT_PROXY_PORT=$PROXY_PORT \
SITEFLOW_IT_DB=$DB SITEFLOW_IT_PSQL="$PSQL" \
  npx vitest run src/lib/db/supabase-store.integration.test.ts
