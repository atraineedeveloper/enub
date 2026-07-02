BEGIN;

SET search_path = public, extensions;

SELECT plan(10);

SELECT is(
    (SELECT count(*) FROM public.worker_document_categories),
    5::bigint,
    'exactly 5 worker document categories exist'
);

SELECT is(
    (SELECT count(*) FROM public.worker_document_types),
    29::bigint,
    'exactly 29 worker document types exist'
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

SELECT is(
    (
        SELECT count(*)
        FROM public.worker_document_types
        WHERE allows_multiple = true
    ),
    3::bigint,
    'exactly 3 worker document types allow multiple files'
);

SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.worker_document_types
        JOIN public.worker_document_categories
            ON worker_document_categories.id = worker_document_types.category_id
        WHERE worker_document_categories.name = 'Docencia'
            AND worker_document_types.name = 'Evidencias'
            AND worker_document_types.allows_multiple = true
    ),
    'Docencia / Evidencias allows multiple files'
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

SELECT * FROM finish();

ROLLBACK;
