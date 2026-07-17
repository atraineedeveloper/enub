BEGIN;

SET search_path = public, extensions;

-- Execution-level coverage for the migration guard in
-- 20260716215631_schedule_ownership_rls_policies.sql. Unlike a
-- precondition-query-duplication test (the prior, superseded version of
-- this coverage), every assertion below calls the REAL
-- public._replace_schedule_ownership_select_policy() helper directly --
-- the exact same function the migration itself calls, not a
-- reimplemented approximation of its guard queries. If the migration's
-- guard logic ever changes, this file automatically exercises the new
-- version; there is no second copy of the logic to keep in sync.
--
-- For BOTH schedule_assignments and schedule_teachers, independently:
-- each of the seven drift scenarios reconstructs the exact expected
-- pre-migration policy state, applies exactly one mutation, calls the
-- real function, and asserts three specific things -- not a full
-- attribute-by-attribute snapshot of the policy catalog:
--   1. the call raises (SQLSTATE P0001, plpgsql's default for an
--      unqualified RAISE EXCEPTION);
--   2. the SELECT policy COUNT for the table after the failed call is
--      identical to the count immediately after the mutation was applied
--      (i.e. unchanged from the mutated setup -- not compared against the
--      original pre-mutation state, and not a comparison of every
--      column of every row);
--   3. neither of the two intended replacement policy names exists under
--      any shape (no partial creation).
-- (2) and (3) together are what "no destructive DDL ran" actually rests
-- on here: every precondition check inside the function completes, via
-- RAISE EXCEPTION on failure, strictly before the first DROP/CREATE
-- POLICY statement executes -- so a precondition failure aborts before
-- any DDL is even attempted, and PostgreSQL's ordinary statement/
-- transaction atomicity (a DDL statement never reached cannot have
-- partially applied) is what makes that guarantee real, not an assumption
-- this test suite makes on its own. One additional success-path test per
-- table proves the same function, called against the real undrifted
-- state, reaches the exact intended final catalog -- that test, unlike
-- the drift cases, does check each new policy's cmd/permissive/roles/qual
-- individually.
--
-- Everything here runs inside this file's own BEGIN/ROLLBACK -- the real,
-- already-migrated policy catalog this file starts from is fully restored
-- when the transaction rolls back at the end.

-- Also covers the policy-name allow-list (Item 3): admin_staff_policy_name/
-- worker_policy_name must be the exact approved pair for the given
-- target_table, not an arbitrary string, not the two names swapped, and
-- not a pair that's valid for the OTHER table. These eight cases (four
-- rejection scenarios x two tables) run near the end of this file,
-- against the real, already-correctly-migrated catalog each table's own
-- success-path test just produced -- no separate "reconstruct a mutated
-- state" setup is needed, since this check fires on the function's
-- arguments alone, before any precondition query even runs.

SELECT plan(74);

-- ============================================================
-- schedule_assignments
-- ============================================================

-- --- Drift 1/7: the expected policy is renamed ---
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON "public"."schedule_assignments"', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Enable read access for all users" ON "public"."schedule_assignments" FOR SELECT USING (true);
ALTER POLICY "Enable read access for all users" ON "public"."schedule_assignments" RENAME TO "Enable read access for all users (renamed)";

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')$$,
    'P0001',
    NULL,
    'schedule_assignments drift 1/7 (policy renamed): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT'),
    1,
    'schedule_assignments drift 1/7: catalog unchanged after the failed call (still exactly the one renamed policy)'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname IN ('Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')),
    'schedule_assignments drift 1/7: neither replacement policy was partially created'
);

-- --- Drift 2/7: command differs from SELECT ---
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd IN ('SELECT', 'UPDATE') AND policyname NOT IN ('Enable update access for all users') LOOP
    EXECUTE format('DROP POLICY %I ON "public"."schedule_assignments"', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Enable read access for all users" ON "public"."schedule_assignments" FOR UPDATE USING (true) WITH CHECK (true);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')$$,
    'P0001',
    NULL,
    'schedule_assignments drift 2/7 (cmd is UPDATE, not SELECT): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname = 'Enable read access for all users'),
    1,
    'schedule_assignments drift 2/7: catalog unchanged after the failed call (still exactly the one UPDATE-cmd policy under that name)'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname IN ('Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')),
    'schedule_assignments drift 2/7: neither replacement policy was partially created'
);
DROP POLICY "Enable read access for all users" ON "public"."schedule_assignments";

-- --- Drift 3/7: permissive mode differs (RESTRICTIVE instead of PERMISSIVE) ---
CREATE POLICY "Enable read access for all users" ON "public"."schedule_assignments" AS RESTRICTIVE FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')$$,
    'P0001',
    NULL,
    'schedule_assignments drift 3/7 (RESTRICTIVE instead of PERMISSIVE): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT'),
    1,
    'schedule_assignments drift 3/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname IN ('Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')),
    'schedule_assignments drift 3/7: neither replacement policy was partially created'
);

-- --- Drift 4/7: roles differ from the expected current catalog representation ---
DROP POLICY "Enable read access for all users" ON "public"."schedule_assignments";
CREATE POLICY "Enable read access for all users" ON "public"."schedule_assignments" FOR SELECT TO anon USING (true);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')$$,
    'P0001',
    NULL,
    'schedule_assignments drift 4/7 (roles = {anon} instead of {public}): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT'),
    1,
    'schedule_assignments drift 4/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname IN ('Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')),
    'schedule_assignments drift 4/7: neither replacement policy was partially created'
);

-- --- Drift 5/7: predicate differs from unrestricted true ---
DROP POLICY "Enable read access for all users" ON "public"."schedule_assignments";
CREATE POLICY "Enable read access for all users" ON "public"."schedule_assignments" FOR SELECT USING (worker_id IS NOT NULL);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')$$,
    'P0001',
    NULL,
    'schedule_assignments drift 5/7 (predicate no longer unconditionally-true): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT'),
    1,
    'schedule_assignments drift 5/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname IN ('Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')),
    'schedule_assignments drift 5/7: neither replacement policy was partially created'
);

-- --- Drift 6/7: an additional PERMISSIVE SELECT policy exists ---
DROP POLICY "Enable read access for all users" ON "public"."schedule_assignments";
CREATE POLICY "Enable read access for all users" ON "public"."schedule_assignments" FOR SELECT USING (true);
CREATE POLICY "QA drift permissive" ON "public"."schedule_assignments" FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')$$,
    'P0001',
    NULL,
    'schedule_assignments drift 6/7 (extra PERMISSIVE SELECT policy): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT'),
    2,
    'schedule_assignments drift 6/7: catalog unchanged after the failed call (still the base policy plus the extra one)'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname IN ('Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')),
    'schedule_assignments drift 6/7: neither replacement policy was partially created'
);
DROP POLICY "QA drift permissive" ON "public"."schedule_assignments";

-- --- Drift 7/7: an additional RESTRICTIVE SELECT policy exists -- the
-- exact gap a permissive-only precondition check would miss. ---
CREATE POLICY "QA drift restrictive" ON "public"."schedule_assignments" AS RESTRICTIVE FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')$$,
    'P0001',
    NULL,
    'schedule_assignments drift 7/7 (extra RESTRICTIVE SELECT policy): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT'),
    2,
    'schedule_assignments drift 7/7: catalog unchanged after the failed call (still the base policy plus the extra restrictive one)'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname IN ('Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')),
    'schedule_assignments drift 7/7: neither replacement policy was partially created'
);
DROP POLICY "QA drift restrictive" ON "public"."schedule_assignments";

-- --- Success path: the real function, called against the exact expected
-- clean pre-migration state, replaces the unsafe policy and reaches the
-- exact intended final catalog. ---
SELECT lives_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')$$,
    'schedule_assignments success path: the real function call succeeds against the exact expected clean pre-migration state'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT'),
    2,
    'schedule_assignments success path: exactly 2 SELECT policies exist after the real replacement'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname = 'Enable read access for all users'),
    'schedule_assignments success path: the old unrestricted policy is gone'
);
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'schedule_assignments'
            AND policyname = 'Staff and admin can read all schedule assignments'
            AND cmd = 'SELECT' AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
            AND qual = '(current_app_role() = ANY (ARRAY[''staff''::text, ''admin''::text]))'
    ),
    'schedule_assignments success path: admin/staff policy has the exact expected shape'
);
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'schedule_assignments'
            AND policyname = 'Workers can read own schedule assignments'
            AND cmd = 'SELECT' AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
            AND qual = '(worker_id = current_worker_id())'
    ),
    'schedule_assignments success path: worker policy has the exact expected shape'
);

-- ============================================================
-- schedule_teachers (identical shape)
-- ============================================================

-- --- Drift 1/7: the expected policy is renamed ---
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON "public"."schedule_teachers"', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Enable read access for all users" ON "public"."schedule_teachers" FOR SELECT USING (true);
ALTER POLICY "Enable read access for all users" ON "public"."schedule_teachers" RENAME TO "Enable read access for all users (renamed)";

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')$$,
    'P0001',
    NULL,
    'schedule_teachers drift 1/7 (policy renamed): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    1,
    'schedule_teachers drift 1/7: catalog unchanged after the failed call (still exactly the one renamed policy)'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname IN ('Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')),
    'schedule_teachers drift 1/7: neither replacement policy was partially created'
);

-- --- Drift 2/7: command differs from SELECT ---
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd IN ('SELECT', 'UPDATE') AND policyname NOT IN ('Enable update access for all users') LOOP
    EXECUTE format('DROP POLICY %I ON "public"."schedule_teachers"', pol.policyname);
  END LOOP;
END $$;
CREATE POLICY "Enable read access for all users" ON "public"."schedule_teachers" FOR UPDATE USING (true) WITH CHECK (true);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')$$,
    'P0001',
    NULL,
    'schedule_teachers drift 2/7 (cmd is UPDATE, not SELECT): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname = 'Enable read access for all users'),
    1,
    'schedule_teachers drift 2/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname IN ('Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')),
    'schedule_teachers drift 2/7: neither replacement policy was partially created'
);
DROP POLICY "Enable read access for all users" ON "public"."schedule_teachers";

-- --- Drift 3/7: permissive mode differs ---
CREATE POLICY "Enable read access for all users" ON "public"."schedule_teachers" AS RESTRICTIVE FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')$$,
    'P0001',
    NULL,
    'schedule_teachers drift 3/7 (RESTRICTIVE instead of PERMISSIVE): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    1,
    'schedule_teachers drift 3/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname IN ('Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')),
    'schedule_teachers drift 3/7: neither replacement policy was partially created'
);

-- --- Drift 4/7: roles differ ---
DROP POLICY "Enable read access for all users" ON "public"."schedule_teachers";
CREATE POLICY "Enable read access for all users" ON "public"."schedule_teachers" FOR SELECT TO anon USING (true);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')$$,
    'P0001',
    NULL,
    'schedule_teachers drift 4/7 (roles = {anon} instead of {public}): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    1,
    'schedule_teachers drift 4/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname IN ('Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')),
    'schedule_teachers drift 4/7: neither replacement policy was partially created'
);

-- --- Drift 5/7: predicate differs ---
DROP POLICY "Enable read access for all users" ON "public"."schedule_teachers";
CREATE POLICY "Enable read access for all users" ON "public"."schedule_teachers" FOR SELECT USING (worker_id IS NOT NULL);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')$$,
    'P0001',
    NULL,
    'schedule_teachers drift 5/7 (predicate no longer unconditionally-true): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    1,
    'schedule_teachers drift 5/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname IN ('Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')),
    'schedule_teachers drift 5/7: neither replacement policy was partially created'
);

-- --- Drift 6/7: an additional PERMISSIVE SELECT policy exists ---
DROP POLICY "Enable read access for all users" ON "public"."schedule_teachers";
CREATE POLICY "Enable read access for all users" ON "public"."schedule_teachers" FOR SELECT USING (true);
CREATE POLICY "QA drift permissive" ON "public"."schedule_teachers" FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')$$,
    'P0001',
    NULL,
    'schedule_teachers drift 6/7 (extra PERMISSIVE SELECT policy): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    2,
    'schedule_teachers drift 6/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname IN ('Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')),
    'schedule_teachers drift 6/7: neither replacement policy was partially created'
);
DROP POLICY "QA drift permissive" ON "public"."schedule_teachers";

-- --- Drift 7/7: an additional RESTRICTIVE SELECT policy exists ---
CREATE POLICY "QA drift restrictive" ON "public"."schedule_teachers" AS RESTRICTIVE FOR SELECT USING (true);

SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')$$,
    'P0001',
    NULL,
    'schedule_teachers drift 7/7 (extra RESTRICTIVE SELECT policy): the real function raises'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    2,
    'schedule_teachers drift 7/7: catalog unchanged after the failed call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname IN ('Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')),
    'schedule_teachers drift 7/7: neither replacement policy was partially created'
);
DROP POLICY "QA drift restrictive" ON "public"."schedule_teachers";

-- --- Success path ---
SELECT lives_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')$$,
    'schedule_teachers success path: the real function call succeeds against the exact expected clean pre-migration state'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    2,
    'schedule_teachers success path: exactly 2 SELECT policies exist after the real replacement'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname = 'Enable read access for all users'),
    'schedule_teachers success path: the old unrestricted policy is gone'
);
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'schedule_teachers'
            AND policyname = 'Staff and admin can read all schedule teacher activities'
            AND cmd = 'SELECT' AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
            AND qual = '(current_app_role() = ANY (ARRAY[''staff''::text, ''admin''::text]))'
    ),
    'schedule_teachers success path: admin/staff policy has the exact expected shape'
);
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'schedule_teachers'
            AND policyname = 'Workers can read own schedule teacher activities'
            AND cmd = 'SELECT' AND permissive = 'PERMISSIVE' AND roles = ARRAY['authenticated']::name[]
            AND qual = '(worker_id = current_worker_id())'
    ),
    'schedule_teachers success path: worker policy has the exact expected shape'
);

-- ============================================================
-- Policy-name allow-list rejection (Item 3): admin_staff_policy_name/
-- worker_policy_name must be the exact approved pair for target_table.
-- Runs against the real, correctly-migrated catalog both tables' own
-- success-path tests above just produced -- these calls must fail before
-- ever touching that catalog, so no setup/teardown is needed; each case
-- also confirms the real catalog is still exactly the correct 2-policy
-- shape afterward, and that no policy was created under the rejected name.
-- ============================================================

-- --- schedule_assignments: arbitrary admin policy name ---
SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'QA Arbitrary Admin Name', 'Workers can read own schedule assignments')$$,
    'P0001',
    NULL,
    'schedule_assignments: an arbitrary admin/staff policy name is rejected'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT'),
    2,
    'schedule_assignments: real catalog still exactly the 2 correct policies after the rejected call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname = 'QA Arbitrary Admin Name'),
    'schedule_assignments: no policy was created under the arbitrary admin name'
);

-- --- schedule_assignments: arbitrary worker policy name ---
SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'Staff and admin can read all schedule assignments', 'QA Arbitrary Worker Name')$$,
    'P0001',
    NULL,
    'schedule_assignments: an arbitrary worker policy name is rejected'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT'),
    2,
    'schedule_assignments: real catalog still exactly the 2 correct policies after the rejected call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname = 'QA Arbitrary Worker Name'),
    'schedule_assignments: no policy was created under the arbitrary worker name'
);

-- --- schedule_assignments: admin/worker names swapped ---
SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'Workers can read own schedule assignments', 'Staff and admin can read all schedule assignments')$$,
    'P0001',
    NULL,
    'schedule_assignments: the admin/staff and worker policy names swapped is rejected'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT'),
    2,
    'schedule_assignments: real catalog still exactly the 2 correct policies after the rejected (swapped-names) call'
);

-- --- schedule_assignments: names valid for the OTHER table ---
SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_assignments', 'Staff and admin can read all schedule teacher activities', 'Workers can read own schedule teacher activities')$$,
    'P0001',
    NULL,
    'schedule_assignments: schedule_teachers'' own approved names are rejected for this table'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND cmd = 'SELECT'),
    2,
    'schedule_assignments: real catalog still exactly the 2 correct policies after the rejected (other-table-names) call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_assignments' AND policyname LIKE '%teacher%'),
    'schedule_assignments: no schedule_teachers-named policy was created on schedule_assignments'
);

-- --- schedule_teachers: arbitrary admin policy name ---
SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'QA Arbitrary Admin Name', 'Workers can read own schedule teacher activities')$$,
    'P0001',
    NULL,
    'schedule_teachers: an arbitrary admin/staff policy name is rejected'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    2,
    'schedule_teachers: real catalog still exactly the 2 correct policies after the rejected call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname = 'QA Arbitrary Admin Name'),
    'schedule_teachers: no policy was created under the arbitrary admin name'
);

-- --- schedule_teachers: arbitrary worker policy name ---
SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'Staff and admin can read all schedule teacher activities', 'QA Arbitrary Worker Name')$$,
    'P0001',
    NULL,
    'schedule_teachers: an arbitrary worker policy name is rejected'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    2,
    'schedule_teachers: real catalog still exactly the 2 correct policies after the rejected call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname = 'QA Arbitrary Worker Name'),
    'schedule_teachers: no policy was created under the arbitrary worker name'
);

-- --- schedule_teachers: admin/worker names swapped ---
SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'Workers can read own schedule teacher activities', 'Staff and admin can read all schedule teacher activities')$$,
    'P0001',
    NULL,
    'schedule_teachers: the admin/staff and worker policy names swapped is rejected'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    2,
    'schedule_teachers: real catalog still exactly the 2 correct policies after the rejected (swapped-names) call'
);

-- --- schedule_teachers: names valid for the OTHER table ---
SELECT throws_ok(
    $$SELECT public._replace_schedule_ownership_select_policy('schedule_teachers', 'Staff and admin can read all schedule assignments', 'Workers can read own schedule assignments')$$,
    'P0001',
    NULL,
    'schedule_teachers: schedule_assignments'' own approved names are rejected for this table'
);
SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND cmd = 'SELECT'),
    2,
    'schedule_teachers: real catalog still exactly the 2 correct policies after the rejected (other-table-names) call'
);
SELECT ok(
    NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'schedule_teachers' AND policyname LIKE '%schedule assignments%'),
    'schedule_teachers: no schedule_assignments-named policy was created on schedule_teachers'
);

SELECT * FROM finish();

-- Restores the real, already-migrated policy catalog (and the two tables'
-- original SELECT policies) exactly as it was before this file ran --
-- nothing above is persisted.
ROLLBACK;
