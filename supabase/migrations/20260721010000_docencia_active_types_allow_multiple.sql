DO $$
DECLARE
    v_docencia_id bigint;
    v_expected_active_types text[] := ARRAY[
        'Planeación semestral',
        'Rúbricas',
        'Listas de cotejo',
        'Evidencias bimestrales',
        'Listas de asistencia',
        'Actas de evaluación',
        'Concentrado de calificaciones finales'
    ];
    v_found_active_types text[];
    v_missing_types text[];
    v_unexpected_types text[];
    v_updated_count int;
BEGIN
    SELECT "id" INTO v_docencia_id
    FROM "public"."worker_document_categories"
    WHERE "name" = 'Docencia';

    IF v_docencia_id IS NULL THEN
        RAISE EXCEPTION 'Docencia category not found; refusing to apply the Docencia allows_multiple migration';
    END IF;

    -- Precondition: the set of currently-active Docencia types matches
    -- exactly what this migration expects (7 types, listed by name). Fails
    -- loudly on ANY drift since the retirement/rename migration
    -- (20260716013947_retire_and_rename_docencia_document_types.sql) -- a
    -- renamed, added, removed, retired, or reactivated type -- instead of
    -- silently updating the wrong set of rows.
    SELECT array_agg("name" ORDER BY "name")
    INTO v_found_active_types
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_docencia_id AND "is_active" = true;

    SELECT array_agg(expected_type)
    INTO v_missing_types
    FROM unnest(v_expected_active_types) AS expected_type
    WHERE expected_type <> ALL (COALESCE(v_found_active_types, ARRAY[]::text[]));

    SELECT array_agg(found_type)
    INTO v_unexpected_types
    FROM unnest(COALESCE(v_found_active_types, ARRAY[]::text[])) AS found_type
    WHERE found_type <> ALL (v_expected_active_types);

    IF v_missing_types IS NOT NULL OR v_unexpected_types IS NOT NULL THEN
        RAISE EXCEPTION 'Docencia active-type catalog drift detected -- missing: %, unexpected: %; refusing to proceed', COALESCE(v_missing_types, ARRAY[]::text[]), COALESCE(v_unexpected_types, ARRAY[]::text[]);
    END IF;

    -- Effect: only active Docencia types, only the ones not already
    -- allowing multiple files -- "Evidencias bimestrales" is already true
    -- and is excluded by the WHERE clause, not re-updated. This is NOT the
    -- same as the migration being safe to re-run: the postcondition below
    -- requires exactly 6 rows to have been updated by THIS statement, so a
    -- second run against an already-migrated catalog (where this WHERE
    -- clause now matches zero rows) fails closed on that exact-count check
    -- rather than silently succeeding as a no-op. That is intentional --
    -- this migration guarantees a specific state transition (6 rows flip
    -- from false to true) happened, once, not merely that the end state is
    -- reached however it got there. Scoped by category_id resolved from the
    -- unique category name above, so it is structurally impossible for this
    -- UPDATE to touch any other category (worker_document_categories.name
    -- is UNIQUE) -- unlike the retirement/rename migration, this doesn't
    -- need a snapshot-diff postcondition for "other categories are
    -- untouched", it is guaranteed by construction rather than verified at
    -- runtime.
    UPDATE "public"."worker_document_types"
    SET "allows_multiple" = true
    WHERE "category_id" = v_docencia_id
        AND "is_active" = true
        AND "allows_multiple" = false;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    IF v_updated_count <> 6 THEN
        RAISE EXCEPTION 'Expected to update exactly 6 Docencia document types to allows_multiple = true, updated %; refusing to proceed', v_updated_count;
    END IF;

    -- Postcondition: every active Docencia type now allows multiple files.
    IF EXISTS (
        SELECT 1 FROM "public"."worker_document_types"
        WHERE "category_id" = v_docencia_id AND "is_active" = true AND "allows_multiple" = false
    ) THEN
        RAISE EXCEPTION 'Postcondition failed: an active Docencia document type still has allows_multiple = false; refusing to proceed';
    END IF;

    -- Postcondition: the two retired Docencia types were never touched by
    -- this migration (it only ever targets is_active = true rows).
    IF (
        SELECT count(*) FROM "public"."worker_document_types"
        WHERE "category_id" = v_docencia_id
            AND "is_active" = false
            AND "name" IN ('Plan de trabajo semestral', 'Planeaciones semanales')
            AND "allows_multiple" = false
    ) <> 2 THEN
        RAISE EXCEPTION 'Postcondition failed: expected exactly 2 retired Docencia document types (Plan de trabajo semestral, Planeaciones semanales) unchanged at allows_multiple = false; refusing to proceed';
    END IF;
END;
$$;
