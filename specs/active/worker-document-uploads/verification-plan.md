# Verification Plan - Worker Document Uploads (Database Layer)

## Status

Draft - describes how the schema in `database-plan.md` will be verified once migrations exist. No migrations exist yet, so none of these steps can run today.

## Scope

This plan covers verifying the **database and storage layer** (categories, document types, `worker_documents`, RLS, storage bucket). It complements — does not replace — the feature-level "Verification plan" already in `spec.md`, which covers the UI/route once built.

## Environment constraints (from `AGENTS.md`)

- Fedora + Bun. Supabase CLI must be invoked as `bunx supabase <command>`.
- Local Supabase requires Docker Engine running.
- Allowed local commands only: `bunx supabase status`, `start`, `stop`, `migration new <name>`, `db reset`, `db lint`, `migration list`, plus `bun run build`, `bun run lint`.
- Commands requiring explicit human approval (not to run autonomously): `login`, `link --project-ref`, `db pull`, `db push --dry-run`, `db push`.
- Forbidden outright: `db reset --linked`, `db reset --db-url ...`, `migration repair`, anything that prints/stores/commits secrets, anything that modifies remote Supabase without approval.
- **This plan never pushes to remote Supabase and never runs destructive remote commands.** All verification is local-only.
- No `.env`, `.env.local`, access tokens, service role keys, or DB passwords are read aloud, printed, or committed at any step.

## 1. Pre-flight

- [ ] Confirm Docker is running (`docker info` or equivalent) before touching Supabase — `bunx supabase start`/`db reset` will fail without it.
- [ ] `bunx supabase status` — confirm local stack is up, or start it with `bunx supabase start`.
- [ ] `git status` on `supabase/migrations/` — confirm no unexpected pending migration files before adding new ones.

## 2. Migration authoring checks (once migrations are written)

- [ ] Each new object (categories, types, `worker_documents`, storage bucket, RLS policies, seed inserts) lands in its own migration file via `bunx supabase migration new <descriptive_name>`, matching the task breakdown in `tasks.md` Phase 2, not one giant migration.
- [ ] Migration file names/order are reviewed manually — confirm `worker_document_categories` and `worker_document_types` migrations run before `worker_documents` (FK dependency), and before the seed-data migration.
- [ ] `bunx supabase db lint` — run after each new migration is added, not just at the end, to catch issues early.

## 3. Local reset and full-schema validation

- [ ] `bunx supabase db reset` — rebuilds the local DB from scratch (all migrations + `supabase/seed.sql`) and must succeed with no errors. This is the primary correctness gate: if `db reset` fails, the migration is wrong.
- [ ] `bunx supabase db lint` — run again post-reset against the fully migrated schema.
- [ ] `bunx supabase migration list` — confirm local migration history matches the files on disk (no drift, no missing entries).

## 4. Schema shape verification (via local Studio at `http://127.0.0.1:54323` or `psql` against the local DB only — never remote)

- [ ] `worker_document_categories` has exactly 5 rows (Datos personales, Docencia, Tutoría, Asesoría, Investigación) with correct `scope` values.
- [ ] `worker_document_types` row count and `allows_multiple` flags match Section 5 of `database-plan.md` exactly — spot check that only the three Evidencias-named types have `allows_multiple = true`.
- [ ] `worker_documents` FKs resolve correctly: `worker_id → workers.id`, `document_type_id → worker_document_types.id`, `semester_id → semesters.id` (nullable).
- [ ] Confirm `workers.id` and `semesters.id` are still `bigint` (unchanged) and the new FK columns match that type — a type mismatch here would be a migration bug, not just a lint warning.

## 5. Constraint / trigger behavior (manual SQL against local DB)

Both triggers in `database-plan.md` Section 2.4 are confirmed and must be implemented — this section is not conditional.

- [ ] Insert a permanent-scope document (`semester_id = NULL`) for a Datos personales type — succeeds.
- [ ] Attempt to insert a Datos personales document with a non-null `semester_id` — must be rejected by the scope-consistency trigger.
- [ ] Attempt to insert a Docencia document with `semester_id = NULL` — must be rejected.
- [ ] Insert a single-file type document (e.g. "CURP") once — succeeds. Insert a second row for the same `(worker_id, document_type_id, semester_id)` — must be rejected by the single-active-file trigger.
- [ ] Insert two rows for an Evidencias-type document with the same `(worker_id, document_type_id, semester_id)` — both must succeed (multiple files allowed).
- [ ] Attempt to insert a `worker_documents` row with `file_size > 10485760` — must be rejected by the `CHECK` constraint.
- [ ] Once `apiWorkerDocuments.js` exists (Phase 3): replace a single-file document end-to-end (delete old storage object + row, insert new row) and confirm the trigger does not block the app's own delete-then-insert sequence — only a true duplicate insert without a prior delete should be rejected.

## 6. RLS verification (local DB, both `anon` and `authenticated` roles)

Use the local anon key and a local test-authenticated session (via `supabase.auth.signInWithPassword` against the local auth stack, or `SET ROLE`/`request.jwt.claims` in a local `psql` session) — never real user credentials, never remote.

- [ ] As `anon`: `SELECT` on `worker_document_categories` and `worker_document_types` succeeds (reference data, intentionally public).
- [ ] As `anon`: `SELECT` on `worker_documents` is **denied** (empty result / permission error) — confirms the stricter-than-`workers` policy is actually in effect.
- [ ] As `anon`: `INSERT`/`UPDATE`/`DELETE` on `worker_documents` is denied.
- [ ] As `authenticated`: `SELECT`/`INSERT`/`UPDATE`/`DELETE` on `worker_documents` succeed, for **any** worker_id — confirm no ownership scoping is accidentally introduced, since the confirmed access model (`decisions.md` #11) is staff-facing/any-authenticated-user, not per-worker.
- [ ] As `anon`: cannot read or write objects in the `worker_documents` storage bucket.
- [ ] As `authenticated`: can upload to and read (via signed URL, not public URL) the `worker_documents` bucket.

## 7. Storage bucket verification

- [ ] Bucket `worker_documents` exists after `db reset` (created via migration, not manually) — confirms the gap noted in `database-plan.md` Section 1.6 doesn't repeat for this bucket.
- [ ] Bucket is `public = false`.
- [ ] `createSignedUrl` produces a working, time-limited URL for an uploaded document; the URL is unusable without the signature/expiry (confirms the private-bucket approach from `decisions.md` #13 actually works end-to-end).
- [ ] Grep the implementation for `getPublicUrl` scoped to the `worker_documents` bucket — confirm it is not used anywhere (only `profile_pictures` should use it).
- [ ] Upload a file exceeding 10 MB — rejected at the bucket's `file_size_limit`.
- [ ] Upload a disallowed MIME type (e.g. `.exe` renamed to look innocuous) — rejected by `allowed_mime_types`.
- [ ] Upload each accepted type (`.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.jpg`, `.jpeg`, `.png`, `.webp`) under 10 MB — all succeed.
- [ ] Generated storage paths follow the `{worker_id}/{document_type_id}/{semester_id|'permanent'}/...` convention and don't collide across workers/types/semesters.

## 7A. Automated database QA with pgTAP

Run the automated database QA suite locally only:

```sh
bunx supabase db reset
bunx supabase test db --local
bunx supabase db lint
```

The suite lives under `supabase/tests/database/` and covers:

- Worker document schema shape: required tables, bigint FK columns, `UNIQUE(storage_path)`, and the 10 MB file-size constraint.
- Seed data: exactly 5 categories, exactly 29 document types, permanent vs semester scopes, and the three allowed multiple Evidencias document types.
- Trigger behavior: permanent/semester scope consistency, duplicate single-file rejection, multiple Evidencias acceptance, delete-old-row-then-insert-new replacement, and file-size rejection.
- RLS/storage policy configuration: public reference-data reads, authenticated-only `worker_documents` access, private `worker_documents` bucket configuration, and authenticated-only storage object policies.

After enabling pgTAP, `bunx supabase db lint` may report findings inside `extensions.*`. These come from pgTAP's bundled extension functions and are expected. Findings inside project-owned schemas, tables, or functions should still be treated as real issues.

What remains manual:

- Browser verification of `/workers/:id/documents`.
- Real upload/view/download behavior through Supabase Storage signed URLs.
- MIME-type enforcement for every accepted/disallowed file type.
- Report download UX.
- Secret hygiene review before commit.

## 8. App-level build/lint gates

- [ ] `bun run lint` — passes with no new violations.
- [ ] `bun run build` — succeeds (only meaningful once Phase 3+ data-access code exists; for the database-only phase this mainly guards against accidental unrelated breakage).

## 9. Secret hygiene

- [ ] `git status` / `git diff` reviewed before any commit — confirm no `.env`, `.env.local`, access tokens, service role keys, or DB passwords are staged.
- [ ] No migration or seed file embeds a real secret (local dev keys from `supabase status` output are not committed either, even though they're low-risk local-only values).

## 10. Explicit non-goals for this verification pass

- No `bunx supabase db push` (with or without `--dry-run`) — requires explicit human approval per `AGENTS.md` and is out of scope until the feature is fully built and reviewed.
- No `bunx supabase link` or `login` — not needed for local-only verification.
- No remote `db reset` or `db pull` under any circumstance.
- UI/manual browser verification of `/workers/:id/documents` is out of scope here — it belongs to the feature-level verification plan in `spec.md` once Phase 5 (UI) exists.
- No verification of per-worker ownership restrictions, worker self-service login, or a dirección/admin role tier — these are explicitly deferred (`decisions.md` #11, `database-plan.md` Section 7) and are not part of this feature.
- No fix or verification of the pre-existing `profile_pictures` bucket migration gap — tracked as a separate future follow-up (`decisions.md` #14).
