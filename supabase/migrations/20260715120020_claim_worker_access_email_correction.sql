-- Trusted-input claim RPC for add-worker-access-email-correction
-- (design.md §6). Accepts only worker_id and the raw requested email --
-- every other value (linked profile, linked Auth user id, canonical form
-- of the requested email, the worker's raw email) is resolved server-side.
--
-- Service-role-only (design.md §4): no internal current_app_role() check
-- -- auth.uid() would resolve to NULL under the service-role connection
-- this function is exclusively reached through, so the real authorization
-- boundary is the calling Edge Function's own admin check, performed
-- before this RPC is ever invoked.
CREATE OR REPLACE FUNCTION "public"."claim_worker_access_email_correction"(
    "worker_id" bigint,
    "requested_email" text
)
RETURNS TABLE("operation_id" bigint, "outcome" text, "reason_code" text)
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    v_canonical_email text;
    v_worker_email text;
    v_profile_role text;
    v_linked_auth_user_id uuid;
    v_recheck_auth_user_id uuid;
    v_auth_exists boolean;
    v_duplicate_exists boolean;
    v_row_by_worker_id bigint;
    v_row_by_worker_state text;
    v_row_by_worker_target text;
    v_row_by_worker_auth uuid;
    v_row_by_auth_id bigint;
    v_row_by_auth_state text;
    v_row_by_auth_target text;
    v_row_by_auth_worker bigint;
    v_new_id bigint;
    v_already_synced boolean;
    v_constraint_name text;
BEGIN
    -- Step 1: canonicalize; reject NULL/empty/whitespace-only/malformed
    -- before any lock or row access -- this is the one case handled by
    -- raising rather than returning a closed outcome.
    --
    -- Finding: a SQL NULL "requested_email" made every branch of the old
    -- single-line check (`v_canonical_email = '' OR v_canonical_email !~
    -- ...`) evaluate to NULL (never TRUE), and `IF NULL THEN` is treated as
    -- FALSE in plpgsql -- a NULL input silently bypassed this guard
    -- entirely and fell through to the NOT NULL/CHECK constraints on the
    -- table's own "requested_canonical_email" column, raising an
    -- unclassified constraint-violation error instead of the clean,
    -- documented `invalid_email` outcome. The explicit "IS NULL" branch
    -- below closes that gap; whitespace-only input canonicalizes to ''
    -- via trim() and is caught by the existing empty-string check.
    IF "claim_worker_access_email_correction"."requested_email" IS NULL THEN
        RAISE EXCEPTION 'The requested email is missing or malformed'
            USING ERRCODE = 'WAEC1';
    END IF;

    v_canonical_email := lower(trim("claim_worker_access_email_correction"."requested_email"));
    IF v_canonical_email = '' OR v_canonical_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
        RAISE EXCEPTION 'The requested email is missing or malformed'
            USING ERRCODE = 'WAEC1';
    END IF;

    -- Step 2: worker-identity lock, fixed order position 1 (design.md §7).
    PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:worker:' || "claim_worker_access_email_correction"."worker_id"::text, 0));

    -- Step 3: re-read the worker under the lock.
    SELECT "w"."email"::text INTO v_worker_email
    FROM "public"."workers" "w"
    WHERE "w"."id" = "claim_worker_access_email_correction"."worker_id";

    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::bigint, 'worker_not_found'::text, 'worker_not_found'::text;
        RETURN;
    END IF;

    -- Step 4: resolve the linked profile.
    SELECT "p"."id", "p"."role" INTO v_linked_auth_user_id, v_profile_role
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = "claim_worker_access_email_correction"."worker_id";

    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::bigint, 'worker_not_linked'::text, 'worker_not_linked'::text;
        RETURN;
    END IF;

    IF v_profile_role <> 'worker' THEN
        RETURN QUERY SELECT NULL::bigint, 'invalid_profile_role'::text, 'invalid_profile_role'::text;
        RETURN;
    END IF;

    -- Step 6: Auth-identity lock, fixed order position 2.
    PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:auth:' || v_linked_auth_user_id::text, 0));

    -- Step 7: re-verify the linkage now under both locks -- catches a race
    -- against an unrelated, non-lock-sharing RPC (link_worker_account /
    -- unlink_worker_account) between steps 4-5 and this point.
    SELECT "p"."id" INTO v_recheck_auth_user_id
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = "claim_worker_access_email_correction"."worker_id";

    IF v_recheck_auth_user_id IS DISTINCT FROM v_linked_auth_user_id THEN
        RETURN QUERY SELECT NULL::bigint, 'ambiguous_claim_state'::text, 'ambiguous_claim_state'::text;
        RETURN;
    END IF;

    -- Step 8: verify the linked Auth user actually exists, before any
    -- duplicate check or blocking-row search.
    SELECT EXISTS (SELECT 1 FROM "auth"."users" "u" WHERE "u"."id" = v_linked_auth_user_id) INTO v_auth_exists;
    IF NOT v_auth_exists THEN
        RETURN QUERY SELECT NULL::bigint, 'linked_auth_user_missing'::text, 'linked_auth_user_missing'::text;
        RETURN;
    END IF;

    -- Step 9: reject a duplicate worker email before creating any claim
    -- (the sync RPC re-performs this same check later, inside its own
    -- transaction, as defense-in-depth against a race with the eventual
    -- write -- this is not a special case unique to this function).
    SELECT EXISTS (
        SELECT 1 FROM "public"."workers" "w2"
        WHERE "w2"."id" <> "claim_worker_access_email_correction"."worker_id"
          AND "w2"."email" IS NOT NULL
          AND lower(trim("w2"."email"::text)) = v_canonical_email
    ) INTO v_duplicate_exists;

    IF v_duplicate_exists THEN
        RETURN QUERY SELECT NULL::bigint, 'duplicate_worker_email'::text, 'duplicate_worker_email'::text;
        RETURN;
    END IF;

    -- Step 10: search for a blocking row, independently, by worker_id and
    -- by linked_auth_user_id. FOR UPDATE since the "exactly one found"
    -- branch below may need to transition that row in place.
    SELECT "c"."id", "c"."state", "c"."requested_canonical_email", "c"."linked_auth_user_id"
        INTO v_row_by_worker_id, v_row_by_worker_state, v_row_by_worker_target, v_row_by_worker_auth
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."worker_id" = "claim_worker_access_email_correction"."worker_id"
      AND "c"."state" IN ('active', 'manual_attention_required')
    ORDER BY "c"."id"
    FOR UPDATE
    LIMIT 1;

    SELECT "c"."id", "c"."state", "c"."requested_canonical_email", "c"."worker_id"
        INTO v_row_by_auth_id, v_row_by_auth_state, v_row_by_auth_target, v_row_by_auth_worker
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."linked_auth_user_id" = v_linked_auth_user_id
      AND "c"."state" IN ('active', 'manual_attention_required')
    ORDER BY "c"."id"
    FOR UPDATE
    LIMIT 1;

    -- Step 11: reconcile -- never attempting an insert where a blocking
    -- row already exists for either identity.
    IF v_row_by_worker_id IS NULL AND v_row_by_auth_id IS NULL THEN
        -- Nothing found: fall through to step 12, the only path that inserts.
        NULL;
    ELSIF v_row_by_worker_id IS NOT NULL AND v_row_by_auth_id IS NOT NULL AND v_row_by_worker_id = v_row_by_auth_id THEN
        -- Same row found both ways: the normal, consistent case.
        IF v_row_by_worker_state = 'manual_attention_required' THEN
            RETURN QUERY SELECT v_row_by_worker_id, 'manual_attention_blocking'::text, 'manual_attention_blocking'::text;
            RETURN;
        ELSIF v_row_by_worker_target = v_canonical_email THEN
            RETURN QUERY SELECT v_row_by_worker_id, 'resumed'::text, NULL::text;
            RETURN;
        ELSE
            RETURN QUERY SELECT v_row_by_worker_id, 'different_target_in_progress'::text, 'different_target_in_progress'::text;
            RETURN;
        END IF;
    ELSIF v_row_by_worker_id IS NOT NULL AND v_row_by_auth_id IS NOT NULL AND v_row_by_worker_id <> v_row_by_auth_id THEN
        -- Two distinct blocking rows: an invariant-broken state. Touch neither.
        RETURN QUERY SELECT NULL::bigint, 'ambiguous_claim_state'::text, 'ambiguous_claim_state'::text;
        RETURN;
    ELSE
        -- Exactly one search found a row: its recorded identity has
        -- drifted since it was created. Transition it in place -- never
        -- insert a second row.
        IF v_row_by_worker_id IS NOT NULL THEN
            IF v_row_by_worker_state = 'active' THEN
                UPDATE "public"."worker_access_email_corrections"
                SET "state" = 'manual_attention_required', "last_reason_code" = 'ambiguous_claim_state', "updated_at" = now()
                WHERE "id" = v_row_by_worker_id;
            END IF;
            RETURN QUERY SELECT v_row_by_worker_id, 'ambiguous_claim_state'::text, 'ambiguous_claim_state'::text;
            RETURN;
        ELSE
            IF v_row_by_auth_state = 'active' THEN
                UPDATE "public"."worker_access_email_corrections"
                SET "state" = 'manual_attention_required', "last_reason_code" = 'ambiguous_claim_state', "updated_at" = now()
                WHERE "id" = v_row_by_auth_id;
            END IF;
            RETURN QUERY SELECT v_row_by_auth_id, 'ambiguous_claim_state'::text, 'ambiguous_claim_state'::text;
            RETURN;
        END IF;
    END IF;

    -- Step 12: only reached when step 11 found no blocking row at all.
    -- Check for instant convergence (both sides already at the target).
    SELECT EXISTS (
        SELECT 1 FROM "auth"."users" "u"
        WHERE "u"."id" = v_linked_auth_user_id
          AND lower(trim("u"."email")) = v_canonical_email
    ) INTO v_already_synced;

    IF v_already_synced AND v_worker_email IS NOT NULL AND lower(trim(v_worker_email)) = v_canonical_email THEN
        BEGIN
            INSERT INTO "public"."worker_access_email_corrections"
                ("worker_id", "linked_auth_user_id", "requested_canonical_email", "raw_expected_worker_email", "state", "last_reason_code")
            VALUES
                ("claim_worker_access_email_correction"."worker_id", v_linked_auth_user_id, v_canonical_email, v_worker_email, 'completed', 'already_synchronized')
            RETURNING "id" INTO v_new_id;

            RETURN QUERY SELECT v_new_id, 'already_completed'::text, 'already_synchronized'::text;
            RETURN;
        EXCEPTION WHEN unique_violation THEN
            GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
            IF v_constraint_name NOT IN ('worker_access_email_corrections_blocking_worker_key', 'worker_access_email_corrections_blocking_auth_key') THEN
                RAISE;
            END IF;
            -- A confirmed partial-index race: fall through to step 13.
        END;
    ELSE
        BEGIN
            INSERT INTO "public"."worker_access_email_corrections"
                ("worker_id", "linked_auth_user_id", "requested_canonical_email", "raw_expected_worker_email", "state")
            VALUES
                ("claim_worker_access_email_correction"."worker_id", v_linked_auth_user_id, v_canonical_email, v_worker_email, 'active')
            RETURNING "id" INTO v_new_id;

            RETURN QUERY SELECT v_new_id, 'created'::text, NULL::text;
            RETURN;
        EXCEPTION WHEN unique_violation THEN
            GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
            IF v_constraint_name NOT IN ('worker_access_email_corrections_blocking_worker_key', 'worker_access_email_corrections_blocking_auth_key') THEN
                RAISE;
            END IF;
            -- A confirmed partial-index race: fall through to step 13.
        END;
    END IF;

    -- Step 13: a confirmed partial-index race occurred (a concurrent
    -- caller committed between step 10's read and this attempt's insert).
    -- Re-run the step 10-11 reconciliation; the concurrent row now exists.
    SELECT "c"."id", "c"."state", "c"."requested_canonical_email", "c"."linked_auth_user_id"
        INTO v_row_by_worker_id, v_row_by_worker_state, v_row_by_worker_target, v_row_by_worker_auth
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."worker_id" = "claim_worker_access_email_correction"."worker_id"
      AND "c"."state" IN ('active', 'manual_attention_required')
    ORDER BY "c"."id"
    LIMIT 1;

    SELECT "c"."id", "c"."state", "c"."requested_canonical_email", "c"."worker_id"
        INTO v_row_by_auth_id, v_row_by_auth_state, v_row_by_auth_target, v_row_by_auth_worker
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."linked_auth_user_id" = v_linked_auth_user_id
      AND "c"."state" IN ('active', 'manual_attention_required')
    ORDER BY "c"."id"
    LIMIT 1;

    IF v_row_by_worker_id IS NOT NULL AND v_row_by_auth_id IS NOT NULL AND v_row_by_worker_id = v_row_by_auth_id THEN
        IF v_row_by_worker_state = 'manual_attention_required' THEN
            RETURN QUERY SELECT v_row_by_worker_id, 'manual_attention_blocking'::text, 'manual_attention_blocking'::text;
        ELSIF v_row_by_worker_target = v_canonical_email THEN
            RETURN QUERY SELECT v_row_by_worker_id, 'resumed'::text, NULL::text;
        ELSE
            RETURN QUERY SELECT v_row_by_worker_id, 'different_target_in_progress'::text, 'different_target_in_progress'::text;
        END IF;
    ELSE
        -- Should not normally occur (the race was specifically an insert
        -- conflict on one of these two indexes), handled defensively.
        RETURN QUERY SELECT NULL::bigint, 'ambiguous_claim_state'::text, 'ambiguous_claim_state'::text;
    END IF;
    RETURN;
END;
$$;

ALTER FUNCTION "public"."claim_worker_access_email_correction"(bigint, text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."claim_worker_access_email_correction"(bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."claim_worker_access_email_correction"(bigint, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."claim_worker_access_email_correction"(bigint, text) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."claim_worker_access_email_correction"(bigint, text) TO "service_role";
