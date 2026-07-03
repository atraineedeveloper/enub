BEGIN;

SET search_path = public, extensions;

-- Regression coverage for decisions.md #19: deleting a workers row that is
-- still referenced by a profiles row must fail outright (ON DELETE
-- RESTRICT), and the sanctioned way around that is unlink_worker_account
-- -- which reverts the account to no role, never to staff.
--
-- Uses a freshly created worker with no other child-table references
-- (date_of_admissions, sustenance_plazas, schedule_assignments,
-- schedule_teachers, roles all also reference workers), so the only FK in
-- play is profiles_worker_id_fkey.

SELECT plan(5);

CREATE TEMP TABLE pwdr_ids AS
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Deletion Restrict Worker', 'QA', 1)
    RETURNING id
)
SELECT worker_insert.id AS worker_id FROM worker_insert;

SELECT worker_id FROM pwdr_ids \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'pwdr-admin@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'pwdr-worker@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id) VALUES ('40000000-0000-0000-0000-000000000001', 'admin', NULL);
INSERT INTO public.profiles (id, role, worker_id) SELECT '40000000-0000-0000-0000-000000000002', 'worker', worker_id FROM pwdr_ids;

SELECT throws_ok(
    format($$DELETE FROM public.workers WHERE id = %L$$, :'worker_id'),
    '23503',
    NULL,
    'deleting a workers row referenced by a profiles row fails (ON DELETE RESTRICT)'
);

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000001';
SELECT lives_ok(
    format($$SELECT public.unlink_worker_account(%L)$$, :'worker_id'),
    'admin can unlink the worker to clear the way for deletion'
);
RESET role;
RESET "request.jwt.claim.sub";

SELECT lives_ok(
    format($$DELETE FROM public.workers WHERE id = %L$$, :'worker_id'),
    'deleting the workers row now succeeds after unlinking'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.workers WHERE id = (SELECT worker_id FROM pwdr_ids)),
    'the workers row is actually gone'
);

-- The formerly-linked account has no role at all -- not staff. Same
-- invariant as unlink_worker_account_function.test.sql, re-checked here in
-- the specific context of a deletion having also occurred.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '40000000-0000-0000-0000-000000000002';
SELECT (public.current_app_role() IS NULL) AS role_after_unlink_and_delete_is_null \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT ok(
    :'role_after_unlink_and_delete_is_null'::boolean,
    'the formerly-linked account has no role after unlink + delete -- not staff'
);

SELECT * FROM finish();

ROLLBACK;
