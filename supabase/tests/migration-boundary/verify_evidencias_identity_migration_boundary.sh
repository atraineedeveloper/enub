#!/usr/bin/env bash
# Real pre/post migration-boundary identity verification for the Docencia
# "Evidencias" -> "Evidencias bimestrales" rename (finding #6), strengthened
# to also prove a real historical foreign-key reference survives the rename
# (finding #2, round 4). Unlike the synthetic-fixture pgTAP test
# (worker_document_type_lifecycle.test.sql, task 8.4), which only proves the
# general UPDATE-based-rename mechanism preserves id using a row this test
# itself creates, THIS script captures the ACTUAL seeded "Docencia /
# Evidencias" row's id before the real rename migration runs, attaches a
# real worker_documents row to that exact id, and compares both the catalog
# row and the worker_documents row's own foreign key after the migration.
#
# Mechanism: `supabase migration down --local --last N` genuinely rebuilds
# the local database from scratch and replays migration history up to (but
# excluding) the last N migrations -- this is an official Supabase CLI
# capability, not a file-moving hack. N is computed dynamically as "how
# many migration files exist from the retirement/rename migration onward,"
# so this script does not need updating if later migrations are added.
#
# This script is DESTRUCTIVE to the local database (it fully resets it,
# twice) and is meant to be run on demand for verification, not as part of
# the routine pgTAP suite (`supabase test db`). Restoration to the latest
# migration state happens in a single EXIT trap (finding #3, round 4) that
# fires on any exit path -- normal completion, an assertion failure, a
# command failure under `set -e`, or an interrupt -- so the local stack is
# never left mid-migration-history regardless of how this script ends.
# Only local Supabase is ever touched (`--local` throughout; `db reset`
# defaults to local, never `--linked`).
#
# Set FORCE_FAILURE=1 to deliberately abort partway through (after the
# fixture is created, before the migration is even applied) -- this is used
# to prove the EXIT trap restores the latest migration state even when the
# script fails, without needing a real assertion to break.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MIGRATIONS_DIR="${REPO_ROOT}/supabase/migrations"
RENAME_MIGRATION_NAME="20260716013947_retire_and_rename_docencia_document_types.sql"
CONTAINER="supabase_db_enub"
RESTORE_LOG="/tmp/migration_boundary_restore.log"

cd "${REPO_ROOT}"

psql_local() {
  docker exec -i -e PGPASSWORD=postgres "${CONTAINER}" psql -U postgres -d postgres -tAc "$1"
}

# ---------------------------------------------------------------------------
# Cleanup trap: ALWAYS restores the local database to the latest migration
# state (a full `supabase db reset`, local only), regardless of how or why
# this script is exiting. Guarded against recursive invocation (the trap is
# disabled with `trap - EXIT` as the very first thing inside the handler,
# so nothing inside the handler itself -- including a failing `db reset` --
# can re-trigger it). The ORIGINAL exit code is preserved and reported
# unless restoration itself fails, in which case this script exits
# non-zero regardless (leaving the local database at an uncertain
# migration state is itself a reportable failure, never hidden).
# ---------------------------------------------------------------------------
CLEANUP_RAN=0
restore_latest_state() {
  local original_exit_code="$1"

  if [[ "${CLEANUP_RAN}" -eq 1 ]]; then
    return
  fi
  CLEANUP_RAN=1
  trap - EXIT

  echo ""
  echo "[cleanup] Restoring the local database to the latest migration state (supabase db reset --local only)..."
  if bunx supabase db reset >"${RESTORE_LOG}" 2>&1; then
    echo "[cleanup] Restoration succeeded -- local database is at the latest migration state."
    exit "${original_exit_code}"
  else
    echo "[cleanup] FAIL: restoration itself failed -- local database may NOT be at the latest migration state. See ${RESTORE_LOG}:" >&2
    tail -20 "${RESTORE_LOG}" >&2
    if [[ "${original_exit_code}" -eq 0 ]]; then
      # The script's own checks passed, but leaving the database at a
      # non-latest state is itself a failure of this script's contract --
      # never silently reported as an overall success.
      exit 1
    else
      exit "${original_exit_code}"
    fi
  fi
}
trap 'restore_latest_state $?' EXIT

# Compute N: count of migration files from the rename migration to the end
# of the sorted migration list (inclusive).
MIGRATION_FILES=$(ls "${MIGRATIONS_DIR}" | sort)
N=$(echo "${MIGRATION_FILES}" | awk -v target="${RENAME_MIGRATION_NAME}" '
  $0 == target { found=1 }
  found { count++ }
  END { print count }
')

if [[ -z "${N}" || "${N}" -lt 1 ]]; then
  echo "FAIL: could not locate ${RENAME_MIGRATION_NAME} in ${MIGRATIONS_DIR} -- cannot compute how many migrations to revert."
  exit 1
fi

echo "Reverting the last ${N} migration(s) (from ${RENAME_MIGRATION_NAME} onward) to reach the genuine pre-rename state..."
bunx supabase migration down --local --last "${N}" --yes >/tmp/migration_down.log 2>&1
tail -5 /tmp/migration_down.log

# --- 1. Locate the actual seeded "Docencia / Evidencias" row -----------------
BEFORE_ID=$(psql_local "
  SELECT wdt.id
  FROM public.worker_document_types wdt
  JOIN public.worker_document_categories wdc ON wdc.id = wdt.category_id
  WHERE wdc.name = 'Docencia' AND wdt.name = 'Evidencias';
")

if [[ -z "${BEFORE_ID}" ]]; then
  echo "FAIL: no 'Docencia / Evidencias' row found before the rename migration -- unexpected pre-migration state."
  exit 1
fi

# --- 2. Capture its ID dynamically, plus the attributes the post-condition --
#        already checks (category/allows_multiple/sort_order) -- never a
#        hard-coded literal.
BEFORE_CATEGORY=$(psql_local "
  SELECT wdc.name
  FROM public.worker_document_types wdt
  JOIN public.worker_document_categories wdc ON wdc.id = wdt.category_id
  WHERE wdt.id = ${BEFORE_ID};
")
BEFORE_ALLOWS_MULTIPLE=$(psql_local "SELECT allows_multiple FROM public.worker_document_types WHERE id = ${BEFORE_ID};")
BEFORE_SORT_ORDER=$(psql_local "SELECT sort_order FROM public.worker_document_types WHERE id = ${BEFORE_ID};")

echo "Captured BEFORE catalog state: id=${BEFORE_ID} category=${BEFORE_CATEGORY} allows_multiple=${BEFORE_ALLOWS_MULTIPLE} sort_order=${BEFORE_SORT_ORDER}"

# --- 3. Create the minimum valid worker/document fixture referencing that --
#        exact ID (this runs BEFORE the rename migration, on a database
#        where the lifecycle trigger does not exist yet -- only the two
#        original scope/single-file triggers apply, and Evidencias is a
#        semester-scoped, allows_multiple type, so a plain insert is valid).
FIXTURE_IDS=$(docker exec -i -e PGPASSWORD=postgres "${CONTAINER}" psql -U postgres -d postgres -qtA <<SQL
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Migration Boundary FK Worker', 'QA', 1)
    RETURNING id
),
semester_insert AS (
    INSERT INTO public.semesters (semester, school_year)
    VALUES ('QA Migration Boundary', '2026-2027')
    RETURNING id
),
document_insert AS (
    INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
    SELECT worker_insert.id, ${BEFORE_ID}, semester_insert.id, 'evidencia_historica.pdf', 'migration-boundary/evidencia_historica.pdf', 'application/pdf', 100
    FROM worker_insert, semester_insert
    RETURNING id, document_type_id
)
SELECT worker_insert.id || '|' || document_insert.id || '|' || document_insert.document_type_id
FROM worker_insert, document_insert;
SQL
)

FIXTURE_WORKER_ID=$(echo "${FIXTURE_IDS}" | cut -d'|' -f1)
FIXTURE_DOCUMENT_ID=$(echo "${FIXTURE_IDS}" | cut -d'|' -f2)
FIXTURE_DOCUMENT_TYPE_ID=$(echo "${FIXTURE_IDS}" | cut -d'|' -f3)

# --- 4. Record the worker_documents.id and document_type_id ----------------
echo "Captured historical FK fixture: worker_documents.id=${FIXTURE_DOCUMENT_ID} document_type_id=${FIXTURE_DOCUMENT_TYPE_ID}"

if [[ -z "${FIXTURE_DOCUMENT_ID}" || -z "${FIXTURE_DOCUMENT_TYPE_ID}" ]]; then
  echo "FAIL: could not create the historical worker_documents fixture referencing Docencia / Evidencias."
  exit 1
fi

if [[ "${FIXTURE_DOCUMENT_TYPE_ID}" != "${BEFORE_ID}" ]]; then
  echo "FAIL: fixture's document_type_id (${FIXTURE_DOCUMENT_TYPE_ID}) does not match the captured Evidencias id (${BEFORE_ID})."
  exit 1
fi

if [[ "${FORCE_FAILURE:-0}" == "1" ]]; then
  echo ""
  echo "FORCE_FAILURE=1 set -- deliberately aborting before the migration is applied, to prove the cleanup trap restores the latest migration state on failure."
  exit 1
fi

echo "Applying the remaining migrations (rename onward)..."
bunx supabase migration up --local >/tmp/migration_up.log 2>&1
tail -5 /tmp/migration_up.log

# --- After applying the real migration --------------------------------------
AFTER_ID=$(psql_local "
  SELECT wdt.id
  FROM public.worker_document_types wdt
  JOIN public.worker_document_categories wdc ON wdc.id = wdt.category_id
  WHERE wdc.name = 'Docencia' AND wdt.name = 'Evidencias bimestrales';
")
AFTER_CATEGORY=$(psql_local "
  SELECT wdc.name
  FROM public.worker_document_types wdt
  JOIN public.worker_document_categories wdc ON wdc.id = wdt.category_id
  WHERE wdt.id = ${AFTER_ID:-0};
")
AFTER_ALLOWS_MULTIPLE=$(psql_local "SELECT allows_multiple FROM public.worker_document_types WHERE id = ${AFTER_ID:-0};")
AFTER_SORT_ORDER=$(psql_local "SELECT sort_order FROM public.worker_document_types WHERE id = ${AFTER_ID:-0};")
AFTER_IS_ACTIVE=$(psql_local "SELECT is_active FROM public.worker_document_types WHERE id = ${AFTER_ID:-0};")

echo "Captured AFTER catalog state: id=${AFTER_ID} category=${AFTER_CATEGORY} allows_multiple=${AFTER_ALLOWS_MULTIPLE} sort_order=${AFTER_SORT_ORDER} is_active=${AFTER_IS_ACTIVE}"

FAIL=0

if [[ -z "${AFTER_ID}" ]]; then
  echo "FAIL: no 'Docencia / Evidencias bimestrales' row found after the rename migration."
  FAIL=1
fi

if [[ "${BEFORE_ID}" != "${AFTER_ID}" ]]; then
  echo "FAIL: id changed across the rename (before=${BEFORE_ID}, after=${AFTER_ID}) -- identity was NOT preserved."
  FAIL=1
else
  echo "PASS: the same id (${BEFORE_ID}) carries the row across the real rename migration."
fi

[[ "${BEFORE_CATEGORY}" == "${AFTER_CATEGORY}" ]] || { echo "FAIL: category changed (before=${BEFORE_CATEGORY}, after=${AFTER_CATEGORY})"; FAIL=1; }
[[ "${BEFORE_ALLOWS_MULTIPLE}" == "${AFTER_ALLOWS_MULTIPLE}" ]] || { echo "FAIL: allows_multiple changed"; FAIL=1; }
[[ "${BEFORE_SORT_ORDER}" == "${AFTER_SORT_ORDER}" ]] || { echo "FAIL: sort_order changed"; FAIL=1; }
[[ "${AFTER_IS_ACTIVE}" == "t" ]] || { echo "FAIL: is_active is not true after the rename"; FAIL=1; }

# --- Historical foreign-key preservation (finding #2, round 4) -------------
FK_DOCUMENT_STILL_EXISTS=$(psql_local "SELECT count(*) FROM public.worker_documents WHERE id = ${FIXTURE_DOCUMENT_ID};")
FK_DOCUMENT_TYPE_ID_NOW=$(psql_local "SELECT document_type_id FROM public.worker_documents WHERE id = ${FIXTURE_DOCUMENT_ID};")
FK_RESOLVES_TO_NAME=$(psql_local "
  SELECT wdt.name
  FROM public.worker_documents wd
  JOIN public.worker_document_types wdt ON wdt.id = wd.document_type_id
  WHERE wd.id = ${FIXTURE_DOCUMENT_ID};
")

echo "Historical fixture after migration: exists=${FK_DOCUMENT_STILL_EXISTS} document_type_id=${FK_DOCUMENT_TYPE_ID_NOW} resolves_to=${FK_RESOLVES_TO_NAME}"

[[ "${FK_DOCUMENT_STILL_EXISTS}" == "1" ]] || { echo "FAIL: the historical worker_documents row no longer exists after the migration."; FAIL=1; }
[[ "${FK_DOCUMENT_TYPE_ID_NOW}" == "${FIXTURE_DOCUMENT_TYPE_ID}" ]] || { echo "FAIL: the historical row's document_type_id changed (was ${FIXTURE_DOCUMENT_TYPE_ID}, now ${FK_DOCUMENT_TYPE_ID_NOW})."; FAIL=1; }
[[ "${FK_RESOLVES_TO_NAME}" == "Evidencias bimestrales" ]] || { echo "FAIL: the historical row's document_type_id no longer resolves to 'Evidencias bimestrales' (resolves to '${FK_RESOLVES_TO_NAME}')."; FAIL=1; }
[[ -n "${FK_RESOLVES_TO_NAME}" ]] || { echo "FAIL: the historical row's foreign key does not resolve at all -- orphaned."; FAIL=1; }

if [[ "${FAIL}" -eq 0 ]]; then
  echo ""
  echo "RESULT: PASS -- the actual seeded Docencia/Evidencias row's id (${BEFORE_ID}) is proven, via a real migration-history boundary (not a synthetic fixture, not a hard-coded literal), to be the same row now named Evidencias bimestrales, with allows_multiple/sort_order/category unchanged and is_active = true. A real historical worker_documents row (id ${FIXTURE_DOCUMENT_ID}) created before the rename migration still exists afterward, with its document_type_id unchanged and correctly resolving to the renamed type -- the foreign key was never orphaned."
  exit 0
else
  echo ""
  echo "RESULT: FAIL -- see above."
  exit 1
fi
