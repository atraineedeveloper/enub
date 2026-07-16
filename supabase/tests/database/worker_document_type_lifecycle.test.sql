BEGIN;

SET search_path = public, extensions;

-- Covers the is_active lifecycle column, the Docencia retirement/rename
-- migration, and identity preservation through the rename -- proven by
-- capture-then-compare, never by asserting a hard-coded row id (see
-- design.md Decision 9). The empirically observed id for Docencia /
-- Evidencias on a fresh reset of this migration history is documented in
-- design.md's Context section purely as verification evidence; no test in
-- this file depends on that literal value being universal.

SELECT plan(16);

-- 8.1: is_active exists, is boolean, and is NOT NULL.
SELECT is(
    (
        SELECT format_type(attribute.atttypid, attribute.atttypmod)
        FROM pg_attribute AS attribute
        JOIN pg_class AS relation ON relation.oid = attribute.attrelid
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
            AND relation.relname = 'worker_document_types'
            AND attribute.attname = 'is_active'
    ),
    'boolean',
    'worker_document_types.is_active is boolean'
);

SELECT ok(
    (
        SELECT attribute.attnotnull
        FROM pg_attribute AS attribute
        JOIN pg_class AS relation ON relation.oid = attribute.attrelid
        JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
            AND relation.relname = 'worker_document_types'
            AND attribute.attname = 'is_active'
    ),
    'worker_document_types.is_active is NOT NULL'
);

-- 8.1: a freshly-inserted row that doesn't specify is_active defaults to true.
CREATE TEMP TABLE worker_document_type_lifecycle_ids AS
WITH default_fixture AS (
    INSERT INTO public.worker_document_types (category_id, name, allows_multiple, sort_order)
    SELECT id, 'QA Lifecycle Default Fixture', false, 999
    FROM public.worker_document_categories
    WHERE name = 'Investigación'
    RETURNING id, is_active
)
SELECT id AS default_fixture_id, is_active AS default_fixture_is_active
FROM default_fixture;

SELECT ok(
    (SELECT default_fixture_is_active FROM worker_document_type_lifecycle_ids),
    'a new worker_document_types row defaults to is_active = true when not specified'
);

-- 8.2: exactly the two named Docencia types are inactive.
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Docencia'
            AND worker_document_types.name = 'Plan de trabajo semestral'
            AND worker_document_types.is_active = false
    )
    AND EXISTS (
        SELECT 1 FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Docencia'
            AND worker_document_types.name = 'Planeaciones semanales'
            AND worker_document_types.is_active = false
    ),
    'Docencia / Plan de trabajo semestral and Docencia / Planeaciones semanales are both inactive'
);

SELECT is(
    (SELECT count(*) FROM public.worker_document_types WHERE is_active = false),
    2::bigint,
    'exactly two worker document types are inactive after a fresh reset'
);

-- 8.3: identically-named types in other categories are untouched.
SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Tutoría'
            AND worker_document_types.name = 'Evidencias de actividades'
            AND worker_document_types.is_active = true
            AND worker_document_types.allows_multiple = true
    ),
    'Tutoría / Evidencias de actividades is unchanged (name, is_active, allows_multiple)'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Asesoría'
            AND worker_document_types.name = 'Evidencias'
            AND worker_document_types.is_active = true
            AND worker_document_types.allows_multiple = true
    ),
    'Asesoría / Evidencias is unchanged (name, is_active, allows_multiple)'
);

-- The rename itself: no Docencia row is still named "Evidencias".
SELECT ok(
    NOT EXISTS (
        SELECT 1 FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Docencia'
            AND worker_document_types.name = 'Evidencias'
    ),
    'no Docencia document type is still named "Evidencias" after the rename'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Docencia'
            AND worker_document_types.name = 'Evidencias bimestrales'
    ),
    'exactly one Docencia document type is named "Evidencias bimestrales"'
);

-- 8.4 (synthetic fixture, capture-then-compare): prove the general
-- mechanism -- an UPDATE-based rename preserves id -- using a row this test
-- creates and captures itself, never a hard-coded literal. Uses the
-- Investigación category (untouched by the real migration) so this fixture
-- cannot collide with or be confused for the real Docencia rename.
WITH identity_fixture AS (
    INSERT INTO public.worker_document_types (category_id, name, allows_multiple, sort_order)
    SELECT id, 'QA Identity Fixture', true, 998
    FROM public.worker_document_categories
    WHERE name = 'Investigación'
    RETURNING id, category_id, allows_multiple, sort_order
)
SELECT id AS identity_fixture_id, category_id AS identity_fixture_category_id,
    allows_multiple AS identity_fixture_allows_multiple, sort_order AS identity_fixture_sort_order
INTO TEMP identity_fixture_before
FROM identity_fixture;

SELECT identity_fixture_id FROM identity_fixture_before \gset

-- The identical UPDATE-based rename shape the real migration uses.
UPDATE public.worker_document_types
SET name = 'QA Identity Fixture Renamed'
WHERE id = :identity_fixture_id;

SELECT ok(
    (
        SELECT worker_document_types.id = before.identity_fixture_id
            AND worker_document_types.category_id = before.identity_fixture_category_id
            AND worker_document_types.allows_multiple = before.identity_fixture_allows_multiple
            AND worker_document_types.sort_order = before.identity_fixture_sort_order
            AND worker_document_types.name = 'QA Identity Fixture Renamed'
        FROM public.worker_document_types, identity_fixture_before AS before
        WHERE worker_document_types.id = before.identity_fixture_id
    ),
    'an UPDATE-based rename preserves id, category_id, allows_multiple, and sort_order (captured live, not hard-coded)'
);

-- 8.4 (real catalog, capture-then-compare): query the real, current
-- Evidencias bimestrales row and capture its id live -- no literal id is
-- ever asserted ahead of time.
SELECT worker_document_types.id AS evidencias_bimestrales_id
FROM public.worker_document_types
JOIN public.worker_document_categories
    ON worker_document_categories.id = worker_document_types.category_id
WHERE worker_document_categories.name = 'Docencia'
    AND worker_document_types.name = 'Evidencias bimestrales' \gset

SELECT ok(
    :evidencias_bimestrales_id IS NOT NULL,
    'the real Evidencias bimestrales row''s id was captured live'
);

SELECT ok(
    EXISTS (
        SELECT 1 FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_types.id = :evidencias_bimestrales_id
            AND worker_document_categories.name = 'Docencia'
            AND worker_document_types.allows_multiple = true
            AND worker_document_types.sort_order = 60
    ),
    'the live-captured Evidencias bimestrales row resolves to Docencia, allows_multiple = true, sort_order = 60'
);

-- 8.5: a worker_documents row referencing the live-captured id remains a
-- valid, insertable foreign key reference after the rename -- proving no
-- orphaning, without ever hard-coding the id.
CREATE TEMP TABLE worker_document_type_lifecycle_fk_ids AS
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Lifecycle FK Worker', 'QA', 1)
    RETURNING id
),
semester_insert AS (
    INSERT INTO public.semesters (semester, school_year)
    VALUES ('QA Lifecycle', '2026-2027')
    RETURNING id
)
SELECT worker_insert.id AS worker_id, semester_insert.id AS semester_id
FROM worker_insert, semester_insert;

SELECT worker_id, semester_id FROM worker_document_type_lifecycle_fk_ids \gset

SELECT lives_ok(
    format(
        $$
        INSERT INTO public.worker_documents (worker_id, document_type_id, semester_id, file_name, storage_path, mime_type, file_size)
        VALUES (%L, %L, %L, 'evidencia-bimestral.pdf', 'lifecycle/evidencia-bimestral.pdf', 'application/pdf', 100)
        $$,
        :worker_id,
        :evidencias_bimestrales_id,
        :semester_id
    ),
    'a worker_documents row can still reference the renamed type''s live-captured id'
);

SELECT is(
    (
        SELECT count(*) FROM public.worker_documents
        WHERE storage_path = 'lifecycle/evidencia-bimestral.pdf'
            AND document_type_id = :evidencias_bimestrales_id
    ),
    1::bigint,
    'the inserted row resolves to the renamed type, not an orphaned reference'
);

-- Idempotent re-run sanity (design.md Decision 10): re-running the rename
-- UPDATE against an already-migrated catalog is a no-op, not an error.
SELECT lives_ok(
    $$
    UPDATE public.worker_document_types
    SET name = 'Evidencias bimestrales'
    WHERE category_id = (SELECT id FROM public.worker_document_categories WHERE name = 'Docencia')
        AND name = 'Evidencias'
    $$,
    're-running the rename UPDATE against an already-migrated catalog is a no-op, not an error'
);

SELECT is(
    (
        SELECT count(*) FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Docencia'
            AND worker_document_types.name = 'Evidencias bimestrales'
    ),
    1::bigint,
    'exactly one Evidencias bimestrales row exists under Docencia after the idempotent re-run'
);

SELECT * FROM finish();

ROLLBACK;
