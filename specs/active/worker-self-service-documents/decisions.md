# Decisions - Worker Self-Service Documents

## Revision note (security review)

This file was revised after a security review flagged that the original "no profile row defaults to staff" design was a privilege-escalation risk: a freshly created (but not-yet-linked) worker Auth account, or any future Auth account created for any reason, would be treated as full staff until someone explicitly linked it. Decision #7 below is **superseded** — see [[#7-revised-no-profiles-row-means-no-access-default-deny]]. Everywhere else in this document that referenced the old "default to staff" behavior has been updated to match.

## 1. Mapping model: a `profiles` table, not a column on `workers`

We add a new table `public.profiles` keyed by `auth.users.id`, holding `role` and an optional `worker_id`, instead of adding a `user_id` column directly on `public.workers`.

Reason:

- `profiles` is the standard Supabase pattern for an auth-adjacent table and keeps identity/authorization concerns out of the `workers` business table (name, RFC, address, etc.).
- It generalizes to the three roles this spec needs (`admin`, `staff`, `worker`) without overloading `workers` with columns that only make sense for the small subset of workers who have self-service accounts.
- It gives us one place to enable/disable an account's app-level role without touching the worker's own record.

## 2. Why not reuse the existing `public.roles` table?

`public.roles` already exists (`worker_id` + free-text `role` like "Director", "Subdirector") but it is **institutional/administrative role data** ("Administrative college roles" per its table comment) — it describes a worker's job title, not an application authorization tier. Reusing it for auth would conflate "what job title does this person hold" with "what can this session do in the app," which are unrelated and would break the moment a Director's title changes.

The new `profiles.role` enum (`admin` / `staff` / `worker`) is a distinct, purely technical concept. No change to `public.roles` is part of this feature.

## 3. Provisioning of the auth account itself

Creating the actual `auth.users` row for a worker stays a **manual, admin-only step performed in Supabase Studio/Dashboard** (local or hosted), outside the app.

Reason:

- The client only has the anon key. Creating users normally requires the Supabase Admin API (service role key), which must never be shipped to the browser.
- Self-registration (`supabase.auth.signUp`) is explicitly out of scope — the institution wants controlled provisioning, not open sign-up.

This is a hard constraint, not a preference — it was not part of the AskUserQuestion decision below.

**Security consequence of this decision (new):** because account creation and role-linking are two separate steps, there is necessarily a window where an `auth.users` row exists with no `profiles` row at all — anyone who signs in during that window must be treated as having **no access**, not as staff. This is the core reasoning behind decision #7 below.

## 4. Linking a provisioned auth account to a worker: in-app admin UI backed by a SECURITY DEFINER RPC

Confirmed via stakeholder question. Once an admin has created the `auth.users` row in Studio, they link it to the correct `workers` row **from inside the app**:

- Workers UI gets an admin-only action ("Vincular cuenta") where the admin enters the worker's email.
- The app calls `public.link_worker_account(worker_id, worker_email)`, a `SECURITY DEFINER` Postgres function that looks up `auth.users` by email (not exposed to PostgREST directly) and inserts the `profiles` row with `role = 'worker'`.
- The function itself checks that the caller's role is `admin` and raises an exception otherwise — so granting `EXECUTE` to `authenticated` broadly is safe.

Rejected alternative: fully manual SQL runbook (admin also hand-writes the `insert into profiles ...` in Studio for every worker). Rejected because it doesn't scale past a handful of workers and every future admin would need Studio SQL access and know the schema.

Reason this is safe without a service-role key in the browser: the function runs as its owner (`postgres`) inside Postgres itself, so it can read `auth.users` and write `profiles` regardless of the caller's row-level grants — the client never touches `auth.users` or the service role.

**Revised (security review):** `link_worker_account` must not silently overwrite an existing role assignment. See [[#16-link_worker_account-rejects-role-collisions]].

## 5. Bootstrapping the first admin

There is a chicken-and-egg problem: `link_worker_account` requires the caller to already be `admin`, but the first `admin` row can't be created through the app (no admin exists yet to click the button).

Decision: the first `admin` profile row is created **once, manually, via SQL in Supabase Studio** as a one-time bootstrap step, documented as a runbook in [[database-plan#bootstrapping-the-first-admin]]. After that, admins can be promoted by repeating the manual step — this feature does not build a "manage admins" UI. (Ordinary staff onboarding, by contrast, does get a small in-app RPC — see [[#17-onboarding-new-staff-after-launch-grant_staff_role]] — because it's a much more frequent operation than creating a new admin.)

## 6. `staff` and `admin` have identical document/worker access in this MVP

`admin` is not a stronger version of `staff` for viewing or uploading documents. The only things `admin` can do that `staff` cannot are calling `link_worker_account`, `unlink_worker_account`, and `grant_staff_role`. Both `staff` and `admin` retain the full, unrestricted access to all workers' records and all `/workers/:id/documents` expedientes — but **only if their account has an explicit `profiles` row saying so**. See decision #7.

Reason:

- The user request and the deferred follow-up from `worker-document-uploads` are about **worker self-service**, not about tightening staff-vs-staff permissions. Introducing a real staff/admin permission split (e.g., "only Dirección can review documents") is a separate, larger product decision the stakeholder has not made.
- Keeping `staff` and `admin` behaviorally identical (except for account/role management) is the smallest change that satisfies "define the role model" without silently changing who can already do what today, beyond the explicit-provisioning requirement forced by the security review.

Future follow-up (not part of this feature): differentiate `staff` vs `admin` document-review permissions, matching the original `worker-document-uploads` decision #2 language ("Dirección/admin users can review").

## 7. REVISED: no `profiles` row means no access (default-deny)

**This supersedes the original version of this decision, which said "no profile row means staff."** That was a privilege-escalation bug: it meant every new Auth account — including a worker account an admin had just created in Studio but not yet linked, and any account created for any other reason — was treated as full staff by default, for however long it took someone to notice and fix it.

New behavior:

- `public.current_app_role()` returns `NULL` when no matching `profiles` row exists (see [[database-plan#2-helper-functions-revised]] — `NULL`, not `'staff'`, and not the string `'unknown'`, because `NULL` composes safely with SQL `IN (...)`/`=` checks used throughout RLS: `NULL IN ('staff','admin')` evaluates to `NULL`, which `USING`/`WITH CHECK` treat as deny, with no special-casing needed in any policy).
- Every policy in this feature that grants staff/admin access checks `public.current_app_role() IN ('staff', 'admin')` explicitly — an allow-list, never "not worker" or "not null."
- The app surfaces `NULL`/no-profile as a distinct state (shown to the user as "your account has no access assigned yet — contact an administrator"), not silently mapped to any working state. See [[implementation-plan#pending-access-state]].

Consequence: **every existing internal user account must receive an explicit `profiles` row before this feature ships**, or they will be locked out the moment the new RLS policies are applied. This is a one-time backfill migration, not optional — see [[#18-backfill-migration-for-existing-internal-users]].

## 8. `staff`/`admin` accounts require an explicit `profiles` row, same as `worker`

There is no longer an implicit-staff tier. `admin`, `staff`, and `worker` are all determined the same way: an explicit row in `profiles`. The only asymmetry is *how* that row gets created for each case (bootstrap SQL for the first admin, an RPC for staff and workers thereafter) — never by omission.

## 9. Worker identity is resolved server-side, never from the URL

`/my-documents` does not take a `:id` param. The worker's own `worker_id` is resolved from `profiles.worker_id` for `auth.uid()`, both in the client (to build the page) and in RLS (to authorize every query/storage access). The client-side resolution is a UX convenience only — RLS is the actual enforcement boundary, so even a tampered client request cannot cross worker boundaries.

## 10. Reuse strategy for the existing `WorkerDocuments` UI

`src/pages/Records/WorkerDocuments.jsx` today: reads `id` from `useParams`, then finds the worker by scanning the full `useWorkers({ fullDetails: false })` list. That approach doesn't work for a `worker` session, which is not allowed to list all workers (see RLS changes in `database-plan.md`) and shouldn't need to.

Decision: extract the current page body into a shared, presentational component parametrized by a `workerId` prop (and a single-row `useWorker(workerId)` hook, new), then add two thin wrappers:

- `src/pages/Records/WorkerDocuments.jsx` (staff/admin route `/workers/:id/documents`): reads `id` from `useParams`, passes it down. Behavior unchanged for staff/admin.
- `src/pages/MyDocuments.jsx` (worker route `/my-documents`, new): resolves `workerId` from the current profile instead of `useParams`, passes it down to the same shared component.

This is a refactor for reuse, not a rewrite — the upload/replace/view/download/report logic and all `apiWorkerDocuments.js` functions are untouched.

## 11. Route/layout separation

A `worker` session must not see the full staff navigation (Degrees, Subjects, Groups, etc.) — only their own document expediente. A session with no recognized role (no `profiles` row) must not see *anything* except a "pending access" notice. This requires:

- An allow-list route guard: staff routes render only for `role IN ('staff', 'admin')`; every other authenticated state (worker, or no role) is redirected away — never the inverse ("anything that isn't worker").
- A distinct, minimal layout for the worker route (no staff sidebar/nav), reusing existing shared UI primitives (`Heading`, `Row`, `Logout`, etc.) rather than introducing a new UI kit.
- A distinct "pending access" page/state for authenticated sessions with no resolvable role.

Full routing detail in [[implementation-plan]].

## 12. RLS: `workers` table SELECT/UPDATE tightened; INSERT/DELETE untouched

Today `public.workers` has `FOR SELECT USING (true)` and `FOR UPDATE USING (true) WITH CHECK (true)` with **no `TO` clause** — meaning even `anon` can read and update every worker row. This spec tightens both to `TO authenticated` plus an explicit `role IN ('staff', 'admin')` check (worker: own row only, read-only).

There is no existing INSERT or DELETE policy on `workers` at all (a pre-existing gap, unrelated to this feature — worker creation apparently relies on a path this repo doesn't currently exercise under RLS, or is done via the dashboard). This spec does not add or touch INSERT policies on `workers`. It does, however, change the **foreign key** from `profiles.worker_id` to `workers.id` from `ON DELETE CASCADE` to `ON DELETE RESTRICT` — see [[#19-deleting-a-linked-worker-row]] — which is a delete-safety change, not an RLS/DELETE-policy change; there still is no `DELETE` RLS policy on `workers` today, and this feature doesn't add one.

## 13. `worker_documents` RLS: allow-list, not deny-list

`FOR ALL` policies for `worker_documents` (and the storage bucket) check `public.current_app_role() IN ('staff', 'admin')` for the broad-access policy, and `worker_id = public.current_worker_id()` for the worker-scoped policy. A session with no `profiles` row satisfies neither — `current_app_role()` is `NULL` (`NULL IN (...)` is not true) and `current_worker_id()` is `NULL` (`worker_id = NULL` is never true) — so it is correctly denied everywhere, with no special-case needed.

## 14. Storage bucket ownership via path prefix, not new metadata

Worker document storage paths already encode the owning worker as the first path segment (`${workerId}/${documentTypeId}/${scopeFolder}/...`, see `createWorkerDocumentStoragePath` in `apiWorkerDocuments.js`). RLS on `storage.objects` for the `worker_documents` bucket uses `(storage.foldername(name))[1]` compared against the caller's resolved `worker_id`, instead of adding a new storage metadata column or a parallel ownership table.

Reason: the ownership information already exists in the path that the app itself generates; duplicating it elsewhere would be a second source of truth that could drift.

## 15. `worker_document_categories` / `worker_document_types` RLS unchanged

These stay `FOR SELECT USING (true)` (world-readable, no `TO` clause). They contain only category/document-type labels (e.g., "Datos personales", "Acta de nacimiento") — no PII, no per-worker data. Tightening them would add complexity with no privacy benefit, so this spec leaves them as-is.

## 16. `link_worker_account` rejects role collisions

`link_worker_account(worker_id, worker_email)` now explicitly checks the target account's *existing* `profiles` row (if any) before writing, instead of blindly `ON CONFLICT ... DO UPDATE`-ing over it:

- If the target account already has `role IN ('admin', 'staff')`: **reject** with an explicit error. An admin/staff account must not be silently downgraded/repurposed into a worker account by an email typo or a well-intentioned but mistaken click.
- If the target account is already linked to a *different* worker (`role = 'worker'` with a different `worker_id`): **reject**. Re-pointing an existing worker account to a different worker's records must be an explicit, deliberate action (`unlink_worker_account` first), never an accidental side effect of calling `link_worker_account` again.
- If the *requested* `worker_id` already has a different account linked to it: **reject** with a clear message, rather than surfacing a raw unique-constraint violation.

Only when the target account has no `profiles` row at all does `link_worker_account` proceed to insert one. See [[database-plan#3-link_worker_account-rpc-revised]] for the exact function body.

## 17. Onboarding new staff after launch: `grant_staff_role`

Decision #7 closes the "no row = staff" hole, but it creates an operational question the original spec didn't need to answer: once this ships, how does a **brand-new staff member** (hired after launch) get access at all, given there is no more implicit default?

Decision: add a second small admin-only RPC, `grant_staff_role(staff_email)`, mirroring `link_worker_account` but setting `role = 'staff'`, `worker_id = NULL`. Same safety rule as #16: if the target account is already `role = 'worker'`, reject — an admin must explicitly `unlink_worker_account` first if they really intend to convert a worker account into a staff account (this should be rare and deliberate, not a one-click accident).

This was not one of the ten required items verbatim, but it is a direct, necessary consequence of item 3/4 (explicit rows required) — without it, every future new hire would need Studio SQL access on day one, which is a worse operational posture than what this feature is trying to fix. Promoting to `admin` specifically stays fully manual (decision #5) — `grant_staff_role` never grants `admin`.

## 18. Backfill migration for existing internal users

A one-time migration inserts an explicit `role = 'staff'` row into `profiles` for every `auth.users` row that exists at migration time and doesn't already have one:

```sql
insert into public.profiles (id, role, worker_id)
select id, 'staff', null
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;
```

Reason: before this feature ships, *every* existing `auth.users` account is, by the current (pre-feature) app's own behavior, a staff account — there is no other kind of account yet. This migration only encodes that existing fact explicitly; it grants no new access to anyone. It must run in the same deployment as the RLS changes in decisions #12/#13, or there is a window where legitimate staff are locked out. See [[database-plan#backfill-migration]] and [[tasks]] Phase 2.

This is different from — and does not reintroduce — the old "no row = staff" default: after this migration runs, the default for any *new* row-less account reverts to no-access (decision #7). This migration is a one-time snapshot, not an ongoing rule.

## 19. Deleting a linked worker row

**Chosen approach: combine "prevent deleting linked workers" with "require explicit unlink first."** (Of the three options considered — prevent deletion, keep-but-disable, require explicit unlink — the third alone isn't enforceable without the first: nothing stops someone from deleting the worker row directly without remembering to unlink. The first alone isn't ergonomic without the second: there'd be no sanctioned way to actually delete a worker who has an account.)

Concretely:

- `profiles.worker_id`'s foreign key to `workers.id` changes from `ON DELETE CASCADE` to `ON DELETE RESTRICT`. Deleting a `workers` row that still has a linked `profiles` row now fails at the database level, full stop — this holds even if the deletion is attempted directly in Studio or by a future feature, not just through this app's current (nonexistent) worker-delete UI.
- A new admin-only RPC, `unlink_worker_account(worker_id)`, deletes the `profiles` row for that worker (reverting the account to no-access, per decision #7 — **not** to staff). Only after this runs can the `workers` row be deleted.

Rejected: "keep the profile but mark it disabled" (would need a new `status`/`disabled` column and would require every RLS policy and both helper functions to also check it — more schema surface for the same outcome `RESTRICT` + `unlink` already achieves without a new column).

Why this is safe against the original bug report: previously, `ON DELETE CASCADE` plus "no row = staff" meant deleting a worker's row was a **one-step path to that account becoming full staff**. Now, deleting a worker's row is blocked outright while a profile exists, and even if unlinked first, the account lands on no-access, never staff.

## 20. Migration idempotency: `DROP POLICY IF EXISTS`

Every `DROP POLICY` statement in this feature's migrations uses `DROP POLICY IF EXISTS "..." ON ...;` instead of a bare `DROP POLICY`. Reason: a bare `DROP POLICY` errors out the whole migration if the policy name doesn't exist under that exact name (e.g., diverged between local/hosted environments, or a future rename) — `IF EXISTS` makes the migration safe to re-run/reorder without blocking on a name mismatch. This applies to every policy drop in [[database-plan]] sections 5, 6, and 7.
