-- Server-only, operation-bound raw-Auth-email read (code-review finding
-- #9, add-worker-access-email-correction). Replaces the general-purpose
-- get_auth_user_email_by_id(uuid) for the correction flow's own reads:
-- rather than accepting an arbitrary Auth user id, this function accepts
-- only an operation_id and re-derives the linked Auth identity itself.
--
-- Used by update-worker-access-email for both the baseline read (at the
-- start of a reconciliation attempt) and the fresh, immediately-before-
-- the-write re-read the external-Auth-drift guard needs (finding #2) --
-- never adminClient.auth.admin.getUserById for pure comparison/reads
-- (design.md §2, unchanged).
--
-- This function is only ever called after
-- validate_worker_access_email_correction_identity has already confirmed
-- 'valid' for the same operation_id, but never trusts that alone: it
-- re-verifies the operation is blocking and the linkage still matches
-- before returning anything, raising a single stable error code (WAEC5)
-- if not -- a failure here after validate_identity already passed would
-- mean a genuine race in the narrow window between the two calls, which
-- the Edge Function treats conservatively (re-observe / uncertain),
-- never by silently returning a stale or wrong email.
CREATE OR REPLACE FUNCTION "public"."get_worker_access_email_correction_auth_email"("p_operation_id" bigint)
RETURNS text
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    v_state text;
    v_worker_id bigint;
    v_linked_auth_user_id uuid;
    v_current_linked_auth_user_id uuid;
    v_auth_email text;
BEGIN
    SELECT "c"."state", "c"."worker_id", "c"."linked_auth_user_id"
        INTO v_state, v_worker_id, v_linked_auth_user_id
    FROM "public"."worker_access_email_corrections" "c"
    WHERE "c"."id" = "get_worker_access_email_correction_auth_email"."p_operation_id";

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No such worker access email correction operation: %', "get_worker_access_email_correction_auth_email"."p_operation_id"
            USING ERRCODE = 'WAEC2';
    END IF;

    IF v_state NOT IN ('active', 'manual_attention_required') THEN
        RAISE EXCEPTION 'Worker access email correction operation % is not blocking (state: %)', "get_worker_access_email_correction_auth_email"."p_operation_id", v_state
            USING ERRCODE = 'WAEC5';
    END IF;

    SELECT "p"."id" INTO v_current_linked_auth_user_id
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = v_worker_id;

    IF NOT FOUND OR v_current_linked_auth_user_id IS DISTINCT FROM v_linked_auth_user_id THEN
        RAISE EXCEPTION 'Linkage for worker access email correction operation % no longer matches its recorded identity', "get_worker_access_email_correction_auth_email"."p_operation_id"
            USING ERRCODE = 'WAEC5';
    END IF;

    SELECT "u"."email" INTO v_auth_email
    FROM "auth"."users" "u"
    WHERE "u"."id" = v_linked_auth_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked Auth user for worker access email correction operation % no longer exists', "get_worker_access_email_correction_auth_email"."p_operation_id"
            USING ERRCODE = 'WAEC5';
    END IF;

    RETURN v_auth_email;
END;
$$;

ALTER FUNCTION "public"."get_worker_access_email_correction_auth_email"(bigint) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_worker_access_email_correction_auth_email"(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."get_worker_access_email_correction_auth_email"(bigint) FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_worker_access_email_correction_auth_email"(bigint) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_worker_access_email_correction_auth_email"(bigint) TO "service_role";
