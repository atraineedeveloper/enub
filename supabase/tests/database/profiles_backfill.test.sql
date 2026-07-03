BEGIN;

SET search_path = public, extensions;

-- The backfill migration (20260703002501_profiles_backfill_existing_users.sql)
-- already ran once, at migration time during db reset, over whatever
-- auth.users rows existed then (in a fresh local reset, typically none --
-- auth.users is empty until supabase/seed.sql runs afterwards). There is no
-- way to "time travel" and re-run only that migration against a
-- newly-inserted auth.users row through the normal migration path.
--
-- So this file tests the backfill migration's actual SQL statement
-- directly, against fixture auth.users rows created in this transaction --
-- verifying both its core correctness (grants role='staff' to a row with no
-- profile) and its idempotency guard (does not clobber an existing role).
-- This is a deliberate, documented choice, not an oversight -- see
-- decisions.md #18 and database-plan.md §11.

SELECT plan(6);

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    -- Simulates a pre-existing internal user from before this feature shipped.
    ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'backfill-pre-existing@example.test', 'x', now(), '{}', '{}', now(), now()),
    -- Simulates a user who was already migrated to a non-staff role before
    -- the backfill runs (e.g. a worker linked in the same deployment).
    ('00000000-0000-0000-0000-000000000000', '50000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'backfill-already-worker@example.test', 'x', now(), '{}', '{}', now(), now());

CREATE TEMP TABLE profiles_backfill_worker AS
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Backfill Worker', 'QA', 1)
    RETURNING id
)
SELECT worker_insert.id AS worker_id FROM worker_insert;

INSERT INTO public.profiles (id, role, worker_id)
SELECT '50000000-0000-0000-0000-000000000002', 'worker', worker_id FROM profiles_backfill_worker;

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '50000000-0000-0000-0000-000000000001'),
    'sanity: the pre-existing user has no profiles row yet'
);

-- Same statement as the migration (database-plan.md §11 / decisions.md #18).
INSERT INTO public.profiles (id, role, worker_id)
SELECT id, 'staff', NULL
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

SELECT is(
    (SELECT role FROM public.profiles WHERE id = '50000000-0000-0000-0000-000000000001'),
    'staff'::text,
    'the pre-existing user now has role=staff after the backfill runs'
);

SELECT ok(
    (SELECT worker_id FROM public.profiles WHERE id = '50000000-0000-0000-0000-000000000001') IS NULL,
    'the backfilled row has worker_id=NULL'
);

SELECT is(
    (SELECT role FROM public.profiles WHERE id = '50000000-0000-0000-0000-000000000002'),
    'worker'::text,
    'a user already migrated to a non-staff role before the backfill keeps that role (not clobbered to staff)'
);

-- Idempotency: running the exact same statement again must not error and
-- must not change anything (ON CONFLICT DO NOTHING + the NOT IN guard).
SELECT lives_ok(
    $$
    INSERT INTO public.profiles (id, role, worker_id)
    SELECT id, 'staff', NULL
    FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.profiles)
    ON CONFLICT (id) DO NOTHING
    $$,
    'running the backfill statement a second time does not error'
);

SELECT is(
    (SELECT role FROM public.profiles WHERE id = '50000000-0000-0000-0000-000000000002'),
    'worker'::text,
    're-running the backfill statement does not clobber the already-worker account'
);

SELECT * FROM finish();

ROLLBACK;
