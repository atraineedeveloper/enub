# Verification Plan - Worker Self-Service Documents

**Revised after security review** — new scenarios are marked **(security revision)**. These are not optional hardening; they directly verify the fixes for the reported privilege-escalation risk.

## Automated

- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bunx supabase db reset`
- [ ] `bunx supabase db lint`
- [ ] `bunx supabase test db --local` (includes the new `profiles`/RLS pgTAP suite from `tasks.md` Phase 9, alongside the existing `worker_documents_*` suite)

## Manual setup (local)

1. `bunx supabase start` / confirm local stack is up.
2. Create local test auth users (Studio or `supabase.auth.admin` via a local script — never against a remote project):
   - `staff-test@example.com` — will be covered by the backfill migration if created *before* it runs; otherwise granted via `grant_staff_role` (test both paths, see below).
   - `worker-test@example.com` — to be linked to a specific `workers` row.
   - `unlinked-test@example.com` — **(security revision, new)** created but deliberately left unlinked, to verify the "pending access" path.
3. Bootstrap one `admin` profile (per [[database-plan#bootstrapping-the-first-admin]]) for a third account, `admin-test@example.com`.
4. Pick or create one `workers` row to link (`worker-test@example.com`'s counterpart).

## (security revision) Default-deny verification — do this first

These scenarios verify the core fix and should be checked before anything else, since a regression here reintroduces the original privilege-escalation bug:

- [ ] Log in as `unlinked-test@example.com` (a real Auth account with **no** `profiles` row). Confirm landing on `/pending-access`, not the staff dashboard and not `/my-documents`.
- [ ] While logged in as `unlinked-test@example.com`, manually navigate to `/dashboard`, `/workers`, `/workers/:id/documents` for any id, and `/my-documents`. Confirm every one of them redirects to `/pending-access` — none of them render staff content or worker document content.
- [ ] Directly query, from the browser console using the app's Supabase client while logged in as `unlinked-test@example.com`: `worker_documents`, `workers`, and `storage.from('worker_documents').list(...)`. Confirm all return zero rows / denied, not an error that happens to expose data.
- [ ] Confirm `SELECT public.current_app_role()` and `SELECT public.current_worker_id()` (run as this user, e.g. via a debug RPC or by inspecting a query that surfaces them) return `NULL`, not `'staff'` or any other value.
- [ ] Repeat the above with a second, completely fresh Auth account created *after* all migrations have already run (simulating "admin creates a new worker's Auth account in Studio and forgets to link it immediately," the exact scenario that motivated this revision). Confirm identical behavior.

## Regression: staff/admin behavior unchanged (via the backfill migration)

- [ ] Confirm `staff-test@example.com`, if created *before* the backfill migration ran, has a `profiles` row with `role = 'staff'` after `bunx supabase db reset`.
- [ ] Log in as that account. Confirm full app access identical to pre-feature behavior: all Records routes, `/workers`, `/workers/:id/documents` for any worker id.
- [ ] **(security revision, new)** Separately, create a *new* auth account after the migrations have run, and grant it staff access via the `grant_staff_role` RPC (through the admin UI, or directly via `supabase.rpc(...)` if the UI isn't built yet at test time). Confirm it behaves identically to the backfilled staff account.
- [ ] Log in as `admin-test@example.com`. Confirm identical document/worker access to staff (per decisions.md #6 — no extra document permissions expected).
- [ ] As `admin-test@example.com`, confirm the "Vincular cuenta", "Desvincular cuenta", and "Grant staff access" actions are visible; as the staff account, confirm they are not (or are visible but rejected on submit — whichever the implementation chooses, but the RPCs must reject regardless of UI state).

## Worker self-service — golden path

- [ ] As `admin-test@example.com`, link `worker-test@example.com` to the chosen worker via the UI. Confirm success toast.
- [ ] Log out; log in as `worker-test@example.com`.
- [ ] Confirm automatic landing on `/my-documents` (not `/dashboard`, not `/pending-access`).
- [ ] Confirm the page shows the correct worker's name/identity, matching the linked `workers` row.
- [ ] Upload a document to "Datos personales" (permanent category). Confirm it appears as "Cargado".
- [ ] Select a semester and upload a Docencia document. Confirm scoping to that semester.
- [ ] Upload multiple files to an "Evidencias" type. Confirm all appear.
- [ ] Replace a single-file document type. Confirm old file is gone, storage object removed, new one visible.
- [ ] Open and download a document. Confirm signed URL works.
- [ ] Download the report. Confirm it reflects only this worker's data.

## Worker self-service — access boundaries

- [ ] While logged in as the worker, manually navigate the browser to `/workers` and to `/workers/:id/documents` for any id (including their own). Confirm redirect to `/my-documents` in both cases.
- [ ] While logged in as the worker, open browser devtools and issue a direct Supabase client call (e.g. from the console, using the app's already-initialized client) requesting `worker_documents` filtered to a different `worker_id`. Confirm zero rows returned (RLS, not just UI, blocks it).
- [ ] Attempt a direct `storage.from('worker_documents').createSignedUrl(...)` or list call for a path prefixed with a different worker's id. Confirm it is denied/empty.
- [ ] Attempt to call `link_worker_account`, `unlink_worker_account`, or `grant_staff_role` as the worker (not admin) via the console. Confirm each raises its "Only admins can ..." exception.
- [ ] Attempt a direct `insert`/`update`/`delete` against `profiles` as any non-service-role session. Confirm it is denied (no policy grants it).
- [ ] Confirm `getWorkers()`/`getWorkersFull()` (full list) called as the worker session returns no rows or errors gracefully — the worker-facing pages must not depend on this call succeeding.

## (security revision) Role-collision and unlink/delete safety

- [ ] As admin, attempt `link_worker_account` targeting `staff-test@example.com`'s email. Confirm rejection with a message naming the existing role (not a generic error, not a silent overwrite).
- [ ] As admin, attempt `link_worker_account` targeting `admin-test@example.com`'s email. Confirm rejection.
- [ ] Link `worker-test@example.com` to worker A, then attempt `link_worker_account` again for the same email targeting worker B. Confirm rejection ("already linked to a different worker").
- [ ] Attempt `link_worker_account` for a *different* email targeting the same `worker_id` that `worker-test@example.com` is already linked to. Confirm rejection ("worker already has a linked account").
- [ ] With `worker-test@example.com` linked, attempt to delete that `workers` row directly (e.g. via a raw SQL `DELETE` in Studio, simulating what a future feature or direct DB access might do). Confirm it fails due to the `ON DELETE RESTRICT` foreign key.
- [ ] Call `unlink_worker_account` for that worker as admin. Confirm the `profiles` row is removed.
- [ ] Log in as `worker-test@example.com` again after unlinking. Confirm landing on `/pending-access`, **not** staff access and **not** `/my-documents`.
- [ ] Now delete the `workers` row (previously blocked). Confirm it succeeds now that no `profiles` row references it.
- [ ] Attempt `grant_staff_role` targeting an email still linked with `role = 'worker'`. Confirm rejection until unlinked.

## Regression: pre-existing `anon` exposure closed

- [ ] Using an unauthenticated Supabase client (anon key, no session), confirm `workers` SELECT/UPDATE that previously succeeded (per the original `worker-document-uploads` decisions) now fails or returns zero rows.

## Cleanup

- [ ] Confirm no `.env`, service role key, or access token was committed.
- [ ] Confirm local-only seed/bootstrap data (test users, bootstrap admin) is clearly marked as not intended for production application.
- [ ] Confirm the backfill migration (`database-plan.md` §11) was actually exercised in `bunx supabase db reset` against at least one pre-existing local user, not just reviewed as SQL.
