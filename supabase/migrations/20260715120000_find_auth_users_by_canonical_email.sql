-- Server-only canonical-email-match lookup, added for
-- add-worker-access-email-correction (design.md §3). auth.users has a
-- partial unique index on the raw email value, so two rows can never share
-- a byte-identical non-null email, but can still share a *canonical*
-- (lower(trim(...))) email via case/whitespace variants -- this function
-- is the only reliable way to detect that, since GoTrueAdminApi.listUsers()
-- has no email filter (verified directly against the installed
-- @supabase/auth-js@2.71.1 type declarations).
--
-- No current_app_role() check inside: this function is server-only,
-- reachable exclusively through the service-role connection (see grants
-- below) -- authorization lives in the calling Edge Function.
CREATE OR REPLACE FUNCTION "public"."find_auth_users_by_canonical_email"("raw_email" text)
RETURNS SETOF uuid
LANGUAGE "sql"
STABLE
SECURITY DEFINER
SET "search_path" = ''
AS $$
    SELECT "id"
    FROM "auth"."users"
    WHERE lower(trim("email")) = lower(trim("raw_email"));
$$;

ALTER FUNCTION "public"."find_auth_users_by_canonical_email"(text) OWNER TO "postgres";

REVOKE ALL ON FUNCTION "public"."find_auth_users_by_canonical_email"(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."find_auth_users_by_canonical_email"(text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."find_auth_users_by_canonical_email"(text) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."find_auth_users_by_canonical_email"(text) TO "service_role";
