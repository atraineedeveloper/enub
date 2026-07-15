-- Server-only, worker-bound raw-Auth-email read (code-review finding #9,
-- add-worker-access-email-correction). Used only by the browser-facing
-- get-worker-access-email-context Edge Function, replacing the general
-- get_auth_user_email_by_id(uuid): rather than accepting an arbitrary
-- Auth user id, this function accepts only a worker_id and resolves the
-- exact linked worker profile internally, exposing no arbitrary-UUID
-- lookup capability to any caller.
--
-- The Edge Function still performs its own worker-existence check
-- (worker_not_found/404) before calling this -- this function assumes
-- that has already happened and focuses solely on profile/role/Auth
-- resolution, raising one stable error code (WAEC6) if anything doesn't
-- check out; the Edge Function maps any such failure to its existing
-- linked_auth_user_missing/500 branch.
CREATE OR REPLACE FUNCTION "public"."get_linked_worker_auth_email_context"("worker_id" bigint)
RETURNS text
LANGUAGE "plpgsql"
STABLE
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    v_linked_auth_user_id uuid;
    v_profile_role text;
    v_auth_email text;
BEGIN
    SELECT "p"."id", "p"."role" INTO v_linked_auth_user_id, v_profile_role
    FROM "public"."profiles" "p"
    WHERE "p"."worker_id" = "get_linked_worker_auth_email_context"."worker_id";

    IF NOT FOUND OR v_profile_role <> 'worker' THEN
        RAISE EXCEPTION 'Worker % has no valid linked worker profile', "get_linked_worker_auth_email_context"."worker_id"
            USING ERRCODE = 'WAEC6';
    END IF;

    SELECT "u"."email" INTO v_auth_email
    FROM "auth"."users" "u"
    WHERE "u"."id" = v_linked_auth_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Linked Auth user for worker % no longer exists', "get_linked_worker_auth_email_context"."worker_id"
            USING ERRCODE = 'WAEC6';
    END IF;

    RETURN v_auth_email;
END;
$$;

ALTER FUNCTION "public"."get_linked_worker_auth_email_context"(bigint) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."get_linked_worker_auth_email_context"(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."get_linked_worker_auth_email_context"(bigint) FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_linked_worker_auth_email_context"(bigint) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_linked_worker_auth_email_context"(bigint) TO "service_role";
