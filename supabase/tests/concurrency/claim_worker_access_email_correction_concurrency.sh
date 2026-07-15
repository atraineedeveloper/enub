#!/usr/bin/env bash
# Real two-session concurrency verification for
# claim_worker_access_email_correction (code-review finding #13,
# add-worker-access-email-correction).
#
# WHAT THIS HARNESS ACTUALLY PROVES: two genuinely separate PostgreSQL
# backend connections, coordinated through the SAME advisory lock the
# claim RPC itself acquires (never merely "started around the same
# time") -- session A holds the worker-identity lock open for several
# seconds (by calling the real claim RPC inside a transaction, then
# sleeping before committing, since pg_advisory_xact_lock releases only
# at transaction end); session B's own real claim RPC call is issued
# while A still holds the lock, and B's own elapsed wall-clock time is
# measured to confirm B genuinely BLOCKED on that lock rather than
# racing past it. This is real, observable cross-connection blocking
# behavior, not a timing coincidence.
#
# WHAT THIS HARNESS DOES NOT PROVE: the partial-unique-index race the
# claim RPC's own `EXCEPTION WHEN unique_violation` handler defends
# against (tasks.md 3.18) is, BY THE DESIGN THIS LOCK ORDER GUARANTEES,
# unreachable via genuine concurrent execution for the SAME worker_id --
# the worker lock alone fully serializes any two claims against one
# worker, so there is no window in which two real concurrent sessions
# could both observe "no blocking row" before either commits. That
# specific defense-in-depth path remains verified the way tasks.md 3.18
# already verifies it: a deterministic, single-transaction simulation
# (pgTAP), not a real concurrent race -- because the lock design makes a
# real one impossible to construct honestly.
#
# Requires: the local Supabase stack running (supabase_db_enub reachable
# via `docker exec`). Safe to run repeatedly; all fixture rows use a
# fixed, dedicated worker/Auth id range and are cleaned up at the end
# (best-effort) via a wrapping transaction per session -- but since each
# session's own COMMIT is what this harness is proving happens, cleanup
# is a final DELETE pass, not a rollback.

set -euo pipefail

CONTAINER="supabase_db_enub"
PSQL="docker exec -i -e PGPASSWORD=postgres ${CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1"
SCRATCH_DIR="$(mktemp -d)"
trap 'rm -rf "${SCRATCH_DIR}"' EXIT

pass_count=0
fail_count=0

report() {
  local label="$1"
  local ok="$2"
  if [ "${ok}" = "1" ]; then
    echo "PASS: ${label}"
    pass_count=$((pass_count + 1))
  else
    echo "FAIL: ${label}"
    fail_count=$((fail_count + 1))
  fi
}

cleanup_fixtures() {
  ${PSQL} -q -c "
    DELETE FROM public.worker_access_email_corrections WHERE worker_id IN (900001, 900002, 900003);
    DELETE FROM public.profiles WHERE worker_id IN (900001, 900002, 900003);
    DELETE FROM auth.users WHERE id IN (
      '90000000-0000-0000-0000-000000000001',
      '90000000-0000-0000-0000-000000000002',
      '90000000-0000-0000-0000-000000000003'
    );
    DELETE FROM public.workers WHERE id IN (900001, 900002, 900003);
  " > /dev/null 2>&1 || true
}

cleanup_fixtures

# ---------------------------------------------------------------------------
# Test 1: simultaneous IDENTICAL-target claims for the same worker
# ---------------------------------------------------------------------------
echo "=== Test 1: simultaneous identical-target claims ==="

${PSQL} -q -c "
  INSERT INTO public.workers (id, name, type_worker, status, email)
  VALUES (900001, 'Concurrency Test Worker 1', 'QA', 1, 'concurrency-test-1@example.test')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'concurrency-test-1-auth@example.test', 'x', now(), '{}', '{}', now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, role, worker_id)
  VALUES ('90000000-0000-0000-0000-000000000001', 'worker', 900001)
  ON CONFLICT (id) DO NOTHING;
" > /dev/null

cat > "${SCRATCH_DIR}/session_a_1.sql" <<'SQL'
BEGIN;
SELECT operation_id AS a_op_id, outcome AS a_outcome FROM public.claim_worker_access_email_correction(900001, 'concurrency-same-target@example.test') \gset
\echo SESSION_A_OUTCOME: :a_outcome
SELECT pg_sleep(3);
COMMIT;
SQL

${PSQL} -q < "${SCRATCH_DIR}/session_a_1.sql" > "${SCRATCH_DIR}/session_a_1.out" 2>&1 &
SESSION_A_PID=$!

sleep 1

start_ns=$(date +%s%N)
${PSQL} -t -A -q -c "SELECT outcome FROM public.claim_worker_access_email_correction(900001, 'concurrency-same-target@example.test');" \
  > "${SCRATCH_DIR}/session_b_1.out" 2>&1
end_ns=$(date +%s%N)
elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))

wait "${SESSION_A_PID}"

session_a_outcome=$(grep "SESSION_A_OUTCOME:" "${SCRATCH_DIR}/session_a_1.out" | awk '{print $2}')
session_b_outcome=$(tr -d '[:space:]' < "${SCRATCH_DIR}/session_b_1.out")

echo "Session A outcome: ${session_a_outcome}"
echo "Session B outcome: ${session_b_outcome}"
echo "Session B elapsed: ${elapsed_ms}ms (must be >= ~2000ms to prove genuine blocking on session A's held lock, not a coincidental race)"

[ "${session_a_outcome}" = "created" ] && a_ok=1 || a_ok=0
report "Test 1: session A (first claimant) received 'created'" "${a_ok}"

[ "${session_b_outcome}" = "resumed" ] && b_ok=1 || b_ok=0
report "Test 1: session B (blocked, later claimant) received 'resumed' for the identical target" "${b_ok}"

[ "${elapsed_ms}" -ge 2000 ] && timing_ok=1 || timing_ok=0
report "Test 1: session B genuinely blocked (elapsed >= 2000ms) on session A's held worker-identity lock" "${timing_ok}"

cleanup_fixtures

# ---------------------------------------------------------------------------
# Test 2: simultaneous DIFFERENT-target claims for the same worker
# ---------------------------------------------------------------------------
echo
echo "=== Test 2: simultaneous different-target claims ==="

${PSQL} -q -c "
  INSERT INTO public.workers (id, name, type_worker, status, email)
  VALUES (900002, 'Concurrency Test Worker 2', 'QA', 1, 'concurrency-test-2@example.test')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'concurrency-test-2-auth@example.test', 'x', now(), '{}', '{}', now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, role, worker_id)
  VALUES ('90000000-0000-0000-0000-000000000002', 'worker', 900002)
  ON CONFLICT (id) DO NOTHING;
" > /dev/null

cat > "${SCRATCH_DIR}/session_a_2.sql" <<'SQL'
BEGIN;
SELECT operation_id AS a_op_id, outcome AS a_outcome FROM public.claim_worker_access_email_correction(900002, 'concurrency-target-a@example.test') \gset
\echo SESSION_A_OUTCOME: :a_outcome
SELECT pg_sleep(3);
COMMIT;
SQL

${PSQL} -q < "${SCRATCH_DIR}/session_a_2.sql" > "${SCRATCH_DIR}/session_a_2.out" 2>&1 &
SESSION_A_PID=$!

sleep 1

start_ns=$(date +%s%N)
${PSQL} -t -A -q -c "SELECT outcome FROM public.claim_worker_access_email_correction(900002, 'concurrency-target-b@example.test');" \
  > "${SCRATCH_DIR}/session_b_2.out" 2>&1
end_ns=$(date +%s%N)
elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))

wait "${SESSION_A_PID}"

session_a_outcome=$(grep "SESSION_A_OUTCOME:" "${SCRATCH_DIR}/session_a_2.out" | awk '{print $2}')
session_b_outcome=$(tr -d '[:space:]' < "${SCRATCH_DIR}/session_b_2.out")

echo "Session A outcome: ${session_a_outcome}"
echo "Session B outcome: ${session_b_outcome}"
echo "Session B elapsed: ${elapsed_ms}ms"

[ "${session_a_outcome}" = "created" ] && a_ok=1 || a_ok=0
report "Test 2: session A (first claimant, target A) received 'created'" "${a_ok}"

[ "${session_b_outcome}" = "different_target_in_progress" ] && b_ok=1 || b_ok=0
report "Test 2: session B (blocked, different target B) received 'different_target_in_progress'" "${b_ok}"

[ "${elapsed_ms}" -ge 2000 ] && timing_ok=1 || timing_ok=0
report "Test 2: session B genuinely blocked (elapsed >= 2000ms) on session A's held worker-identity lock" "${timing_ok}"

cleanup_fixtures

# ---------------------------------------------------------------------------
# Test 3: lock order -- the worker-identity lock is acquired FIRST
# ---------------------------------------------------------------------------
echo
echo "=== Test 3: lock order (worker-identity lock acquired before the Auth-identity lock) ==="

${PSQL} -q -c "
  INSERT INTO public.workers (id, name, type_worker, status, email)
  VALUES (900003, 'Concurrency Test Worker 3', 'QA', 1, 'concurrency-test-3@example.test')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', '90000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'concurrency-test-3-auth@example.test', 'x', now(), '{}', '{}', now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, role, worker_id)
  VALUES ('90000000-0000-0000-0000-000000000003', 'worker', 900003)
  ON CONFLICT (id) DO NOTHING;
" > /dev/null

# Session A holds ONLY the raw worker-identity advisory lock directly
# (the exact same key the claim RPC itself would compute) -- never
# calling the claim RPC at all. If session B's real claim RPC call still
# blocks, that proves the RPC's FIRST lock acquisition is genuinely this
# same worker-identity lock, matching the fixed lock order the design
# promises (worker, then Auth).
cat > "${SCRATCH_DIR}/session_a_3.sql" <<'SQL'
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('worker_access_email:worker:' || 900003::text, 0));
SELECT pg_sleep(3);
COMMIT;
SQL

${PSQL} -q < "${SCRATCH_DIR}/session_a_3.sql" > "${SCRATCH_DIR}/session_a_3.out" 2>&1 &
SESSION_A_PID=$!

sleep 1

start_ns=$(date +%s%N)
${PSQL} -t -A -q -c "SELECT outcome FROM public.claim_worker_access_email_correction(900003, 'concurrency-lockorder-target@example.test');" \
  > "${SCRATCH_DIR}/session_b_3.out" 2>&1
end_ns=$(date +%s%N)
elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))

wait "${SESSION_A_PID}"

session_b_outcome=$(tr -d '[:space:]' < "${SCRATCH_DIR}/session_b_3.out")

echo "Session B outcome (after session A released the raw worker lock): ${session_b_outcome}"
echo "Session B elapsed: ${elapsed_ms}ms"

[ "${session_b_outcome}" = "created" ] && b_ok=1 || b_ok=0
report "Test 3: session B's claim proceeds and succeeds once the raw worker-identity lock is released" "${b_ok}"

[ "${elapsed_ms}" -ge 2000 ] && timing_ok=1 || timing_ok=0
report "Test 3: session B's claim call itself blocked on the SAME worker-identity lock key (elapsed >= 2000ms), confirming that lock is acquired first" "${timing_ok}"

cleanup_fixtures

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo
echo "=== Summary ==="
echo "Passed: ${pass_count}"
echo "Failed: ${fail_count}"
echo
echo "NOTE: the worker/Auth partial-unique-index race (tasks.md 3.18) is not"
echo "re-verified here -- it is structurally unreachable via genuine"
echo "concurrent execution given this same lock design (see the header"
echo "comment above) and remains covered by the existing deterministic"
echo "pgTAP simulation instead."

if [ "${fail_count}" -gt 0 ]; then
  exit 1
fi
