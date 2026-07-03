CREATE OR REPLACE FUNCTION "public"."current_app_role"()
RETURNS text
LANGUAGE "sql"
SECURITY DEFINER
STABLE
SET "search_path" = ''
AS $$
    SELECT "role"
    FROM "public"."profiles"
    WHERE "id" = "auth"."uid"();
$$;

ALTER FUNCTION "public"."current_app_role"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."current_worker_id"()
RETURNS bigint
LANGUAGE "sql"
SECURITY DEFINER
STABLE
SET "search_path" = ''
AS $$
    SELECT "worker_id"
    FROM "public"."profiles"
    WHERE "id" = "auth"."uid"() AND "role" = 'worker';
$$;

ALTER FUNCTION "public"."current_worker_id"() OWNER TO "postgres";

-- current_app_role() intentionally returns NULL (not 'staff' or any other default)
-- when the caller has no profiles row. NULL composes safely with the `IN (...)`
-- checks used throughout RLS ("NULL IN (...)" evaluates to NULL, which USING/
-- WITH CHECK treat as deny) so every policy in this feature denies by default
-- with no special-casing. See decisions.md #7.

GRANT EXECUTE ON FUNCTION "public"."current_app_role"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."current_app_role"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."current_app_role"() TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."current_worker_id"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."current_worker_id"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."current_worker_id"() TO "service_role";
