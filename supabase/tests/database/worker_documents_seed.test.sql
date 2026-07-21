BEGIN;

SET search_path = public, extensions;

SELECT plan(17);

SELECT is(
    (SELECT count(*) FROM public.worker_document_categories),
    5::bigint,
    'exactly 5 worker document categories exist'
);

-- 30 = 29 seeded + Tutoría / Plan de Trabajo, added by
-- 20260721030000_update_advising_tutoring_document_requirements.sql.
SELECT is(
    (SELECT count(*) FROM public.worker_document_types),
    30::bigint,
    'exactly 30 worker document types exist'
);

SELECT is(
    (
        SELECT scope
        FROM public.worker_document_categories
        WHERE name = 'Datos personales'
    ),
    'permanent',
    'Datos personales has permanent scope'
);

SELECT is(
    (
        SELECT scope
        FROM public.worker_document_categories
        WHERE name = 'Docencia'
    ),
    'semester',
    'Docencia has semester scope'
);

SELECT is(
    (
        SELECT scope
        FROM public.worker_document_categories
        WHERE name = 'Tutoría'
    ),
    'semester',
    'Tutoría has semester scope'
);

SELECT is(
    (
        SELECT scope
        FROM public.worker_document_categories
        WHERE name = 'Asesoría'
    ),
    'semester',
    'Asesoría has semester scope'
);

SELECT is(
    (
        SELECT scope
        FROM public.worker_document_categories
        WHERE name = 'Investigación'
    ),
    'semester',
    'Investigación has semester scope'
);

-- 9 = 7 active Docencia types (flipped by
-- 20260721010000_docencia_active_types_allow_multiple.sql, see below) + 1
-- Tutoría (Evidencias de actividades) + 1 Asesoría (Evidencias). Was 3
-- before that migration (only Evidencias bimestrales + those same two).
SELECT is(
    (
        SELECT count(*)
        FROM public.worker_document_types
        WHERE allows_multiple = true
    ),
    9::bigint,
    'exactly 9 worker document types allow multiple files'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Docencia'
            AND worker_document_types.name = 'Evidencias bimestrales'
            AND worker_document_types.allows_multiple = true
    ),
    'Docencia / Evidencias bimestrales allows multiple files'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Tutoría'
            AND worker_document_types.name = 'Evidencias de actividades'
            AND worker_document_types.allows_multiple = true
    )
    AND EXISTS (
        SELECT 1
        FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Asesoría'
            AND worker_document_types.name = 'Evidencias'
            AND worker_document_types.allows_multiple = true
    ),
    'Tutoría / Evidencias de actividades and Asesoría / Evidencias allow multiple files'
);

-- 20260721010000_docencia_active_types_allow_multiple.sql: every active
-- Docencia type now allows multiple files -- no active Docencia type is
-- left at allows_multiple = false.
SELECT is(
    (
        SELECT count(*)
        FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Docencia'
            AND worker_document_types.is_active = true
            AND worker_document_types.allows_multiple = false
    ),
    0::bigint,
    'no active Docencia document type has allows_multiple = false'
);

SELECT is(
    (
        SELECT count(*)
        FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Docencia'
            AND worker_document_types.is_active = true
    ),
    7::bigint,
    'exactly 7 active Docencia document types exist'
);

-- The 2 retired Docencia types are untouched by the migration (still
-- allows_multiple = false, exactly as before).
SELECT is(
    (
        SELECT count(*)
        FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Docencia'
            AND worker_document_types.is_active = false
            AND worker_document_types.name IN ('Plan de trabajo semestral', 'Planeaciones semanales')
            AND worker_document_types.allows_multiple = false
    ),
    2::bigint,
    'both retired Docencia document types remain allows_multiple = false'
);

-- Datos personales, Tutoría, Asesoría, and Investigación are unaffected:
-- their allows_multiple = true counts are exactly what the seed/lifecycle
-- migrations already established, unchanged by the Docencia migration.
SELECT is(
    (
        SELECT count(*)
        FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Datos personales'
            AND worker_document_types.allows_multiple = true
    ),
    0::bigint,
    'Datos personales has zero document types with allows_multiple = true (unaffected)'
);

SELECT is(
    (
        SELECT count(*)
        FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Tutoría'
            AND worker_document_types.allows_multiple = true
    ),
    1::bigint,
    'Tutoría has exactly 1 document type with allows_multiple = true (unaffected)'
);

SELECT is(
    (
        SELECT count(*)
        FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Asesoría'
            AND worker_document_types.allows_multiple = true
    ),
    1::bigint,
    'Asesoría has exactly 1 document type with allows_multiple = true (unaffected)'
);

SELECT is(
    (
        SELECT count(*)
        FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Investigación'
            AND worker_document_types.allows_multiple = true
    ),
    0::bigint,
    'Investigación has zero document types with allows_multiple = true (unaffected)'
);

SELECT * FROM finish();

ROLLBACK;
