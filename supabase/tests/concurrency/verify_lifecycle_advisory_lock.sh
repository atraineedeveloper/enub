#!/usr/bin/env bash
# Genuine two-connection concurrency harness for the shared lifecycle
# advisory lock (pg_advisory_xact_lock(hashtextextended('worker_document_type:
# lifecycle:' || document_type_id::text, 0))), used identically by the
# retirement/rename migration, enforce_active_worker_document_type, and
# replace_worker_document_metadata.
#
# pgTAP files run inside a single BEGIN...ROLLBACK transaction on ONE
# connection, so they cannot prove real cross-connection blocking -- this
# script uses two independent `docker exec` psql processes (two genuinely
# separate database connections/backends) and real wall-clock timing to
# prove the lock actually blocks one side while the other holds it, not
# merely that the two operations happen to run in a particular order.
#
# What this DOES prove: two real connections serialize on the same
# lock key, in both directions, with a measured minimum blocking duration
# as evidence of real blocking (not a coincidental ordering).
# What this does NOT prove: behavior under production-scale concurrent
# load, deadlock scenarios beyond this exact schedule, or anything about
# genuine network-partitioned distributed connections (this remains a
# single local Postgres instance, two backends).

set -euo pipefail

CONTAINER="supabase_db_enub"
PSQL="docker exec -i -e PGPASSWORD=postgres ${CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=0 -qtA"
HOLD_SECONDS=2
HEAD_START_SECONDS=0.5
# The contender starts HEAD_START_SECONDS into the HOLD_SECONDS hold, so the
# expected wait is approximately (HOLD_SECONDS - HEAD_START_SECONDS) =~ 1.5s,
# not the full HOLD_SECONDS. MIN_BLOCK_SECONDS is set comfortably below that
# expected value -- high enough that no real block could pass it by
# accident (a non-blocking call returns in milliseconds), low enough to
# absorb ordinary scheduling/Docker-exec jitter without a flaky false FAIL.
MIN_BLOCK_SECONDS=1.2
FAIL=0

log() { printf '%s\n' "$*"; }

# --- Fixtures: one worker, one semester, one single-file active type -------
FIXTURE_IDS=$(docker exec -i -e PGPASSWORD=postgres "${CONTAINER}" psql -U postgres -d postgres -qtA <<'SQL'
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Concurrency Worker', 'QA', 1)
    RETURNING id
),
semester_insert AS (
    INSERT INTO public.semesters (semester, school_year)
    VALUES ('QA Concurrency', '2026-2027')
    RETURNING id
),
type_lookup AS (
    SELECT worker_document_types.id
    FROM public.worker_document_types
    JOIN public.worker_document_categories
        ON worker_document_categories.id = worker_document_types.category_id
    WHERE worker_document_categories.name = 'Docencia'
        AND worker_document_types.name = 'Concentrado de calificaciones finales'
)
SELECT worker_insert.id || '|' || semester_insert.id || '|' || type_lookup.id
FROM worker_insert, semester_insert, type_lookup;
SQL
)

WORKER_ID=$(echo "$FIXTURE_IDS" | cut -d'|' -f1)
SEMESTER_ID=$(echo "$FIXTURE_IDS" | cut -d'|' -f2)
TYPE_ID=$(echo "$FIXTURE_IDS" | cut -d'|' -f3)

log "Fixtures: worker_id=${WORKER_ID} semester_id=${SEMESTER_ID} document_type_id=${TYPE_ID}"

cleanup() {
  docker exec -i -e PGPASSWORD=postgres "${CONTAINER}" psql -U postgres -d postgres -qtA >/dev/null <<SQL || true
DELETE FROM public.worker_documents WHERE worker_id = ${WORKER_ID};
DELETE FROM public.semesters WHERE id = ${SEMESTER_ID};
DELETE FROM public.workers WHERE id = ${WORKER_ID};
UPDATE public.worker_document_types SET is_active = true WHERE id = ${TYPE_ID};
SQL
}
trap cleanup EXIT

# ============================================================================
# Schedule 1: Retirement wins
#   1. connection A acquires the lifecycle lock and updates is_active = false
#   2. connection B starts a replacement and blocks
#   3. A commits
#   4. B resumes, receives WDT01
#   5. old metadata remains
#   6. no new metadata commits
# ============================================================================
log ""
log "=== Schedule 1: Retirement wins ==="

# Seed an existing document under the active type, so "old metadata remains"
# is a concrete, checkable row, not just an absence.
docker exec -i -e PGPASSWORD=postgres "${CONTAINER}" psql -U postgres -d postgres -qtA >/dev/null <<SQL
INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
VALUES (${WORKER_ID}, ${TYPE_ID}, ${SEMESTER_ID}, 'concentrado_v1.pdf', 'concurrency/schedule1/concentrado_v1.pdf', 'application/pdf', 100);
SQL

# Connection A: acquire the lock, retire the type, hold the lock for
# HOLD_SECONDS via pg_sleep before committing.
( ${PSQL} <<SQL
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('worker_document_type:lifecycle:${TYPE_ID}', 0));
SELECT clock_timestamp() AS a_lock_acquired;
UPDATE public.worker_document_types SET is_active = false WHERE id = ${TYPE_ID};
SELECT pg_sleep(${HOLD_SECONDS});
COMMIT;
SELECT clock_timestamp() AS a_committed;
SQL
) > /tmp/schedule1_a.log 2>&1 &
PID_A=$!

sleep 0.5  # ensure A acquires the lock first

B_START=$(date +%s.%N)
B_OUTPUT=$( ${PSQL} <<SQL 2>&1
\set VERBOSITY verbose
SELECT clock_timestamp() AS b_call_starting;
SELECT * FROM public.replace_worker_document_metadata(${WORKER_ID}, ${TYPE_ID}, ${SEMESTER_ID}, 'concentrado_v2.pdf', 'concurrency/schedule1/concentrado_v2.pdf', 'application/pdf', 200);
SQL
)
B_END=$(date +%s.%N)
wait "${PID_A}"

B_DURATION=$(echo "${B_END} - ${B_START}" | bc)
log "Connection A log:"; sed 's/^/  /' /tmp/schedule1_a.log
log "Connection B output:"; echo "${B_OUTPUT}" | sed 's/^/  /'
log "Connection B wall-clock duration: ${B_DURATION}s. Expected measurable blocking above the configured threshold (${MIN_BLOCK_SECONDS}s)."

# Note: psql's default ON_ERROR_STOP=0 means its own process exit code stays
# 0 even when a statement inside errors -- the reliable signal that the RPC
# actually failed is the WDT01 text in its output, checked next, not the
# psql process's own exit status.
if ! echo "${B_OUTPUT}" | grep -q "WDT01"; then
  log "FAIL: expected WDT01 in connection B's error output"
  FAIL=1
fi

if (( $(echo "${B_DURATION} < ${MIN_BLOCK_SECONDS}" | bc -l) )); then
  log "FAIL: connection B returned too quickly (${B_DURATION}s) -- does not look like it actually blocked on the lock"
  FAIL=1
fi

OLD_ROW_COUNT=$(docker exec -i -e PGPASSWORD=postgres "${CONTAINER}" psql -U postgres -d postgres -qtA <<SQL
SELECT count(*) FROM public.worker_documents WHERE storage_path = 'concurrency/schedule1/concentrado_v1.pdf';
SQL
)
NEW_ROW_COUNT=$(docker exec -i -e PGPASSWORD=postgres "${CONTAINER}" psql -U postgres -d postgres -qtA <<SQL
SELECT count(*) FROM public.worker_documents WHERE storage_path = 'concurrency/schedule1/concentrado_v2.pdf';
SQL
)

log "Old metadata row still present: ${OLD_ROW_COUNT} (expected 1)"
log "New metadata row committed: ${NEW_ROW_COUNT} (expected 0)"

[[ "${OLD_ROW_COUNT}" == "1" ]] || { log "FAIL: old metadata was lost"; FAIL=1; }
[[ "${NEW_ROW_COUNT}" == "0" ]] || { log "FAIL: new metadata committed despite the RPC failing"; FAIL=1; }

# Cleanup schedule 1's fixture row and reset the type back to active for schedule 2.
docker exec -i -e PGPASSWORD=postgres "${CONTAINER}" psql -U postgres -d postgres -qtA >/dev/null <<SQL
DELETE FROM public.worker_documents WHERE worker_id = ${WORKER_ID};
UPDATE public.worker_document_types SET is_active = true WHERE id = ${TYPE_ID};
SQL

# ============================================================================
# Schedule 2: Replacement wins
#   1. connection B acquires the lifecycle lock and starts replacement
#   2. connection A attempts retirement and blocks
#   3. B commits the replacement
#   4. A resumes and retires the type
#   5. exactly one replacement row exists
#   6. final type is inactive
# ============================================================================
log ""
log "=== Schedule 2: Replacement wins ==="

docker exec -i -e PGPASSWORD=postgres "${CONTAINER}" psql -U postgres -d postgres -qtA >/dev/null <<SQL
INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
VALUES (${WORKER_ID}, ${TYPE_ID}, ${SEMESTER_ID}, 'concentrado_v1.pdf', 'concurrency/schedule2/concentrado_v1.pdf', 'application/pdf', 100);
SQL

# Connection B: wraps the RPC call in an explicit outer transaction so the
# advisory lock the RPC acquires internally is held until this connection's
# own COMMIT -- a pg_sleep after the call, before COMMIT, simulates the
# client taking HOLD_SECONDS to finish its own post-commit work while still
# holding the transaction (and therefore the lock) open.
( ${PSQL} <<SQL
BEGIN;
SELECT clock_timestamp() AS b_call_starting;
SELECT * FROM public.replace_worker_document_metadata(${WORKER_ID}, ${TYPE_ID}, ${SEMESTER_ID}, 'concentrado_v2.pdf', 'concurrency/schedule2/concentrado_v2.pdf', 'application/pdf', 200);
SELECT pg_sleep(${HOLD_SECONDS});
COMMIT;
SELECT clock_timestamp() AS b_committed;
SQL
) > /tmp/schedule2_b.log 2>&1 &
PID_B=$!

sleep 0.5  # ensure B acquires the lock first

A_START=$(date +%s.%N)
${PSQL} <<SQL > /tmp/schedule2_a.log 2>&1
BEGIN;
SELECT clock_timestamp() AS a_call_starting;
SELECT pg_advisory_xact_lock(hashtextextended('worker_document_type:lifecycle:${TYPE_ID}', 0));
SELECT clock_timestamp() AS a_lock_acquired;
UPDATE public.worker_document_types SET is_active = false WHERE id = ${TYPE_ID};
COMMIT;
SELECT clock_timestamp() AS a_committed;
SQL
A_END=$(date +%s.%N)
wait "${PID_B}"

A_DURATION=$(echo "${A_END} - ${A_START}" | bc)
log "Connection B log:"; sed 's/^/  /' /tmp/schedule2_b.log
log "Connection A log:"; sed 's/^/  /' /tmp/schedule2_a.log
log "Connection A wall-clock duration: ${A_DURATION}s. Expected measurable blocking above the configured threshold (${MIN_BLOCK_SECONDS}s)."

if (( $(echo "${A_DURATION} < ${MIN_BLOCK_SECONDS}" | bc -l) )); then
  log "FAIL: connection A completed too quickly (${A_DURATION}s) -- does not look like it actually blocked on the lock"
  FAIL=1
fi

REPLACEMENT_COUNT=$(docker exec -i -e PGPASSWORD=postgres "${CONTAINER}" psql -U postgres -d postgres -qtA <<SQL
SELECT count(*) FROM public.worker_documents WHERE worker_id = ${WORKER_ID} AND document_type_id = ${TYPE_ID} AND semester_id = ${SEMESTER_ID};
SQL
)
FINAL_IS_ACTIVE=$(docker exec -i -e PGPASSWORD=postgres "${CONTAINER}" psql -U postgres -d postgres -qtA <<SQL
SELECT is_active FROM public.worker_document_types WHERE id = ${TYPE_ID};
SQL
)

log "Exactly one replacement row present: ${REPLACEMENT_COUNT} (expected 1)"
log "Final type is_active: ${FINAL_IS_ACTIVE} (expected f)"

[[ "${REPLACEMENT_COUNT}" == "1" ]] || { log "FAIL: expected exactly one replacement row"; FAIL=1; }
[[ "${FINAL_IS_ACTIVE}" == "f" ]] || { log "FAIL: expected the type to end up inactive"; FAIL=1; }

log ""
if [[ "${FAIL}" -eq 0 ]]; then
  log "RESULT: PASS -- both schedules exhibited real cross-connection blocking with the expected outcomes."
  exit 0
else
  log "RESULT: FAIL -- see above."
  exit 1
fi
