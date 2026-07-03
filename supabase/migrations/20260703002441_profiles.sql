CREATE TABLE "public"."profiles" (
    "id" uuid NOT NULL,
    "role" text NOT NULL,
    "worker_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "profiles_role_check" CHECK ("role" IN ('admin', 'staff', 'worker')),
    CONSTRAINT "profiles_worker_role_consistency" CHECK (
        ("role" = 'worker' AND "worker_id" IS NOT NULL)
        OR ("role" <> 'worker' AND "worker_id" IS NULL)
    ),
    CONSTRAINT "profiles_worker_id_key" UNIQUE ("worker_id")
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- ON DELETE RESTRICT (not CASCADE): deleting a workers row while a profile still
-- references it must fail outright, instead of silently deleting the profile and
-- leaving the auth user role-less via cascade. See decisions.md #19.
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE RESTRICT;

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
