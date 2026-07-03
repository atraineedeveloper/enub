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

- [ ] Create migration for `public.profiles` table + constraints. **(security revision: no default value on `role`; `worker_id` FK is `ON DELETE RESTRICT`, not `CASCADE`.)**
- [ ] Create migration for `current_app_role()` and `current_worker_id()` helper functions. **(security revision: `current_app_role()` returns `NULL` when no row exists — no `COALESCE(..., 'staff')`.)**
- [ ] Create migration for `link_worker_account()` RPC function. **(security revision: reject if target account already has role `admin`/`staff`, already linked to a different worker, or the requested `worker_id` already has a different linked account — see `database-plan.md` §3.)**
- [ ] **(security revision, new)** Create migration for `unlink_worker_account()` RPC function.
- [ ] **(security revision, new)** Create migration for `grant_staff_role()` RPC function, for onboarding new staff after launch without an implicit default.
- [ ] Create migration for `profiles` RLS policies (read-own, read-all-if-admin, no direct writes).
- [ ] **(security revision, new, required)** Create the one-time backfill migration granting explicit `role = 'staff'` to every pre-existing `auth.users` row with no `profiles` row. Must ship in the same deployment as Phase 3's RLS changes, not before or after.
- [ ] Decide and implement local-only bootstrap admin seed (or document the manual Studio step if not automated). This stays separate from the backfill migration above (decisions.md #18).

## Phase 3: Supabase schema — RLS tightening on existing tables

- [ ] Migration: drop and recreate `workers` SELECT policy (staff/admin: all rows; worker: own row). **Use `DROP POLICY IF EXISTS`.**
- [ ] Migration: drop and recreate `workers` UPDATE policy (staff/admin only, unchanged for them). **Use `DROP POLICY IF EXISTS`.**
- [ ] Migration: drop and recreate the four `worker_documents` policies (staff/admin: all; worker: own `worker_id` only). **Use `DROP POLICY IF EXISTS`.**
- [ ] Migration: drop and recreate the four `storage.objects` policies scoped to the `worker_documents` bucket (staff/admin: all; worker: own path prefix via `storage.foldername`). **Use `DROP POLICY IF EXISTS`.**
- [ ] Confirm every policy check in this phase uses an explicit allow-list (`role IN ('staff','admin')` or `role = 'worker'`), never a negation of one role implying access for all others.
- [ ] Run `bunx supabase db reset` and confirm no migration errors.
- [ ] Run `bunx supabase db lint`.

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

- [ ] `profiles_schema.test.sql` — table/constraint shape, `role` check constraint values, `worker_id` uniqueness, **`role` has no column default**, **`worker_id` FK is `ON DELETE RESTRICT`**.
- [ ] `profiles_rls.test.sql` — RLS enabled; no `authenticated` INSERT/UPDATE/DELETE policy exists; anon has no access.
- [ ] `worker_documents_ownership_rls.test.sql` — staff/admin policy and worker-ownership policy both present with expected `USING`/`WITH CHECK` shape (adapting the existing `worker_documents_rls.test.sql` style).
- [ ] `workers_rls.test.sql` — confirm `anon` no longer has SELECT/UPDATE on `workers` (regression guard against the pre-existing open policy).
- [ ] **(security revision, new)** `current_app_role_default_deny.test.sql` — insert an `auth.users` row with no `profiles` row, assert `current_app_role()` and `current_worker_id()` return `NULL` for it, not `'staff'`.
- [ ] `link_worker_account_function.test.sql` — function exists, is `SECURITY DEFINER`, rejects non-admin callers. **(security revision, expanded)** also assert: rejects linking to an account with existing role `admin`/`staff`; rejects re-linking an already-linked worker account; rejects when the target `worker_id` already has a different linked account.
- [ ] **(security revision, new)** `unlink_worker_account_function.test.sql` — admin-only; removes the profile row; account has no role afterward (not staff).
- [ ] **(security revision, new)** `grant_staff_role_function.test.sql` — admin-only; rejects converting an existing `worker` row; sets role to `staff` otherwise.
- [ ] **(security revision, new)** `profiles_worker_deletion_restrict.test.sql` — attempting to delete a `workers` row with a linked `profiles` row fails; deleting succeeds after `unlink_worker_account`.
- [ ] **(security revision, new)** `profiles_backfill.test.sql` — every pre-existing `auth.users` row (as of the backfill migration) has a corresponding `profiles` row with `role = 'staff'`.

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
