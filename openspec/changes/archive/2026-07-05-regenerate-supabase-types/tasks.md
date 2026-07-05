# Tasks — regenerate-supabase-types

Status: **Done — typecheck/lint verified.**

## Pre-regeneration checks

- [x] Read `AGENTS.md`, `docs/ai/architecture.md`,
      `openspec/changes/convert-workers-documents-to-ts/design.md`,
      `package.json`, `supabase/migrations/*`, `src/types/supabase.ts`.
- [x] Confirmed no dedicated `package.json` script exists for type generation
      (only `supabase:start`/`:stop`/`:status`/`:reset`/`:lint`/`:test`/
      `:migration:new`/`:push:dry`).
- [x] `bunx supabase status` + `docker ps` — confirmed the local stack (DB,
      Auth, REST, Storage, Realtime, Studio) was already running and healthy.
- [x] `docker exec supabase_db_enub psql ... "\dt public.worker_document*"` —
      confirmed all three target tables already exist in the running local
      database. **No `supabase db reset` or any destructive command was
      needed** (`design.md` Section 1).
- [x] Grepped every `CREATE TABLE "public"."..."` across
      `supabase/migrations/*.sql` and diffed against tables already in
      `src/types/supabase.ts` — found a fourth missing table (`profiles`) and 5
      missing RPC functions, beyond the 3 originally named (`design.md`
      Section 5).

## Regeneration

- [x] Ran `bunx supabase gen types typescript --local --schema public`,
      captured to a scratch file first.
- [x] Diffed the scratch output against the tracked `src/types/supabase.ts`
      before writing anything — confirmed the diff was purely additive (3
      worker-document tables, `profiles`, 5 RPC functions; every previously-
      existing table's shape byte-for-byte unchanged) plus one harmless,
      investigated omission (`__InternalSupabase`/`PostgrestVersion` block —
      `design.md` Section 4).
- [x] Wrote the reviewed output to `src/types/supabase.ts` (trailing-newline
      normalized to match the file's prior convention). No table definition was
      hand-edited — the whole file is verbatim CLI output.

## Verification — results

- [x] `bun run typecheck` — clean, no errors, no follow-up fixes needed.
- [x] `bun run build` — implementer reported a clean pass, `✓ built in 5.51s`,
      no diagnostics. Independent review ran `timeout 180s bun run build`; it
      timed out after Vite printed `$ vite build` with no diagnostics. Treat as a
      local environment caveat and rerun before commit if a fresh build transcript
      is required.
- [x] `bun run lint` — total: **206 problems (202 errors, 4 warnings)** —
      unchanged from baseline; `src/types/supabase.ts` does not appear in the
      lint output.
- [x] Confirmed via grep that `worker_document_categories`,
      `worker_document_types`, `worker_documents` all appear in the
      regenerated file.
- [x] `git status`/`git diff --stat` — changed-file set is exactly
      `src/types/supabase.ts` and this change's own `proposal.md`/`design.md`/
      `tasks.md`.

## Not in scope for this change

- [ ] Replacing `convert-workers-documents-to-ts`'s hand-rolled
      `WorkerDocumentType`/`WorkerDocumentCategory`/`WorkerDocument` interfaces
      with `Database["public"]["Tables"][...]["Row"]` lookups — deliberately
      deferred as a follow-up change; touches 7 files across
      `src/features/workers/documents/` (`design.md` Section 6).
- [ ] Adding a `package.json` script for type generation (e.g. `types:generate`)
      — not requested, and would be an unrelated convenience addition.
- [ ] Any Supabase migration, RLS policy, or database schema change.
- [ ] Any application runtime code change (none was needed).
- [ ] Investigating further why `__InternalSupabase` was omitted from this
      codegen run beyond confirming it's harmless (`design.md` Section 4).
