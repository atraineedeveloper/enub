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

- [ ] Add `getWorkerById(id)` to `src/services/apiWorkers.js`.
- [ ] Create `src/services/apiProfiles.js` with `getCurrentProfile()`, `linkWorkerAccount(...)`, `unlinkWorkerAccount(...)`, `grantStaffRole(...)`. **`getCurrentProfile()` must return `role: null` (not `'staff'`) when no row exists.**

## Phase 5: React Query hooks

- [ ] Create `src/features/workers/useWorker.js`.
- [ ] Create `src/features/authentication/useProfile.js`, exposing `role` (nullable), `isStaffOrAdmin`, `isWorker`, `isAdmin`, and `hasNoAccess` as distinct, explicit values.
- [ ] Create `src/features/authentication/useLinkWorkerAccount.js`.
- [ ] **(security revision, new)** Create `src/features/authentication/useUnlinkWorkerAccount.js`.
- [ ] **(security revision, new)** Create `src/features/authentication/useGrantStaffRole.js`.

## Phase 6: Reuse — split `WorkerDocuments.jsx`

- [ ] Extract `src/features/workers/documents/WorkerDocumentsView.jsx` from the current page body, parametrized by `workerId` prop.
- [ ] Switch the extracted view from `useWorkers({ fullDetails: false })` + `.find()` to `useWorker(workerId)`.
- [ ] Thin `src/pages/Records/WorkerDocuments.jsx` down to a `useParams` wrapper around the shared view.
- [ ] Confirm staff/admin behavior at `/workers/:id/documents` is unchanged after the split.

## Phase 7: Worker self-service route and access gate

- [ ] Create `src/pages/MyDocuments.jsx` — **must** check `role === 'worker' && workerId != null`, redirect staff/admin to `/dashboard`, redirect everyone else (including no-role) to `/pending-access`.
- [ ] **(security revision, new)** Create `src/pages/PendingAccess.jsx` for authenticated sessions with no resolvable role.
- [ ] Create the minimal worker layout (no staff nav), reused by both `MyDocuments` and `PendingAccess`.
- [ ] **(security revision — renamed/redesigned)** Create `RoleGate` guard component (replaces the earlier "StaffRoute" concept): allow-list `role IN ('staff','admin')` only; explicitly redirect `worker` to `/my-documents` and everything else to `/pending-access`. Apply it to all existing staff routes in `src/App.jsx`.
- [ ] Add the `my-documents` and `pending-access` routes in `src/App.jsx`.

## Phase 8: Admin account management UI

- [ ] Add an admin-only "Vincular cuenta" action to `WorkerTable.jsx` / `WorkerRow.jsx`, gated on `useProfile().isAdmin`. Surface RPC rejection reasons (already-staff, already-linked, etc.) distinctly, not as a generic error.
- [ ] **(security revision, new)** Add an admin-only "Desvincular cuenta" action, wired to `useUnlinkWorkerAccount()` — required for the `ON DELETE RESTRICT` FK to be usable in practice.
- [ ] **(security revision, new)** Add a "Grant staff access" admin action (placement TBD at implementation time), wired to `useGrantStaffRole()`.

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

## Follow-up (separate future spec, not part of this feature)

- [ ] Differentiate `staff` vs `admin` document-review permissions (decisions.md #6).
- [ ] "Promote to admin" UI (stays manual/Studio for this feature, decisions.md #5).
- [ ] Self-service password reset / invitation email flow for workers.
- [ ] Make `profile_pictures` bucket reproducible locally via migration (carried over from `worker-document-uploads`).
