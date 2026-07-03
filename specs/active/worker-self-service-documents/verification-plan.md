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

## (new) Server-side worker account provisioning by invitation

Covers `decisions.md` #21–29, `implementation-plan.md` §11, `tasks.md` Phase 11. Not applicable until that phase is implemented — included here now so verification isn't designed after the fact. No open design questions remain for this scope (see the "open questions resolved" revision note at the top of `decisions.md`).

### Local functional verification

- [ ] `bunx supabase start` + `supabase functions serve create-worker-account --env-file <local env file>`; confirm the function starts without error using only auto-injected `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` plus the one custom `WORKER_INVITE_REDIRECT_URL`.
- [ ] Case 1: pick a `workers` row with a valid, unused email and no linked profile. As admin, click "Crear cuenta de acceso". Confirm: a new `auth.users` row exists, and a `profiles` row now exists with `role = 'worker'` and the correct `worker_id`.
- [ ] Case 1 (content verification, required — decisions.md #28, not optional): open the local Mailpit inbox (port 54324). Confirm the invite email:
  - appears at all (not just that the API call returned no error);
  - is addressed to the exact `workers.email` value used for this worker;
  - contains a link that is well-formed and not broken/placeholder text;
  - when followed, redirects to the configured local `WORKER_INVITE_REDIRECT_URL`;
  - and that redirect URL points at the local app (`127.0.0.1`-style), never at any production domain.
  - Also confirm no real remote Auth account and no real email were created/sent anywhere during this — everything happened inside the local stack.
- [ ] Case 2: pick (or reuse) a `workers` row whose email already matches an existing `auth.users` row with no profile yet. Click "Crear cuenta de acceso". Confirm: no duplicate `auth.users` row is created, and the existing account is linked (`profiles` row appears, `role = 'worker'`).
- [ ] Case 3: pick a `workers` row with `email` empty/null. Click "Crear cuenta de acceso" (or confirm it's disabled with a hint in the UI). Confirm: clear error, no `auth.users` row created, no `profiles` row created. Confirm there is no way to type/supply an alternate email into this specific action to work around the block (decisions.md #29) — the only way to unblock is editing `workers.email` itself, or using "Vincular cuenta existente" separately.
- [ ] Case 4: temporarily set a `workers.email` to an obviously invalid value (e.g. `not-an-email`). Confirm: clear error, no Admin API call made.
- [ ] Case 5: temporarily set two `workers` rows to the same email. Attempt provisioning for either. Confirm: clear "duplicated across workers" error, no Admin API call made, no `profiles` row created for either.
- [ ] Case 6: attempt "Crear cuenta de acceso" again for a worker provisioned in case 1 or 2. Confirm: a clear "already linked" message, and confirm (e.g. via Studio) that no second invite email was sent and no `auth.users` row was created/touched a second time.
- [ ] Case 7: call the Edge Function directly (e.g. via `curl` with a valid staff, non-admin JWT, or via the browser console using the app's already-authenticated client) bypassing the UI entirely. Confirm rejection — both the early `current_app_role()` check and, if that were somehow bypassed, `link_worker_account`'s own admin check.
- [ ] Confirm the frontend network tab never shows a service-role key anywhere in any request — only the anon key, consistent with every other Supabase call this app makes.
- [ ] Confirm `grep -r "service_role\|SERVICE_ROLE" src/` (or equivalent) returns nothing.
- [ ] Confirm "Vincular cuenta existente" (the pre-existing manual flow) is still visible and functional for an admin after "Crear cuenta de acceso" ships — it is a permanent fallback (decisions.md #4), not replaced or removed.

### Companion page verification

- [ ] Complete case 1 above, open the invite email from the local Mailpit inbox, click the link. Confirm it lands on `/set-password` with an active (invite-derived) session.
- [ ] Set a password on `/set-password`. Confirm `supabase.auth.updateUser({ password })` succeeds, a clear success state is shown, and the page redirects specifically to `/my-documents` (not `/dashboard`, not a generic landing page).
- [ ] Confirm an error state (e.g. a password that fails Supabase's own validation) is shown clearly, not silently swallowed or a raw stack trace.
- [ ] Confirm `/set-password` does not create or touch any `profiles` row — the worker's profile was already linked by `create-worker-account` before the invite was sent; this page only sets a password.
- [ ] Confirm no service-role key or call appears anywhere in this page's network requests.
- [ ] Log out, log back in with the newly-set password. Confirm it works, and confirm the resulting session's access is governed exactly like any other worker session (`RoleGate`/RLS) — `/set-password` did not introduce any separate authorization path.
- [ ] This is the actual proof the invitation flow is usable end-to-end, not just that an email was sent. **Per decisions.md #27, worker Auth provisioning is not considered complete until every check in this subsection passes.**

### Production smoke test (real mailbox, not Mailpit — decisions.md #28, resolved)

Required before the first real production rollout, and again after any change to email templates or `WORKER_INVITE_REDIRECT_URL` configuration. Mailpit does not exist in production — none of these checks can be satisfied by looking at the local inbox.

- [ ] Use a **controlled test worker** record with an email address the team actually controls (an internal test mailbox) — explicitly **not** a real employee's email for this first check.
- [ ] As admin, trigger `create-worker-account` against the deployed remote function for that controlled test worker.
- [ ] Confirm the invite email actually arrives in the real, controlled mailbox (check the actual inbox, not just the function's response).
- [ ] Confirm the link in that real email redirects to the **production** `WORKER_INVITE_REDIRECT_URL` (the remote secret, not the local one).
- [ ] Complete `/set-password` against production with that test account, then log out and log back in with the new password — confirm the full loop works against the real deployed stack, not just locally.
- [ ] Clean up the test worker/Auth account afterward if it isn't meant to represent a real institutional worker (avoid leaving throwaway test data in production).

### Environment/secrets verification

- [ ] Confirm the Edge Function source contains no literal Supabase URL (local or remote) anywhere — only `Deno.env.get(...)` calls.
- [ ] Confirm the Edge Function source contains no literal service-role key, anon key, or `WORKER_INVITE_REDIRECT_URL` value anywhere.
- [ ] Confirm any local env file used for `--env-file` is excluded by `.gitignore` and was never committed (`git log --all --full-history -- <path>` should show nothing).
- [ ] Confirm the function is **not** deployed to the remote project by default — `supabase functions list --project-ref <remote-ref>` (read-only, safe) should not show `create-worker-account` until someone has explicitly run the deploy step.
- [ ] Confirm remote deployment and `supabase secrets set` were both treated as explicit, human-approved actions, not run automatically as part of any script or CI step introduced by this feature.

## Cleanup

- [ ] Confirm no `.env`, service role key, or access token was committed.
- [ ] Confirm local-only seed/bootstrap data (test users, bootstrap admin) is clearly marked as not intended for production application.
- [ ] Confirm the backfill migration (`database-plan.md` §11) was actually exercised in `bunx supabase db reset` against at least one pre-existing local user, not just reviewed as SQL.
