BEGIN;

SET search_path = public, extensions;

SELECT plan(7);

CREATE TEMP TABLE worker_documents_trigger_ids AS
WITH worker_insert AS (
    INSERT INTO public.workers (name, type_worker, status)
    VALUES ('QA Worker Documents Triggers', 'QA', 1)
    RETURNING id
),
semester_insert AS (
    INSERT INTO public.semesters (semester, school_year)
    VALUES ('QA', '2026-2027')
    RETURNING id
),
type_lookup AS (
    SELECT
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Datos personales'
                AND worker_document_types.name = 'CURP'
        ) AS permanent_type_id,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Planeación semestral'
        ) AS semester_type_id,
        max(worker_document_types.id) FILTER (
            WHERE worker_document_categories.name = 'Docencia'
                AND worker_document_types.name = 'Evidencias'
        ) AS evidence_type_id
    FROM public.worker_document_types
    JOIN public.worker_document_categories
        ON worker_document_categories.id = worker_document_types.category_id
)
SELECT
    worker_insert.id AS worker_id,
    semester_insert.id AS semester_id,
    type_lookup.permanent_type_id,
    type_lookup.semester_type_id,
    type_lookup.evidence_type_id
FROM worker_insert, semester_insert, type_lookup;

SELECT throws_ok(
    $$
    INSERT INTO public.worker_documents (
        worker_id,
        document_type_id,
        semester_id,
        file_name,
        storage_path,
        mime_type,
        file_size
    )
    SELECT
        worker_id,
        permanent_type_id,
        semester_id,
        'curp.pdf',
        'triggers/permanent-with-semester.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids
    $$,
    'P0001',
    'Permanent worker documents cannot be tied to a semester',
    'permanent document with non-null semester_id is rejected'
);

SELECT throws_ok(
    $$
    INSERT INTO public.worker_documents (
        worker_id,
        document_type_id,
        semester_id,
        file_name,
        storage_path,
        mime_type,
        file_size
    )
    SELECT
        worker_id,
        semester_type_id,
        NULL,
        'planeacion.pdf',
        'triggers/semester-without-semester.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids
    $$,
    'P0001',
    'Semester worker documents require semester_id',
    'semester-scoped document with null semester_id is rejected'
);

INSERT INTO public.worker_documents (
    worker_id,
    document_type_id,
    semester_id,
    file_name,
    storage_path,
    mime_type,
    file_size
)
SELECT
    worker_id,
    permanent_type_id,
    NULL,
    'curp-a.pdf',
    'triggers/curp-a.pdf',
    'application/pdf',
    100
FROM worker_documents_trigger_ids;

SELECT throws_ok(
    $$
    INSERT INTO public.worker_documents (
        worker_id,
        document_type_id,
        semester_id,
        file_name,
        storage_path,
        mime_type,
        file_size
    )
    SELECT
        worker_id,
        permanent_type_id,
        NULL,
        'curp-b.pdf',
        'triggers/curp-b.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids
    $$,
    'P0001',
    'This worker document type allows only one active file for the selected scope',
    'duplicate single-file document for same worker/type/scope is rejected'
);

SELECT lives_ok(
    $$
    INSERT INTO public.worker_documents (
        worker_id,
        document_type_id,
        semester_id,
        file_name,
        storage_path,
        mime_type,
        file_size
    )
    SELECT
        worker_id,
        evidence_type_id,
        semester_id,
        'evidence-a.pdf',
        'triggers/evidence-a.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids;

    INSERT INTO public.worker_documents (
        worker_id,
        document_type_id,
        semester_id,
        file_name,
        storage_path,
        mime_type,
        file_size
    )
    SELECT
        worker_id,
        evidence_type_id,
        semester_id,
        'evidence-b.pdf',
        'triggers/evidence-b.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids;
    $$,
    'multiple Evidencias documents for same worker/type/scope are allowed'
);

SELECT lives_ok(
    $$
    DELETE FROM public.worker_documents
    WHERE storage_path = 'triggers/curp-a.pdf';

    INSERT INTO public.worker_documents (
        worker_id,
        document_type_id,
        semester_id,
        file_name,
        storage_path,
        mime_type,
        file_size
    )
    SELECT
        worker_id,
        permanent_type_id,
        NULL,
        'curp-replacement.pdf',
        'triggers/curp-replacement.pdf',
        'application/pdf',
        100
    FROM worker_documents_trigger_ids
    $$,
    'delete-old-row-then-insert-new replacement pattern succeeds'
);

SELECT throws_ok(
    $$
    INSERT INTO public.worker_documents (
        worker_id,
        document_type_id,
        semester_id,
        file_name,
        storage_path,
        mime_type,
        file_size
    )
    SELECT
        worker_id,
        evidence_type_id,
        semester_id,
        'empty.pdf',
        'triggers/empty.pdf',
        'application/pdf',
        0
    FROM worker_documents_trigger_ids
    $$,
    '23514',
    'new row for relation "worker_documents" violates check constraint "worker_documents_file_size_check"',
    'file_size = 0 is rejected'
);

SELECT throws_ok(
    $$
    INSERT INTO public.worker_documents (
        worker_id,
        document_type_id,
        semester_id,
        file_name,
        storage_path,
        mime_type,
        file_size
    )
    SELECT
        worker_id,
        evidence_type_id,
        semester_id,
        'too-large.pdf',
        'triggers/too-large.pdf',
        'application/pdf',
        10485761
    FROM worker_documents_trigger_ids
    $$,
    '23514',
    'new row for relation "worker_documents" violates check constraint "worker_documents_file_size_check"',
    'file_size > 10485760 is rejected'
);

SELECT * FROM finish();

ROLLBACK;
