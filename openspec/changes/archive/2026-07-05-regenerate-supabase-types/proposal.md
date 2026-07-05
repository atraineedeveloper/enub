# Proposal: Regenerate Supabase Types

## Status

Done — types regenerated and verified.

## Why

While converting `src/features/workers/documents/` to TypeScript
(`convert-workers-documents-to-ts`, Phase 3), we discovered that
`src/types/supabase.ts` — the generated `Database` type used throughout the TS
migration — was missing three real tables: `worker_document_categories`,
`worker_document_types`, `worker_documents`. Since the migrations that created
those tables (`supabase/migrations/20260702145810_worker_document_categories.sql`
and neighbors) postdate whenever this file was last generated, Phase 3 hand-rolled
local interfaces matching the migrations' columns rather than editing the
generated file directly (see that change's `design.md` Sections 18–20).

`src/types/supabase.ts` is a generated artifact — its `Database` boilerplate and
helper types are Supabase CLI output. The correct fix is to regenerate it from
the real schema, not to hand-patch table definitions into a file that's supposed
to be a faithful mirror of the database.

## What changes

- `src/types/supabase.ts` is regenerated in full from the local Supabase
  Postgres schema via `bunx supabase gen types typescript --local --schema public`.

## Unplanned discovery: `profiles` was also missing

Grepping every `CREATE TABLE "public"."..."` statement across
`supabase/migrations/*.sql` and comparing against the tables already present in
`src/types/supabase.ts` showed a fourth missing table: `profiles` (created by
`supabase/migrations/20260703002441_profiles.sql`), plus five RPC functions
(`current_app_role`, `current_worker_id`, `grant_staff_role`,
`link_worker_account`, `unlink_worker_account`) that were entirely absent from
the `Functions` section. `docs/ai/architecture.md`'s "Auth/profile model" section
describes `profiles` and these functions as core, already-shipped parts of the
app — they were simply never captured by the last codegen run
(`supabase/migrations/20260702000000_remote_schema.sql` is the base schema dump
that produced the file currently in the repo; everything created by a later
migration was missing until this regeneration).

This is in scope: a full `gen types` run necessarily regenerates the whole
`public` schema — there is no way to regenerate only the three worker-document
tables the original discovery named. Including `profiles`/the RPC functions is a
correct, unavoidable side effect of fixing the actual problem (a stale generated
file), not scope creep into unrelated migration work. No migration, RLS policy, or
schema was touched to produce this — the tables and functions already existed in
the database; only the generated type file was out of date.

## What does not change

- No Supabase migration added, edited, or reordered.
- No database schema, table, column, or RLS policy changed.
- No dependency added.
- No application runtime code changed — regenerating types surfaced zero
  compile errors (see `design.md` for why: the addition of new tables/functions
  to `Database` is purely additive from every existing consumer's perspective).
- The hand-rolled `WorkerDocumentType`/`WorkerDocumentCategory`/`WorkerDocument`
  interfaces added in `convert-workers-documents-to-ts` Phase 3 are **not**
  replaced with `Database["public"]["Tables"][...]["Row"]` lookups in this
  change — see `design.md` for why that's deliberately deferred as a follow-up
  rather than done here.

## Impact

- **Affected code:** `src/types/supabase.ts` only.
- **Affected lint baseline:** unchanged (206 problems before and after; the file
  was never part of the lint baseline).
