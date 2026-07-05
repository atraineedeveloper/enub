# Design: Regenerate Supabase Types

## 1. Local stack was already running with the target migrations applied — no reset needed

Checked non-destructively before doing anything else, per the "prefer non-
destructive commands first" instruction:

- `bunx supabase status` — reported the DB and REST/Auth/Storage/Realtime/Studio
  containers up; only `imgproxy`/`edge_runtime`/`pooler` (irrelevant to codegen)
  were stopped.
- `docker ps` — confirmed `supabase_db_enub` has been `Up ... (healthy)` for
  hours, i.e. a long-running local instance, not a fresh one.
- `docker exec supabase_db_enub psql -U postgres -d postgres -c "\dt public.worker_document*"`
  — confirmed all three worker-document tables already exist **in the running
  database**. The gap was entirely in the generated TypeScript file, never in the
  schema or the local Postgres instance itself.

Conclusion: no `supabase db reset`, migration replay, or any destructive command
was necessary at any point. This is documented here per the explicit instruction
to call out clearly if a reset were needed — it was not.

## 2. Regeneration command

```
bunx supabase gen types typescript --local --schema public
```

- `--local` — generates from the local dev database (the one already confirmed
  running in Section 1), not a linked/remote project. No `--linked` project is
  configured for this repo in this environment, and using the remote path would
  have required credentials/approval per `AGENTS.md`'s Supabase safety rules —
  `--local` avoids that entirely and matches the "prefer the existing
  project/local Supabase workflow" instruction.
- `--schema public` — matches the single schema already represented in the
  existing file (no `auth`/`storage`/other schema types were ever generated
  here); keeps the regeneration scoped to exactly what was there before, just
  brought current.
- Output was captured to a scratch file first
  (`/tmp/.../scratchpad/supabase.ts.new`) and diffed against the tracked file
  before being written into place, so the exact change could be reviewed rather
  than blindly overwriting a tracked file with command output.

No dedicated `package.json` script exists for this (only `supabase:start`,
`:stop`, `:status`, `:reset`, `:lint`, `:test`, `:migration:new`, `:push:dry` are
defined) — ran the CLI directly via `bunx`, consistent with how every other
`bunx supabase ...` command in `AGENTS.md`'s allowed-commands list is invoked.

## 3. Diff review before writing

`diff -u` between the old tracked file and the new output showed exactly three
categories of change, all additive:

1. **Three tables added**: `worker_document_categories`, `worker_document_types`,
   `worker_documents` — column-for-column identical to the hand-rolled interfaces
   written in `convert-workers-documents-to-ts` Phase 3 (`useWorkerDocumentCatalog.ts`,
   `useWorkerDocuments.ts`), which independently validates that phase's manual
   reasoning from the raw SQL migrations: `category_id`/`document_type_id`/
   `worker_id` all `NOT NULL` (bare `number`, no `| null`), `semester_id`/
   `uploaded_by` nullable, `Relationships` confirming `worker_documents` is the
   FK-holding ("many") side pointing at `worker_document_types`/`semesters`/
   `workers` (`isOneToOne: false` on all three) — the same to-many-from-the-
   child's-own-column-perspective reasoning applied throughout this migration.
2. **One table added**: `profiles` (Section 4 below).
3. **`Functions` populated**: `current_app_role`, `current_worker_id`,
   `grant_staff_role`, `link_worker_account`, `unlink_worker_account` — matching
   `docs/ai/architecture.md`'s description of the RLS/role-check/account-linking
   functions almost exactly by name.

No existing table's `Row`/`Insert`/`Update`/`Relationships` shape changed —
`date_of_admissions`, `degrees`, `groups`, `roles`, `schedule_assignments`,
`schedule_teachers`, `semesters`, `state_roles`, `study_programs`, `subjects`,
`sustenance_plazas`, `utilities`, `workers` are byte-for-byte identical to before
(only their position in the diff shifted because of the newly-inserted tables
around them, alphabetically). This means every `Database["public"]["Tables"][...]`
lookup already used by any `.ts`/`.tsx` file in the codebase keeps typing exactly
as before — the reason `bun run typecheck` needed zero follow-up fixes.

## 4. `__InternalSupabase`/`PostgrestVersion` block disappeared — investigated, confirmed harmless

The previously-tracked file had:

```ts
export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: { ... }
}
```

The regenerated file omits this block entirely (this CLI/postgres-meta version's
`--local` output apparently doesn't emit it, or emits it only when it can
positively detect a PostgREST version format it recognizes — not confirmed from
CLI docs, but empirically absent from this run's output). Checked whether this
matters: `src/services/supabase.js` calls `createClient(supabaseUrl, supabaseKey)`
with **no** `Database` generic argument at all — the `Database` type is only
referenced there via a `/** @type {...} */` JSDoc comment for editor
autocompletion, never as `createClient<Database, {...}>(...)`. Every other
consumer in the codebase (`useWorkers.ts`, `useSemesters.ts`, etc.) indexes
`Database["public"]["Tables"][...]["Row"]` directly and never touches
`__InternalSupabase`. The lower boilerplate line
`type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">` (near the
bottom of the file) still compiles fine even though the key it's omitting no
longer exists on `Database` — `Omit` doesn't require the key to be present.
Net effect: zero behavior or type-safety change from this omission. Flagged here
for visibility, not treated as a problem to fix.

## 5. Unplanned discovery: `profiles` (and 5 RPC functions) were also stale-missing

Before regenerating, grepped every `CREATE TABLE "public"."..."` across
`supabase/migrations/*.sql` and diffed against the table names already present in
the old `src/types/supabase.ts`:

```
grep -rhoE 'CREATE TABLE "public"\."[a-z_]+"' supabase/migrations/*.sql \
  | sed -E 's/CREATE TABLE "public"\."([a-z_]+)"/\1/' | sort -u
```

Result: `profiles`, `worker_document_categories`, `worker_documents`,
`worker_document_types` — four tables, not three. Cross-checked migration
filenames: `supabase/migrations/20260702000000_remote_schema.sql` is a base
schema dump (the source of every table already in the old file);
`profiles.sql` (`20260703002441`) and every `worker_document*.sql` migration are
all later, individual migrations layered on top of that dump. Nothing has
regenerated types since that base dump — the gap is total for anything added
after it, not specific to the three tables the original discovery named.

This is called out explicitly in `proposal.md` as an unplanned-but-correct
consequence of the fix: a `gen types` run operates on the whole `public` schema,
there's no per-table codegen mode, and `profiles` genuinely exists in the
database (confirmed via the same `\dt` check as Section 1, and consistent with
`docs/ai/architecture.md`'s description of the profile/role model as an already-
shipped, in-production concept — not new work invented by this change).

## 6. Why the Phase 3 hand-rolled interfaces are *not* replaced in this change

`convert-workers-documents-to-ts`'s `WorkerDocumentType`, `WorkerDocumentCategory`
(`useWorkerDocumentCatalog.ts`) and `WorkerDocument` (`useWorkerDocuments.ts`)
interfaces could now be replaced with
`Database["public"]["Tables"]["worker_document_types"]["Row"]` etc. Not done
here, per the task's own instruction ("may remain for now unless they can be
safely replaced without broadening scope... document as a follow-up"):

- `WorkerDocumentCategory`/`WorkerDocumentReportCategory`/
  `WorkerDocumentReportDocumentType` in `useWorkerDocumentReportData.ts` compose
  these hand-rolled types with extra runtime-computed fields
  (`document_types`, `documents`, `status`, `uploaded_at`) that don't exist on
  the generated `Row` types at all — swapping the base interface would still
  need to preserve every one of those `extends`/`Omit` compositions.
- The hand-rolled types are re-exported and imported across 7 files in
  `src/features/workers/documents/` (`useWorkerDocumentCatalog.ts`,
  `useWorkerDocuments.ts`, `useWorkerDocumentsBySemester.ts`,
  `useUploadWorkerDocument.ts`, `useReplaceWorkerDocument.ts`,
  `useWorkerDocumentReportData.ts`, `WorkerDocumentsView.tsx`) — swapping the
  source of truth touches every one of them, which is a second migration-sized
  change of its own, not a natural side effect of "regenerate the types file."
- Doing it here would silently expand this change's blast radius past
  `src/types/supabase.ts` into application code exactly where the task said not
  to ("do not modify application runtime code unless the regenerated types
  reveal a compile error that must be addressed" — they didn't).

Recorded as a follow-up in `tasks.md`'s "Not in scope" section rather than
attempted partially here.

## 7. Verification — results

- [x] `bun run typecheck` — clean, no errors (0 follow-up fixes needed — every
      pre-existing table's shape is unchanged; see Section 3).
- [x] `bun run build` — implementer reported a clean pass, `✓ built in 5.51s`,
      no diagnostics. Independent review ran `timeout 180s bun run build`; it
      timed out after Vite printed `$ vite build` with no diagnostics. Treat as a
      local environment caveat and rerun before commit if a fresh build transcript
      is required.
- [x] `bun run lint` — total: **206 problems (202 errors, 4 warnings)** —
      unchanged from baseline; confirmed `src/types/supabase.ts` itself does not
      appear anywhere in the lint output, before or after.
- [x] Confirmed via grep that `worker_document_categories`, `worker_document_types`,
      `worker_documents` all appear in the regenerated `src/types/supabase.ts`.
- [x] `git status`/`git diff --stat` — changed-file set is exactly
      `src/types/supabase.ts` and this change's own `proposal.md`/`design.md`/
      `tasks.md`. No migration, RLS policy, application code, or dependency file
      touched.
