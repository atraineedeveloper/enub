-- Tightens public.schedule_assignments and public.schedule_teachers SELECT
-- access from the base-schema "Enable read access for all users" (USING
-- (true), no TO clause -- readable by anon and every authenticated role
-- alike) to the same staff/admin-unrestricted + worker-own-row pattern
-- already established for public.workers (20260703002454) and
-- public.worker_documents (20260703002456), using the existing
-- current_app_role()/current_worker_id() SECURITY DEFINER functions.
--
-- This is deliberately NOT a plain additive change: it removes a
-- currently-effective open-read grant, so every step is verified rather
-- than assumed. The guard+replace logic (preconditions, DROP, CREATE x2,
-- postconditions) lives in ONE private helper function,
-- public._replace_schedule_ownership_select_policy(), called once per
-- table below -- not duplicated inline per table, and not duplicated in
-- the test suite either. supabase/tests/database/
-- schedule_ownership_rls_migration_drift.test.sql calls this EXACT same
-- function directly to prove it fails closed (raises, and leaves the
-- policy catalog unchanged) under each of seven independent drift
-- scenarios, and reaches the exact intended final catalog on the real
-- path -- execution-level coverage of the real guard logic, not a
-- re-implemented approximation of it (see design.md §17).
--
-- The function is intentionally RETAINED after this migration runs (not
-- dropped): the execution-level drift tests need a stable, callable
-- target. It carries no production client API surface -- REVOKEd from
-- PUBLIC (and therefore from anon/authenticated) immediately after
-- creation, SECURITY DEFINER with a fixed, injection-safe search_path, and
-- only ever invoked by this migration (as the migration-runner role) and
-- by local pgTAP (which also runs as a privileged role) -- never by any
-- application code path.
--
-- The expected postcondition predicate strings below were captured
-- empirically: the exact CREATE POLICY statements this function issues
-- were run once against a local scratch database inside a rolled-back
-- transaction, and the resulting pg_policies.qual values were read back
-- verbatim. They are not independently hand-authored SQL, which is what
-- makes a simple case/whitespace-normalized comparison sufficient --
-- Postgres commonly rewrites policy predicates when storing them (e.g. an
-- `IN (...)` list becomes `= ANY (ARRAY[...])`), and comparing against
-- Postgres's own reconstruction of the same statement sidesteps that
-- entirely rather than trying to solve general SQL-equivalence matching.
--
-- INSERT/UPDATE/DELETE policies on both tables are intentionally left
-- untouched by this function; hardening them is a separate, definite
-- follow-up (see the add-worker-schedule-and-profile change's design.md,
-- Fixed Follow-ups #3).

-- ============================================================
-- Shared private helper: the exact guard + drop/create/verify sequence,
-- parameterized by table and the two new policy names so the identical
-- logic runs for schedule_assignments and schedule_teachers, called once
-- each below, and called again (directly, unmodified) by the
-- execution-level pgTAP drift tests.
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."_replace_schedule_ownership_select_policy"(
  "target_table" text,
  "admin_staff_policy_name" text,
  "worker_policy_name" text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  precondition_count int;
  expected_unrestricted_qual text := 'true';
  policy_row record;
  total_select_count int;
  expected_admin_qual text := '(current_app_role() = any (array[''staff''::text, ''admin''::text]))';
  expected_worker_qual text := '(worker_id = current_worker_id())';
BEGIN
  -- Scope guard: this helper only ever operates on the two tables it was
  -- written for -- never an arbitrary caller-supplied table name, even
  -- though it is not reachable by anon/authenticated at all (defense in
  -- depth before any dynamic SQL below touches real DDL).
  IF target_table NOT IN ('schedule_assignments', 'schedule_teachers') THEN
    RAISE EXCEPTION 'public._replace_schedule_ownership_select_policy: unsupported target_table %, this helper is scoped to schedule_assignments/schedule_teachers only', target_table;
  END IF;

  -- Policy-name allow-list: target_table alone is not enough to constrain
  -- what this helper does -- admin_staff_policy_name/worker_policy_name
  -- must also be exactly the approved pair for that specific table, not
  -- an arbitrary string, not the two names swapped between the
  -- admin/staff and worker roles, and not a pair that happens to be valid
  -- for the OTHER table. Every combination is enumerated explicitly
  -- (never built from target_table by string concatenation, so there is
  -- no pattern for a crafted table/name pair to exploit) and checked
  -- before any precondition query or DDL runs.
  IF NOT (
    (target_table = 'schedule_assignments'
      AND admin_staff_policy_name = 'Staff and admin can read all schedule assignments'
      AND worker_policy_name = 'Workers can read own schedule assignments')
    OR
    (target_table = 'schedule_teachers'
      AND admin_staff_policy_name = 'Staff and admin can read all schedule teacher activities'
      AND worker_policy_name = 'Workers can read own schedule teacher activities')
  ) THEN
    RAISE EXCEPTION 'public._replace_schedule_ownership_select_policy: (%, %) is not the approved admin/staff + worker policy-name pair for target_table %. Aborting -- refusing to create a policy under an unapproved name.', admin_staff_policy_name, worker_policy_name, target_table;
  END IF;

  -- Precondition 1: the exact policy we're about to drop exists, once, and
  -- matches the checked-in base-schema catalog representation
  -- (20260702000000_remote_schema.sql: `FOR SELECT USING (true)`, no TO
  -- clause) on EVERY dimension -- name, cmd, permissive mode, roles, and
  -- normalized predicate -- not just name+cmd+qual. A policy that matches
  -- on name/cmd but has drifted on permissive mode or roles (e.g. someone
  -- narrowed it to `TO anon` only, or flipped it to RESTRICTIVE, without
  -- renaming it) must fail closed here, not be silently treated as "the
  -- expected policy" and dropped anyway. Never assume; verify first.
  SELECT count(*) INTO precondition_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = target_table
    AND policyname = 'Enable read access for all users'
    AND cmd = 'SELECT'
    AND permissive = 'PERMISSIVE'
    AND roles = ARRAY['public']::name[]
    AND regexp_replace(lower(coalesce(qual, '')), '\s+', ' ', 'g') = expected_unrestricted_qual;

  IF precondition_count <> 1 THEN
    RAISE EXCEPTION '%: expected exactly one "Enable read access for all users" SELECT policy (PERMISSIVE, roles={public}, qual normalizing to "true"), found %. Aborting -- refusing to assume the policy being replaced is the one that was verified.', target_table, precondition_count;
  END IF;

  -- Precondition 1b: that same policy, looked up by name+cmd alone (no
  -- shape filter), must resolve to exactly the row just verified above --
  -- i.e. there is no other policy also named "Enable read access for all
  -- users" on this table/cmd that could be ambiguous with it.
  SELECT count(*) INTO precondition_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = target_table
    AND policyname = 'Enable read access for all users'
    AND cmd = 'SELECT';

  IF precondition_count <> 1 THEN
    RAISE EXCEPTION '%: expected exactly one SELECT policy named "Enable read access for all users" (any shape), found %. Aborting.', target_table, precondition_count;
  END IF;

  -- Precondition 2: no other SELECT policy exists at all -- permissive OR
  -- restrictive -- that could silently preserve or otherwise interfere
  -- with unrestricted access once the verified policy above is dropped
  -- (permissive policies are OR'd together in Postgres RLS; a stray
  -- restrictive policy would also mean this table's SELECT access isn't
  -- what this migration assumes it is).
  SELECT count(*) INTO precondition_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = target_table
    AND cmd = 'SELECT'
    AND policyname <> 'Enable read access for all users';

  IF precondition_count <> 0 THEN
    RAISE EXCEPTION '%: found % unexpected additional SELECT policy(ies) (permissive or restrictive) beyond the one being replaced. Aborting -- refusing to leave unverified access in place under another name.', target_table, precondition_count;
  END IF;

  -- Every precondition above passed: only now does any DDL run. `target_table`
  -- is already constrained to the fixed allow-list checked at the top of
  -- this function, so this dynamic SQL never interpolates an arbitrary
  -- caller-supplied table name into DDL.
  EXECUTE format('DROP POLICY %I ON "public".%I', 'Enable read access for all users', target_table);

  EXECUTE format(
    'CREATE POLICY %I ON "public".%I FOR SELECT TO "authenticated" USING ("public"."current_app_role"() IN (''staff'', ''admin''))',
    admin_staff_policy_name,
    target_table
  );

  EXECUTE format(
    'CREATE POLICY %I ON "public".%I FOR SELECT TO "authenticated" USING ("worker_id" = "public"."current_worker_id"())',
    worker_policy_name,
    target_table
  );

  -- Postcondition: verify the admin/staff policy individually, on every
  -- dimension, in one combined check.
  SELECT * INTO policy_row
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = target_table
    AND policyname = admin_staff_policy_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION '%: postcondition failed -- "%" policy is missing after creation', target_table, admin_staff_policy_name;
  END IF;

  IF policy_row.cmd <> 'SELECT' THEN
    RAISE EXCEPTION '%: postcondition failed -- admin/staff policy cmd is %, expected SELECT', target_table, policy_row.cmd;
  END IF;
  IF policy_row.permissive <> 'PERMISSIVE' THEN
    RAISE EXCEPTION '%: postcondition failed -- admin/staff policy permissive is %, expected PERMISSIVE', target_table, policy_row.permissive;
  END IF;
  IF policy_row.roles <> ARRAY['authenticated']::name[] THEN
    RAISE EXCEPTION '%: postcondition failed -- admin/staff policy roles are %, expected {authenticated}', target_table, policy_row.roles;
  END IF;
  IF regexp_replace(lower(policy_row.qual), '\s+', ' ', 'g') <> expected_admin_qual THEN
    RAISE EXCEPTION '%: postcondition failed -- admin/staff policy qual normalized to %, expected %', target_table, regexp_replace(lower(policy_row.qual), '\s+', ' ', 'g'), expected_admin_qual;
  END IF;

  -- Postcondition: verify the worker-own-row policy individually, on every
  -- dimension, in one combined check.
  SELECT * INTO policy_row
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = target_table
    AND policyname = worker_policy_name;

  IF NOT FOUND THEN
    RAISE EXCEPTION '%: postcondition failed -- "%" policy is missing after creation', target_table, worker_policy_name;
  END IF;

  IF policy_row.cmd <> 'SELECT' THEN
    RAISE EXCEPTION '%: postcondition failed -- worker policy cmd is %, expected SELECT', target_table, policy_row.cmd;
  END IF;
  IF policy_row.permissive <> 'PERMISSIVE' THEN
    RAISE EXCEPTION '%: postcondition failed -- worker policy permissive is %, expected PERMISSIVE', target_table, policy_row.permissive;
  END IF;
  IF policy_row.roles <> ARRAY['authenticated']::name[] THEN
    RAISE EXCEPTION '%: postcondition failed -- worker policy roles are %, expected {authenticated}', target_table, policy_row.roles;
  END IF;
  IF regexp_replace(lower(policy_row.qual), '\s+', ' ', 'g') <> expected_worker_qual THEN
    RAISE EXCEPTION '%: postcondition failed -- worker policy qual normalized to %, expected %', target_table, regexp_replace(lower(policy_row.qual), '\s+', ' ', 'g'), expected_worker_qual;
  END IF;

  -- Postcondition: no anonymous/public SELECT access remains.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = target_table AND cmd = 'SELECT'
      AND ('anon' = ANY(roles) OR 'public' = ANY(roles))
  ) THEN
    RAISE EXCEPTION '%: postcondition failed -- a SELECT policy still targets anon or public', target_table;
  END IF;

  -- Postcondition: no unrestricted predicate remains under any name, of
  -- either permissive or restrictive mode.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = target_table AND cmd = 'SELECT'
      AND regexp_replace(lower(coalesce(qual, '')), '\s+', ' ', 'g') IN ('true', '(true)')
  ) THEN
    RAISE EXCEPTION '%: postcondition failed -- an unrestricted SELECT policy remains under some name', target_table;
  END IF;

  -- Postcondition: the exact final policy catalog -- exactly these two
  -- SELECT policies, nothing else, of either permissive or restrictive mode.
  SELECT count(*) INTO total_select_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = target_table AND cmd = 'SELECT';

  IF total_select_count <> 2 THEN
    RAISE EXCEPTION '%: postcondition failed -- expected exactly 2 SELECT policies, found %', target_table, total_select_count;
  END IF;
END;
$function$;

-- No production client API surface: not executable by anon or
-- authenticated (or any other role) -- only the function's owner (the
-- role that runs migrations, and the role local pgTAP connects as) can
-- call it. `REVOKE ... FROM PUBLIC` alone is NOT sufficient in this
-- project: this Supabase instance grants EXECUTE on every function in the
-- "public" schema to `anon`/`authenticated` directly (confirmed
-- empirically -- current_app_role()/current_worker_id() carry the same
-- default, which is intentional for THOSE functions since RLS predicates
-- must be callable by the querying role; it is emphatically not desired
-- here, since this function performs schema-altering DDL). Both the
-- PUBLIC revoke and the explicit per-role revokes below are required.
REVOKE ALL ON FUNCTION "public"."_replace_schedule_ownership_select_policy"(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."_replace_schedule_ownership_select_policy"(text, text, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."_replace_schedule_ownership_select_policy"(text, text, text) FROM "authenticated";

-- ============================================================
-- schedule_assignments
-- ============================================================

SELECT "public"."_replace_schedule_ownership_select_policy"(
  'schedule_assignments',
  'Staff and admin can read all schedule assignments',
  'Workers can read own schedule assignments'
);

-- ============================================================
-- schedule_teachers (identical shape)
-- ============================================================

SELECT "public"."_replace_schedule_ownership_select_policy"(
  'schedule_teachers',
  'Staff and admin can read all schedule teacher activities',
  'Workers can read own schedule teacher activities'
);

-- INSERT/UPDATE/DELETE policies on both tables are intentionally untouched
-- by this migration -- see the header comment above.
