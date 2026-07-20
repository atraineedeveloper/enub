BEGIN;

SET search_path = public, extensions;

-- Execution-level coverage for the migration guard in
-- 20260721000000_worker_relation_ownership_select_policies.sql. Mirrors
-- schedule_ownership_rls_migration_drift.test.sql exactly: every
-- assertion below calls the REAL
-- public._replace_worker_relation_ownership_select_policy() helper
-- directly -- the exact same function the migration itself calls, not a
-- reimplemented approximation of its guard queries. If the migration's
-- guard logic ever changes, this file automatically exercises the new
-- version; there is no second copy of the logic to keep in sync.
--
-- Part 1 (ACL): the helper carries no production client API surface --
-- anon, authenticated, and service_role each get a real permission-denied
-- error attempting to call it (not merely "no grant row exists"); only
-- the owner-equivalent role this test file itself connects as can.
--
-- Part 2 (drift + allow-list): for BOTH sustenance_plazas and
-- date_of_admissions, independently: each of the seven drift scenarios
-- reconstructs the exact expected pre-migration policy state, applies
-- exactly one mutation, calls the real function, and asserts three
-- specific things -- the call raises (SQLSTATE P0001), the SELECT policy
-- count is unchanged from the mutated setup, and neither replacement
-- policy was partially created. One success-path test per table proves
-- the same function, called against the real undrifted state, reaches
-- the exact intended final catalog. The policy-name allow-list rejection
-- cases (Item 3) run against that real, correctly-migrated catalog.
--
-- Transactional isolation of this suite (no SAVEPOINTs needed or used):
-- the entire file -- Part 1, both tables of Part 2, and Part 3 -- runs
-- inside the single outer BEGIN/ROLLBACK that opens/closes this file.
-- Every drift scenario below explicitly reconstructs the exact catalog
-- state it needs (DROP-then-CREATE the specific policy/policies under
-- test) rather than assuming leftover state from a previous scenario, so
-- scenarios execute correctly regardless of ordering and never depend on
-- one another. Cleanup statements immediately following an assertion
-- (e.g. `DROP POLICY "QA drift permissive" ...`) exist only to keep each
-- scenario's *own* setup self-contained for the reader, not because a
-- later scenario would otherwise see partial/inconsistent state: the
-- guard function itself is proven, by the surrounding is()/ok() checks,
-- to never leave partial DDL behind on a rejected call. No scenario here
-- persists past this file: the final ROLLBACK discards every mutation
-- made by every scenario in one step, so the real, already-migrated
-- policy catalog this file started from is exactly what remains once this
-- file finishes -- no per-scenario savepoint-and-rollback is needed to
-- achieve that.

SELECT plan(70);

-- ============================================================
-- Part 1: the helper is not executable by any application-facing role
-- ============================================================

SET LOCAL role anon;
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'x', 'y')$$,
    '42501',
    NULL,
    'anon cannot execute the helper (permission denied, not merely a logic rejection)'
);
RESET role;

SET LOCAL role authenticated;
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'x', 'y')$$,
    '42501',
    NULL,
    'authenticated cannot execute the helper'
);
RESET role;

SET LOCAL role service_role;
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'x', 'y')$$,
    '42501',
    NULL,
    'service_role cannot execute the helper -- the gap a prior pass of this migration left open'
);
RESET role;

-- ============================================================
-- Part 2a: sustenance_plazas
-- ============================================================

-- --- Drift 1/7: the expected policy is renamed ---
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd = 'SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON "public"."sustenance_plazas"', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Enable read access for all users" ON "public"."sustenance_plazas" FOR SELECT USING (true);
ALTER POLICY "Enable read access for all users" ON "public"."sustenance_plazas" RENAME TO "Enable read access for all users (renamed)";

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')$$,
    'P0001',
    NULL,
    'sustenance_plazas drift 1/7 (policy renamed): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd = 'SELECT'),
    1,
    'sustenance_plazas drift 1/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND policyname IN ('Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')),
    'sustenance_plazas drift 1/7: neither replacement policy was partially created'
);

-- --- Drift 2/7: command differs from SELECT ---
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd IN ('SELECT', 'UPDATE') AND policyname NOT IN ('Staff and admin can update sustenance plazas') LOOP
    EXECUTE format('DROP POLICY %I ON "public"."sustenance_plazas"', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Enable read access for all users" ON "public"."sustenance_plazas" FOR UPDATE USING (true) WITH CHECK (true);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')$$,
    'P0001',
    NULL,
    'sustenance_plazas drift 2/7 (cmd is UPDATE, not SELECT): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND policyname = 'Enable read access for all users'),
    1,
    'sustenance_plazas drift 2/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND policyname IN ('Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')),
    'sustenance_plazas drift 2/7: neither replacement policy was partially created'
);
DROP POLICY "Enable read access for all users" ON "public"."sustenance_plazas";

-- --- Drift 3/7: permissive mode differs (RESTRICTIVE instead of PERMISSIVE) ---
CREATE POLICY "Enable read access for all users" ON "public"."sustenance_plazas" AS RESTRICTIVE FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')$$,
    'P0001',
    NULL,
    'sustenance_plazas drift 3/7 (RESTRICTIVE instead of PERMISSIVE): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd = 'SELECT'),
    1,
    'sustenance_plazas drift 3/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND policyname IN ('Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')),
    'sustenance_plazas drift 3/7: neither replacement policy was partially created'
);

-- --- Drift 4/7: roles differ from the expected current catalog representation ---
DROP POLICY "Enable read access for all users" ON "public"."sustenance_plazas";
CREATE POLICY "Enable read access for all users" ON "public"."sustenance_plazas" FOR SELECT TO anon USING (true);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')$$,
    'P0001',
    NULL,
    'sustenance_plazas drift 4/7 (roles = {anon} instead of {public}): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd = 'SELECT'),
    1,
    'sustenance_plazas drift 4/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND policyname IN ('Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')),
    'sustenance_plazas drift 4/7: neither replacement policy was partially created'
);

-- --- Drift 5/7: predicate differs from unrestricted true ---
DROP POLICY "Enable read access for all users" ON "public"."sustenance_plazas";
CREATE POLICY "Enable read access for all users" ON "public"."sustenance_plazas" FOR SELECT USING (worker_id IS NOT NULL);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')$$,
    'P0001',
    NULL,
    'sustenance_plazas drift 5/7 (predicate no longer unconditionally-true): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd = 'SELECT'),
    1,
    'sustenance_plazas drift 5/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND policyname IN ('Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')),
    'sustenance_plazas drift 5/7: neither replacement policy was partially created'
);

-- --- Drift 6/7: an additional PERMISSIVE SELECT policy exists ---
DROP POLICY "Enable read access for all users" ON "public"."sustenance_plazas";
CREATE POLICY "Enable read access for all users" ON "public"."sustenance_plazas" FOR SELECT USING (true);
CREATE POLICY "QA drift permissive" ON "public"."sustenance_plazas" FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')$$,
    'P0001',
    NULL,
    'sustenance_plazas drift 6/7 (extra PERMISSIVE SELECT policy): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd = 'SELECT'),
    2,
    'sustenance_plazas drift 6/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND policyname IN ('Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')),
    'sustenance_plazas drift 6/7: neither replacement policy was partially created'
);
DROP POLICY "QA drift permissive" ON "public"."sustenance_plazas";

-- --- Drift 7/7: an additional RESTRICTIVE SELECT policy exists ---
CREATE POLICY "QA drift restrictive" ON "public"."sustenance_plazas" AS RESTRICTIVE FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')$$,
    'P0001',
    NULL,
    'sustenance_plazas drift 7/7 (extra RESTRICTIVE SELECT policy): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd = 'SELECT'),
    2,
    'sustenance_plazas drift 7/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND policyname IN ('Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')),
    'sustenance_plazas drift 7/7: neither replacement policy was partially created'
);
DROP POLICY "QA drift restrictive" ON "public"."sustenance_plazas";

-- --- Success path ---
SELECT lives_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')$$,
    'sustenance_plazas success path: the real function call succeeds against the exact expected clean pre-migration state'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd = 'SELECT'),
    2,
    'sustenance_plazas success path: exactly 2 SELECT policies exist after the real replacement'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND policyname = 'Enable read access for all users'),
    'sustenance_plazas success path: the old unrestricted policy is gone'
);
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'sustenance_plazas'
            AND policyname = 'Staff and admin can read all sustenance plazas'
            AND cmd = 'SELECT' AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
            AND qual = '(current_app_role() = ANY (ARRAY[''staff''::text, ''admin''::text]))'
    ),
    'sustenance_plazas success path: admin/staff policy has the exact expected shape'
);
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'sustenance_plazas'
            AND policyname = 'Workers can read own sustenance plazas'
            AND cmd = 'SELECT' AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
            AND qual = '(worker_id = current_worker_id())'
    ),
    'sustenance_plazas success path: worker policy has the exact expected shape'
);

-- ============================================================
-- Part 2b: date_of_admissions (identical shape)
-- ============================================================

-- --- Drift 1/7 ---
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND cmd = 'SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON "public"."date_of_admissions"', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Enable read access for all users" ON "public"."date_of_admissions" FOR SELECT USING (true);
ALTER POLICY "Enable read access for all users" ON "public"."date_of_admissions" RENAME TO "Enable read access for all users (renamed)";

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'Staff and admin can read all date of admissions', 'Workers can read own date of admissions')$$,
    'P0001',
    NULL,
    'date_of_admissions drift 1/7 (policy renamed): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND cmd = 'SELECT'),
    1,
    'date_of_admissions drift 1/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND policyname IN ('Staff and admin can read all date of admissions', 'Workers can read own date of admissions')),
    'date_of_admissions drift 1/7: neither replacement policy was partially created'
);

-- --- Drift 2/7 ---
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND cmd IN ('SELECT', 'UPDATE') AND policyname NOT IN ('Staff and admin can update admission dates') LOOP
    EXECUTE format('DROP POLICY %I ON "public"."date_of_admissions"', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Enable read access for all users" ON "public"."date_of_admissions" FOR UPDATE USING (true) WITH CHECK (true);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'Staff and admin can read all date of admissions', 'Workers can read own date of admissions')$$,
    'P0001',
    NULL,
    'date_of_admissions drift 2/7 (cmd is UPDATE, not SELECT): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND policyname = 'Enable read access for all users'),
    1,
    'date_of_admissions drift 2/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND policyname IN ('Staff and admin can read all date of admissions', 'Workers can read own date of admissions')),
    'date_of_admissions drift 2/7: neither replacement policy was partially created'
);
DROP POLICY "Enable read access for all users" ON "public"."date_of_admissions";

-- --- Drift 3/7 ---
CREATE POLICY "Enable read access for all users" ON "public"."date_of_admissions" AS RESTRICTIVE FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'Staff and admin can read all date of admissions', 'Workers can read own date of admissions')$$,
    'P0001',
    NULL,
    'date_of_admissions drift 3/7 (RESTRICTIVE instead of PERMISSIVE): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND cmd = 'SELECT'),
    1,
    'date_of_admissions drift 3/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND policyname IN ('Staff and admin can read all date of admissions', 'Workers can read own date of admissions')),
    'date_of_admissions drift 3/7: neither replacement policy was partially created'
);

-- --- Drift 4/7 ---
DROP POLICY "Enable read access for all users" ON "public"."date_of_admissions";
CREATE POLICY "Enable read access for all users" ON "public"."date_of_admissions" FOR SELECT TO anon USING (true);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'Staff and admin can read all date of admissions', 'Workers can read own date of admissions')$$,
    'P0001',
    NULL,
    'date_of_admissions drift 4/7 (roles = {anon} instead of {public}): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND cmd = 'SELECT'),
    1,
    'date_of_admissions drift 4/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND policyname IN ('Staff and admin can read all date of admissions', 'Workers can read own date of admissions')),
    'date_of_admissions drift 4/7: neither replacement policy was partially created'
);

-- --- Drift 5/7 ---
DROP POLICY "Enable read access for all users" ON "public"."date_of_admissions";
CREATE POLICY "Enable read access for all users" ON "public"."date_of_admissions" FOR SELECT USING (worker_id IS NOT NULL);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'Staff and admin can read all date of admissions', 'Workers can read own date of admissions')$$,
    'P0001',
    NULL,
    'date_of_admissions drift 5/7 (predicate no longer unconditionally-true): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND cmd = 'SELECT'),
    1,
    'date_of_admissions drift 5/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND policyname IN ('Staff and admin can read all date of admissions', 'Workers can read own date of admissions')),
    'date_of_admissions drift 5/7: neither replacement policy was partially created'
);

-- --- Drift 6/7 ---
DROP POLICY "Enable read access for all users" ON "public"."date_of_admissions";
CREATE POLICY "Enable read access for all users" ON "public"."date_of_admissions" FOR SELECT USING (true);
CREATE POLICY "QA drift permissive" ON "public"."date_of_admissions" FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'Staff and admin can read all date of admissions', 'Workers can read own date of admissions')$$,
    'P0001',
    NULL,
    'date_of_admissions drift 6/7 (extra PERMISSIVE SELECT policy): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND cmd = 'SELECT'),
    2,
    'date_of_admissions drift 6/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND policyname IN ('Staff and admin can read all date of admissions', 'Workers can read own date of admissions')),
    'date_of_admissions drift 6/7: neither replacement policy was partially created'
);
DROP POLICY "QA drift permissive" ON "public"."date_of_admissions";

-- --- Drift 7/7 ---
CREATE POLICY "QA drift restrictive" ON "public"."date_of_admissions" AS RESTRICTIVE FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'Staff and admin can read all date of admissions', 'Workers can read own date of admissions')$$,
    'P0001',
    NULL,
    'date_of_admissions drift 7/7 (extra RESTRICTIVE SELECT policy): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND cmd = 'SELECT'),
    2,
    'date_of_admissions drift 7/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND policyname IN ('Staff and admin can read all date of admissions', 'Workers can read own date of admissions')),
    'date_of_admissions drift 7/7: neither replacement policy was partially created'
);
DROP POLICY "QA drift restrictive" ON "public"."date_of_admissions";

-- --- Success path ---
SELECT lives_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'Staff and admin can read all date of admissions', 'Workers can read own date of admissions')$$,
    'date_of_admissions success path: the real function call succeeds against the exact expected clean pre-migration state'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND cmd = 'SELECT'),
    2,
    'date_of_admissions success path: exactly 2 SELECT policies exist after the real replacement'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND policyname = 'Enable read access for all users'),
    'date_of_admissions success path: the old unrestricted policy is gone'
);
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'date_of_admissions'
            AND policyname = 'Staff and admin can read all date of admissions'
            AND cmd = 'SELECT' AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
            AND qual = '(current_app_role() = ANY (ARRAY[''staff''::text, ''admin''::text]))'
    ),
    'date_of_admissions success path: admin/staff policy has the exact expected shape'
);
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'date_of_admissions'
            AND policyname = 'Workers can read own date of admissions'
            AND cmd = 'SELECT' AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
            AND qual = '(worker_id = current_worker_id())'
    ),
    'date_of_admissions success path: worker policy has the exact expected shape'
);

-- ============================================================
-- Part 3: policy-name allow-list rejection (Item 3). Runs against the
-- real, correctly-migrated catalog both tables' own success-path tests
-- above just produced.
-- ============================================================

-- --- sustenance_plazas: arbitrary admin policy name ---
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'QA Arbitrary Admin Name', 'Workers can read own sustenance plazas')$$,
    'P0001',
    NULL,
    'sustenance_plazas: an arbitrary admin/staff policy name is rejected'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd = 'SELECT'),
    2,
    'sustenance_plazas: real catalog still exactly the 2 correct policies after the rejected call'
);

-- --- sustenance_plazas: arbitrary worker policy name ---
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'Staff and admin can read all sustenance plazas', 'QA Arbitrary Worker Name')$$,
    'P0001',
    NULL,
    'sustenance_plazas: an arbitrary worker policy name is rejected'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd = 'SELECT'),
    2,
    'sustenance_plazas: real catalog still exactly the 2 correct policies after the rejected call'
);

-- --- sustenance_plazas: admin/worker names swapped ---
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'Workers can read own sustenance plazas', 'Staff and admin can read all sustenance plazas')$$,
    'P0001',
    NULL,
    'sustenance_plazas: the admin/staff and worker policy names swapped is rejected'
);

-- --- sustenance_plazas: names valid for the OTHER table ---
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('sustenance_plazas', 'Staff and admin can read all date of admissions', 'Workers can read own date of admissions')$$,
    'P0001',
    NULL,
    'sustenance_plazas: date_of_admissions'' own approved names are rejected for this table'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND policyname LIKE '%admission%'),
    'sustenance_plazas: no date_of_admissions-named policy was created on sustenance_plazas'
);

-- --- sustenance_plazas: an out-of-allow-list table name is rejected outright ---
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('workers', 'Staff and admin can read all workers', 'Workers can read own worker row')$$,
    'P0001',
    NULL,
    'a target_table outside the two-table allow-list (e.g. workers) is rejected before any precondition query runs'
);

-- --- date_of_admissions: arbitrary admin policy name ---
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'QA Arbitrary Admin Name', 'Workers can read own date of admissions')$$,
    'P0001',
    NULL,
    'date_of_admissions: an arbitrary admin/staff policy name is rejected'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND cmd = 'SELECT'),
    2,
    'date_of_admissions: real catalog still exactly the 2 correct policies after the rejected call'
);

-- --- date_of_admissions: arbitrary worker policy name ---
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'Staff and admin can read all date of admissions', 'QA Arbitrary Worker Name')$$,
    'P0001',
    NULL,
    'date_of_admissions: an arbitrary worker policy name is rejected'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND cmd = 'SELECT'),
    2,
    'date_of_admissions: real catalog still exactly the 2 correct policies after the rejected call'
);

-- --- date_of_admissions: admin/worker names swapped ---
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'Workers can read own date of admissions', 'Staff and admin can read all date of admissions')$$,
    'P0001',
    NULL,
    'date_of_admissions: the admin/staff and worker policy names swapped is rejected'
);

-- --- date_of_admissions: names valid for the OTHER table ---
SELECT throws_ok(
    $$SELECT public._replace_worker_relation_ownership_select_policy('date_of_admissions', 'Staff and admin can read all sustenance plazas', 'Workers can read own sustenance plazas')$$,
    'P0001',
    NULL,
    'date_of_admissions: sustenance_plazas'' own approved names are rejected for this table'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'date_of_admissions' AND policyname LIKE '%plaza%'),
    'date_of_admissions: no sustenance_plazas-named policy was created on date_of_admissions'
);

SELECT * FROM finish();

-- Restores the real, already-migrated policy catalog (and both tables'
-- original SELECT policies) exactly as it was before this file ran --
-- nothing above is persisted.
ROLLBACK;
