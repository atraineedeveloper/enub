BEGIN;

SET search_path = public, extensions;

-- Behavioral coverage of replace_worker_document_metadata (design.md
-- Decision 5): the transactional delete-then-insert replacement RPC, its
-- rollback behavior, its compatibility with the pre-existing single-file
-- integrity trigger, its interaction with row-level security, and the
-- retirement-race schedule from finding #3. Ownership/RLS scenarios are
-- exercised via real RLS enforcement (SET LOCAL role authenticated +
-- request.jwt.claim.sub), matching worker_documents_ownership_rls.test.sql.

SELECT plan(18);

CREATE TEMP TABLE wd_rpc_ids AS
WITH worker_a AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA RPC Worker A', 'QA', 1)
    RETURNING id
),
worker_b AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA RPC Worker B', 'QA', 1)
    RETURNING id
),
semester_insert AS (
    INSERT INTO public.semesters (semester, school_year)
    VALUES ('QA RPC', '2026-2027')
    RETURNING id
),
type_lookup AS (
    SELECT
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Planeación semestral'
        ) AS single_file_type_id,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Rúbricas'
        ) AS single_file_type_id_2,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Listas de cotejo'
        ) AS single_file_type_id_3,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Listas de asistencia'
        ) AS single_file_type_id_4,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Actas de evaluación'
        ) AS single_file_type_id_5,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Plan de trabajo semestral'
        ) AS inactive_type_id
    FROM public.worker_document_types
    JOIN public.worker_document_categories
        ON worker_document_categories.id = worker_document_types.category_id
)
SELECT
    worker_a.id AS worker_a_id,
    worker_b.id AS worker_b_id,
    semester_insert.id AS semester_id,
    type_lookup.single_file_type_id,
    type_lookup.single_file_type_id_2,
    type_lookup.single_file_type_id_3,
    type_lookup.single_file_type_id_4,
    type_lookup.single_file_type_id_5,
    type_lookup.inactive_type_id
FROM worker_a, worker_b, semester_insert, type_lookup;

SELECT worker_a_id, worker_b_id, semester_id, single_file_type_id,
    single_file_type_id_2, single_file_type_id_3, single_file_type_id_4,
    single_file_type_id_5, inactive_type_id
FROM wd_rpc_ids \gset

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'wd-rpc-staff@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'wd-rpc-worker-a@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'wd-rpc-worker-b@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id)
VALUES ('e0000000-0000-0000-0000-000000000001', 'staff', NULL);

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'e0000000-0000-0000-0000-000000000002', 'worker', worker_a_id FROM wd_rpc_ids;

INSERT INTO public.profiles (id, role, worker_id)
SELECT 'e0000000-0000-0000-0000-000000000003', 'worker', worker_b_id FROM wd_rpc_ids;

-- 1. A successful call against an active, single-file type: the superseded
-- row is gone, the new row exists, exactly one row remains, and the
-- pre-existing single-file integrity trigger stayed enabled throughout
-- (proven by the fact that a normal second insert against this same
-- worker/type/semester scope would still be rejected -- see test 2 below,
-- run before this row is replaced).
INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
SELECT worker_a_id, single_file_type_id, semester_id, 'plan-v1.pdf', 'rpc/plan-v1.pdf', 'application/pdf', 100
FROM wd_rpc_ids;

SELECT throws_ok(
    format(
        $$
        INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
        VALUES (%L, %L, %L, 'plan-conflict.pdf', 'rpc/plan-conflict.pdf', 'application/pdf', 100)
        $$,
        :'worker_a_id', :'single_file_type_id', :'semester_id'
    ),
    'P0001',
    'This worker document type allows only one active file for the selected scope',
    'the pre-existing single-file integrity trigger remains fully enabled before any RPC call'
);

SELECT lives_ok(
    format(
        $$
        SELECT * FROM public.replace_worker_document_metadata(%L, %L, %L, 'plan-v2.pdf', 'rpc/plan-v2.pdf', 'application/pdf', 200)
        $$,
        :'worker_a_id', :'single_file_type_id', :'semester_id'
    ),
    'a successful replacement call against an active single-file type succeeds'
);

SELECT is(
    (
        SELECT count(*) FROM public.worker_documents
        WHERE worker_id = :'worker_a_id'::bigint
            AND document_type_id = :'single_file_type_id'::bigint
            AND semester_id = :'semester_id'::bigint
    ),
    1::bigint,
    'exactly one row remains for that worker/type/semester after a successful replacement'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_documents
        WHERE worker_id = :'worker_a_id'::bigint
            AND document_type_id = :'single_file_type_id'::bigint
            AND storage_path = 'rpc/plan-v2.pdf'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.worker_documents WHERE storage_path = 'rpc/plan-v1.pdf'
    ),
    'the new row exists and the superseded row is gone after a successful replacement'
);

-- 2. A call against an inactive type raises WDT01 and leaves
-- worker_documents completely unchanged.
INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
SELECT worker_a_id, single_file_type_id_2, semester_id, 'rubrica-v1.pdf', 'rpc/rubrica-v1.pdf', 'application/pdf', 100
FROM wd_rpc_ids;

UPDATE public.worker_document_types SET is_active = false WHERE id = :'single_file_type_id_2'::bigint;

SELECT throws_ok(
    format(
        $$
        SELECT * FROM public.replace_worker_document_metadata(%L, %L, %L, 'rubrica-v2.pdf', 'rpc/rubrica-v2.pdf', 'application/pdf', 200)
        $$,
        :'worker_a_id', :'single_file_type_id_2', :'semester_id'
    ),
    'WDT01',
    NULL,
    'a call against an inactive type raises WDT01'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_documents WHERE storage_path = 'rpc/rubrica-v1.pdf'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.worker_documents WHERE storage_path = 'rpc/rubrica-v2.pdf'
    ),
    'a call against an inactive type leaves worker_documents completely unchanged (no delete, no insert)'
);

-- 3. Rollback-after-insert-failure: force the INSERT step to fail (via the
-- file_size CHECK constraint) after the DELETE step has already run within
-- the same call, and confirm the superseded row is restored -- same id,
-- same content -- proving Postgres's own transaction rollback, not custom
-- compensating code.
INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
SELECT worker_a_id, single_file_type_id_3, semester_id, 'lista-v1.pdf', 'rpc/lista-v1.pdf', 'application/pdf', 100
FROM wd_rpc_ids
RETURNING id AS lista_v1_id \gset

SELECT throws_ok(
    format(
        $$
        SELECT * FROM public.replace_worker_document_metadata(%L, %L, %L, 'lista-v2.pdf', 'rpc/lista-v2.pdf', 'application/pdf', 0)
        $$,
        :'worker_a_id', :'single_file_type_id_3', :'semester_id'
    ),
    '23514',
    NULL,
    'an insert failure inside the RPC (file_size check) aborts the whole call'
);

SELECT is(
    (SELECT id FROM public.worker_documents WHERE storage_path = 'rpc/lista-v1.pdf'),
    :'lista_v1_id'::bigint,
    'the superseded row is restored with its original id after an insert failure -- proving automatic transaction rollback'
);

-- 4. Race with retirement (finding #3): a single-transaction simulation --
-- the type is active at "preflight" time, then a direct retirement is
-- applied (simulating a separate, already-committed transaction), then the
-- RPC call is made and observes the now-inactive state. The property under
-- test is the RPC's own transactional correctness given already-committed
-- inactive state, not genuine cross-session lock contention.
INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
SELECT worker_b_id, single_file_type_id, semester_id, 'plan-race-v1.pdf', 'rpc/plan-race-v1.pdf', 'application/pdf', 100
FROM wd_rpc_ids;

-- (1) preflight would see single_file_type_id as active here (still true).
-- (2) the new storage object upload is simulated -- no database effect.
-- (3) a separate transaction retires the type and commits.
UPDATE public.worker_document_types SET is_active = false WHERE id = :'single_file_type_id'::bigint;

-- (4) the client now calls the replacement RPC.
SELECT throws_ok(
    format(
        $$
        SELECT * FROM public.replace_worker_document_metadata(%L, %L, %L, 'plan-race-v2.pdf', 'rpc/plan-race-v2.pdf', 'application/pdf', 200)
        $$,
        :'worker_b_id', :'single_file_type_id', :'semester_id'
    ),
    'WDT01',
    NULL,
    '(5) the RPC detects the now-inactive type and fails'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_documents WHERE storage_path = 'rpc/plan-race-v1.pdf'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.worker_documents WHERE storage_path = 'rpc/plan-race-v2.pdf'
    ),
    '(6) the RPC transaction leaves old metadata untouched -- old metadata and old storage remain usable ((7)/(8) are the client''s own cleanup, exercised at the application level, task group 12)'
);

-- 5. Ownership enforcement, exercised behaviorally under real RLS.
-- single_file_type_id_4 (Listas de asistencia) has not been touched by any
-- earlier test in this file, so worker A and worker B can each get a fresh
-- fixture row under it without colliding with any leftover row from tests
-- 1-4 above.
INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
SELECT worker_a_id, single_file_type_id_4, semester_id, 'ownership-a-v1.pdf', 'rpc/ownership-a-v1.pdf', 'application/pdf', 100
FROM wd_rpc_ids;

INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
SELECT worker_b_id, single_file_type_id_4, semester_id, 'ownership-b-v1.pdf', 'rpc/ownership-b-v1.pdf', 'application/pdf', 100
FROM wd_rpc_ids;

-- Worker A can replace their own document.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
SELECT lives_ok(
    format(
        $$
        SELECT * FROM public.replace_worker_document_metadata(%L, %L, %L, 'ownership-a-v2.pdf', 'rpc/ownership-a-v2.pdf', 'application/pdf', 200)
        $$,
        :'worker_a_id', :'single_file_type_id_4', :'semester_id'
    ),
    'worker A can call the replacement RPC for their own document'
);
RESET role;
RESET "request.jwt.claim.sub";

-- Worker A cannot replace worker B's document; worker B's row is
-- unaffected -- both the RLS rejection and the "nothing was touched"
-- outcome are proven together.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
SELECT throws_ok(
    format(
        $$
        SELECT * FROM public.replace_worker_document_metadata(%L, %L, %L, 'ownership-b-v2.pdf', 'rpc/ownership-b-v2.pdf', 'application/pdf', 100)
        $$,
        :'worker_b_id', :'single_file_type_id_4', :'semester_id'
    ),
    '42501',
    NULL,
    'worker A cannot call the replacement RPC targeting worker B''s worker_id'
);
RESET role;
RESET "request.jwt.claim.sub";

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_documents WHERE storage_path = 'rpc/ownership-b-v1.pdf'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.worker_documents WHERE storage_path = 'rpc/ownership-b-v2.pdf'
    ),
    'worker B''s document remains completely unchanged after worker A''s rejected attempt'
);

-- Staff can replace any worker's document.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000001';
SELECT lives_ok(
    format(
        $$
        SELECT * FROM public.replace_worker_document_metadata(%L, %L, %L, 'ownership-b-staff-v2.pdf', 'rpc/ownership-b-staff-v2.pdf', 'application/pdf', 200)
        $$,
        :'worker_b_id', :'single_file_type_id_4', :'semester_id'
    ),
    'a staff session can call the replacement RPC for any worker'
);
RESET role;
RESET "request.jwt.claim.sub";

-- 6. Historical SELECT/DELETE on a document whose type is now inactive
-- remains governed solely by the existing ownership-aware RLS -- the
-- lifecycle trigger introduces no new authorization restriction. The
-- fixture must be inserted while single_file_type_id_5 is still active
-- (the lifecycle trigger rejects any INSERT against an already-inactive
-- type, regardless of role) and only then retired via a direct UPDATE,
-- mirroring how a real historical document ends up under a since-retired
-- type in production.
INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
SELECT worker_a_id, single_file_type_id_5, semester_id, 'historical.pdf', 'rpc/historical.pdf', 'application/pdf', 100
FROM wd_rpc_ids;

UPDATE public.worker_document_types SET is_active = false WHERE id = :'single_file_type_id_5'::bigint;

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
SELECT (SELECT count(*) FROM public.worker_documents WHERE storage_path = 'rpc/historical.pdf') AS worker_a_sees_own_historical \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(
    :'worker_a_sees_own_historical'::bigint,
    1::bigint,
    'worker A can read their own historical document under a now-inactive type'
);

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000003';
SELECT (SELECT count(*) FROM public.worker_documents WHERE storage_path = 'rpc/historical.pdf') AS worker_b_sees_worker_a_historical \gset
RESET role;
RESET "request.jwt.claim.sub";

SELECT is(
    :'worker_b_sees_worker_a_historical'::bigint,
    0::bigint,
    'worker B cannot read worker A''s historical document under a now-inactive type -- ownership RLS alone still governs it'
);

-- Worker B's delete attempt on worker A's historical document is a
-- no-op (RLS filters it out, not a real delete) -- identical to the
-- pre-existing worker_documents_ownership_rls.test.sql pattern for an
-- active type, proving the lifecycle trigger changes nothing about DELETE
-- authorization either.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000003';
DELETE FROM public.worker_documents WHERE storage_path = 'rpc/historical.pdf';
RESET role;
RESET "request.jwt.claim.sub";

SELECT ok(
    EXISTS (SELECT 1 FROM public.worker_documents WHERE storage_path = 'rpc/historical.pdf'),
    'worker A''s historical document under a now-inactive type still exists after worker B''s no-op delete attempt'
);

-- Worker A can delete their own historical document under a now-inactive
-- type -- ownership RLS alone still governs DELETE, unaffected by is_active.
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = 'e0000000-0000-0000-0000-000000000002';
SELECT lives_ok(
    $$DELETE FROM public.worker_documents WHERE storage_path = 'rpc/historical.pdf'$$,
    'worker A can delete their own historical document under a now-inactive type'
);
RESET role;
RESET "request.jwt.claim.sub";

SELECT * FROM finish();

ROLLBACK;
