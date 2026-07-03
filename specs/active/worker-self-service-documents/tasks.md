# Tasks - Worker Self-Service Documents

**Revised after security review** — new/changed items are marked **(security revision)**.

## Phase 1: Spec and database planning

- [x] Read `worker-document-uploads` spec set and current auth/route code.
- [x] Confirm account-linking mechanism with stakeholder (in-app admin UI + RPC).
- [x] Write `spec.md`.
- [x] Write `decisions.md`.
- [x] Write `database-plan.md`.
- [x] Write `implementation-plan.md`.
- [x] Write `verification-plan.md`.
- [x] **(security revision)** Re-review the default-deny model, role-collision handling, and worker-deletion safety; revise all spec docs accordingly.

## Phase 2: Supabase schema — mapping and roles

- [x] Create migration for `public.profiles` table + constraints. **(security revision: no default value on `role`; `worker_id` FK is `ON DELETE RESTRICT`, not `CASCADE`.)** — `20260703002441_profiles.sql`
- [x] Create migration for `current_app_role()` and `current_worker_id()` helper functions. **(security revision: `current_app_role()` returns `NULL` when no row exists — no `COALESCE(..., 'staff')`.)** — `20260703002444_profiles_helper_functions.sql`
- [x] Create migration for `link_worker_account()` RPC function. **(security revision: reject if target account already has role `admin`/`staff`, already linked to a different worker, or the requested `worker_id` already has a different linked account — see `database-plan.md` §3.)** — `20260703002446_link_worker_account_function.sql`. Functional testing surfaced and fixed an additional NULL-safety bug not called out in the original checklist: the admin check used `<> 'admin'`, which is falsy (not true) for a `NULL` role and silently skipped the guard — changed to `IS DISTINCT FROM 'admin'`.
- [x] **(security revision, new)** Create migration for `unlink_worker_account()` RPC function. — `20260703002448_unlink_worker_account_function.sql` (same `IS DISTINCT FROM` fix applied).
- [x] **(security revision, new)** Create migration for `grant_staff_role()` RPC function, for onboarding new staff after launch without an implicit default. — `20260703002450_grant_staff_role_function.sql` (same `IS DISTINCT FROM` fix applied).
- [x] Create migration for `profiles` RLS policies (read-own, read-all-if-admin, no direct writes). — `20260703002452_profiles_rls_policies.sql`
- [x] **(security revision, new, required)** Create the one-time backfill migration granting explicit `role = 'staff'` to every pre-existing `auth.users` row with no `profiles` row. Must ship in the same deployment as Phase 3's RLS changes, not before or after. — `20260703002501_profiles_backfill_existing_users.sql`
- [x] Decide and implement local-only bootstrap admin seed (or document the manual Studio step if not automated). This stays separate from the backfill migration above (decisions.md #18). — implemented: `supabase/seed.sql` now grants `role = 'admin'` to the existing seeded local user (`admin.local@enub.test`, `11111111-1111-1111-1111-111111111111`), since that user is created by the seed step itself (after migrations run), so the backfill migration alone wouldn't have covered it.

## Phase 3: Supabase schema — RLS tightening on existing tables

- [x] Migration: drop and recreate `workers` SELECT policy (staff/admin: all rows; worker: own row). **Use `DROP POLICY IF EXISTS`.** — `20260703002454_workers_rls_policies_update.sql`
- [x] Migration: drop and recreate `workers` UPDATE policy (staff/admin only, unchanged for them). **Use `DROP POLICY IF EXISTS`.** — `20260703002454_workers_rls_policies_update.sql`
- [x] Migration: drop and recreate the four `worker_documents` policies (staff/admin: all; worker: own `worker_id` only). **Use `DROP POLICY IF EXISTS`.** — `20260703002456_worker_documents_rls_policies_update.sql`
- [x] Migration: drop and recreate the four `storage.objects` policies scoped to the `worker_documents` bucket (staff/admin: all; worker: own path prefix via `storage.foldername`). **Use `DROP POLICY IF EXISTS`.** — `20260703002459_worker_documents_storage_rls_policies_update.sql`
- [x] Confirm every policy check in this phase uses an explicit allow-list (`role IN ('staff','admin')` or `role = 'worker'`), never a negation of one role implying access for all others. — confirmed by direct SQL testing (see below).
- [x] Run `bunx supabase db reset` and confirm no migration errors. — clean.
- [x] Run `bunx supabase db lint`. — no issues in any `public.*` function (only pre-existing, unrelated `extensions.*`/pgTAP internals warnings/errors, not introduced by this work).

**Additional verification performed (beyond the checklist, via direct SQL against the reset local DB, all inside rolled-back transactions):**

- No-profile-row session: `current_app_role()`/`current_worker_id()` return `NULL`; `link_worker_account`/`unlink_worker_account`/`grant_staff_role` all reject it with "Only admins can ...".
- Seeded local admin (`admin.local@enub.test`) can `link_worker_account`; the resulting worker session can read only its own `workers` row and has zero visibility into other workers' `worker_documents`.
- `link_worker_account` rejects: re-linking a `worker_id` that already has a different linked account.
- `grant_staff_role` rejects converting an already-linked `worker` account.
- A staff (non-admin) session is rejected by `unlink_worker_account`.
- `profiles_worker_id_fkey` (`ON DELETE RESTRICT`) blocks deleting a linked `workers` row; deletion succeeds only after `unlink_worker_account` runs, and the unlinked account reverts to no role (`NULL`), not `staff`.

**Known, expected side effect (not fixed, out of scope for Phase 2/3):** `bunx supabase test db --local` now fails 5 pre-existing assertions in `supabase/tests/database/worker_documents_rls.test.sql` (tests 11–14, 19). Those assertions check for one policy per command (`cmd = 'SELECT'/'INSERT'/'UPDATE'/'DELETE'`), but this feature intentionally replaced that shape with combined `FOR ALL` staff/admin + worker-ownership policies (as specified in `database-plan.md` §8–9 and reviewed in `decisions.md` #13). Updating/replacing that test file is Phase 9 work (`worker_documents_ownership_rls.test.sql`, `workers_rls.test.sql`), which was not part of this implementation request.

## Phase 4: Data access layer

- [x] Add `getWorkerById(id)` to `src/services/apiWorkers.js`.
- [x] Create `src/services/apiProfiles.js` with `getCurrentProfile()`. **`getCurrentProfile()` returns `role: null` (not `'staff'`) when no row exists** — verified against `useProfile.js` behavior.
- [x] Add `linkWorkerAccount({ workerId, email })` to `apiProfiles.js`, calling `supabase.rpc('link_worker_account', ...)`. Surfaces the RPC's own exception message as the thrown `Error` (not a generic fallback), per decisions.md #16.
- [ ] Add `unlinkWorkerAccount(...)`, `grantStaffRole(...)` to `apiProfiles.js`. **Still deferred** — unlink UI and staff-granting UI were explicitly out of scope for this pass; adding unused RPC wrappers now would be speculative/half-finished code with nothing consuming them yet.

## Phase 5: React Query hooks

- [x] Create `src/features/workers/useWorker.js`.
- [x] Create `src/features/authentication/useProfile.js`, exposing `role` (nullable), `isStaffOrAdmin`, `isWorker`, `isAdmin`, and `hasNoAccess` as distinct, explicit values.
- [x] Create `src/features/authentication/useLinkWorkerAccount.js`. Wraps `linkWorkerAccount`, used by the admin-only "Vincular cuenta" action added in Phase 8.
- [ ] **(security revision, new)** Create `src/features/authentication/useUnlinkWorkerAccount.js`. **Deferred to Phase 8.**
- [ ] **(security revision, new)** Create `src/features/authentication/useGrantStaffRole.js`. **Deferred to Phase 8.**

## Phase 6: Reuse — split `WorkerDocuments.jsx`

- [x] Extract `src/features/workers/documents/WorkerDocumentsView.jsx` from the current page body, parametrized by `workerId` prop. Upload, replace, view, download, semester selector, category display, and report download logic copied verbatim — no behavior change.
- [x] Switch the extracted view from `useWorkers({ fullDetails: false })` + `.find()` to `useWorker(workerId)`.
- [x] Thin `src/pages/Records/WorkerDocuments.jsx` down to a `useParams` wrapper around the shared view.
- [x] `src/pages/MyDocuments.jsx` now renders `WorkerDocumentsView` with `workerId` from `useProfile()` (never from the URL), replacing the earlier placeholder text.
- [ ] Confirm staff/admin behavior at `/workers/:id/documents` is unchanged after the split. **Not done in this pass** — `bun run build`/`bun run lint` confirm the code compiles and resolves correctly, but no manual/browser verification of the actual route was performed. Still open per `verification-plan.md`.

## Phase 7: Worker self-service route and access gate

- [x] Create `src/pages/MyDocuments.jsx` — checks `role === 'worker' && workerId != null`, redirects staff/admin to `/dashboard`, redirects everyone else (including no-role) to `/pending-access`. Renders the real expediente view (`WorkerDocumentsView`, added in Phase 6) with `workerId` resolved entirely from `useProfile()`, never from the URL.
- [x] **(security revision, new)** Create `src/pages/PendingAccess.jsx` for authenticated sessions with no resolvable role.
- [ ] Create the minimal worker layout (no staff nav), reused by both `MyDocuments` and `PendingAccess`. **Not done** — both pages currently render standalone (no shared layout component), consistent with this task's file scope not including a `WorkerAppLayout`. Worth revisiting now that `MyDocuments` renders `WorkerDocumentsView` (Phase 6) without any surrounding layout/nav.
- [x] **(security revision — renamed/redesigned)** Create `RoleGate` guard component (replaces the earlier "StaffRoute" concept): allow-list `role IN ('staff','admin')` only; explicitly redirects `worker` to `/my-documents` and everything else to `/pending-access`. Applied to all existing staff routes in `src/App.jsx` (wraps `AppLayout`, so it covers every nested staff route, including `workers/:id/documents`).
- [x] Add the `my-documents` and `pending-access` routes in `src/App.jsx`.

## Phase 8: Admin account management UI

- [x] Add an admin-only "Vincular cuenta" action to `WorkerRow.jsx`, gated on `useProfile().isAdmin`. Opens a small `LinkWorkerAccountForm` (new, `src/features/workers/LinkWorkerAccountForm.jsx`) asking for the email of an Auth account already created manually in Supabase Studio; calls `useLinkWorkerAccount()` (new, `src/features/authentication/useLinkWorkerAccount.js`). RPC rejection reasons (already-staff, already-linked, no account found, etc.) surface via `react-hot-toast` as the RPC's own message, not a generic error. The RPC (`link_worker_account`, unchanged) remains the actual security boundary — hiding the action for non-admins in the UI is convenience only, verified already-tested at the database layer in an earlier phase.
- [ ] **(security revision, new)** Add an admin-only "Desvincular cuenta" action, wired to `useUnlinkWorkerAccount()` — required for the `ON DELETE RESTRICT` FK to be usable in practice. **Explicitly out of scope for this pass.**
- [ ] **(security revision, new)** Add a "Grant staff access" admin action (placement TBD at implementation time), wired to `useGrantStaffRole()`. **Explicitly out of scope for this pass.**

## Phase 9: Database tests (pgTAP, following the existing `supabase/tests/database/` pattern)

- [x] `profiles_schema.test.sql` — table/constraint shape, `role` check constraint values, `worker_id` uniqueness, **`role` has no column default**, **`worker_id` FK is `ON DELETE RESTRICT`** (plus a behavioral RESTRICT check and an `ON DELETE CASCADE` check for `profiles_id_fkey`).
- [x] `profiles_rls.test.sql` — RLS enabled; no `authenticated` INSERT/UPDATE/DELETE policy exists; anon has no access; behavioral checks that a worker sees only its own row, an admin sees all, and a direct authenticated INSERT is denied.
- [x] `worker_documents_ownership_rls.test.sql` — behavioral: worker sessions see/insert/delete only their own `worker_id`'s rows, staff/admin see everything, a no-role session sees nothing. (Structural policy-shape assertions were folded into the updated `worker_documents_rls.test.sql` instead of duplicated here, since that file already owns policy-metadata checks for this table.)
- [x] `workers_rls.test.sql` — confirms `anon` no longer has SELECT/UPDATE on `workers` (regression guard against the pre-existing open policy), plus behavioral checks that staff sees all workers, a worker sees only its own row, and a no-role session sees none.
- [x] **(security revision, new)** `current_app_role_default_deny.test.sql` — covers a real unlinked `auth.users` row, a uuid with no `auth.users` row at all, and no JWT claim set at all; asserts `current_app_role()`/`current_worker_id()` return `NULL` in every case, not `'staff'`, plus a sanity check that a linked account resolves normally.
- [x] `link_worker_account_function.test.sql` — function exists, is `SECURITY DEFINER`, rejects a caller with **no** `profiles` row (the exact bug class found during implementation) and a staff (non-admin) caller. **(security revision, expanded)** also asserts: rejects linking to an account with existing role `admin`/`staff`; rejects re-linking an already-linked worker account; rejects when the target `worker_id` already has a different linked account; happy path produces the correct `role`/`worker_id`.
- [x] **(security revision, new)** `unlink_worker_account_function.test.sql` — rejects a no-role caller and a staff caller; is a safe no-op for an unlinked `worker_id`; admin can unlink; the account has **no** role afterward (not staff).
- [x] **(security revision, new)** `grant_staff_role_function.test.sql` — rejects a no-role caller and a worker caller; rejects converting an existing `worker` row; rejects a nonexistent email; sets role to `staff` (`worker_id = NULL`) for a brand-new account; is a safe no-op for an already-staff account.
- [x] **(security revision, new)** `profiles_worker_deletion_restrict.test.sql` — deleting a linked `workers` row fails (`ON DELETE RESTRICT`); succeeds after `unlink_worker_account`; the unlinked account has no role afterward (not staff).
- [x] **(security revision, new)** `profiles_backfill.test.sql` — tests the backfill migration's exact SQL statement (not a live re-run of the migration itself, since it already executed once at reset time over whatever existed then — documented in the file): grants `role = 'staff'` to a simulated pre-existing user with no profile, does not clobber a user already migrated to a non-staff role, and is idempotent on a second run.
- [x] **(not originally listed, added for completeness)** `worker_documents_storage_rls.test.sql` — behavioral: staff/admin see all objects in the `worker_documents` bucket, a worker sees only objects under its own path prefix, inserts under another worker's prefix or a non-matching prefix are rejected.
- [x] Updated the pre-existing `worker_documents_rls.test.sql`: replaced the stale one-policy-per-command assertions (tests 11–14, storage count=4) with assertions matching the actual `FOR ALL` ownership-scoped policy shape this feature introduced.

## Phase 10: Verification

See [[verification-plan]] for the full manual scenario list. Summary:

- [ ] Run `bun run lint`.
- [ ] Run `bun run build`.
- [ ] Run `bunx supabase db reset`.
- [ ] Run `bunx supabase db lint`.
- [ ] Run `bunx supabase test db --local`.
- [ ] Manually verify staff/admin regression (nothing broke for existing logins, thanks to the backfill migration).
- [ ] Manually verify worker login → redirect → scoped document access.
- [ ] Manually verify cross-worker access is blocked at the RLS layer, not just the UI.
- [ ] **(security revision, new)** Manually verify an unlinked (freshly Studio-created) Auth account lands on `/pending-access`, not staff access.
- [ ] **(security revision, new)** Manually verify deleting a linked worker row is rejected until unlinked.
- [ ] **(security revision, new)** Manually verify `link_worker_account` rejects role collisions with clear error messages.
- [ ] Manually verify admin-only linking/unlinking/staff-granting UI and its rejection for non-admins.
- [ ] Confirm no `.env` or secrets were committed.

## Phase 11: Server-side worker account provisioning by invitation

Added by the spec update covering `decisions.md` #21–29, `database-plan.md` §14–15, and `implementation-plan.md` §11. Split into 11A (Edge Function, server-side only) and 11B (frontend + companion page), implemented separately.

### Phase 11A: the Edge Function itself (implemented, local-only)

- [x] Create `supabase/functions/create-worker-account/index.ts` (Deno Edge Function, `Deno.serve` + `@supabase/supabase-js` — the same package already used by the frontend, imported via `npm:@supabase/supabase-js@2` in `deno.json`; the CLI's newer `@supabase/server`/`withSupabase` scaffold helper was deliberately not used, since its exact client/RLS semantics couldn't be verified against this design's needs). Two Supabase clients: user-scoped (forwarded `Authorization` header) for `current_app_role()`/`workers`/`profiles` reads and the `link_worker_account` call; service-role (server env only, via `Deno.env.get`) for `auth.admin.inviteUserByEmail` only.
- [x] **(Codex review fix)** Enforce the request body's exact shape: exactly one key, `workerId` — not just reject a literal `email` key. `Object.keys(body).length !== 1 || bodyKeys[0] !== "workerId"` closes every variant (`email`, `worker_email`, `workerEmail`, or any other unrelated extra key), not only the one name originally checked. Error: "El cuerpo de la solicitud debe contener únicamente workerId." **Verified live** against `worker_email`, `workerEmail`, an unrelated `notes` key, `email`, and a wrong-key-name-only body — all rejected with `400` and the exact message.
- [x] **(Codex review fix)** `WORKER_INVITE_REDIRECT_URL` is now validated alongside `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` as required config, checked before any request-body parsing or Admin API call. Missing → `500` config error, `inviteUserByEmail` is never reached. **Verified live**: served the function with no `--env-file` (so only the platform-auto-injected `SUPABASE_*` vars were present), called it for a worker with a valid unused email, got `500`, then confirmed directly in the database that zero `auth.users`/`profiles` rows were created for that email — proving the Admin API call never happened.
- [x] **(Codex review fix)** Success responses now carry a distinct `status` (`"invited"` / `"linked_existing_auth_user"` / `"already_linked"`) plus `message`, `workerId`, and `email` — no more one ambiguous success shape for three different outcomes.
- [x] Implement case 1 (valid email, no existing Auth user → invite). **Verified live** (after the fixes, on a fresh `db reset`): worker 1 (`maria.prueba@example.test`) → `{"status":"invited","message":"Cuenta creada e invitación enviada","workerId":1,"email":"maria.prueba@example.test"}`, `200`.
- [x] Implement case 2 (valid email, existing Auth user, not yet linked → skip invite, proceed straight to `link_worker_account`). **Verified live** (new for this fix pass — not exercised before): pre-created an `auth.users` row for worker 2's email (`carlos.demo@example.test`) with no `profiles` row, then called the function → `{"status":"linked_existing_auth_user","message":"Cuenta Auth existente vinculada al trabajador","workerId":2,"email":"carlos.demo@example.test"}`, `200`. No duplicate `auth.users` row created.
- [x] Implement case 3 (empty/null `workers.email` → block with clear error, no Admin API call, **no manually-typed fallback email accepted**). **Verified live**: `400`, clear Spanish error message, confirmed no way to override via request body (exact-shape check above makes this structural, not just behavioral).
- [x] Implement case 4 (invalid email format → block with clear error, no Admin API call). **Verified live**: `400`, clear error.
- [x] Implement case 5 (email duplicated across `workers` rows → block with clear error, no Admin API call). **Verified live**: `400`, clear error.
- [x] Implement case 6 (worker already has a linked `profiles` row → short-circuit with a clear "already linked" message, checked before any Admin API call). **Verified live**: re-invoking for worker 1 after case 1 returned `200 {"status":"already_linked","message":"El trabajador ya tiene una cuenta vinculada","workerId":1,"email":"maria.prueba@example.test"}`.
- [x] Implement case 7 (non-admin caller → early `current_app_role()` fast-fail for UX, with `link_worker_account`'s own admin check as the real, non-bypassable boundary). **Verified live**: `403` for a freshly-created auth user with no `profiles` row.
- [x] Add `[functions.create-worker-account]` to `supabase/config.toml` with `verify_jwt = true` (must not be disabled). **Note**: `supabase functions new` auto-generated this section with `verify_jwt = false` (matching its default `apikey` auth-mode scaffold) — corrected to `true`.
- [x] Create the local-only env file, confirmed git-ignored **before** creating it (`git check-ignore -v` run first, then again after creation, then via `git add --dry-run` to confirm it would never be staged). Path: `supabase/functions/create-worker-account/.env.local`. Contains only `WORKER_INVITE_REDIRECT_URL` (a local placeholder URL) — no real secret, no Supabase keys (those are auto-injected, decisions.md #25).
- [x] Local verification (re-run after the fixes, on a fresh `db reset`): `bunx supabase db reset`, `bunx supabase db lint`, `bunx supabase test db --local` all pass unaffected (no migrations touched). `supabase functions serve` (with and without `--env-file`, as needed per case) served the function correctly; all 7 required retest cases plus the original 5 cases behaved as designed.
- [x] Confirmed no remote deploy, `supabase link`, or `supabase secrets set` was run at any point in this pass.

**Not done in 11A (see Phase 11B below):**
- [ ] Add `createWorkerAccount({ workerId })` to `src/services/apiProfiles.js`.
- [ ] Create `src/features/authentication/useCreateWorkerAccount.js`.
- [ ] Add admin-only "Crear cuenta de acceso" action to `WorkerRow.jsx`; relabel the existing "Vincular cuenta" to "Vincular cuenta existente" to read as the fallback — kept permanently (decisions.md #4), not removed once the automatic flow ships.
- [ ] Disable "Crear cuenta de acceso" in the UI (with a hint) when `worker.email` is empty — convenience only, the function blocks it either way, and never offers a manual-email override in this specific action (decisions.md #29).

### Phase 11B: frontend button + companion page (not started)

- [ ] Create the companion `src/pages/SetPassword.jsx` at route `/set-password`, matching the exact minimum scope in `decisions.md` #27 / `implementation-plan.md` §11.3 (reads invite session, sets password, clear success/error states, redirects to `/my-documents`, no general password recovery, no service_role exposure, no profile creation/linking, no new authorization logic). **This is a completion gate, not a nice-to-have** — Phase 11 as a whole is not done until this page exists and passes the companion-page checks in `verification-plan.md`.
- [ ] Add the `/set-password` route in `src/App.jsx`.
- [ ] Local verification: confirm the invite email's actual content in Mailpit (recipient, valid link, redirect to local `WORKER_INVITE_REDIRECT_URL`, never production) — not just that the API call succeeded (decisions.md #28, resolved). **Partially covered already in 11A** (email content was inspected in Mailpit as part of live-testing the Edge Function) — full re-verification belongs here once the UI button exists and triggers the same call end-to-end from the browser.
- [ ] Production verification (first rollout, and after any email/redirect config change): use a controlled test worker mailbox (never a real employee), confirm real delivery, confirm redirect to the production `WORKER_INVITE_REDIRECT_URL`, confirm the full set-password-then-login loop works. Never rely on Mailpit for this (decisions.md #28, resolved).

**Not part of this phase (explicitly deferred, see spec.md Out of scope):**
- Resend/revoke invitation UI, or a bulk view of pending invitations.
- General self-service "forgot password" flow (distinct from the one-time `/set-password` activation page above).
- A `workers.email` format/uniqueness database constraint (database-plan.md §15).
- Any "override email" input on `create-worker-account` — the manual "Vincular cuenta existente" flow is the sanctioned place for a typed email, permanently (decisions.md #4, #29).

## Follow-up (separate future spec, not part of this feature)

- [ ] Differentiate `staff` vs `admin` document-review permissions (decisions.md #6).
- [ ] "Promote to admin" UI (stays manual/Studio for this feature, decisions.md #5).
- [ ] Make `profile_pictures` bucket reproducible locally via migration (carried over from `worker-document-uploads`).
- [ ] `workers.email` format/uniqueness database constraint, once existing data is cleaned up (database-plan.md §15).
- [ ] Invitation resend/revoke admin UI, general self-service password reset (superseded from a vaguer "invitation email flow" bullet now that Phase 11 defines the actual invitation flow concretely).
