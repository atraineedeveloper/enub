# Database Plan - Worker Self-Service Documents

**Revised after security review.** Changes from the original version are called out inline; see `decisions.md` for the reasoning behind each.

This plan describes new migrations only. Nothing here modifies existing migration files from `worker-document-uploads` — everything is additive (new migration files), matching how that feature itself was built as a sequence of small migrations.

## 1. `public.profiles` table

```sql
CREATE TABLE "public"."profiles" (
    "id" uuid NOT NULL,
    "role" text NOT NULL,
    "worker_id" bigint,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "profiles_role_check" CHECK ("role" IN ('admin', 'staff', 'worker')),
    CONSTRAINT "profiles_worker_role_consistency" CHECK (
        ("role" = 'worker' AND "worker_id" IS NOT NULL)
        OR ("role" <> 'worker' AND "worker_id" IS NULL)
    ),
    CONSTRAINT "profiles_worker_id_key" UNIQUE ("worker_id")
);

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- REVISED: ON DELETE RESTRICT, not CASCADE (decisions.md #19).
-- Deleting a workers row while a profile still references it now fails outright,
-- instead of silently deleting the profile and leaving the auth user role-less.
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE RESTRICT;
```

Notes:

- `role` has **no default value** (removed the implicit default from the original draft). Every row must state its role explicitly at insert time — there is no "row exists but role is implicitly staff" state possible.
- `worker_id` unique + nullable: a worker has at most one linked account; multiple `NULL`s are allowed (every `admin`/`staff` row).
- The consistency check keeps `worker_id` meaningless for non-`worker` roles, so an `admin`/`staff` row is never accidentally scoped to a worker.
- **No implicit row is created for anyone.** `admin`/`staff`/`worker` rows are only ever created by: the one-time backfill migration (section 9), the `link_worker_account`/`grant_staff_role` RPCs (sections 3–4), or the one-time manual admin bootstrap (section 3). There is deliberately no "auto-create a staff row on first login" trigger — see [[decisions#7-revised-no-profiles-row-means-no-access-default-deny]].
- The FK on `worker_id` is `RESTRICT`, not `CASCADE` — deleting a linked `workers` row is blocked until an admin explicitly calls `unlink_worker_account` (section 5).

## 2. Helper functions (REVISED)

```sql
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

GRANT EXECUTE ON FUNCTION "public"."current_app_role"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."current_worker_id"() TO "authenticated";
```

**What changed from the original draft:** `current_app_role()` no longer wraps the result in `COALESCE(..., 'staff')`. A `SELECT` against a table that matches zero rows naturally returns `NULL` for a scalar-returning SQL function — that `NULL` is the deliberate "no recognized role" signal, consumed as:

- In RLS policies: `public.current_app_role() IN ('staff', 'admin')` — `NULL IN (...)` evaluates to `NULL`, which `USING`/`WITH CHECK` treat as "deny." No special-casing required anywhere.
- In the app: `getCurrentProfile()` surfaces this as `role: null`, rendered as a distinct "pending access" state, never silently treated as staff. See `implementation-plan.md`.

`SECURITY DEFINER` + `STABLE` is unchanged from the original draft and still deliberate: these are called from inside RLS policies on `profiles` itself (among other tables), and a non-definer function would recurse into `profiles`' own RLS as the calling role — definer functions bypass that and read as the function owner (`postgres`), avoiding recursive policy evaluation, which is the standard Supabase pattern for this kind of helper.

## 3. `link_worker_account` RPC (REVISED — rejects role collisions)

```sql
CREATE OR REPLACE FUNCTION "public"."link_worker_account"(
    "worker_id" bigint,
    "worker_email" text
)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    target_auth_id uuid;
    existing_role text;
BEGIN
    -- IS DISTINCT FROM (not <>): current_app_role() returns NULL for a
    -- caller with no profiles row, and plain `<>` with NULL evaluates to
    -- NULL, which "IF ... THEN" treats as false -- silently skipping this
    -- guard instead of raising. IS DISTINCT FROM is NULL-safe.
    IF "public"."current_app_role"() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Only admins can link worker accounts';
    END IF;

    SELECT "id" INTO target_auth_id
    FROM "auth"."users"
    WHERE "email" = "worker_email";

    IF target_auth_id IS NULL THEN
        RAISE EXCEPTION 'No auth account found for %', "worker_email";
    END IF;

    SELECT "role" INTO existing_role
    FROM "public"."profiles"
    WHERE "id" = target_auth_id;

    IF existing_role IN ('admin', 'staff') THEN
        RAISE EXCEPTION 'This account already has role % and cannot be linked as a worker; revoke that role first if this is intentional', existing_role;
    END IF;

    IF existing_role = 'worker' THEN
        RAISE EXCEPTION 'This account is already linked to a different worker; call unlink_worker_account first';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "public"."profiles"
        WHERE "profiles"."worker_id" = "link_worker_account"."worker_id"
    ) THEN
        RAISE EXCEPTION 'Worker % already has a linked account; unlink it first', "link_worker_account"."worker_id";
    END IF;

    INSERT INTO "public"."profiles" ("id", "role", "worker_id")
    VALUES (target_auth_id, 'worker', "link_worker_account"."worker_id");
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."link_worker_account"(bigint, text) TO "authenticated";
```

**What changed from the original draft:** the original used `ON CONFLICT ("id") DO UPDATE` unconditionally, which would have silently overwritten an existing `admin`/`staff` row (or re-pointed an existing `worker` row to a different worker) if `link_worker_account` were called with an email that already had a role. This is now checked explicitly and rejected with a descriptive error before any write happens (decisions.md #16). A benign check-then-insert race between two concurrent admin calls is accepted as out of scope — this is a low-frequency, admin-only action, not a hot path.

**Bug found during implementation, now fixed in the snippet above:** the admin check originally read `IF public.current_app_role() <> 'admin' THEN`. In PL/pgSQL, `NULL <> 'admin'` evaluates to `NULL`, and `IF NULL THEN ...` is treated as false — so a caller with **no** `profiles` row (the exact case this feature's default-deny model is supposed to catch) would have silently skipped the admin check entirely instead of being rejected. Functional testing against a reset local database surfaced this. Fixed by using `IS DISTINCT FROM 'admin'`, which is NULL-safe. The same fix applies to `unlink_worker_account` and `grant_staff_role` below. The `EXISTS (...)` check just above this note is also shown with the column reference qualified as `"profiles"."worker_id"` — `db lint` flagged the unqualified form as ambiguous against the PL/pgSQL parameter of the same name.

## 4. `unlink_worker_account` RPC (new)

```sql
CREATE OR REPLACE FUNCTION "public"."unlink_worker_account"("worker_id" bigint)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
BEGIN
    -- IS DISTINCT FROM (not <>): NULL-safe, so a caller with no profiles
    -- row (current_app_role() = NULL) is correctly rejected instead of
    -- silently passing this guard. See link_worker_account for the same fix.
    IF "public"."current_app_role"() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Only admins can unlink worker accounts';
    END IF;

    DELETE FROM "public"."profiles"
    WHERE "profiles"."worker_id" = "unlink_worker_account"."worker_id" AND "profiles"."role" = 'worker';
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."unlink_worker_account"(bigint) TO "authenticated";
```

Purpose: the sanctioned way to free up a `workers` row for deletion (the `RESTRICT` FK in section 1 blocks deletion while a profile references it — decisions.md #19), and the sanctioned way to walk back a `link_worker_account` mistake without going to Studio. After this runs, the account reverts to **no access** (no `profiles` row), never to staff.

## 5. `grant_staff_role` RPC (new)

```sql
CREATE OR REPLACE FUNCTION "public"."grant_staff_role"("staff_email" text)
RETURNS void
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = ''
AS $$
DECLARE
    target_auth_id uuid;
    existing_role text;
BEGIN
    -- IS DISTINCT FROM (not <>): NULL-safe, so a caller with no profiles
    -- row (current_app_role() = NULL) is correctly rejected instead of
    -- silently passing this guard. See link_worker_account for the same fix.
    IF "public"."current_app_role"() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Only admins can grant staff role';
    END IF;

    SELECT "id" INTO target_auth_id
    FROM "auth"."users"
    WHERE "email" = "staff_email";

    IF target_auth_id IS NULL THEN
        RAISE EXCEPTION 'No auth account found for %', "staff_email";
    END IF;

    SELECT "role" INTO existing_role
    FROM "public"."profiles"
    WHERE "id" = target_auth_id;

    IF existing_role = 'worker' THEN
        RAISE EXCEPTION 'This account is linked to a worker; call unlink_worker_account first if converting it to staff is intentional';
    END IF;

    INSERT INTO "public"."profiles" ("id", "role", "worker_id")
    VALUES (target_auth_id, 'staff', NULL)
    ON CONFLICT ("id") DO UPDATE SET "role" = 'staff', "worker_id" = NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION "public"."grant_staff_role"(text) TO "authenticated";
```

Purpose: closes the operational gap created by decision #7 (no more implicit staff default) — this is how a brand-new staff member gets access after launch, without needing Studio SQL access. Never grants `admin`; promoting to `admin` stays a manual step (decisions.md #5). `ON CONFLICT DO UPDATE` is safe here (unlike in `link_worker_account`) because the only pre-existing states this can legitimately overwrite are `'admin'` (re-affirming/downgrading an admin to plain staff is a real, intended admin action, not a mistake class we need to guard against the same way) or `'staff'` (no-op). The one dangerous case — an existing `'worker'` row — is explicitly checked and rejected above.

### Bootstrapping the first admin

One-time, manual, run in Supabase Studio's SQL editor (or as local-dev seed data — see section 9):

```sql
insert into public.profiles (id, role, worker_id)
values ('<uuid-of-an-existing-auth-user>', 'admin', null)
on conflict (id) do update set role = 'admin', worker_id = null;
```

## 6. RLS: `profiles`

```sql
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON "public"."profiles"
    FOR SELECT TO "authenticated"
    USING ("id" = "auth"."uid"());

CREATE POLICY "Admins can read all profiles" ON "public"."profiles"
    FOR SELECT TO "authenticated"
    USING ("public"."current_app_role"() = 'admin');
```

No `INSERT`/`UPDATE`/`DELETE` policy is added for `authenticated` — see [[decisions#12-rls-workers-table-selectupdate-tightened-insertdelete-untouched]] and the earlier note on `profiles` having no direct write policies. Only the `SECURITY DEFINER` functions (owned by `postgres`) write to this table.

## 7. RLS: `workers` (tightened; `IF EXISTS` on every drop)

```sql
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."workers";
DROP POLICY IF EXISTS "Enable update access for all users" ON "public"."workers";

CREATE POLICY "Staff and admin can read all workers" ON "public"."workers"
    FOR SELECT TO "authenticated"
    USING ("public"."current_app_role"() IN ('staff', 'admin'));

CREATE POLICY "Workers can read own worker row" ON "public"."workers"
    FOR SELECT TO "authenticated"
    USING ("id" = "public"."current_worker_id"());

CREATE POLICY "Staff and admin can update workers" ON "public"."workers"
    FOR UPDATE TO "authenticated"
    USING ("public"."current_app_role"() IN ('staff', 'admin'))
    WITH CHECK ("public"."current_app_role"() IN ('staff', 'admin'));
```

Multiple permissive `SELECT` policies on the same table combine with `OR` in Postgres RLS, so staff/admin and worker sessions are each authorized by their own policy without conflicting. A session with no `profiles` row satisfies neither policy — both conditions evaluate to `NULL`/false — and is correctly denied.

No `worker` policy for `UPDATE`: a worker cannot edit their own `workers` row through this feature (out of scope; that would be a profile-editing feature, not documents).

## 8. RLS: `worker_documents` (replaced; `IF EXISTS` on every drop)

```sql
DROP POLICY IF EXISTS "Enable read for authenticated users only" ON "public"."worker_documents";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON "public"."worker_documents";
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON "public"."worker_documents";
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON "public"."worker_documents";

CREATE POLICY "Staff and admin manage all worker documents" ON "public"."worker_documents"
    FOR ALL TO "authenticated"
    USING ("public"."current_app_role"() IN ('staff', 'admin'))
    WITH CHECK ("public"."current_app_role"() IN ('staff', 'admin'));

CREATE POLICY "Workers manage own worker documents" ON "public"."worker_documents"
    FOR ALL TO "authenticated"
    USING ("worker_id" = "public"."current_worker_id"())
    WITH CHECK ("worker_id" = "public"."current_worker_id"());
```

A session with no `profiles` row: `current_app_role()` is `NULL` (`NULL IN (...)` is not true), and `current_worker_id()` is `NULL` (`worker_id = NULL` is never true, even for `worker_id IS NULL` rows, since SQL `=` with `NULL` is never true) — denied by both policies, no special case needed.

The two data-integrity triggers from `worker-document-uploads` (`enforce_worker_document_scope`, `enforce_single_worker_document_file`) are untouched and still run for both staff and worker-originated writes.

## 9. RLS: `storage.objects` for the `worker_documents` bucket (replaced; `IF EXISTS` on every drop)

```sql
DROP POLICY IF EXISTS "Worker documents bucket read for authenticated users" ON "storage"."objects";
DROP POLICY IF EXISTS "Worker documents bucket insert for authenticated users" ON "storage"."objects";
DROP POLICY IF EXISTS "Worker documents bucket update for authenticated users" ON "storage"."objects";
DROP POLICY IF EXISTS "Worker documents bucket delete for authenticated users" ON "storage"."objects";

CREATE POLICY "Staff and admin access worker documents bucket" ON "storage"."objects"
    FOR ALL TO "authenticated"
    USING (
        "bucket_id" = 'worker_documents'
        AND "public"."current_app_role"() IN ('staff', 'admin')
    )
    WITH CHECK (
        "bucket_id" = 'worker_documents'
        AND "public"."current_app_role"() IN ('staff', 'admin')
    );

CREATE POLICY "Workers access own worker documents bucket path" ON "storage"."objects"
    FOR ALL TO "authenticated"
    USING (
        "bucket_id" = 'worker_documents'
        AND ("storage"."foldername"("name"))[1] = ("public"."current_worker_id"())::text
    )
    WITH CHECK (
        "bucket_id" = 'worker_documents'
        AND ("storage"."foldername"("name"))[1] = ("public"."current_worker_id"())::text
    );
```

Relies on the existing storage path convention from `createWorkerDocumentStoragePath` in `apiWorkerDocuments.js`: `${workerId}/${documentTypeId}/${scopeFolder}/${uuid}-${filename}` — the first folder segment is always the owning `workerId`. No app code change needed for this to work; the path shape doesn't change. If `current_worker_id()` is `NULL` (no role, or role isn't `worker`), `(storage.foldername(name))[1] = NULL::text` is never true — correctly denies.

## 10. Indexes

- `profiles_worker_id_key` (from the `UNIQUE` constraint) already covers lookups by `worker_id`.
- `profiles_pkey` on `id` covers `current_app_role()`/`current_worker_id()` lookups (primary key, already indexed).
- No additional indexes needed.

## 11. Backfill migration for existing internal users (new — required, not optional)

```sql
insert into public.profiles (id, role, worker_id)
select id, 'staff', null
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;
```

This **must** ship in the same deployment as sections 6–9 (the RLS policy changes). Reason and scope covered in [[decisions#18-backfill-migration-for-existing-internal-users]] — in short, every `auth.users` row that exists *before* this feature ships is, by the current app's own behavior, staff; this migration only records that fact explicitly so the new deny-by-default policies don't lock those accounts out. It is a one-time snapshot at migration time, not an ongoing default — any account created *after* this migration runs gets no row and no access until `grant_staff_role`/`link_worker_account`/manual admin bootstrap gives it one.

## 12. Seed data (local dev only)

`worker-document-uploads` already seeds `worker_document_categories`/`worker_document_types`. This feature adds, for local `db reset` only:

- One local-only bootstrap `admin` profile linked to whatever test auth user the local seed already creates (if any), so `bunx supabase db reset` produces a working admin out of the box for manual verification. If no seeded auth user exists today, this step is added as part of this feature's seed migration (creating one via `auth.users` insert is possible in a seed script but must stay local-only, never applied to a remote environment).
- This local seed is separate from, and does not replace, the backfill migration in section 11 — the backfill is a real migration meant to run everywhere (including production, over whatever real users already exist); the seed is `db reset`-only convenience data for a fresh local database that has no real users yet.

## 13. Migration naming

Following the existing `YYYYMMDDHHMMSS_description.sql` convention seen in `worker-document-uploads`' migrations (e.g. `20260702145830_worker_documents.sql`), new migrations should be named in this order:

1. `..._profiles.sql` — table + constraints (section 1).
2. `..._profiles_helper_functions.sql` — `current_app_role`, `current_worker_id` (section 2).
3. `..._link_worker_account_function.sql` — the RPC (section 3).
4. `..._unlink_worker_account_function.sql` — the RPC (section 4).
5. `..._grant_staff_role_function.sql` — the RPC (section 5).
6. `..._profiles_rls_policies.sql` (section 6).
7. `..._workers_rls_policies_update.sql` (section 7).
8. `..._worker_documents_rls_policies_update.sql` (section 8).
9. `..._worker_documents_storage_rls_policies_update.sql` (section 9).
10. `..._profiles_backfill_existing_users.sql` — **required**, must ship alongside 6–9, not after (section 11).
11. `..._profiles_seed_data.sql` — local-only bootstrap admin (section 12), if applicable.

Actual timestamps assigned at implementation time via `bunx supabase migration new <name>`.
