# Decisions - Worker Self-Service Documents

## Revision note (security review)

This file was revised after a security review flagged that the original "no profile row defaults to staff" design was a privilege-escalation risk: a freshly created (but not-yet-linked) worker Auth account, or any future Auth account created for any reason, would be treated as full staff until someone explicitly linked it. Decision #7 below is **superseded** — see [[#7-revised-no-profiles-row-means-no-access-default-deny]]. Everywhere else in this document that referenced the old "default to staff" behavior has been updated to match.

## Revision note (server-side provisioning by invitation)

This file was revised again to add **server-side worker Auth provisioning**: an admin-triggered Supabase Edge Function that invites (or links, if already registered) an Auth account for a worker using `public.workers.email`, then links it via the existing `link_worker_account` RPC — no new migration required. This supersedes part of decision #3 (manual Studio creation is no longer the *only* path, though it remains a valid fallback) and adds decisions #21–#28 below. No code is written yet; this is spec-only. See the new "Environment and secrets" and "Cases" sections in `spec.md`, the new Edge Function design in `implementation-plan.md` §11, and the new phase in `tasks.md`.

## Revision note (open questions resolved)

The two open questions from the previous revision are now resolved: local email testing must verify actual content, not just API success (decision #28, revised below), and the `/set-password` companion page's exact minimum scope is now specified (decision #27, revised below). A new decision #29 makes explicit that the automatic provisioning flow must never accept a manually-typed fallback email — it is `workers.email` or nothing, by design, not by oversight. Decision #4 (manual fallback flow) gets its edge-case list spelled out concretely rather than gestured at. No new open questions were introduced by this revision.

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

**Partially superseded by decision #21 — see below.** Creating the actual `auth.users` row for a worker no longer has to be a manual Studio step: it can now happen server-side via an Edge Function using the Auth Admin API. Manual Studio/Dashboard creation remains a valid fallback (e.g. if email delivery is broken, or for a one-off account), but it is no longer the only path.

The reasoning that still holds, unchanged:

- The client only ever has the anon key. Creating users via the Admin API always requires the service role key, which must never be shipped to the browser — that constraint doesn't go away with decision #21, it just moves the service-role usage into a server-side Edge Function instead of a human using Studio.
- Self-registration (`supabase.auth.signUp`) is still explicitly out of scope — the institution wants controlled, admin-triggered provisioning, not open sign-up. An Edge Function invited by an admin is controlled provisioning; a public sign-up form would not be.

**Security consequence of this decision (unchanged):** because account creation and role-linking can still be effectively two steps (an invited user hasn't accepted yet, or a manually-created Studio account hasn't been linked), there is necessarily a window where an `auth.users` row exists with no `profiles` row at all — anyone who signs in during that window must be treated as having **no access**, not as staff. This is the core reasoning behind decision #7 below, and it applies identically regardless of which provisioning path created the `auth.users` row.

## 4. Linking a provisioned auth account to a worker: in-app admin UI backed by a SECURITY DEFINER RPC

**Now the fallback path — see decision #21 for the new primary path (server-side invitation). Confirmed: kept permanently, not a transitional shim.** This flow (manual Studio account + "Vincular cuenta existente") stays available because it covers concrete cases the automatic flow structurally cannot:

- The worker's `auth.users` account was already created manually (e.g., before this feature existed, or via Studio for an unrelated reason).
- An invitation email failed to deliver (bounced, spam-filtered, wrong provider config) but the `auth.users` row exists regardless — re-running `create-worker-account` would just re-attempt the same invite; the admin needs a way to link the already-existing account directly.
- An admin needs to link a *different*, already-known Auth email than whatever is currently in `workers.email` — e.g., the worker uses a different personal/institutional address for their actual login than what's on file.
- Migration/data-cleanup scenarios: bulk-fixing links after correcting bad `workers.email` data, or re-establishing links lost to some other issue.

`link_worker_account` itself (the RPC) is not just kept as a fallback UI entry point — the new Edge Function in decision #21 calls this exact same RPC internally for the linking step, so this decision's reasoning is still load-bearing, not legacy.

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

## 21. Server-side provisioning by invitation: an Edge Function, not a bigger RPC

Instead of teaching the database more about Auth account creation (which it structurally cannot do — `auth.users` writes via the Admin API require the service role key, and SQL functions, even `SECURITY DEFINER` ones, cannot hold or use that key), provisioning moves into a new Supabase Edge Function, `create-worker-account`, that:

1. Runs entirely server-side (Deno runtime managed by Supabase — locally via `supabase functions serve`/`supabase start`, remotely once explicitly deployed via `supabase functions deploy`).
2. Holds the service role key **only** in its own server-side environment (injected automatically by the Supabase platform as `SUPABASE_SERVICE_ROLE_KEY` — see decision #25), never in `src/`, never in a Vite env var, never sent to the browser.
3. Uses the service role key **only** for the one thing that structurally requires it: calling the Auth Admin API (`supabase.auth.admin.inviteUserByEmail(...)`) to create/invite the `auth.users` row.
4. Delegates everything else — admin authorization and the actual `profiles` write — to the **existing, already-tested** `link_worker_account` RPC, called with the *caller's own forwarded JWT*, not the service role.

Reason this shape, not a new all-in-one RPC: Postgres functions cannot make outbound HTTPS calls to the Auth Admin API (`/auth/v1/admin/...`) — that surface only exists over HTTP, not SQL. An Edge Function is the only place in the Supabase architecture that can both hold a service-role credential safely (server-side, never shipped to a browser) and call that HTTP API. Reusing `link_worker_account` for the linking half means:

- Zero new SQL to audit for the admin-only check, the role-collision rejections (decision #16), or the `profiles` write shape — all of that is already implemented and already has pgTAP coverage.
- The RPC's admin check is the **real** authorization boundary for case 7 (a non-admin caller is rejected inside the RPC, which runs with the caller's own JWT — not the Edge Function's service-role client). The Edge Function is not a second, separately-trusted authority; it's a thin orchestration layer in front of the same database rules.

Rejected alternative: give the Edge Function's service-role client the job of writing directly to `profiles` (bypassing RLS entirely, since service role always bypasses RLS). Rejected because it would duplicate the admin check, the role-collision checks, and the `worker_role_consistency` reasoning in a second place (Deno/TypeScript) that has to be kept in sync with the SQL version forever, doubling the audit surface for exactly the part of this feature that has already had one privilege-escalation bug found and fixed (decisions #7, #16). Calling the existing RPC with the *caller's* JWT (not service role) means the exact same tested SQL path runs regardless of whether the profile was linked via the old manual flow or the new invitation flow.

## 22. Invitation over temporary passwords

`inviteUserByEmail` is the only method this feature implements for creating the `auth.users` row. Directly creating a user with a server-generated temporary password (`admin.createUser({ email, password, email_confirm: true })`) is not implemented.

Reason:

- Invitation email is Supabase's built-in flow for "this account exists but the person hasn't set a password yet" — it sends the person a link, they set their own password, no secret ever has to be communicated out-of-band (Slack, a sticky note, a phone call) where it could leak or be reused.
- A temporary password requires a second, separate communication channel to tell the worker what it is, and a policy for forcing a change on first login that this app does not have infrastructure for (no forced-password-change flow exists).

Not rejected forever — noted as a possible future fallback (e.g., if email deliverability to some workers is unreliable) but not built in this pass, consistent with keeping this change minimal.

## 23. `public.workers.email` is the source of truth, with known data-quality gaps

The Edge Function reads `public.workers.email` for the worker being provisioned rather than asking the admin to type an email a second time (unlike the fallback `link_worker_account` flow, where the admin types the email directly, precisely because that flow supports linking to *any* existing Auth account, not necessarily one matching `workers.email`).

`public.workers.email` today: nullable, no format constraint, no uniqueness constraint (confirmed against the live schema — `character varying`, no `CHECK`, no `UNIQUE`/partial index). This feature does **not** add a schema constraint to fix that (see [[database-plan#14-workers-email-data-quality-considered-deferred]] for why) — instead the Edge Function validates at request time (cases 3, 4, 5 below) and blocks with a clear error rather than silently proceeding with bad data.

## 24. Case-by-case provisioning behavior

Concrete handling for the seven cases named in the request, all enforced **inside the Edge Function**, before any Admin API call is made (so a request that's going to be blocked never triggers a wasted invite email):

1. **Valid email, no existing Auth user:** `inviteUserByEmail(email, { redirectTo: <configured URL> })` succeeds → call `link_worker_account(workerId, email)` with the caller's JWT → success.
2. **Valid email, Auth user already exists:** `inviteUserByEmail` returns a "user already registered"/`email_exists`-class error → the Edge Function treats this as expected, not a failure, and proceeds straight to `link_worker_account(workerId, email)`, which resolves the existing `auth.users` row by email itself (unchanged RPC behavior) → success. No duplicate Auth user is ever created.
3. **Worker has empty/null email:** blocked before any Admin API call, with a clear "este trabajador no tiene correo registrado; actualiza su correo antes de continuar" error. No invite is attempted.
4. **Worker email fails a basic format check:** blocked the same way, before any Admin API call, with a clear "el correo del trabajador no es válido" error.
5. **Worker email is duplicated across multiple `workers` rows:** blocked before any Admin API call — the Edge Function checks `count(*) from workers where email = <this email>` (readable by the caller under the existing staff/admin `workers` SELECT policy) and refuses with "este correo está registrado en más de un trabajador; corrige los datos antes de continuar" if the count is greater than one. Reason to block rather than guess: silently picking "the worker being provisioned right now" while a duplicate exists risks a future admin provisioning the *other* worker with the same email and creating a confusing cross-linked mess; forcing a data fix first is cheap and avoids that.
6. **Worker already has a linked `profiles` row:** checked **before** any Admin API call (via the caller's own admin-readable `profiles` SELECT policy) — if `profiles.worker_id` already has a row, the Edge Function short-circuits with a clear "este trabajador ya tiene una cuenta vinculada" message and never calls `inviteUserByEmail` at all. See decision #26 for why this is a clear message rather than a deeper idempotency check.
7. **Caller is not admin:** rejected **inside `link_worker_account`**, which runs with the caller's own forwarded JWT and already contains the `current_app_role() IS DISTINCT FROM 'admin'` check (decisions #7, #16). The Edge Function additionally makes an early `current_app_role()` call for fast, clear UI feedback (avoiding a wasted invite email if the request will be rejected anyway) — but that early check is a UX optimization, not the security boundary. Even if the Edge Function's early check were buggy or skipped, `link_worker_account` still rejects a non-admin caller on its own, exactly as it does today for the manual flow. This satisfies "reject server-side, not only in UI" without inventing a second, parallel authorization system to keep in sync with the first.

## 25. Environment and secrets model

- **No hardcoded URLs anywhere.** The Edge Function never contains a literal `http://127.0.0.1:54321` or a literal remote project URL. It reads `Deno.env.get("SUPABASE_URL")`.
- **Supabase auto-injects the basics.** Every Edge Function, both under local `supabase functions serve` and once deployed remotely, automatically receives `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as environment variables scoped to whichever project is actually running it — the CLI does this without any manual `supabase secrets set` step for these three. This is *why* the same function code works unmodified in both environments: the platform, not the code, decides which project's URL/keys are injected, based on whether you're running `supabase start`/`serve` locally or have deployed to a linked remote project.
- **Only one custom secret is needed:** `WORKER_INVITE_REDIRECT_URL` — where the invite email's link sends the worker to finish setting a password (decision #27). This *does* need to differ per environment (a `127.0.0.1`-style local URL vs. the real deployed app URL) and is exactly the kind of value that must come from configuration, not code:
  - Local: set in a local-only env file consumed by `supabase functions serve --env-file <path>` (see decision #26's `.env.example` sketch — not created as a real file in this pass).
  - Remote: set via `supabase secrets set WORKER_INVITE_REDIRECT_URL=https://<real-domain>/set-password` (or the equivalent Dashboard "Edge Function secrets" UI) — an explicit, human-run command against the linked remote project, never automatic.
- **No service role key in `src/`, Vite env vars, or any frontend bundle, ever.** The frontend only ever calls `supabase.functions.invoke('create-worker-account', { body: { workerId } })` using the same anon-key client it already uses everywhere else. It never sees, requests, or needs the service role key — that key exists only inside the Edge Function's own server-side runtime.
- **Remote provisioning requires an explicit, separate action.** Nothing about writing this Edge Function's code or running it locally touches the remote project. Making it usable in production requires a human to run `supabase functions deploy create-worker-account --project-ref <remote-ref>` and to set `WORKER_INVITE_REDIRECT_URL` for that project — both are the kind of explicit, human-approved, remote-affecting actions `AGENTS.md`'s existing Supabase safety rules already gate (`supabase login`, `supabase link`, `supabase db push` all require explicit approval today; function deploys and remote secret-setting are the same class of action and should be treated the same way when this is implemented).

## 26. Local testing must not accidentally reach the remote project

Because `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are injected by whichever CLI context is running the function (decision #25), the only way local testing could accidentally provision a real remote Auth user is if a developer manually ran the deploy/link commands against the remote project while testing — an explicit, human-initiated action, not something that happens by running the function locally. Nothing in the function code itself can "reach" the remote project; there is no fallback URL, no default project ref baked in.

Sketch of a local-only `.env.example` for this function (illustrative only — **not created as a real file in this pass**, since this update is spec-only):

```
# supabase/functions/create-worker-account/.env.example
# Local-only. Copy to .env.local and fill in for `supabase functions serve --env-file`.
# SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are injected
# automatically by the Supabase CLI/platform and do NOT need to be set here.
WORKER_INVITE_REDIRECT_URL=http://127.0.0.1:3000/set-password
```

No real secret values appear in this sketch — `SUPABASE_SERVICE_ROLE_KEY` is deliberately absent from the example entirely, since it should never be typed into a file by hand; it's always platform-injected.

## 27. REVISED: a minimal "accept invitation / set password" page is required — provisioning is not complete without it

**This is a real gap the review surfaced, not a design preference.** Supabase's invite email sends the worker a link that establishes a session (via the standard `detectSessionInUrl` behavior already active in this app's Supabase client) but leaves them with **no password set**. Without a page that captures a new password and calls `supabase.auth.updateUser({ password })`, a worker who clicks their invite link lands on some arbitrary route of the app with a half-finished session and no way to actually finish activating their account — the feature would send an email that leads nowhere useful.

The current `spec.md` (before this update) listed "Recuperación avanzada de contraseña / flujo de invitación por correo" as out of scope. That exclusion meant *self-service forgot-password recovery* and *building an invitation flow* generically — it did not anticipate this feature itself introducing invitations. Decision: carve out a **minimal, one-time "activar cuenta" page** (`/set-password`, `src/pages/SetPassword.jsx`) as newly in-scope, necessary companion work for decision #21 — not the advanced, general-purpose password recovery flow that stays out of scope.

**Hard gate (resolved, not open anymore): worker Auth provisioning is not considered complete — not for this feature, not for Phase 11, not for a production rollout — until `/set-password` exists *and* has been verified end-to-end** (per `verification-plan.md`'s companion-page section: invite link → session established → password set → logout → log back in with the new password). Shipping `create-worker-account` alone, without this page working, is shipping an invite email that leads nowhere — that is treated as an incomplete feature, not a smaller/faster version of it.

**Minimum scope for `/set-password`** (deliberately small — anything beyond this list is out of scope for this page):

- Route: `/set-password`.
- Reads the Supabase Auth session already established by the invitation (or password-recovery) link's redirect — no new session-handling code, relies on the existing `detectSessionInUrl` client behavior.
- Lets the worker set/update their password (a password field + confirmation, calling `supabase.auth.updateUser({ password })`).
- Shows clear success and error states (not a silent no-op, not a raw stack trace).
- On success, redirects to `/my-documents` — **not** to `/dashboard`, `/login`, or a generic landing page; the person who just activated an invited account is, by definition, a worker.
- Does **not** implement general forgot-password / self-service recovery for already-active accounts — that stays out of scope (spec.md's Out-of-scope section).
- Does **not** touch or expose the service role key in any way — this is a plain client-side page using the already-established session and the existing anon-key client, same as every other page in the app.
- Does **not** create or link any `profiles` row — that already happened (or will happen) via `link_worker_account`, called from the Edge Function *before* the invite email was ever sent (decisions #21, #24). This page only sets a password on an Auth account that is already linked.
- Authorization after the worker logs in with their new password stays exactly as already specified elsewhere in this document — `RoleGate`/`MyDocuments` resolve access from `profiles`/RLS the same way as any other worker session; `/set-password` itself does not participate in or alter that logic.

See `spec.md`'s revised Out-of-scope section and `implementation-plan.md` §11.3 for this page's design, and `tasks.md`'s Phase 11 for tracking it as its own work item.

## 28. RESOLVED: local invite-email testing must verify content, not just API success; production must not rely on Mailpit

**Previously an open question; now decided.** Supabase local dev already runs a local SMTP testing inbox (`[local_smtp]` in `supabase/config.toml`, a Mailpit-compatible web UI on port 54324) that captures every email the local Auth stack would otherwise send, including invites — this already works today with zero extra configuration, simply by using `inviteUserByEmail` against the local stack.

### Local: content verification is required, not optional

"The `inviteUserByEmail` call returned no error" is **not** sufficient local verification on its own. Reason: this feature's actual value depends on the worker receiving a *usable* link — a successful API response says nothing about whether the redirect URL is correct, whether the email template renders sensibly, or whether the link that arrives actually works. A bug in `WORKER_INVITE_REDIRECT_URL` configuration, for example, would still produce a "successful" API call while sending every worker a broken link.

Local acceptance criteria (all required, tracked in `verification-plan.md`):

- After invoking `create-worker-account` locally, the invite email appears in the local Mailpit inbox (port 54324).
- The email is addressed to the `workers.email` value used for that provisioning request (not some other address).
- The email contains a valid invite/confirmation link (not a broken/placeholder URL).
- Clicking that link redirects to the configured local `WORKER_INVITE_REDIRECT_URL`.
- That redirect URL points at the local app (`127.0.0.1`-style), never at a production domain — confirming local testing cannot leak into pointing a real worker at production by a misconfiguration.
- No real remote Auth account and no real email are created/sent during local testing — everything above happens entirely within the local stack.

### Production: verification must use a real mailbox, not Mailpit

Mailpit only exists in the local stack — it is not a stand-in for verifying production email delivery, which goes through whatever SMTP provider is actually configured for the remote project's Supabase Auth. Production acceptance criteria (all required before the first real rollout, and again after any change to email/redirect configuration):

- Use a **controlled test worker** with an email the team actually controls (e.g., an internal test mailbox) for the first production smoke test — never a real employee's email for this initial check.
- Confirm the invite email actually arrives in that real, controlled mailbox (not just that the API call succeeded).
- Confirm the link in that real email redirects to the **production** `WORKER_INVITE_REDIRECT_URL` (not a local or staging URL — this is the production-side mirror of the local check above).
- Confirm the test worker can complete the full loop: set a password via `/set-password`, then log in successfully with it.

Both halves of this decision exist for the same reason: an API call succeeding is a necessary but not sufficient signal — the thing actually being shipped is a working link a real person clicks, and that has to be verified as such, locally with Mailpit content and in production with a real controlled mailbox.

Simulating a real SMTP provider locally (pointing local `[auth.email.smtp]` at a sandbox account) was considered and rejected as unnecessary for this feature's scope — the local Mailpit content check above already catches the class of bug (bad redirect URL, broken template, wrong recipient) that would matter here; actual SMTP-provider deliverability issues are a production-environment concern, covered by the production smoke test instead.

## 29. The automatic provisioning flow never accepts a manually-typed fallback email

`create-worker-account`'s request body is `{ workerId }` only — there is no `email` field, and there must never be one added to this specific endpoint. The Edge Function always resolves the email from `public.workers.email` for the given `worker_id`, full stop.

Reason: the entire point of decision #23 (`workers.email` as source of truth) is that the automatic flow trusts one specific column. Accepting a caller-supplied email as a fallback "in case the worker record doesn't have one" would silently defeat cases 3/4/5's blocking behavior — an admin could route around an empty/invalid/duplicated `workers.email` by just typing something into a form field, which is exactly the workaround decision #23/#24 case 3 exists to prevent. If `workers.email` is empty or wrong, the correct fix is to correct `workers.email` (a data-quality fix, visible and auditable), not to let the provisioning UI quietly accept a different value that the worker's own record doesn't reflect.

This is not a limitation of the fallback flow — "Vincular cuenta existente" (decision #4) already exists precisely for the case where an admin needs to type a specific, known email that doesn't (or shouldn't) come from `workers.email`. The two flows are deliberately asymmetric: the automatic one is rigid and always matches `workers.email`; the manual one is flexible and always takes admin input directly. Blurring that line — e.g., adding an "override email" option to `create-worker-account` — would erode the reason the automatic flow is safe to trust by default.
