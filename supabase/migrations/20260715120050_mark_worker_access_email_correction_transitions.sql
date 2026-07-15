-- Guarded operation-transition RPCs for add-worker-access-email-correction
-- (design.md §9). No RPC or grant permits a direct, unguarded
-- UPDATE/INSERT/DELETE against worker_access_email_corrections from any
-- role other than service_role acting through claim/sync/one of these two
-- transition functions.

-- mark_worker_access_email_correction_completed: may transition
-- active -> completed only when a fresh, independent, direct-SQL re-check
-- proves both workers.email and auth.users.email already canonically
-- equal the operation's requested target -- never trusting a
-- caller-asserted "it worked".
CREATE OR REPLACE FUNCTION "public"."mark_worker_access_email_correction_completed"("p_operation_id" bigint)
RETURNS boolean
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    v_state text;
    v_worker_id bigint;
    v_linked_auth_user_id uuid;
    v_requested_canonical_email text;
    v_current_linked_auth_user_id uuid;
    v_auth_exists boolean;
    v_worker_matches boolean;
    v_auth_matches boolean;
BEGIN
    -- Step 1: load the operation; raise for a missing/invalid id; refuse
    -- outright for a non-active operation.
    SELECT "c"."state", "c"."worker_id", "c"."linked_auth_user_id", "c"."requested_canonical_email"
        INTO v_state, v_worker_id, v_linked_auth_user_id, v_requested_canonical_email
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."id" = "mark_worker_access_email_correction_completed"."p_operation_id";

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No such worker access email correction operation: %', "mark_worker_access_email_correction_completed"."p_operation_id"
            USING ERRCODE = 'WAEC2';
    END IF;

    IF v_state <> 'active' THEN
        RETURN false;
    END IF;

    -- Steps 2-4: worker lock, re-read linkage, verify it still matches.
    PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:worker:' || v_worker_id::text, 0));

    SELECT "p"."id" INTO v_current_linked_auth_user_id
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = v_worker_id;

    IF NOT FOUND OR v_current_linked_auth_user_id IS DISTINCT FROM v_linked_auth_user_id THEN
        RETURN false;
    END IF;

    -- Steps 5-6: Auth lock, re-verify under both locks.
    PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:auth:' || v_linked_auth_user_id::text, 0));

    SELECT "c"."state" INTO v_state
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."id" = "mark_worker_access_email_correction_completed"."p_operation_id";

    IF v_state <> 'active' THEN
        RETURN false;
    END IF;

    SELECT "p"."id" INTO v_current_linked_auth_user_id
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = v_worker_id;

    IF NOT FOUND OR v_current_linked_auth_user_id IS DISTINCT FROM v_linked_auth_user_id THEN
        RETURN false;
    END IF;

    SELECT EXISTS (SELECT 1 FROM "auth"."users" "u" WHERE "u"."id" = v_linked_auth_user_id) INTO v_auth_exists;
    IF NOT v_auth_exists THEN
        RETURN false;
    END IF;

    -- Step 7 (this function's own effect): independently re-verify
    -- convergence via direct SQL.
    SELECT EXISTS (
        SELECT 1 FROM "public"."workers" "w"
        WHERE "w"."id" = v_worker_id
          AND "w"."email" IS NOT NULL
          AND lower(trim("w"."email"::text)) = v_requested_canonical_email
    ) INTO v_worker_matches;

    SELECT EXISTS (
        SELECT 1 FROM "auth"."users" "u"
        WHERE "u"."id" = v_linked_auth_user_id
          AND lower(trim("u"."email")) = v_requested_canonical_email
    ) INTO v_auth_matches;

    IF v_worker_matches AND v_auth_matches THEN
        UPDATE "public"."worker_access_email_corrections"
        SET "state" = 'completed', "last_reason_code" = 'updated', "updated_at" = now()
        WHERE "id" = "mark_worker_access_email_correction_completed"."p_operation_id";
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

ALTER FUNCTION "public"."mark_worker_access_email_correction_completed"(bigint) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."mark_worker_access_email_correction_completed"(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."mark_worker_access_email_correction_completed"(bigint) FROM "anon";
REVOKE ALL ON FUNCTION "public"."mark_worker_access_email_correction_completed"(bigint) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."mark_worker_access_email_correction_completed"(bigint) TO "service_role";

-- mark_worker_access_email_correction_manual_attention: may transition
-- active -> manual_attention_required only for a narrow, explicit set of
-- reasons. Deliberately does NOT REFUSE merely because the linkage has
-- drifted from the operation's stored identity -- that mismatch is
-- frequently the exact reason this transition is being requested at all
-- (e.g. linkage_changed, ambiguous_claim_state); it still acquires both
-- locks, in the fixed order, using the operation's own recorded identity,
-- consistent with every other function in this change.
--
-- Code-review finding #7 hardening: this function now ALSO re-reads
-- worker/profile linkage under both locks (never pretending linkage
-- still matches when it plainly does not) and, for the specific reasons
-- whose entire premise is an independently-checkable structural
-- condition (`linkage_changed`, `operation_identity_mismatch`,
-- `external_auth_email_changed` -- code-review finding #2), verifies the
-- claimed condition genuinely holds before transitioning, raising WAEC9
-- if a caller's claimed reason contradicts what a direct re-check shows.
-- The remaining reasons (`ambiguous_claim_state`, `duplicate_worker_email`,
-- `auth_update_uncertain`, `worker_sync_uncertain`) describe conditions
-- this RPC has no independent way to re-derive and remain trust-based, as
-- before.
CREATE OR REPLACE FUNCTION "public"."mark_worker_access_email_correction_manual_attention"(
    "p_operation_id" bigint,
    "p_reason_code" text
)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    v_state text;
    v_worker_id bigint;
    v_linked_auth_user_id uuid;
    v_requested_canonical_email text;
    v_current_linked_auth_user_id uuid;
    v_linkage_matches boolean;
    v_auth_exists boolean;
    v_current_auth_email text;
BEGIN
    IF "mark_worker_access_email_correction_manual_attention"."p_reason_code" NOT IN (
        'ambiguous_claim_state',
        'duplicate_worker_email',
        'linkage_changed',
        'operation_identity_mismatch',
        'external_auth_email_changed',
        'auth_update_uncertain',
        'worker_sync_uncertain'
    ) THEN
        RAISE EXCEPTION 'Invalid manual-attention reason code: %', "mark_worker_access_email_correction_manual_attention"."p_reason_code"
            USING ERRCODE = 'WAEC3';
    END IF;

    -- Step 1: load the operation; raise for a missing/invalid id; refuse
    -- outright for a non-active operation (including one already
    -- manual_attention_required -- no path re-transitions it).
    SELECT "c"."state", "c"."worker_id", "c"."linked_auth_user_id", "c"."requested_canonical_email"
        INTO v_state, v_worker_id, v_linked_auth_user_id, v_requested_canonical_email
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."id" = "mark_worker_access_email_correction_manual_attention"."p_operation_id";

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No such worker access email correction operation: %', "mark_worker_access_email_correction_manual_attention"."p_operation_id"
            USING ERRCODE = 'WAEC2';
    END IF;

    IF v_state <> 'active' THEN
        RETURN;
    END IF;

    -- Step 2: worker lock, fixed order position 1.
    PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:worker:' || v_worker_id::text, 0));

    -- Step 3: re-read exact worker/profile linkage, under the worker lock.
    SELECT "p"."id" INTO v_current_linked_auth_user_id
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = v_worker_id;

    -- Step 4: the recorded Auth identity lock, fixed order position 2.
    PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:auth:' || v_linked_auth_user_id::text, 0));

    -- Step 5 (re-verify under both locks): only the operation's active
    -- state is grounds to refuse outright -- a linkage mismatch is not
    -- itself grounds to refuse this specific transition. Re-reads
    -- linkage again here (under the fuller lock guarantee) so the
    -- observed-mismatch checks below use the freshest possible read.
    SELECT "c"."state" INTO v_state
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."id" = "mark_worker_access_email_correction_manual_attention"."p_operation_id";

    IF v_state <> 'active' THEN
        RETURN;
    END IF;

    SELECT "p"."id" INTO v_current_linked_auth_user_id
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = v_worker_id;

    v_linkage_matches := FOUND AND v_current_linked_auth_user_id IS NOT DISTINCT FROM v_linked_auth_user_id;

    -- Step 6: verify the Auth row, where required by the claimed reason.
    SELECT EXISTS (SELECT 1 FROM "auth"."users" "u" WHERE "u"."id" = v_linked_auth_user_id) INTO v_auth_exists;

    -- Establish the observed mismatch for reasons whose entire premise is
    -- a specific, independently-checkable structural condition -- never
    -- accept a claimed condition this RPC can directly disprove.
    IF "mark_worker_access_email_correction_manual_attention"."p_reason_code" = 'linkage_changed' THEN
        IF v_linkage_matches THEN
            RAISE EXCEPTION 'linkage_changed was claimed for operation % but the profile''s linked Auth user still matches its recorded identity', "mark_worker_access_email_correction_manual_attention"."p_operation_id"
                USING ERRCODE = 'WAEC9';
        END IF;
    ELSIF "mark_worker_access_email_correction_manual_attention"."p_reason_code" = 'operation_identity_mismatch' THEN
        IF v_linkage_matches AND v_auth_exists THEN
            RAISE EXCEPTION 'operation_identity_mismatch was claimed for operation % but its recorded identity is still fully consistent', "mark_worker_access_email_correction_manual_attention"."p_operation_id"
                USING ERRCODE = 'WAEC9';
        END IF;
    ELSIF "mark_worker_access_email_correction_manual_attention"."p_reason_code" = 'external_auth_email_changed' THEN
        IF v_auth_exists THEN
            SELECT "u"."email" INTO v_current_auth_email FROM "auth"."users" "u" WHERE "u"."id" = v_linked_auth_user_id;
            IF lower(trim(v_current_auth_email)) = v_requested_canonical_email THEN
                RAISE EXCEPTION 'external_auth_email_changed was claimed for operation % but the linked Auth user''s current email already equals the requested target', "mark_worker_access_email_correction_manual_attention"."p_operation_id"
                    USING ERRCODE = 'WAEC9';
            END IF;
        END IF;
    END IF;

    -- Step 7 (this function's own effect).
    UPDATE "public"."worker_access_email_corrections"
    SET "state" = 'manual_attention_required',
        "last_reason_code" = "mark_worker_access_email_correction_manual_attention"."p_reason_code",
        "updated_at" = now()
    WHERE "id" = "mark_worker_access_email_correction_manual_attention"."p_operation_id";
END;
$$;

ALTER FUNCTION "public"."mark_worker_access_email_correction_manual_attention"(bigint, text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."mark_worker_access_email_correction_manual_attention"(bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."mark_worker_access_email_correction_manual_attention"(bigint, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."mark_worker_access_email_correction_manual_attention"(bigint, text) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."mark_worker_access_email_correction_manual_attention"(bigint, text) TO "service_role";
