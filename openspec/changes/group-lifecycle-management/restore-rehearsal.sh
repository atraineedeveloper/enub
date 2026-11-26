#!/usr/bin/env bash
# Synthetic audit schema backup/restore rehearsal only; disposable CI database.
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true ]] || { echo "CI only"; exit 1; }
export PGPASSWORD=postgres
db=(psql -X -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# The concurrency suite has inserted fictitious group events.
before=$("${db[@]}" -c "SELECT count(*) || ':' || md5(string_agg(to_jsonb(e)::text,',' ORDER BY id)) FROM group_admin_private.events e")
[[ "$before" =~ ^[1-9][0-9]*:[0-9a-f]{32}$ ]]
# Exercise the same default schema/data dump options as production backup.
supabase db dump --local -f "$tmp/schema.sql"
supabase db dump --local -f "$tmp/data.sql" --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes
grep -Eq 'CREATE TABLE (IF NOT EXISTS )?"?group_admin_private"?\."?events"?' "$tmp/schema.sql"
grep -Eq '^COPY "?group_admin_private"?\."?events"?' "$tmp/data.sql"
# A second database on the isolated runner, not any linked project.
"${db[@]}" -c 'CREATE DATABASE group_audit_restore_qa'
dest=(psql -X -h 127.0.0.1 -p 54322 -U postgres -d group_audit_restore_qa -v ON_ERROR_STOP=1 -Atq)
# Independently restore the audit schema using its native pg_dump archive.
# Full default-dump coverage is checked above, but this restores only audit data.
pg_dump -h 127.0.0.1 -p 54322 -U postgres -d postgres --schema=group_admin_private --table=group_admin_private.events --no-owner --no-acl -f "$tmp/audit.sql"
"${dest[@]}" -c 'CREATE SCHEMA group_admin_private'
"${dest[@]}" -f "$tmp/audit.sql"
after=$("${dest[@]}" -c "SELECT count(*) || ':' || md5(string_agg(to_jsonb(e)::text,',' ORDER BY id)) FROM group_admin_private.events e")
[[ "$before" == "$after" ]]
echo "PASS: default backup includes audit schema and data; isolated audit table restore matches synthetic source"
