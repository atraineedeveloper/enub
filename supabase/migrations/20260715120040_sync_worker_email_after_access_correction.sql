-- Worker-email synchronization RPC for add-worker-access-email-correction
-- (design.md §9). Bound only to operation_id -- no worker id, Auth id,
-- expected email, or requested email parameter; every other value is
-- loaded from the operation's own durable record.
CREATE OR REPLACE FUNCTION "public"."sync_worker_email_after_access_correction"("operation_id" bigint)
RETURNS text
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    v_state text;
    v_worker_id bigint;
    v_linked_auth_user_id uuid;
    v_requested_canonical_email text;
    v_raw_expected_worker_email text;
    v_current_linked_auth_user_id uuid;
    v_auth_exists boolean;
    v_duplicate_exists boolean;
    v_worker_exists boolean;
    v_rows_updated int;
BEGIN
    -- Step 1: load the operation; raise for a missing/invalid id (an
    -- Edge-Function-internal defensive backstop); reject a non-active
    -- operation outright.
    SELECT "c"."state", "c"."worker_id", "c"."linked_auth_user_id", "c"."requested_canonical_email", "c"."raw_expected_worker_email"
        INTO v_state, v_worker_id, v_linked_auth_user_id, v_requested_canonical_email, v_raw_expected_worker_email
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."id" = "sync_worker_email_after_access_correction"."operation_id";

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No such worker access email correction operation: %', "sync_worker_email_after_access_correction"."operation_id"
            USING ERRCODE = 'WAEC2';
    END IF;

    IF v_state <> 'active' THEN
        RETURN 'operation_not_active';
    END IF;

    -- Step 2: worker-identity lock, fixed order position 1.
    PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:worker:' || v_worker_id::text, 0));

    -- Step 3/4: re-read the worker's linked profile; verify it still
    -- matches the operation's own stored identity.
    SELECT "p"."id" INTO v_current_linked_auth_user_id
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = v_worker_id;

    IF NOT FOUND OR v_current_linked_auth_user_id IS DISTINCT FROM v_linked_auth_user_id THEN
        RETURN 'linkage_changed';
    END IF;

    -- Step 5: Auth-identity lock, fixed order position 2.
    PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:auth:' || v_linked_auth_user_id::text, 0));

    -- Step 6: re-verify, now under both locks, that the operation is
    -- still active and the linkage still matches; and that the
    -- operation's own recorded identity is still internally consistent
    -- (the linked Auth user row genuinely still exists).
    SELECT "c"."state" INTO v_state
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."id" = "sync_worker_email_after_access_correction"."operation_id";

    IF v_state <> 'active' THEN
        RETURN 'operation_not_active';
    END IF;

    SELECT "p"."id" INTO v_current_linked_auth_user_id
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = v_worker_id;

    IF NOT FOUND OR v_current_linked_auth_user_id IS DISTINCT FROM v_linked_auth_user_id THEN
        RETURN 'linkage_changed';
    END IF;

    SELECT EXISTS (SELECT 1 FROM "auth"."users" "u" WHERE "u"."id" = v_linked_auth_user_id) INTO v_auth_exists;
    IF NOT v_auth_exists THEN
        RETURN 'operation_identity_mismatch';
    END IF;

    -- Step 7 (this function's own effect): recheck canonical duplicates
    -- inside this transaction.
    SELECT EXISTS (
        SELECT 1 FROM "public"."workers" "w2"
        WHERE "w2"."id" <> v_worker_id
          AND "w2"."email" IS NOT NULL
          AND lower(trim("w2"."email"::text)) = v_requested_canonical_email
    ) INTO v_duplicate_exists;

    IF v_duplicate_exists THEN
        RETURN 'duplicate_worker_email';
    END IF;

    -- Optimistic guard: compare against the operation's IMMUTABLE stored
    -- raw_expected_worker_email -- never refreshed or replaced by a later
    -- read, so a genuine concurrent ordinary edit is always detected.
    UPDATE "public"."workers"
    SET "email" = v_requested_canonical_email
    WHERE "id" = v_worker_id
      AND "email" IS NOT DISTINCT FROM v_raw_expected_worker_email;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 1 THEN
        RETURN 'updated';
    END IF;

    -- Zero rows updated: disambiguate why.
    SELECT EXISTS (SELECT 1 FROM "public"."workers" "w3" WHERE "w3"."id" = v_worker_id) INTO v_worker_exists;
    IF NOT v_worker_exists THEN
        RETURN 'worker_not_found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "public"."workers" "w4"
        WHERE "w4"."id" = v_worker_id
          AND "w4"."email" IS NOT NULL
          AND lower(trim("w4"."email"::text)) = v_requested_canonical_email
    ) THEN
        RETURN 'already_current';
    END IF;

    RETURN 'stale_worker_edit';
END;
$$;

ALTER FUNCTION "public"."sync_worker_email_after_access_correction"(bigint) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."sync_worker_email_after_access_correction"(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."sync_worker_email_after_access_correction"(bigint) FROM "anon";
REVOKE ALL ON FUNCTION "public"."sync_worker_email_after_access_correction"(bigint) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."sync_worker_email_after_access_correction"(bigint) TO "service_role";
