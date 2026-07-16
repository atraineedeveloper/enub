DO $$
DECLARE
    v_docencia_id bigint;
    v_plan_trabajo_id bigint;
    v_planeaciones_id bigint;
    v_evidencias_id bigint;
    v_evidencias_bimestrales_id bigint;
    v_final_row_id bigint;
    v_final_is_active boolean;
    v_final_allows_multiple boolean;
    v_final_sort_order int;
    v_plan_trabajo_inactive_count int;
    v_planeaciones_inactive_count int;
BEGIN
    SELECT "id" INTO v_docencia_id
    FROM "public"."worker_document_categories"
    WHERE "name" = 'Docencia';

    IF v_docencia_id IS NULL THEN
        RAISE EXCEPTION 'Docencia category not found; refusing to apply the worker_document_types retirement/rename migration';
    END IF;

    -- Retire "Plan de trabajo semestral". The shared lifecycle advisory
    -- lock (same namespace/construction used by
    -- enforce_active_worker_document_type and
    -- replace_worker_document_metadata) is acquired before the mutation,
    -- so this UPDATE serializes against a concurrent replacement/upload
    -- attempt against this same type rather than racing it. It is a
    -- transaction-level lock, released automatically when this migration's
    -- transaction commits.
    SELECT "id" INTO v_plan_trabajo_id
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_docencia_id AND "name" = 'Plan de trabajo semestral';

    IF v_plan_trabajo_id IS NULL THEN
        RAISE EXCEPTION 'Docencia / Plan de trabajo semestral not found; refusing to proceed (unexpected catalog state)';
    END IF;

    PERFORM "pg_advisory_xact_lock"(
        "hashtextextended"('worker_document_type:lifecycle:' || v_plan_trabajo_id::text, 0)
    );

    UPDATE "public"."worker_document_types"
    SET "is_active" = false
    WHERE "id" = v_plan_trabajo_id;

    -- Retire "Planeaciones semanales", identical pattern.
    SELECT "id" INTO v_planeaciones_id
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_docencia_id AND "name" = 'Planeaciones semanales';

    IF v_planeaciones_id IS NULL THEN
        RAISE EXCEPTION 'Docencia / Planeaciones semanales not found; refusing to proceed (unexpected catalog state)';
    END IF;

    PERFORM "pg_advisory_xact_lock"(
        "hashtextextended"('worker_document_type:lifecycle:' || v_planeaciones_id::text, 0)
    );

    UPDATE "public"."worker_document_types"
    SET "is_active" = false
    WHERE "id" = v_planeaciones_id;

    -- Rename "Evidencias" -> "Evidencias bimestrales". Explicitly inspect
    -- both possible names under Docencia before attempting anything, and
    -- diagnose all four possible pre-migration states with a controlled
    -- message -- never relying on the UNIQUE(category_id, name)
    -- constraint's own unique_violation to catch the "both names exist"
    -- case, which would be an opaque, un-actionable failure for an
    -- operator to interpret.
    SELECT "id" INTO v_evidencias_id
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_docencia_id AND "name" = 'Evidencias';

    SELECT "id" INTO v_evidencias_bimestrales_id
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_docencia_id AND "name" = 'Evidencias bimestrales';

    IF v_evidencias_id IS NOT NULL AND v_evidencias_bimestrales_id IS NOT NULL THEN
        RAISE EXCEPTION 'Both "Evidencias" (id %) and "Evidencias bimestrales" (id %) exist under Docencia; refusing to proceed -- ambiguous catalog state requires manual review before this migration can run', v_evidencias_id, v_evidencias_bimestrales_id;
    END IF;

    IF v_evidencias_id IS NULL AND v_evidencias_bimestrales_id IS NULL THEN
        RAISE EXCEPTION 'Neither "Evidencias" nor "Evidencias bimestrales" exists under Docencia; refusing to proceed -- unexpected catalog state';
    END IF;

    IF v_evidencias_id IS NOT NULL THEN
        -- First application: only "Evidencias" exists. Rename it in place
        -- (an UPDATE, never a delete+insert), preserving its id,
        -- allows_multiple, sort_order, and category_id untouched.
        PERFORM "pg_advisory_xact_lock"(
            "hashtextextended"('worker_document_type:lifecycle:' || v_evidencias_id::text, 0)
        );

        UPDATE "public"."worker_document_types"
        SET "name" = 'Evidencias bimestrales'
        WHERE "id" = v_evidencias_id;

        v_final_row_id := v_evidencias_id;
    ELSE
        -- Idempotent re-run: only "Evidencias bimestrales" already exists.
        -- Nothing left to rename; the lock is still acquired for
        -- consistency with every other path, and the post-condition below
        -- verifies the final state directly regardless of which path ran.
        PERFORM "pg_advisory_xact_lock"(
            "hashtextextended"('worker_document_type:lifecycle:' || v_evidencias_bimestrales_id::text, 0)
        );

        v_final_row_id := v_evidencias_bimestrales_id;
    END IF;

    -- Post-condition: verify the renamed row's full expected state, not
    -- merely a name count -- is_active, allows_multiple, and sort_order
    -- must all match what "Evidencias" had before this migration.
    SELECT "is_active", "allows_multiple", "sort_order"
    INTO v_final_is_active, v_final_allows_multiple, v_final_sort_order
    FROM "public"."worker_document_types"
    WHERE "id" = v_final_row_id;

    IF v_final_is_active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Docencia / Evidencias bimestrales (id %) has is_active = %, expected true; refusing to proceed', v_final_row_id, v_final_is_active;
    END IF;

    IF v_final_allows_multiple IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'Docencia / Evidencias bimestrales (id %) has allows_multiple = %, expected true; refusing to proceed', v_final_row_id, v_final_allows_multiple;
    END IF;

    IF v_final_sort_order IS DISTINCT FROM 60 THEN
        RAISE EXCEPTION 'Docencia / Evidencias bimestrales (id %) has sort_order = %, expected 60; refusing to proceed', v_final_row_id, v_final_sort_order;
    END IF;

    IF EXISTS (
        SELECT 1 FROM "public"."worker_document_types"
        WHERE "category_id" = v_docencia_id AND "name" = 'Evidencias'
    ) THEN
        RAISE EXCEPTION 'A Docencia document type still named "Evidencias" exists after the rename step; refusing to proceed (ambiguous or inconsistent catalog state)';
    END IF;

    IF (
        SELECT count(*) FROM "public"."worker_document_types"
        WHERE "category_id" = v_docencia_id AND "name" = 'Evidencias bimestrales'
    ) <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one Docencia document type named "Evidencias bimestrales"; refusing to proceed';
    END IF;

    SELECT count(*) INTO v_plan_trabajo_inactive_count
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_docencia_id AND "name" = 'Plan de trabajo semestral' AND "is_active" = false;

    IF v_plan_trabajo_inactive_count <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one inactive Docencia document type named "Plan de trabajo semestral", found %; refusing to proceed', v_plan_trabajo_inactive_count;
    END IF;

    SELECT count(*) INTO v_planeaciones_inactive_count
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_docencia_id AND "name" = 'Planeaciones semanales' AND "is_active" = false;

    IF v_planeaciones_inactive_count <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one inactive Docencia document type named "Planeaciones semanales", found %; refusing to proceed', v_planeaciones_inactive_count;
    END IF;
END;
$$;
