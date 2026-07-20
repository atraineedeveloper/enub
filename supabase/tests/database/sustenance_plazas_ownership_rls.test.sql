BEGIN;

SET search_path = public, extensions;

-- Behavioral + structural coverage for the ownership-scoped
-- sustenance_plazas SELECT policies introduced by
-- 20260721000000_worker_relation_ownership_select_policies.sql. Mirrors
-- schedule_assignments_ownership_rls.test.sql: verifies that the open
-- "Enable read access for all users" policy is gone, that admin/staff see
-- every row (including worker-less rows), that a worker session only sees
-- their own rows, that anonymous/no-profile sessions see nothing, and that
-- INSERT/UPDATE/DELETE remain exactly as restricted (staff/admin only,
-- from 20260720190340_update_worker_with_relations.sql) as before --
-- exercised via real RLS enforcement, not just policy metadata.

SELECT plan(28);

CREATE TEMP TABLE sp_ownership_ids AS
WITH worker_a AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA SP Ownership Worker A', 'QA', 1)
    RETURNING id
),
worker_b AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA SP Ownership Worker B', 'QA', 1)
    RETURNING id
)
SELECT worker_a.id AS worker_a_id, worker_b.id AS worker_b_id
FROM worker_a, worker_b;

-- Captured into psql variables (not re-queried later) because this temp
-- table is only accessible to the connecting role -- later statements in
-- this file run under `SET LOCAL role authenticated`, which cannot see it.
SELECT worker_a_id, worker_b_id FROM sp_ownership_ids \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'f1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'sp-ownership-admin@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'f1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sp-ownership-staff@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'f1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'sp-ownership-worker-a@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'f1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'sp-ownership-worker-b@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'f1000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'sp-ownership-noprofile@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id) VALUES
    ('f1000000-0000-0000-0000-000000000001', 'admin', NULL),
    ('f1000000-0000-0000-0000-000000000002', 'staff', NULL);

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'f1000000-0000-0000-0000-000000000003', 'worker', worker_a_id FROM sp_ownership_ids;

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'f1000000-0000-0000-0000-000000000004', 'worker', worker_b_id FROM sp_ownership_ids;

-- f1000000-...-005 intentionally has no profiles row (the "missing profile" session).

-- Fixture rows: one owned by worker A, one owned by worker B, one
-- worker-less (worker_id NULL). Distinguished by payment_key so tests can
-- target a specific row without relying on worker_id filters alone.
INSERT INTO public.sustenance_plazas (sustenance, payment_key, plaza, worker_id)
SELECT 'Estatal', 'QA-PLAZA-A', 'Plaza A', worker_a_id FROM sp_ownership_ids;

INSERT INTO public.sustenance_plazas (sustenance, payment_key, plaza, worker_id)
SELECT 'Federal', 'QA-PLAZA-B', 'Plaza B', worker_b_id FROM sp_ownership_ids;

INSERT INTO public.sustenance_plazas (sustenance, payment_key, plaza, worker_id)
SELECT 'Estatal', 'QA-PLAZA-NULL', 'Plaza Null', NULL FROM sp_ownership_ids;

-- Admin sees every row, including the worker-less one.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f1000000-0000-0000-0000-000000000001';
SELECT (SELECT count(*) FROM public.sustenance_plazas WHERE payment_key LIKE 'QA-PLAZA-%') AS admin_visible_count \gset
SELECT (SELECT count(*) FROM public.sustenance_plazas WHERE payment_key = 'QA-PLAZA-NULL') AS admin_sees_null_owned \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'admin_visible_count'::bigint, 3::bigint, 'an admin session sees every sustenance_plazas row');
SELECT is(:'admin_sees_null_owned'::bigint, 1::bigint, 'an admin session sees the worker-less row');

-- Staff sees every row too.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f1000000-0000-0000-0000-000000000002';
SELECT (SELECT count(*) FROM public.sustenance_plazas WHERE payment_key LIKE 'QA-PLAZA-%') AS staff_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'staff_visible_count'::bigint, 3::bigint, 'a staff session sees every sustenance_plazas row');

-- Worker A sees only their own row: not worker B's, not the null-owned one.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f1000000-0000-0000-0000-000000000003';
SELECT (SELECT count(*) FROM public.sustenance_plazas WHERE payment_key LIKE 'QA-PLAZA-%') AS worker_a_visible_count \gset
SELECT (SELECT count(*) FROM public.sustenance_plazas WHERE payment_key = 'QA-PLAZA-B') AS worker_a_sees_worker_b \gset
SELECT (SELECT count(*) FROM public.sustenance_plazas WHERE worker_id = :'worker_b_id'::bigint) AS worker_a_filtered_by_worker_b \gset
SELECT (SELECT count(*) FROM public.sustenance_plazas WHERE payment_key = 'QA-PLAZA-NULL') AS worker_a_sees_null_owned \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_a_visible_count'::bigint, 1::bigint, 'worker A session sees exactly one sustenance_plazas row (no explicit filter needed)');
SELECT is(:'worker_a_sees_worker_b'::bigint, 0::bigint, 'worker A session cannot see worker B''s row by its payment_key marker');
SELECT is(:'worker_a_filtered_by_worker_b'::bigint, 0::bigint, 'worker A session filtered explicitly by worker B''s worker_id returns zero rows');
SELECT is(:'worker_a_sees_null_owned'::bigint, 0::bigint, 'worker A session cannot see the worker-less row');

-- Worker B sees only their own row (ownership check is symmetric).
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f1000000-0000-0000-0000-000000000004';
SELECT (SELECT count(*) FROM public.sustenance_plazas WHERE payment_key LIKE 'QA-PLAZA-%') AS worker_b_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'worker_b_visible_count'::bigint, 1::bigint, 'worker B session sees exactly one sustenance_plazas row');

-- Anonymous (no authenticated session at all) is denied.
SET LOCAL role anon;
SELECT (SELECT count(*) FROM public.sustenance_plazas WHERE payment_key LIKE 'QA-PLAZA-%') AS anon_visible_count \gset
RESET role;

SELECT is(:'anon_visible_count'::bigint, 0::bigint, 'an anonymous session sees no sustenance_plazas rows');

-- A real auth.users row with no profiles row (missing profile) is denied.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f1000000-0000-0000-0000-000000000005';
SELECT (SELECT count(*) FROM public.sustenance_plazas WHERE payment_key LIKE 'QA-PLAZA-%') AS noprofile_visible_count \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(:'noprofile_visible_count'::bigint, 0::bigint, 'a session with no profiles row sees no sustenance_plazas rows');

-- Structural: the old unrestricted policy is gone, and nothing else
-- unrestricted has taken its place under any name.
SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'sustenance_plazas'
            AND cmd = 'SELECT'
            AND policyname = 'Enable read access for all users'
    ),
    'the old unrestricted "Enable read access for all users" SELECT policy no longer exists on sustenance_plazas'
);

SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'sustenance_plazas'
            AND cmd = 'SELECT'
            AND (
                qual = 'true'
                OR 'public' = ANY(roles)
                OR 'anon' = ANY(roles)
            )
    ),
    'no unrestricted or anon/public SELECT policy exists on sustenance_plazas under any name'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'sustenance_plazas'
            AND cmd = 'SELECT'
            AND permissive = 'PERMISSIVE'
            AND roles = ARRAY['authenticated']::name[]
            AND qual = '(current_app_role() = ANY (ARRAY[''staff''::text, ''admin''::text]))'
    ),
    'the admin/staff full-read SELECT policy exists on sustenance_plazas with the expected shape'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
            AND tablename = 'sustenance_plazas'
            AND cmd = 'SELECT'
            AND permissive = 'PERMISSIVE'
            AND roles = ARRAY['authenticated']::name[]
            AND qual = '(worker_id = current_worker_id())'
    ),
    'the worker-own-row SELECT policy exists on sustenance_plazas with the expected shape'
);

SELECT is(
    (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sustenance_plazas' AND cmd = 'SELECT'),
    2,
    'exactly two SELECT policies exist on sustenance_plazas'
);

-- Structural: INSERT/UPDATE/DELETE policy metadata is unchanged by this
-- migration -- already staff/admin-only since
-- 20260720190340_update_worker_with_relations.sql.
SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'sustenance_plazas'
            AND policyname = 'Staff and admin can insert sustenance plazas'
            AND cmd = 'INSERT' AND permissive = 'PERMISSIVE'
            AND roles = ARRAY['authenticated']::name[]
    ),
    'the sustenance_plazas INSERT policy is unchanged (staff/admin only)'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'sustenance_plazas'
            AND policyname = 'Staff and admin can update sustenance plazas'
            AND cmd = 'UPDATE' AND permissive = 'PERMISSIVE'
            AND roles = ARRAY['authenticated']::name[]
    ),
    'the sustenance_plazas UPDATE policy is unchanged (staff/admin only)'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'sustenance_plazas'
            AND policyname = 'Staff and admin can delete sustenance plazas'
            AND cmd = 'DELETE' AND permissive = 'PERMISSIVE'
            AND roles = ARRAY['authenticated']::name[]
    ),
    'the sustenance_plazas DELETE policy is unchanged (staff/admin only)'
);

-- Behavioral: writes still require staff/admin (unchanged) -- a worker
-- session cannot insert directly, matching update_worker_with_relations.test.sql.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f1000000-0000-0000-0000-000000000003';

SELECT throws_ok(
    format(
        $$INSERT INTO public.sustenance_plazas (sustenance, payment_key, plaza, worker_id) VALUES ('Estatal', 'QA-DIRECT', 'No permitida', %L)$$,
        :'worker_a_id'
    ),
    '42501',
    NULL,
    'worker role cannot insert sustenance_plazas directly (unchanged)'
);

-- Behavioral: a worker cannot UPDATE or DELETE even their OWN row --
-- write access is staff/admin-only, never ownership-based, unchanged by
-- this migration (which only touched SELECT). UPDATE/DELETE policies gate
-- via their USING clause alone (no WITH CHECK to violate), so a denied
-- worker's statement does NOT raise -- it simply matches zero rows. The
-- real proof is that the row is provably untouched afterward, not an
-- exception.
SELECT lives_ok(
    format(
        $$UPDATE public.sustenance_plazas SET plaza = 'QA-Worker-Update' WHERE payment_key = 'QA-PLAZA-A' AND worker_id = %L$$,
        :'worker_a_id'
    ),
    'a worker session''s UPDATE against sustenance_plazas does not raise (RLS silently matches zero rows)'
);
SELECT is(
    (SELECT plaza FROM public.sustenance_plazas WHERE payment_key = 'QA-PLAZA-A'),
    'Plaza A',
    'worker role cannot actually update sustenance_plazas, not even their own row -- the row is unchanged'
);

SELECT lives_ok(
    format(
        $$DELETE FROM public.sustenance_plazas WHERE payment_key = 'QA-PLAZA-A' AND worker_id = %L$$,
        :'worker_a_id'
    ),
    'a worker session''s DELETE against sustenance_plazas does not raise (RLS silently matches zero rows)'
);
SELECT is(
    (SELECT count(*)::int FROM public.sustenance_plazas WHERE payment_key = 'QA-PLAZA-A'),
    1,
    'worker role cannot actually delete sustenance_plazas, not even their own row -- the row still exists'
);

RESET role;
RESET "request.jwt.claim.sub";

-- Behavioral: staff/admin writes still work exactly as before -- and for
-- UPDATE/DELETE specifically, a bare `lives_ok` (no exception) is not
-- enough proof of an actual write, since the same "no exception" is also
-- what a zero-row no-op looks like. Each capture the affected-row count
-- via `UPDATE/DELETE ... RETURNING` (this statement's ROW_COUNT
-- equivalent) and assert it is exactly 1, then re-query the row by `id`
-- to confirm the value actually changed / the row is actually gone.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'f1000000-0000-0000-0000-000000000001';

SELECT lives_ok(
    format(
        $$INSERT INTO public.sustenance_plazas (sustenance, payment_key, plaza, worker_id) VALUES ('Estatal', 'QA-ADMIN-INSERT', 'Admin insert', %L)$$,
        :'worker_a_id'
    ),
    'admin session can still insert sustenance_plazas (write policies unchanged)'
);

SELECT id AS admin_insert_id FROM public.sustenance_plazas WHERE payment_key = 'QA-ADMIN-INSERT' \gset

WITH updated AS (
    UPDATE public.sustenance_plazas
    SET plaza = 'QA-Admin-Updated'
    WHERE id = :'admin_insert_id'::bigint
    RETURNING 1
)
SELECT count(*)::int AS admin_update_row_count FROM updated \gset

SELECT is(:'admin_update_row_count'::int, 1, 'admin session''s UPDATE against sustenance_plazas affects exactly one row (ROW_COUNT = 1)');
SELECT is(
    (SELECT plaza FROM public.sustenance_plazas WHERE id = :'admin_insert_id'::bigint),
    'QA-Admin-Updated',
    'admin session''s UPDATE actually changed the target row''s plaza to the expected value'
);

WITH deleted AS (
    DELETE FROM public.sustenance_plazas
    WHERE id = :'admin_insert_id'::bigint
    RETURNING 1
)
SELECT count(*)::int AS admin_delete_row_count FROM deleted \gset

SELECT is(:'admin_delete_row_count'::int, 1, 'admin session''s DELETE against sustenance_plazas affects exactly one row (ROW_COUNT = 1)');
SELECT is(
    (SELECT count(*)::int FROM public.sustenance_plazas WHERE id = :'admin_insert_id'::bigint),
    0,
    'admin session''s DELETE actually removed the target row -- count(*) by id is 0'
);

RESET role;
RESET "request.jwt.claim.sub";

SELECT * FROM finish();

ROLLBACK;
