#!/usr/bin/env bash
# Sobe um banco descartável e roda as migrations novas + testes.
# Uso: PGHOST=/var/tmp/sstekpg PGPORT=5433 ./supabase/tests/local/run.sh
set -euo pipefail
cd "$(dirname "$0")"
DB=sstek_test_$$
psql -U postgres -qc "create database $DB" >/dev/null
trap 'psql -U postgres -qc "drop database if exists $DB" >/dev/null' EXIT
P="psql -U postgres -d $DB -q -v ON_ERROR_STOP=1"
$P -c "set client_min_messages=warning" -f 00_supabase_scaffold.sql
$P -f 01_base_minima.sql
$P -f ../../../docs/entrega1/SESSION_HELPERS_APPLIED.sql >/dev/null
for m in ../../migrations/20261102*_up.sql; do $P -f "$m"; done
for t in 9*_test_*.sql; do $P -f "$t"; done
# a reversão precisa funcionar e a migration precisa poder ser reaplicada
for m in $(ls -r ../../migrations/20261102*_down.sql); do $P -f "$m"; done
for m in ../../migrations/20261102*_up.sql; do $P -f "$m"; done
for m in ../../migrations/20261102*_up.sql; do $P -f "$m"; done
echo "OK: migrations aplicadas, revertidas e reaplicadas"
