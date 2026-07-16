## Context

**Current schema (verified directly against migrations, not assumed):**
- `worker_document_categories` (id, name UNIQUE, scope CHECK IN ('permanent','semester'), sort_order).
- `worker_document_types` (id, category_id FK, name, allows_multiple, sort_order, created_at) with a `UNIQUE(category_id, name)` constraint — no lifecycle column exists today; every row is implicitly "active" everywhere it's read.
- `worker_documents` (id, worker_id FK, document_type_id FK, semester_id FK nullable, file_name, storage_path UNIQUE, mime_type, file_size CHECK, uploaded_by, created_at) — references `worker_document_types.id` directly; nothing here changes.
- Two `BEFORE INSERT OR UPDATE` triggers already exist on `worker_documents`: `enforce_worker_document_scope` (permanent vs. semester `semester_id` presence) and `enforce_single_worker_document_file` (rejects a second row for a non-`allows_multiple` type/worker/scope). Both follow the same shape: look up something from `worker_document_types`/`worker_document_categories` by `NEW.document_type_id`, raise a plain `RAISE EXCEPTION` (SQLSTATE `P0001`, plpgsql's default) if the invariant fails.
- The seed migration (`20260702145914_worker_document_seed_data.sql`, already applied) inserts the current 29 `worker_document_types` rows via `ON CONFLICT (category_id, name) DO UPDATE`, keyed by `(category_name, name)` pairs in one VALUES list, in one `INSERT`. It is never edited by this change — later migrations perform the retirement/rename instead.
- `Docencia`'s current rows (`sort_order`): `Planeación semestral`(10), `Plan de trabajo semestral`(20), `Planeaciones semanales`(30), `Rúbricas`(40), `Listas de cotejo`(50), `Evidencias`(60, `allows_multiple=true`), `Listas de asistencia`(70), `Actas de evaluación`(80), `Concentrado de calificaciones finales`(90).
- **Both** `Asesoría` (its own `Evidencias`, `sort_order 20`) and `Tutoría` (`Evidencias de actividades`, `sort_order 30`) have their own, separate rows — distinct `(category_id, name)` keys from `Docencia`'s. The rename/retirement migration must filter by `category_id` (via a `Docencia`-named category join), never by `name` alone.
- **Verified directly, correcting a prior revision of this document that was wrong:** `worker_documents`' RLS is **not** a blanket `WITH CHECK (true)`. The original migration (`20260702145854_worker_document_rls_policies.sql`) did use that shape, but a later migration (`20260703002456_worker_documents_rls_policies_update.sql`, already applied) drops those policies entirely and replaces them with ownership-aware ones:
  ```sql
  CREATE POLICY "Staff and admin manage all worker documents" ON "public"."worker_documents"
      FOR ALL TO "authenticated"
      USING ("public"."current_app_role"() IN ('staff', 'admin'))
      WITH CHECK ("public"."current_app_role"() IN ('staff', 'admin'));

  CREATE POLICY "Workers manage own worker documents" ON "public"."worker_documents"
      FOR ALL TO "authenticated"
      USING ("worker_id" = "public"."current_worker_id"())
      WITH CHECK ("worker_id" = "public"."current_worker_id"());
  ```
  `current_app_role()` and `current_worker_id()` (`20260703002444_profiles_helper_functions.sql`) are both `SECURITY DEFINER`/`STABLE` functions resolving the caller's role/own `worker_id` from `profiles`, keyed off `auth.uid()`. Storage objects have the equivalent split (`20260703002459_worker_documents_storage_rls_policies_update.sql`): staff/admin get unrestricted bucket access; a worker's own access is scoped by the storage path's own first folder segment matching `current_worker_id()`. **The lifecycle trigger this change adds is not, and does not need to be, an authorization boundary** — ownership/role authorization is already fully handled by this existing RLS. The trigger's only job is deciding whether a *document type* (regardless of which authorized caller is inserting) currently accepts new documents. This change does not touch, weaken, or redesign any RLS policy.
- `worker_documents_ownership_rls.test.sql` (pgTAP, already passing) exercises this ownership RLS behaviorally (not just structurally) and, incidentally, uses `Docencia / Evidencias` by exact name as its multi-file fixture type (to avoid colliding with the `enforce_single_worker_document_file` trigger using the single-file CURP fixture already seeded for its "worker A" case). This file must be updated to reference `Evidencias bimestrales` or it breaks once the rename migration lands.
- **Service-layer flow (verified directly in `apiWorkerDocuments.ts`):**
  - `uploadWorkerDocument`: validates the file → `getDocumentType(documentTypeId)` (a plain `SELECT *`, so `is_active` is already present on the returned row once the column exists, with zero query changes) → if `!allows_multiple`, checks for an existing row and throws a friendly error if one exists → uploads the new storage object → inserts metadata (cleaning up the just-uploaded storage object if the insert fails). **No existing-metadata deletion of any kind** — this path cannot lose historical data; it can only fail to add new data, and it already cleans up after itself correctly.
  - `replaceWorkerDocument`: validates the file → `getDocumentType` → refuses if `allows_multiple` (replace is single-file-type-only) → reads the existing row(s) → **uploads the new storage object → `DELETE`s the existing metadata row(s) → inserts the new metadata row** → (best-effort, non-fatal) deletes the old storage object(s). **This is the unsafe ordering this change must fix**: if the final `INSERT` fails for any reason — including a race where the type is retired between this function's own precondition checks and the actual insert, which the database trigger (added by this change) would now reject — the old metadata row is *already gone* (deleted in the prior step) while the new one never lands. The result is complete, silent metadata loss for that worker/type/semester: no row references either the old or the new file, even though the old storage object still physically exists, now orphaned and unreferenced. This is a genuine, pre-existing data-loss defect this change's own trigger would make newly reachable (a stale client attempting a replace against a type retired moments earlier), and must be fixed as part of this change, not left as a latent hazard.
  - Both functions already share one `getDocumentType` call site — the natural, minimal place to add the `is_active` preflight check to both.
- **Observed row ID, recorded as verification evidence only (not a universal guarantee):** on a fresh `bunx supabase db reset` against the current migration history (before any migration this change adds), `Docencia / Evidencias` received `id = 10` — confirmed via direct `psql` query against the freshly-reset local database. `worker_document_types.id` is `GENERATED BY DEFAULT AS IDENTITY`, reset on every fresh database, and the entire 29-row seed list is inserted in one deterministic `INSERT ... VALUES (...)` statement in a fixed literal order — so this value is fully reproducible on *this* migration history's fresh reset, but the seed does not guarantee this literal value in every database: a different migration history (a future seed edit, a different environment that applied migrations in a different order or with different pre-existing data) could assign a different id. This observation is retained as documentation of what was actually seen in this implementation session, not as a fact the design relies on. Decision 9 describes the actual identity-preservation mechanism, which never depends on this or any other literal being universal.
- **One shared component serves both consumer-facing views**: `src/pages/Records/WorkerDocuments.tsx` (admin, `workerId` from route params) and `src/pages/MyDocuments.tsx` (worker self-service, `workerId` from the caller's own session) both render `WorkerDocumentsView.tsx` with only the `workerId` prop differing. There is exactly one place to change the upload-row logic, not two.
- The catalog itself (`getWorkerDocumentCategoriesAndTypes` in `apiWorkerDocuments.ts`) is a single, worker-independent query (`SELECT * FROM worker_document_categories` + `SELECT * FROM worker_document_types`, both ordered by `sort_order`), cached under one global TanStack Query key (`workerDocumentKeys.catalog()`, 5-minute `staleTime`) — **not** parameterized by `workerId`. `WorkerDocumentsView.tsx` is what combines this global catalog with a specific worker's own `worker_documents` rows (via `documentsByType`, a `Map<document_type_id, WorkerDocument[]>` built client-side) to render one row per type. `getWorkerDocumentReportData` (the PDF export) does the identical combination through `groupDocumentTypesByCategory`/`addReportStatusToCategories`.
- No frontend test framework exists in this repo (`AGENTS.md`: "no test script... every spec must include manual verification steps") — "frontend/service tests" in this change's scope are explicit manual/console verification steps, not new automated test files.
- `src/types/supabase.ts` is Supabase-CLI-generated; no `gen:types`-style script exists in `package.json`, and no documented regeneration command exists anywhere in the repo. The standard, safe, local-only command (`bunx supabase gen types typescript --local > src/types/supabase.ts`) is treated as the repo's de facto established workflow, since none is otherwise documented.
- **Full repository search for the three affected literal names** (`Plan de trabajo semestral`, `Planeaciones semanales`, `Evidencias`), classified:
  | Location | Classification | Action |
  |---|---|---|
  | `supabase/migrations/20260702145914_worker_document_seed_data.sql` | Expected migration input (already-applied seed) | Do not edit |
  | `supabase/tests/database/worker_documents_seed.test.sql` | Required final-name update (asserts `Docencia / Evidencias` exists with `allows_multiple = true`) | Update to `Evidencias bimestrales` |
  | `supabase/tests/database/worker_documents_triggers.test.sql` | Required final-name update (uses `Docencia / Evidencias` as its multi-file fixture type, both in a lookup CTE and in test-name strings) | Update to `Evidencias bimestrales` |
  | `supabase/tests/database/worker_documents_ownership_rls.test.sql` | Required final-name update (uses `Docencia / Evidencias` as its multi-file fixture type to avoid an unrelated trigger collision, including in a comment) | Update to `Evidencias bimestrales` |
  | `docs/ai/api.md`, `docs/ai/architecture.md`, `docs/ai/testing.md` | Required final-name update (living project documentation describing current multi-file behavior by example, using `Evidencias` as the example name) | Update references to `Evidencias bimestrales` |
  | `specs/active/worker-document-uploads/*`, `specs/active/worker-documents-ux-and-delete/*`, `specs/active/worker-self-service-documents/verification-plan.md` | Expected historical documentation (a separate, prior spec system) | **Do not modify** — out of scope, `specs/active/` is explicitly off-limits |
  | This change's own `openspec/changes/update-docencia-document-requirements/*` artifacts | This change's own working documents | Updated as part of this revision |
  No other occurrence exists anywhere in `src/`, `supabase/`, or any other tracked location.

## Goals / Non-Goals

**Goals:**
- Retire `Docencia / Plan de trabajo semestral` and `Docencia / Planeaciones semanales` from every upload interface without deleting any historical `worker_documents` row or storage object.
- Rename `Docencia / Evidencias` to `Evidencias bimestrales` in place — same row `id`, same `allows_multiple`, same `sort_order` — a label/requirement-name change only.
- Introduce a reusable `is_active` lifecycle flag on `worker_document_types` so future retirements don't need a new one-off mechanism.
- Close the server-side gap that currently lets a client insert or replace a `worker_documents` row against any `document_type_id`, active or not — at **both** the service layer (fast, friendly failure, before any storage mutation) and the database layer (the final authority for races the service layer cannot fully close).
- Fix the pre-existing unsafe delete-before-insert replacement ordering so a rejected replacement can never lose the previous document's metadata or file.
- Keep every existing historical document visible wherever it is already shown today, regardless of its type's new `is_active` value — for the specific worker who owns it, never for any other worker.
- Describe the existing ownership-aware RLS accurately, and keep the new trigger's role (type-lifecycle enforcement, not authorization) clearly distinct from it.

**Non-Goals:**
- No bimonthly-period entity, per-bimester upload slots, deadlines, notifications, or reporting — `Evidencias bimestrales` remains exactly one `allows_multiple = true` catalog row, identical in structure to today's `Evidencias`.
- No deletion of any `worker_documents` row or storage object, ever, as part of this change.
- No change to `Datos personales`, `Tutoría`, `Asesoría`, `Investigación`, or any of their own document types.
- No change to `worker_documents`' own columns or the shape/scope of its existing RLS policies (staff/admin vs. worker-ownership) — this change is strictly additive (one new column, one new trigger, one new RPC).
- No general RLS redesign of any kind.
- No hosted/remote Supabase operation performed by this change's own implementation or verification; a hosted preflight *read* is documented as a separate, human-approved step (Decision 11), never run automatically.

## Decisions

### 1. `is_active boolean NOT NULL DEFAULT true` on `worker_document_types`, added via a new migration

**Decision:** `ALTER TABLE public.worker_document_types ADD COLUMN is_active boolean NOT NULL DEFAULT true;` in its own migration, separate from the retirement/rename data migration. Two migrations, not one: the column-add is a schema change with a safe, universal default (every existing row becomes `true` automatically, no backfill logic needed); the retirement/rename is a data change scoped to three specific rows. Keeping them separate mirrors the existing convention in this codebase of one migration per concern and makes the retirement migration trivially re-runnable/idempotent on its own.

**Alternative considered:** a nullable `is_active` with application-level "null means active" semantics. Rejected — `NOT NULL DEFAULT true` is simpler, matches the table's existing convention (`allows_multiple`, `sort_order` are both `NOT NULL DEFAULT`), and leaves no ambiguous third state.

### 2. The retirement/rename data migration is scoped by category join, never by bare name, and fails loudly on inconsistent state

**Decision:** a single follow-up migration that:
```sql
UPDATE public.worker_document_types
SET is_active = false
WHERE category_id = (SELECT id FROM public.worker_document_categories WHERE name = 'Docencia')
  AND name = 'Plan de trabajo semestral';

UPDATE public.worker_document_types
SET is_active = false
WHERE category_id = (SELECT id FROM public.worker_document_categories WHERE name = 'Docencia')
  AND name = 'Planeaciones semanales';

UPDATE public.worker_document_types
SET name = 'Evidencias bimestrales'
WHERE category_id = (SELECT id FROM public.worker_document_categories WHERE name = 'Docencia')
  AND name = 'Evidencias';
```
followed immediately by the post-condition block specified in full in Decision 10. Scoping every `UPDATE` by `category_id` (resolved from `worker_document_categories.name = 'Docencia'`), never by `worker_document_types.name` alone, is what keeps `Asesoría / Evidencias` and `Tutoría / Evidencias de actividades` untouched.

**Why preserve the row `id` via `UPDATE`, not delete-and-reinsert:** `worker_documents.document_type_id` is a plain FK with no `ON DELETE` clause, defaulting to `NO ACTION` — deleting a referenced `worker_document_types` row is already impossible while any `worker_documents` row points to it, before this change even runs. `UPDATE` is the only viable approach, not merely the preferred one.

**Alternative considered:** inserting new `Docencia` rows for retired/renamed concepts and leaving the old rows alone. Rejected — the proposal explicitly requires "retains the existing document-type identity where possible."

### 3. Server-side enforcement is a new `BEFORE INSERT OR UPDATE` trigger, narrowly scoped, matching the existing pattern

**Decision:** add `enforce_active_worker_document_type()` alongside the two existing trigger functions, with the identical conventions (`SET search_path = ''`, owned by `postgres`, plain `RAISE EXCEPTION` on the "does not exist" branch, a dedicated stable code on the "inactive" branch — see Decision 13), attached via `BEFORE INSERT OR UPDATE ON worker_documents FOR EACH ROW`:
```sql
CREATE OR REPLACE FUNCTION "public"."enforce_active_worker_document_type"()
RETURNS trigger
LANGUAGE "plpgsql"
SET "search_path" = ''
AS $$
DECLARE
    type_is_active boolean;
BEGIN
    -- Narrow scope (finding #3): an UPDATE that does not change
    -- document_type_id is an edit to an existing, already-accepted
    -- historical row -- never blocked here, even when that row's type is
    -- inactive. OLD is only referenced inside this TG_OP = 'UPDATE' branch,
    -- so it is never evaluated during INSERT (where OLD does not exist).
    IF TG_OP = 'UPDATE' THEN
        IF NEW."document_type_id" IS NOT DISTINCT FROM OLD."document_type_id" THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Reached for every INSERT, and for an UPDATE that changes document_type_id.
    SELECT "worker_document_types"."is_active"
    INTO type_is_active
    FROM "public"."worker_document_types"
    WHERE "worker_document_types"."id" = NEW."document_type_id";

    IF type_is_active IS NULL THEN
        RAISE EXCEPTION 'Worker document type % does not exist', NEW."document_type_id";
    END IF;

    IF type_is_active = false THEN
        RAISE EXCEPTION 'Worker document type % is no longer active and cannot accept new documents', NEW."document_type_id"
            USING ERRCODE = 'WDT01';
    END IF;

    RETURN NEW;
END;
$$;
```
This satisfies the narrowed requirement exactly: every `INSERT` is checked (regardless of what `document_type_id` targets); an `UPDATE` is checked only when `document_type_id` itself is changing; an unrelated `UPDATE` to an existing row that stays attached to the same (possibly inactive) type is never blocked here.

**Why this narrowing matters for the replacement RPC (Decision 5):** the safe replacement protocol never does an in-place `UPDATE` of an existing row's `document_type_id`-unrelated columns while keeping the same type — it always inserts a genuinely new row first (Decision 5) — so the trigger's `INSERT`-always-checked branch is the actual, final race-authority for a replacement attempt, exactly as the service-layer preflight (Decision 4) expects it to be. A same-type metadata-only edit (not something this app's own code paths currently perform, but possible in principle) correctly bypasses this trigger by design — it was never a "new document accepted against this type" event.

**Trigger execution order:** Postgres fires same-timing (`BEFORE INSERT`/`BEFORE UPDATE`) triggers in alphabetical order by trigger name. `enforce_active_worker_document_type_trigger` sorts among the two existing ones with no functional dependency between any of the three (each checks an independent invariant and either raises or passes `NEW` through unchanged) — no explicit ordering is required.

### 4. Service-layer preflight in both `uploadWorkerDocument` and `replaceWorkerDocument`, before any storage mutation

**Decision:** immediately after the existing `const documentType = await getDocumentType(documentTypeId);` call in both functions — before `uploadWorkerDocumentFile(...)` is ever invoked — add:
```js
if (!documentType.is_active) {
  throw new Error("Este tipo de documento ya no acepta nuevas cargas.");
}
```
`getDocumentType` already performs a plain `SELECT *`, so `is_active` requires no query change to become available — only this one guard clause, in the one shared call site both functions already use. This is the fast, ordinary-path failure the finding requires: a stale client whose cached catalog still shows a since-retired type fails immediately, with a controlled, friendly, Spanish message, before any storage object is uploaded, before any metadata is touched, and before any existing metadata or storage object is deleted. **This is a UX/defense-in-depth improvement, not the authority**: the database trigger (Decision 3) remains the actual final authority for a genuine race (the type is retired in the narrow window between this preflight check and the actual mutation) — the service-layer check exists to make the *ordinary* stale-client path fail fast and cleanly, without ever reaching storage.

### 5. Safe replacement protocol: a transactional RPC, delete-then-insert, entirely inside one transaction

**Why the prior (insert-then-delete) ordering was wrong:** the previous revision of this document proposed inserting the new metadata row *before* deleting the old one, reasoning that this kept the old row available until the new one durably existed. That ordering is incompatible with the pre-existing `enforce_single_worker_document_file` trigger, which rejects a second row for the same non-`allows_multiple` type/worker/semester scope whenever one already exists. For the exact single-file case `replaceWorkerDocument` exists to serve, the old row is still present at the moment the new row's `INSERT` runs — so `enforce_single_worker_document_file` would reject every ordinary, non-racing replacement outright. Insert-then-delete does not work for this trigger; it must be delete-then-insert.

**Why delete-then-insert is nonetheless safe, given both statements run inside one transaction:** a PL/pgSQL function's own statements execute inside the same transaction as the RPC call that invoked it. If any statement inside the function raises an exception that the function itself does not catch (this function catches nothing), the exception propagates out and aborts the entire transaction — Postgres then rolls back *every* effect the function performed, including a `DELETE` that already ran earlier in the same function body. This is ordinary, built-in transactional rollback, not custom compensating logic: deleting the old row and then having the new row's `INSERT` fail does not leave the old row deleted, because the delete itself is undone along with everything else in the aborted transaction. This is the core fact the corrected design relies on.

**Decision:** replace the current unsafe ordering (upload new storage object → delete old metadata → insert new metadata → best-effort delete old storage, performed as separate, non-transactional client statements) with a new RPC, `replace_worker_document_metadata`, `SECURITY INVOKER` (the default; stated explicitly here for clarity), that performs the following steps entirely inside its own single transaction:

1. Validate all input (every parameter required, none `NULL`).
2. Load the relevant document type with a plain `SELECT` (not `FOR SHARE`/`FOR UPDATE` — see the note below on why a lock here is actually unsafe, not merely unnecessary).
3. Verify `is_active = true`; raise the stable `WDT01` code (Decision 13) if not.
4. Load and lock the existing metadata row(s) for this worker/type/semester (`FOR UPDATE`), capturing their ids and storage paths as they are read.
5. Verify the type does not allow multiple files (`allows_multiple = false`) — replacement is single-file-only; a caller attempting to replace an `allows_multiple` type is defense-in-depth against a direct/hand-crafted call, since the service layer already refuses to invoke this RPC for such a type.
6. (captured together with step 4, since Postgres does not allow `FOR UPDATE` combined with an aggregate query — a plain `FOR ... IN SELECT ... FOR UPDATE LOOP` is used instead of `SELECT array_agg(...) ... FOR UPDATE`.)
7. Delete the superseded metadata row(s).
8. Insert the replacement metadata row.
9. Return the newly inserted metadata's id and the old storage paths, for the caller to remove *after* this transaction commits.

```sql
CREATE OR REPLACE FUNCTION "public"."replace_worker_document_metadata"(
    "p_worker_id" bigint,
    "p_document_type_id" bigint,
    "p_semester_id" bigint,
    "p_file_name" text,
    "p_storage_path" text,
    "p_mime_type" text,
    "p_file_size" bigint
)
RETURNS TABLE("new_document_id" bigint, "old_storage_paths" text[])
LANGUAGE "plpgsql"
SECURITY INVOKER
SET "search_path" = ''
AS $$
DECLARE
    v_is_active boolean;
    v_allows_multiple boolean;
    v_old_row record;
    v_old_ids bigint[] := ARRAY[]::bigint[];
    v_old_paths text[] := ARRAY[]::text[];
    v_new_id bigint;
BEGIN
    -- 1. Validate input.
    IF p_worker_id IS NULL OR p_document_type_id IS NULL
        OR p_file_name IS NULL OR p_storage_path IS NULL
        OR p_mime_type IS NULL OR p_file_size IS NULL THEN
        RAISE EXCEPTION 'Missing required replacement metadata field';
    END IF;

    -- 2. Load the relevant document type. A plain SELECT, not FOR SHARE:
    -- worker_document_types has only a SELECT-only RLS policy (retirement/
    -- rename is applied via migration, never through a client-facing RLS
    -- policy), and Postgres silently excludes rows from a FOR UPDATE/FOR
    -- SHARE locking clause when no policy applicable to that lock exists --
    -- a FOR SHARE lock here would silently see zero rows for every non-
    -- superuser caller, discovered by exercising this RPC under a real
    -- simulated authenticated role in pgTAP, not by inspection alone. A
    -- plain read is sufficient: it observes whatever is currently
    -- committed, exactly like enforce_active_worker_document_type itself
    -- does, and still correctly catches the retirement-race schedule
    -- (finding #3), which is sequential (the retiring transaction fully
    -- commits before this call begins), not a genuinely overlapping race
    -- that a lock would need to arbitrate.
    SELECT "is_active", "allows_multiple"
    INTO v_is_active, v_allows_multiple
    FROM "public"."worker_document_types"
    WHERE "id" = p_document_type_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Worker document type % does not exist', p_document_type_id;
    END IF;

    -- 3. Verify is_active = true.
    IF NOT v_is_active THEN
        RAISE EXCEPTION 'Worker document type % is no longer active and cannot accept new documents', p_document_type_id
            USING ERRCODE = 'WDT01';
    END IF;

    -- 5. Verify the type does not allow multiple files.
    IF v_allows_multiple THEN
        RAISE EXCEPTION 'Worker document type % allows multiple files and cannot be replaced via this operation', p_document_type_id;
    END IF;

    -- 4. + 6. Load, lock, and capture the existing metadata row(s) for this
    -- worker/type/semester. A FOR UPDATE loop is used, not an aggregate
    -- query, because Postgres rejects FOR UPDATE combined with aggregates.
    FOR v_old_row IN
        SELECT "id", "storage_path"
        FROM "public"."worker_documents"
        WHERE "worker_id" = p_worker_id
            AND "document_type_id" = p_document_type_id
            AND "semester_id" IS NOT DISTINCT FROM p_semester_id
        FOR UPDATE
    LOOP
        v_old_ids := array_append(v_old_ids, v_old_row."id");
        v_old_paths := array_append(v_old_paths, v_old_row."storage_path");
    END LOOP;

    -- 7. Delete the superseded metadata row(s), still inside this
    -- transaction.
    IF array_length(v_old_ids, 1) > 0 THEN
        DELETE FROM "public"."worker_documents"
        WHERE "id" = ANY(v_old_ids);
    END IF;

    -- 8. Insert the replacement metadata. Because the old row(s) were
    -- already deleted above IN THIS SAME TRANSACTION,
    -- enforce_single_worker_document_file's own "does a conflicting row
    -- already exist" check sees none -- a normal single-file replacement's
    -- insert proceeds cleanly. If this INSERT fails for ANY reason --
    -- enforce_active_worker_document_type, enforce_single_worker_document_file,
    -- enforce_worker_document_scope, a NOT NULL/CHECK constraint, or RLS's
    -- WITH CHECK -- the exception propagates out of this function
    -- uncaught, aborting the entire transaction. Postgres then
    -- automatically rolls back every effect of this function, including
    -- the DELETE above: the old row(s) are restored exactly as they were,
    -- with zero custom compensating code. The existing single-file
    -- integrity trigger is never disabled, bypassed, or session-suppressed
    -- -- it remains fully active and is what this design relies on to
    -- reject a genuine duplicate.
    INSERT INTO "public"."worker_documents" (
        "worker_id", "document_type_id", "semester_id",
        "file_name", "storage_path", "mime_type", "file_size"
    )
    VALUES (
        p_worker_id, p_document_type_id, p_semester_id,
        p_file_name, p_storage_path, p_mime_type, p_file_size
    )
    RETURNING "id" INTO v_new_id;

    -- 9. Return the new row's id and the old storage paths, to be removed
    -- by the caller only after this transaction has committed.
    RETURN QUERY SELECT v_new_id, v_old_paths;
END;
$$;
```

`SECURITY INVOKER` (explicit, though also the default) means the function runs under the calling client's own role, so the existing ownership-aware RLS (Context) applies to every statement inside it that touches `worker_documents` — the `SELECT ... FOR UPDATE` loop, the `DELETE`, and the `INSERT` — exactly as it already does for direct client calls today: a worker can only load/lock/delete/insert rows for their own `worker_id`; staff/admin can do so for any worker. (The one read against `worker_document_types`, step 2, is a plain, unlocked `SELECT`, governed by that table's own permissive "readable by everyone" policy — see the note on why locking it would be actively wrong, not just unneeded.) No new authorization surface is introduced; this RPC is a transaction-bundling mechanism over statements RLS already governs individually, not an authorization bypass. A rejection caused by RLS (e.g. a worker session attempting this for another worker's `worker_id`) aborts the transaction exactly like any other failure inside the function, restoring whatever was deleted in the same rollback.

**Client-side flow (`replaceWorkerDocument`, revised):**
1. Load the document type; **preflight `is_active` (Decision 4)** — fail immediately, before any storage call, if inactive.
2. Upload the new file to storage (new object, new path — unchanged from today).
3. Call `replace_worker_document_metadata(...)`.
4. **If the RPC call fails** (including a `WDT01` race, an RLS rejection, or any other database error): delete only the newly uploaded storage object; the previous metadata row and previous storage object are completely untouched, because the whole RPC call was one transaction and it never committed — whatever it deleted internally was rolled back along with everything else. Report a controlled failure, never a partial success.
5. **If the RPC call succeeds:** use its returned `old_storage_paths` to remove the old storage object(s) — best-effort, non-fatal on failure, matching this codebase's existing `deleteWorkerDocument`/`storageCleanupFailed` convention. If this post-commit cleanup fails, the client SHALL NOT roll back or delete the new metadata (the database transaction already committed; there is nothing to undo) — it reports a controlled, non-fatal "cleanup failed, an object may need manual removal" outcome, and the successful replacement stands. Orphaned old storage objects left behind by a failed cleanup are handled as a separate, later cleanup concern, not as part of this operation's own success/failure result.

**Race with retirement — the schedule this design must survive:** (1) the client's own preflight sees the type active; (2) the client uploads the new storage object; (3) a separate transaction retires the type (commits); (4) the client calls the replacement RPC; (5) the RPC's own step-2/3 check (plain `SELECT` + `is_active` verification) now observes the type as inactive — since the retiring transaction already committed before the RPC's own transaction began, this is a fresh read of already-committed data, no lock or arbitration needed — and raises `WDT01`; (6) the RPC's transaction never reaches the `DELETE` or `INSERT` steps, so nothing is touched and nothing needs to roll back; (7) the client removes only the newly uploaded storage object; (8) the previous metadata row and previous storage object remain exactly as they were and remain fully usable. This exact schedule is a required test (tasks.md).

**Why a database RPC, not client-orchestrated statements:** two or more separate client round-trips (even delete-then-insert in the right order) cannot be one atomic unit from the database's point of view — a crash, dropped connection, or client-side error between the `DELETE` and the `INSERT` would leave the worker with neither the old nor the new document. A single RPC call is one transaction by construction, giving the all-or-nothing guarantee this feature requires, at negligible extra implementation cost given this codebase's established pattern of small, single-purpose RPCs (`link_worker_account`, `grant_staff_role`, and the six RPCs added by the most recently archived change all follow this shape already).

### 6. `uploadWorkerDocument` needs the preflight only — its existing insert-with-cleanup-on-failure shape is already safe

**Decision:** no RPC, no reordering, for the non-replace path. `uploadWorkerDocument` never deletes anything; a rejected insert (whether from the existing single-file-conflict check, the pre-existing scope/multiplicity triggers, or the new lifecycle trigger) already triggers cleanup of only the just-uploaded storage object, via the existing `insertWorkerDocumentMetadata` catch block. Adding the Decision 4 preflight is the only change this path needs.

### 7. Catalog consumption: a per-worker union of "active" and "has historical documents," never a blanket `is_active` filter at the query layer

**Decision:** do **not** add `.eq("is_active", true)` inside `getWorkerDocumentCategoriesAndTypes()` — that function is worker-independent and globally cached; filtering there would make a retired type's historical documents invisible in every context that reads this catalog. Instead, keep the catalog query returning every row (now including `is_active`), and filter at the two places that already combine the catalog with a *specific target worker's* `worker_documents`.

**The union rule, stated precisely (finding #9):** for a given target worker (the worker whose documents are being viewed — the `workerId` prop `WorkerDocumentsView` receives, never any other worker), a document-type row is included **if and only if**:
- `documentType.is_active === true`; **or**
- that same target worker (and no other) has at least one `worker_documents` row referencing that type.

A type must never appear for a worker merely because some *other* worker has historical documents under it — the inclusion check is always evaluated against `documentsByType` for the one worker currently being viewed, never against any global "does anyone have documents under this type" signal. Concretely, this is already how `documentsByType` is built (`Map<document_type_id, WorkerDocument[]>` derived from that one worker's own `workerDocuments` query result) — the union check is a `documentType.is_active || documentsByType.has(documentType.id)` test against that same per-worker map, introducing no new cross-worker query.

**Rendering for an inactive-but-historical row:**
- Status is never `Pendiente` — an inactive type only ever renders when the target worker has at least one document, so its status is always "Cargado."
- The existing file list, and its view/download/delete actions, render exactly as they do today, governed by the same existing RLS (Context) — no new permission logic.
- The upload/replace `ActionGroup` (the "Seleccionar archivo"/"Subir archivo"/"Reemplazar archivo" controls) is omitted entirely.

**The identical rule applies to `apiWorkerDocuments.ts`'s `addReportStatusToCategories`** (feeding the PDF report via `getWorkerDocumentReportData`, for the one worker the report is being generated for): an active type always appears (even "Pendiente" with no documents, unchanged from today); an inactive type appears only if that report's own worker has documents under it (always "Cargado"); an inactive type with zero documents for that worker is omitted entirely.

**Verification requirement (finding #8):** a fixture with two distinct workers — Worker A (has an existing historical document under a retired type) and Worker B (has none) — proving Worker A's history never causes the retired type to appear when Worker B is the one being viewed. Covered for both the administrator view and the worker self-service view (both render the same `WorkerDocumentsView`), and for the PDF report consumer, which derives its own category/status list independently via `addReportStatusToCategories` and must be checked separately since it is a distinct code path from the live view, even though it starts from the same catalog data.

### 8. `Evidencias bimestrales`'s label and "permite múltiples archivos" hint need zero frontend code changes

**Decision, unchanged from the prior revision:** `WorkerDocumentsView.tsx` already renders `documentType.name` and conditionally renders "Permite múltiples archivos" directly from `documentType.allows_multiple` — both already come straight from the `worker_document_types` row with no hardcoded string anywhere in the component. Renaming the row's `name` column (Decision 2) and leaving `allows_multiple = true` untouched is sufficient on its own.

### 9. Exact identity preservation is proven by capture-then-compare, never by a hard-coded universal ID

**Why not a hard-coded literal:** the prior revision of this document asserted that `Docencia / Evidencias` has `id = 10` and treated that literal as the anchor for both the deployment-time and test-time identity proof. `worker_document_types.id` is `GENERATED BY DEFAULT AS IDENTITY`, and while it is fully reproducible on *this* migration history's fresh reset (verified directly, see Context), the seed does not guarantee that literal value in every database — a different migration history, seed ordering, or environment could assign a different id. Treating `10` as a universal constant would be wrong and would silently pass or fail for the wrong reason if a future seed change shifted it. Identity preservation must instead be proven by capturing the actual id and comparing it, never by asserting what its value is expected to be a priori.

**Decision — two independent capture-then-compare mechanisms, neither depending on a literal:**

1. **Deployment-time (any real environment, local or hosted):** run the preflight query (Decision 11) *before* migrating — it reports the actual current row id for the type named `Evidencias` under `Docencia`, whatever that id happens to be in that specific database. Apply the in-place `UPDATE` migration (Decision 2), which never touches `id`. Run the identical preflight query again *after* migrating, and compare: the same captured id now appears under `Evidencias bimestrales`, with `exists = true`, and its reported `document_count` (already part of Decision 11's query) is unchanged from the pre-migration run, evidencing that every `worker_documents.document_type_id` reference to that id is still valid. This comparison is performed against the two actual query outputs, not against any hard-coded expectation of what the id should be.

2. **Automated-test-time (pgTAP, general mechanism only):** a single pgTAP `.sql` file always runs against an already-fully-migrated database and cannot itself straddle a migration boundary. Identity preservation of the *mechanism* (an in-place `UPDATE` preserves `id`) is proven with a self-contained fixture: insert a test-only `worker_document_types` row (under a category safe for test fixtures) and capture its id immediately via `RETURNING`/`\gset` — a genuine "before" observation, since the test created the row and therefore already knows its id without inferring it from any other attribute. Apply the identical `UPDATE`-based rename statement the real migration uses to that fixture row. Assert that the *same captured id* now carries the new name, with its other columns (`category_id`, `allows_multiple`, `sort_order`) unchanged. Separately (not conflated with the synthetic fixture), also query the real, current catalog for the row now named `Evidencias bimestrales` under `Docencia`, capture *its* actual id live at test-run time, and assert that every `worker_documents` row in the test's own fixture data referencing that id still resolves correctly — again without asserting any specific numeric value for that id ahead of time. This mechanism proof runs as part of the routine pgTAP suite (fast, always on).

3. **Automated-test-time (real migration boundary, the actual seeded row):** although a single pgTAP file cannot straddle a migration, the Supabase CLI itself can: `supabase migration down --local --last N` genuinely rebuilds the local database from scratch and replays migration history up to, but excluding, the last `N` migrations — an official CLI capability, not a file-moving workaround. `supabase/tests/migration-boundary/verify_evidencias_identity_migration_boundary.sh` uses this to capture the *actual seeded* `Docencia / Evidencias` row's id before the real rename migration runs, applies the rest of the migration history (`supabase migration up --local`), and compares against the actual seeded `Evidencias bimestrales` row afterward — real evidence about the real seed data, not a synthetic stand-in. This script is destructive (it resets the local database twice) and is run on demand, not as part of the routine `supabase test db` suite; it always restores the stack to its normal fully-migrated state when it finishes.

None of these three mechanisms infers identity from `category_id`, `sort_order`, or `allows_multiple` alone (each of which could coincidentally match a different row) — all three compare an id captured live against an id captured live at a different point in time.

**The empirically observed value (`id = 10`) is retained in Context strictly as verification evidence** — a record of what this implementation session actually saw on its own local environment — not as a fact any decision, migration, or test in this change depends on being true elsewhere.

### 10. Migration consistency: an explicit post-condition block, covering every named scenario

**Decision:** immediately following the three `UPDATE` statements in Decision 2's migration, a `DO $$ ... $$` block that fails loudly rather than silently succeeding on unexpected state:
```sql
DO $$
DECLARE
    v_docencia_id bigint;
    v_final_evidencias_count int;
    v_plan_trabajo_inactive_count int;
    v_planeaciones_inactive_count int;
BEGIN
    SELECT "id" INTO v_docencia_id
    FROM "public"."worker_document_categories"
    WHERE "name" = 'Docencia';

    IF v_docencia_id IS NULL THEN
        RAISE EXCEPTION 'Docencia category not found; refusing to apply the worker_document_types retirement/rename migration';
    END IF;

    IF EXISTS (
        SELECT 1 FROM "public"."worker_document_types"
        WHERE "category_id" = v_docencia_id AND "name" = 'Evidencias'
    ) THEN
        RAISE EXCEPTION 'A Docencia document type still named "Evidencias" exists after the rename step; refusing to proceed (ambiguous or inconsistent catalog state)';
    END IF;

    SELECT count(*) INTO v_final_evidencias_count
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_docencia_id AND "name" = 'Evidencias bimestrales';

    IF v_final_evidencias_count <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one Docencia document type named "Evidencias bimestrales", found %; refusing to proceed', v_final_evidencias_count;
    END IF;

    SELECT count(*) INTO v_plan_trabajo_inactive_count
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_docencia_id AND "name" = 'Plan de trabajo semestral' AND "is_active" = false;

    IF v_plan_trabajo_inactive_count <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one inactive Docencia document type named "Plan de trabajo semestral", found %; refusing to proceed', v_plan_trabajo_inactive_count;
    END IF;

    SELECT count(*) INTO v_planeaciones_inactive_count
    FROM "public"."worker_document_types"
    WHERE "category_id" = v_docencia_id AND "name" = 'Planeaciones semanales' AND "is_active" = false;

    IF v_planeaciones_inactive_count <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one inactive Docencia document type named "Planeaciones semanales", found %; refusing to proceed', v_planeaciones_inactive_count;
    END IF;
END;
$$;
```
**Behavior for every named scenario:**
| Scenario | Outcome |
|---|---|
| First application: only `Evidencias` exists | The rename `UPDATE` renames it; the post-condition finds exactly one `Evidencias bimestrales`, zero `Evidencias` → succeeds |
| Idempotent re-run: only `Evidencias bimestrales` already exists | The rename `UPDATE` matches zero rows (no-op, no error); the post-condition still finds exactly one `Evidencias bimestrales` → succeeds |
| Neither `Evidencias` nor `Evidencias bimestrales` exists | The rename `UPDATE` matches zero rows; the post-condition's count check finds zero → **raises** |
| Both `Evidencias` and `Evidencias bimestrales` exist simultaneously | The rename `UPDATE` attempts to rename `Evidencias` into a name already taken in the same `(category_id, name)` unique scope → the `UPDATE` itself raises a `unique_violation`, aborting the whole migration transaction before the post-condition block is even reached — the existing `UNIQUE(category_id, name)` constraint is the actual safeguard here, needing no extra code |
| Either retired row (`Plan de trabajo semestral`/`Planeaciones semanales`) is missing | The corresponding inactive-count check finds zero → **raises** |
| An unexpected duplicate (e.g. two rows both named `Evidencias bimestrales` under Docencia) | Structurally prevented by the same `UNIQUE(category_id, name)` constraint — cannot occur |
No path silently creates a replacement `Evidencias`-named row, and every `UPDATE` remains scoped to `category_id = v_docencia_id`, so nothing outside `Docencia` is ever touched by this migration.

### 11. The preflight query returns exactly one row per expected item, missing or not, and is never run against a hosted database automatically

**Decision:** the read-only preflight is redesigned as a `LEFT JOIN` against a fixed `VALUES` list of expected `(category, name)` pairs, so a missing type produces a row of `NULL`s rather than being silently omitted:
```sql
WITH "expected_types" ("category_name", "document_type_name") AS (
    VALUES
        ('Docencia', 'Plan de trabajo semestral'),
        ('Docencia', 'Planeaciones semanales'),
        ('Docencia', 'Evidencias'),
        ('Docencia', 'Evidencias bimestrales')
)
SELECT
    "expected_types"."category_name",
    "expected_types"."document_type_name" AS "expected_name",
    "worker_document_types"."id" AS "document_type_id",
    ("worker_document_types"."id" IS NOT NULL) AS "exists",
    "worker_document_types"."is_active",
    "worker_document_types"."allows_multiple",
    "worker_document_types"."sort_order",
    count("worker_documents"."id") AS "existing_document_count"
FROM "expected_types"
LEFT JOIN "public"."worker_document_categories"
    ON "worker_document_categories"."name" = "expected_types"."category_name"
LEFT JOIN "public"."worker_document_types"
    ON "worker_document_types"."category_id" = "worker_document_categories"."id"
    AND "worker_document_types"."name" = "expected_types"."document_type_name"
LEFT JOIN "public"."worker_documents"
    ON "worker_documents"."document_type_id" = "worker_document_types"."id"
GROUP BY
    "expected_types"."category_name", "expected_types"."document_type_name",
    "worker_document_types"."id", "worker_document_types"."is_active",
    "worker_document_types"."allows_multiple", "worker_document_types"."sort_order"
ORDER BY "expected_types"."document_type_name";
```
Always returns exactly 4 rows. Before this change's migrations, `Evidencias bimestrales`'s row shows `exists = false`; after, `Evidencias`'s row shows `exists = false` and `Evidencias bimestrales` shows the (unchanged) `document_type_id`, `allows_multiple = true`, `sort_order = 60`, and `is_active`. Running the identical query both before and after is how a prior partial application is detected — `Evidencias` and `Evidencias bimestrales` both showing `exists = true` at once is exactly the "both old and new names exist" scenario the migration itself is also hardened against (Decision 10).

**Where this runs:** locally, before implementation verification (task-tracked, part of this change's own apply phase) — and, **separately, only with explicit human approval**, against the target hosted database before any real deployment, per `AGENTS.md`'s existing Supabase safety rules (`db push`/remote inspection already require approval). No remote or hosted operation is performed automatically as part of `/opsx:apply`ing this change; the hosted read is a documented, human-owned follow-up step, not something this change's own implementation executes.

### 12. Generated types: full regeneration via the standard Supabase CLI command, never hand-edited

**Decision, unchanged from the prior revision:** run `bunx supabase gen types typescript --local > src/types/supabase.ts` against the local stack after the new migrations are applied. No manual edit to the generated file.

### 13. Stable lifecycle error contract

**Decision:**
- **PostgreSQL code:** the custom SQLSTATE `WDT01` (5 characters, not colliding with any built-in Postgres code), raised only by `enforce_active_worker_document_type()`'s "type exists but is inactive" branch (Decision 3). The function's other branch ("type does not exist at all") keeps the plain, generic `RAISE EXCEPTION` default (`P0001`), matching the two pre-existing triggers' own "does not exist" checks — that branch is a should-never-happen defensive backstop, not a scenario the frontend needs to distinguish, so it deliberately does not get its own code.
- **Why a dedicated code, not reusing `P0001`:** the two existing triggers *also* raise plain `P0001` for their own, unrelated invariant violations (wrong scope/semester pairing, duplicate single-file upload). If the new trigger reused `P0001`, the frontend could not reliably distinguish "this failed because the type is retired" from those other, differently-actionable failures without fragile message-text matching. A dedicated code lets `apiWorkerDocuments.ts` check `error.code === 'WDT01'` directly.
- **Frontend mapping:** wherever a Postgrest error surfaces from either the trigger directly (the `uploadWorkerDocument` path) or the new RPC (the `replaceWorkerDocument` path), a `WDT01` code is mapped to the exact, controlled, Spanish message: `"Este tipo de documento ya no acepta nuevas cargas."` — the same message the service-layer preflight (Decision 4) already throws for the ordinary (non-race) case, so the user sees one consistent message regardless of which layer caught it. No internal trigger name, function name, or raw SQL detail is ever exposed to the browser. This mapping is implemented once (`mapWorkerDocumentDatabaseError` in `apiWorkerDocuments.ts`) and reused by both `insertWorkerDocumentMetadata` (the ordinary upload path — a race where the type is retired between the preflight and the actual insert now maps to the same controlled message, not the generic "no pudo guardarse" fallback) and `replaceWorkerDocument`.

### 14. A single shared transaction-level advisory-lock namespace serializes retirement against replacement/upload

**Why plain reads were not enough:** Decisions 3 and 5 originally relied on each side (the trigger, the RPC) reading `is_active` with a plain, unlocked `SELECT`, reasoning that the retirement-race schedule in finding #3 is sequential (the retiring transaction fully commits before the other side's transaction begins). That reasoning has a gap: it does not address a *genuinely overlapping* schedule where the retirement's `UPDATE ... SET is_active = false` has executed (and is visible to itself) but has not yet committed, while a concurrent replacement/upload's plain `SELECT` reads the *old, still-committed* `true` value (standard read-committed semantics: a reader never sees another transaction's uncommitted write) — proceeds to delete/insert, and only then does the retirement commit. Both sides can end up believing they went first.

**Decision:** every one of the three places that read or write `is_active` for a given document type first acquires one, single, deterministic transaction-level advisory lock keyed by that type, using exactly the same construction everywhere:
```sql
PERFORM pg_advisory_xact_lock(
    hashtextextended('worker_document_type:lifecycle:' || document_type_id::text, 0)
);
```
- **`enforce_active_worker_document_type()`** (Decision 3): acquires the lock (keyed on `NEW.document_type_id`) immediately before its own `is_active` read, for every `INSERT` and every `document_type_id`-changing `UPDATE`.
- **The retirement/rename migration** (Decision 2): acquires the lock for each of the three affected rows' own ids (looked up first), immediately before that row's own `UPDATE`.
- **`replace_worker_document_metadata`** (Decision 5): acquires the lock (keyed on `p_document_type_id`) immediately before its own `is_active` read, before any other statement touches `worker_documents`.

This is a **transaction-level** (`_xact_`) advisory lock, never a session-level one — it is acquired implicitly at the `PERFORM` call and released automatically at `COMMIT`/`ROLLBACK`, requiring no explicit unlock call and leaving nothing held if the transaction aborts partway through. It is purely an **operation-serialization mechanism**: it does not check or grant any permission, and it does not claim to be a row lock — the actual row lock protecting `worker_documents` metadata rows during replacement remains the existing `FOR UPDATE` loop (Decision 5), unchanged.

**Required semantics, now genuinely guaranteed:**
- If replacement/upload acquires the lock first, it proceeds and commits using the still-active type; the retirement transaction blocks on the *same* lock key until that commit, then proceeds and marks the type inactive — valid, because the document mutation is serialized *before* the retirement in real transaction-commit order, not just in wall-clock start order.
- If retirement acquires the lock first, replacement/upload blocks until the retirement commits, then reads `is_active = false` (now guaranteed committed, not stale) and returns `WDT01` — no previous metadata is lost (nothing was deleted before the block), and the newly uploaded storage object is cleaned up by the client as usual.

**Verified with a genuine two-connection harness, not just reasoning:** `supabase/tests/concurrency/verify_lifecycle_advisory_lock.sh` opens two independent `docker exec` psql connections (not two statements in one pgTAP transaction, which cannot demonstrate real cross-connection blocking) and proves both directions with measured wall-clock blocking (~1.6s observed against a 2s hold, well above a 1.2s minimum-blocking threshold) — see that script's own header comment for exactly what it does and does not prove.

### 15. Browser-discovered defect: Storage keys must strip accented Unicode, not just path separators and whitespace

**The defect:** manual browser verification of the upload flow (task group 14) surfaced a real failure, unrelated to the catalog-lifecycle behavior this change otherwise adds: uploading a file named `Curso de Maestría en Comunicación.pdf` produced a Storage object key containing `Curso-de-Maestría-en-Comunicación.pdf` (raw accented Unicode, only spaces and path separators had been touched), which Supabase Storage rejected with HTTP 400 `InvalidKey`. `sanitizeStorageFileName` (`apiWorkerDocuments.ts`, pre-existing, not introduced by this change) only ever handled `/`, `\`, and whitespace — every accented character (á, é, í, ó, ú, ñ, ü, and their uppercase forms) passed through untouched, and Supabase Storage's key validation rejects raw non-ASCII bytes in an object key.

**The fix (scoped narrowly to the Storage-key segment, not a file-management redesign):** `sanitizeStorageFileName` now: trims; Unicode-normalizes to `NFKD` and strips the resulting combining diacritical marks (`̀`–`ͯ`) — turning `í`→`i`, `ñ`→`n`, `ü`→`u`, etc.; lowercases; replaces `/`/`\`; replaces any run of characters outside `[a-z0-9-_]` with a single `-`; collapses repeated `-`; trims leading/trailing separators; bounds the basename to 100 characters; and falls back to a fixed `archivo` basename if sanitization removes everything. The extension is detected and normalized separately (lowercased, alphanumeric-only) so the result never has more than one final `.` — a leading-dot-only name (`.hiddenfile`) is treated as having no extension, avoiding an earlier draft's `hiddenfile.hiddenfile` duplication bug caught during unit testing, not in the browser.

**What is explicitly unchanged:** `worker_documents.file_name` continues to store `file.name` exactly as given — the sanitizer's output is used *only* to build `storage_path` (via `createWorkerDocumentStoragePath`), never assigned to `file_name`, never used for MIME detection (`getWorkerDocumentMimeType` still reads the real extension from the original name), and never recomputed after the fact — `uploadWorkerDocument` and `replaceWorkerDocument` both compute `storagePath` exactly once and reuse that same value for the actual upload, the metadata insert/RPC call, and any cleanup-on-error. `crypto.randomUUID()` continues prefixing every generated path, so collision-avoidance is unaffected by this fix. No other file-handling behavior (validation, size limits, allowed extensions, replacement/delete flow) was touched.

## Risks / Trade-offs

- **[Risk]** A stale, already-loaded browser tab (5-minute catalog `staleTime`) could still show a retired type's upload controls for up to 5 minutes after the migration is applied. → **Accepted, mitigated by Decisions 3 and 4**: the service-layer preflight catches the ordinary case immediately with a friendly message before any storage mutation; a genuine race (retirement lands in the exact window between the preflight and the actual insert/RPC call) is caught by the trigger, which the client also maps to the identical friendly message (Decision 13) — no raw error ever reaches the user in either case.
- **[Risk]** `worker_documents_seed.test.sql`, `worker_documents_triggers.test.sql`, and `worker_documents_ownership_rls.test.sql` all reference `Docencia / Evidencias` by exact name today and will break once the rename migration is applied. → **Mitigation**: all three are updated as part of this change's own task list (not left for a future change to discover as a regression), preserving every existing ownership/trigger/seed assertion unchanged apart from the one literal name.
- **[Risk]** No documented `gen:types` workflow exists in this repo. → **Accepted**: the standard `supabase gen types typescript --local` invocation is well-established Supabase CLI convention and matches the existing generated file's own shape.
- **[Risk]** This repo has no frontend *component/rendering* test framework. → **Partially addressed**: `bun test` (bundled with the project's existing runtime, no new *runtime* dependency) is used to unit-test pure, extracted helpers — `isDocumentTypeVisibleForWorker`/`filterVisibleDocumentTypes` (the union rule), `addReportStatusToCategories` (the report's identical rule), `mapWorkerDocumentDatabaseError` (WDT01 mapping), and `buildReplacedWorkerDocument` (the RPC-result-to-document mapping) — proving their logic directly rather than only by inspection. Making this typecheck required one new **devDependency**, `@types/bun`, which the user explicitly approved (dev-only; no other dependency added — see tasks.md group 13). Full component rendering and true browser interaction remain manual/console-based, per `AGENTS.md`.
- **[Risk]** Identity preservation (Decision 9) needed a genuine pre/post migration-history proof, not only a synthetic fixture. → **Resolved**: `supabase/tests/migration-boundary/verify_evidencias_identity_migration_boundary.sh` uses `supabase migration down --local --last N` (an official CLI capability that genuinely rebuilds the database up to, but excluding, the retirement/rename migration) to capture the *actual seeded* `Docencia / Evidencias` row's id, then `supabase migration up --local` to apply the rename, then compares against the actual seeded `Evidencias bimestrales` row — real evidence, not a hard-coded literal and not only a synthetic fixture. The pgTAP synthetic-fixture test (task 8.4) remains as a fast, always-run regression check of the general mechanism; this script is the authoritative, on-demand proof of the actual seeded transition and should be re-run whenever the seed or rename migration changes.
- **[Risk]** The corrected replacement RPC deletes superseded metadata before inserting the replacement, inside one transaction. If a caller inspected `worker_documents` from a *different, concurrent* transaction using a lower isolation level than this database's default (`read committed`), it could not observe an unfinished mid-function state anyway, since none of this function's uncommitted writes are visible outside its own transaction until it commits — this is standard Postgres MVCC behavior, not a gap introduced by this design. → **Accepted, no mitigation needed beyond Postgres's own guarantees.**
- **[Risk]** Manually re-running the already-applied seed migration (`20260702145914_worker_document_seed_data.sql`) in isolation, directly against an already-fully-migrated database (i.e. bypassing the normal `supabase db reset`/`migration up`/`db push` sequencing), would insert a *second*, active `Docencia / Evidencias` row: the seed's `INSERT ... ON CONFLICT (category_id, name) DO UPDATE` targets `(category_id, name)`, and after the rename no row matches `(Docencia, 'Evidencias')` any more, so the conflict target misses and a fresh row gets inserted instead of updating the existing (now differently-named) one. → **Assessed, no new trigger added**: this can only happen by deliberately bypassing this project's own migration tooling, which `AGENTS.md` already governs (migrations are always applied in full timestamp order via the standard CLI commands, never cherry-picked). A broad trigger to guard against an out-of-band SQL execution was considered and rejected as disproportionate to a risk that requires bypassing established process to trigger at all; the mitigation is process discipline plus the explicit documentation and verification task above (tasks.md group 3), not new database machinery. A normal full `supabase db reset` was verified (repeatedly, across this session) to always end in the correct final state.

## Migration Plan

1. `ALTER TABLE worker_document_types ADD COLUMN is_active boolean NOT NULL DEFAULT true;` (new migration).
2. A second new migration: deactivate `Docencia / Plan de trabajo semestral`, deactivate `Docencia / Planeaciones semanales`, rename `Docencia / Evidencias` → `Evidencias bimestrales`, each scoped by a `Docencia`-category join, followed by the full post-condition block (Decision 10).
3. A third new migration: `enforce_active_worker_document_type()` (narrowly scoped per Decision 3) + its trigger.
4. A fourth new migration: `replace_worker_document_metadata(...)` RPC — `SECURITY INVOKER`, delete-then-insert entirely inside its own transaction (Decision 5).
5. pgTAP coverage for all of the above, including the transactional-rollback scenarios (inactive-type rejection, insert failure, RLS rejection), the retirement-race schedule, single-file-trigger compatibility, and RLS-preserving rollback (Decision 5) — plus updating the three pre-existing files that reference `Docencia / Evidencias` by name (`worker_documents_seed.test.sql`, `worker_documents_triggers.test.sql`, `worker_documents_ownership_rls.test.sql`).
6. Frontend: `apiWorkerDocuments.ts`'s `uploadWorkerDocument`/`replaceWorkerDocument` (preflight + the new RPC-based replace flow), `WorkerDocumentsView.tsx`'s row-inclusion logic, `addReportStatusToCategories`'s identical union rule.
7. Update `docs/ai/api.md`, `docs/ai/architecture.md`, `docs/ai/testing.md` references from `Evidencias` to `Evidencias bimestrales`.
8. Regenerate `src/types/supabase.ts` (Decision 12).
9. Run the local read-only preflight query (Decision 11) before and after applying the migrations, recording both results.
10. Manual verification: fresh `bunx supabase db reset`, then walk both the admin and worker self-service views with the Worker A/Worker B fixture (Decision 7), confirm the PDF report's independent behavior, confirm a direct stale-`document_type_id` insert/replace attempt is rejected with the controlled message, and confirm a real replacement attempt against an active type succeeds with the previous storage object removed only after the database commit.
11. No remote/hosted step of any kind performed automatically; the hosted preflight read (Decision 11) is a separate, human-approved follow-up, never run during `/opsx:apply`.

**Rollback — corrected, not "safe at any point" (finding #12):**
- **Frontend filtering** (the union-rule changes in `WorkerDocumentsView.tsx` and the report helper) can be reverted relatively easily and independently of the database changes — but doing so *changes visible behavior*: rolling back only the frontend while the database migrations remain applied would make every `is_active = false` type's row disappear entirely again (including historical-only rows for workers who have documents under them), since the old frontend code has no concept of the union rule at all. This is a real behavior change, not a no-op, and should not be treated as consequence-free.
- **Reverting `is_active` flags and the rename** (i.e., setting the two retired types back to active and renaming `Evidencias bimestrales` back to `Evidencias`) requires reviewing production data first: any document uploaded against `Evidencias bimestrales` *after* this change deployed is a real, worker-submitted file under that name — reverting the name without reviewing what was uploaded in the interim risks presenting those uploads under a reverted label without the context of when the rename happened. This is not a mechanical, always-safe operation.
- **No destructive down-migration is expected or provided.** Reverting the column, trigger, or RPC (if ever fully undoing this change) is additive-safe *in isolation* (dropping a column, function, and trigger that nothing else depends on), but is only meaningful alongside the data/frontend review above, not as a substitute for it.
- **Applied migration files are never edited**, in either direction — a genuine rollback is a new, forward migration reverting the prior one's effect, exactly like any other change in this repository's history.

**What "no deletion" actually means in this change (finding #6 — precise, not blanket):** the claim that this change never deletes anything applies specifically and only to the **catalog migration** (retiring/renaming `worker_document_types` rows never deletes a document type, a `worker_documents` row, or a storage object — Decision 2). It does **not** apply to a successful replacement, which by design (Decision 5) intentionally deletes the superseded `worker_documents` metadata row inside its own committed transaction, and intentionally removes the superseded storage object after that commit succeeds — this is the feature working as intended, not a defect. A **failed** replacement is held to the stricter standard: it must never delete previous metadata or the previous storage object, and may only clean up the newly uploaded, uncommitted replacement object. These three cases are distinct and must not be collapsed into a single "nothing is ever deleted" statement, which was ambiguous in the prior revision of this document and is corrected here and in tasks.md's archive-readiness checklist.

## Open Questions

_None blocking._ The type-regeneration command (Decision 12), the union-based catalog filtering (Decision 7), the capture-then-compare identity strategy (Decision 9), and the stable error contract (Decision 13) are all resolved design decisions, flagged here only so a reviewer knows they were deliberated, not overlooked.
