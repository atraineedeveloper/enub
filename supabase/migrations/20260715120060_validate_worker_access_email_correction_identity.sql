-- Server-only linkage/identity revalidation RPC (code-review finding #1,
-- add-worker-access-email-correction). Called by the Edge Function
-- immediately before every updateUserById call. The claim RPC's own
-- linkage checks happen once, at claim time; by the time the Edge
-- Function actually attempts to mutate Auth, the worker's linked profile
-- may have changed (relinked/unlinked via link_worker_account /
-- unlink_worker_account), or the recorded Auth user itself may no longer
-- exist. This RPC re-derives and re-verifies the operation's own recorded
-- identity fresh, under the same fixed lock order every other RPC in this
-- change uses, and returns a closed classification -- it never mutates
-- anything itself.
--
-- The six-value result maps to the numbered verification steps below:
-- `linkage_changed` is what step 4 (the first linkage check, under the
-- worker lock only) reports; `operation_identity_mismatch` is reserved
-- for a change detected only at step 6 (re-verification under BOTH
-- locks) -- i.e. one that happened in the narrow window between
-- acquiring each lock -- consistent with how every other RPC in this
-- change already uses that same name for that same kind of narrow-window
-- race. `linked_auth_user_missing` is step 7's Auth-row-itself-gone case.
--
-- Note this is a deliberate departure from how `operation_identity_mismatch`
-- is used by the pre-existing sync/completion RPCs (design.md §9), which
-- have only ONE linkage/Auth-existence check point and use that name for
-- "the Auth row is gone." This function has TWO distinct linkage-equality
-- check points (step 4, worker lock only; step 6, both locks) plus a
-- SEPARATE Auth-existence check (step 7) -- three distinct conditions,
-- three distinct names, chosen to match the six-value result set exactly
-- as specified. `operation_identity_mismatch` here specifically means "the
-- linkage passed step 4's check but failed the SAME check again under the
-- fuller two-lock guarantee" -- a narrow race-window condition that, by
-- construction, only a genuinely concurrent second session can trigger
-- (not reachable from a single deterministic pgTAP transaction); every
-- other one of the six values is deterministically reachable and tested.
CREATE OR REPLACE FUNCTION "public"."validate_worker_access_email_correction_identity"("p_operation_id" bigint)
RETURNS text
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    v_state text;
    v_worker_id bigint;
    v_linked_auth_user_id uuid;
    v_worker_exists boolean;
    v_current_linked_auth_user_id uuid;
    v_auth_exists boolean;
BEGIN
    -- Step 1: load the operation; raise for a missing/invalid id (an
    -- internal defensive backstop, consistent with every other RPC in
    -- this change).
    SELECT "c"."state", "c"."worker_id", "c"."linked_auth_user_id"
        INTO v_state, v_worker_id, v_linked_auth_user_id
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."id" = "validate_worker_access_email_correction_identity"."p_operation_id";

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No such worker access email correction operation: %', "validate_worker_access_email_correction_identity"."p_operation_id"
            USING ERRCODE = 'WAEC2';
    END IF;

    IF v_state <> 'active' THEN
        RETURN 'operation_not_active';
    END IF;

    -- Step 2: worker-identity lock, fixed order position 1.
    PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:worker:' || v_worker_id::text, 0));

    -- Step 3: re-read the worker and its exact linked profile.
    SELECT EXISTS (SELECT 1 FROM "public"."workers" "w" WHERE "w"."id" = v_worker_id) INTO v_worker_exists;
    IF NOT v_worker_exists THEN
        RETURN 'worker_not_found';
    END IF;

    SELECT "p"."id" INTO v_current_linked_auth_user_id
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = v_worker_id;

    -- Step 4: verify the current profile id equals the operation's own
    -- recorded linked Auth user id (a profile now absent entirely is
    -- treated the same as one pointing elsewhere -- both are "the
    -- worker's own linkage identity is no longer what this operation
    -- recorded").
    IF NOT FOUND OR v_current_linked_auth_user_id IS DISTINCT FROM v_linked_auth_user_id THEN
        RETURN 'linkage_changed';
    END IF;

    -- Step 5: the recorded Auth identity lock, fixed order position 2.
    PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:auth:' || v_linked_auth_user_id::text, 0));

    -- Step 6: re-verify the operation is still active and re-read linkage
    -- now under both locks.
    SELECT "c"."state" INTO v_state
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."id" = "validate_worker_access_email_correction_identity"."p_operation_id";

    IF v_state <> 'active' THEN
        RETURN 'operation_not_active';
    END IF;

    SELECT "p"."id" INTO v_current_linked_auth_user_id
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = v_worker_id;

    IF NOT FOUND OR v_current_linked_auth_user_id IS DISTINCT FROM v_linked_auth_user_id THEN
        RETURN 'operation_identity_mismatch';
    END IF;

    -- Step 7: verify the exact Auth row still exists.
    SELECT EXISTS (SELECT 1 FROM "auth"."users" "u" WHERE "u"."id" = v_linked_auth_user_id) INTO v_auth_exists;
    IF NOT v_auth_exists THEN
        RETURN 'linked_auth_user_missing';
    END IF;

    -- Step 8: everything checked out -- safe to proceed with an Auth mutation.
    RETURN 'valid';
END;
$$;

ALTER FUNCTION "public"."validate_worker_access_email_correction_identity"(bigint) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."validate_worker_access_email_correction_identity"(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."validate_worker_access_email_correction_identity"(bigint) FROM "anon";
REVOKE ALL ON FUNCTION "public"."validate_worker_access_email_correction_identity"(bigint) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."validate_worker_access_email_correction_identity"(bigint) TO "service_role";
