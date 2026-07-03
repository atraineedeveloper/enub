BEGIN;

SET search_path = public, extensions;

SELECT plan(13);

SELECT ok(to_regclass('public.profiles') IS NOT NULL, 'profiles table exists');

SELECT is(
    (
        SELECT format_type(attribute.atttypid, attribute.atttypmod)
        FROM pg_attribute AS attribute
        JOIN pg_class AS relation ON relation.oid = attribute.attrelid
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
            AND relation.relname = 'profiles'
            AND attribute.attname = 'id'
    ),
    'uuid',
    'profiles.id is uuid'
);

SELECT is(
    (
        SELECT format_type(attribute.atttypid, attribute.atttypmod)
        FROM pg_attribute AS attribute
        JOIN pg_class AS relation ON relation.oid = attribute.attrelid
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
            AND relation.relname = 'profiles'
            AND attribute.attname = 'worker_id'
    ),
    'bigint',
    'profiles.worker_id is bigint'
);

-- role must have no column default: a profiles row can only ever be created
-- by explicitly stating its role (backfill migration, the RPCs, or manual
-- bootstrap) -- never implicitly. See decisions.md #7 and #8.
SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM pg_attrdef AS default_definition
        JOIN pg_class AS relation ON relation.oid = default_definition.adrelid
        JOIN pg_attribute AS attribute
            ON attribute.attrelid = relation.oid AND attribute.attnum = default_definition.adnum
        WHERE relation.relname = 'profiles'
            AND attribute.attname = 'role'
    ),
    'profiles.role has no column default'
);

-- profiles_worker_id_fkey must be ON DELETE RESTRICT, not CASCADE, so
-- deleting a linked workers row fails outright instead of silently
-- deleting the profile. See decisions.md #19.
SELECT is(
    (SELECT confdeltype FROM pg_constraint WHERE conname = 'profiles_worker_id_fkey'),
    'r',
    'profiles_worker_id_fkey is ON DELETE RESTRICT'
);

-- profiles_id_fkey stays ON DELETE CASCADE: deleting the auth.users row
-- itself (account removal) should remove the now-meaningless profile row.
SELECT is(
    (SELECT confdeltype FROM pg_constraint WHERE conname = 'profiles_id_fkey'),
    'c',
    'profiles_id_fkey is ON DELETE CASCADE'
);

CREATE TEMP TABLE profiles_schema_ids AS
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Profiles Schema Worker', 'QA', 1)
    RETURNING id
)
SELECT worker_insert.id AS worker_id FROM worker_insert;

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'profiles-schema-qa@example.test',
    'x',
    now(),
    '{}',
    '{}',
    now(),
    now()
);

SELECT throws_ok(
    $$
    INSERT INTO public.profiles (id, role, worker_id)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'not-a-real-role', NULL)
    $$,
    '23514',
    'new row for relation "profiles" violates check constraint "profiles_role_check"',
    'role is restricted to admin/staff/worker'
);

SELECT throws_ok(
    $$
    INSERT INTO public.profiles (id, role, worker_id)
    VALUES ('a0000000-0000-0000-0000-000000000001', 'worker', NULL)
    $$,
    '23514',
    'new row for relation "profiles" violates check constraint "profiles_worker_role_consistency"',
    'role=worker requires a non-null worker_id'
);

SELECT throws_ok(
    format(
        $$
        INSERT INTO public.profiles (id, role, worker_id)
        VALUES ('a0000000-0000-0000-0000-000000000001', 'staff', %L)
        $$,
        (SELECT worker_id FROM profiles_schema_ids)
    ),
    '23514',
    'new row for relation "profiles" violates check constraint "profiles_worker_role_consistency"',
    'role=staff requires a null worker_id'
);

SELECT lives_ok(
    format(
        $$
        INSERT INTO public.profiles (id, role, worker_id)
        VALUES ('a0000000-0000-0000-0000-000000000001', 'worker', %L)
        $$,
        (SELECT worker_id FROM profiles_schema_ids)
    ),
    'role=worker with a non-null worker_id is accepted'
);

-- profiles_worker_id_fkey is ON DELETE RESTRICT: deleting a workers row
-- that is still referenced by a profiles row must fail (behavioral check,
-- complementing the structural confdeltype check above).
SELECT throws_ok(
    format(
        $$DELETE FROM public.workers WHERE id = %L$$,
        (SELECT worker_id FROM profiles_schema_ids)
    ),
    '23503',
    NULL,
    'deleting a workers row referenced by profiles fails (RESTRICT)'
);

-- profiles_id_fkey is ON DELETE CASCADE: deleting the auth.users row
-- removes the now-orphaned profile row automatically.
SELECT lives_ok(
    $$DELETE FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000001'$$,
    'deleting the auth.users row succeeds'
);

SELECT ok(
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000001'),
    'deleting the auth.users row cascade-deletes its profiles row'
);

SELECT * FROM finish();

ROLLBACK;
