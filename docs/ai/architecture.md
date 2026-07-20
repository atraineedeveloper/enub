# ENU Architecture

## Stack

- React 18
- Vite
- React Router DOM
- TanStack Query
- Supabase
- Styled Components
- React Hook Form
- React Hot Toast
- Vite PWA

## App entry

- `src/main.jsx` renders `App` inside `ErrorBoundary`.
- `src/App.jsx` defines providers, router, protected routes, lazy pages, and toast configuration.

## Routing

Staff/admin routes (wrapped in `ProtectedRoute` + `RoleGate`, rendered inside `AppLayout`):

- `/dashboard`
- `/degrees`
- `/subjects`
- `/groups`
- `/study-programs`
- `/state-roles`
- `/roles`
- `/others`
- `/semesters`
- `/workers`
- `/workers/:id/documents` — staff/admin view of a specific worker's document expediente (see "Worker documents module" below).
- `/semesters/:id`

Worker self-service routes (wrapped in `ProtectedRoute`, rendered inside `WorkerAppLayout` — a separate, minimal layout with no staff navigation):

- `/my-documents` — a worker's own document expediente.
- `/pending-access` — shown to an authenticated session with no usable role (see "Auth/profile model" below).

Password setup route (not wrapped in `ProtectedRoute`):

- `/set-password` — landing page for an invite or password-recovery email link. Not gated by `ProtectedRoute` because the page itself is what establishes/reads the session from the incoming link; it shows its own "invalid or expired link" state if no session is present, then lets the user set a password via `supabase.auth.updateUser({ password })`.

Public routes:

- `/login`
- `/forgot-password` — self-service entry point for a worker to request a password-recovery email themselves (see "Worker password recovery" below). Not gated by `ProtectedRoute`, same as `/login`.

### Routing behavior

- Staff/admin sessions (`profiles.role` is `staff` or `admin`) reach the normal dashboard/staff routes via `RoleGate`.
- Worker sessions (`profiles.role = 'worker'`) are redirected by `RoleGate` to `/my-documents` if they try to reach any staff route.
- Authenticated sessions with **no** `profiles` row (or an unrecognized role) are redirected to `/pending-access` — never treated as staff by default.
- `/set-password` is reachable regardless of role, since it's used before a worker has finished activating their account.

## Auth/profile model

- `public.profiles` maps a Supabase Auth user (`id`, same as `auth.users.id`) to an application role: `admin`, `staff`, or `worker`.
- A `worker` profile additionally has a `worker_id`, linking that Auth user to a specific row in `public.workers`. `staff`/`admin` profiles have no `worker_id`.
- **No `profiles` row means no application access**, for any reason (a freshly-created Auth user, an account an admin forgot to link, etc.) — this is a deliberate deny-by-default design, not an oversight. Such a session lands on `/pending-access`, never on any staff or worker page.
- Staff/admin access is a separate concern from worker self-service: a `staff`/`admin` profile grants the same broad access to all workers' records/documents that existed before self-service was added; a `worker` profile only ever grants access to that one linked worker's own data.
- Role resolution happens via `src/features/authentication/useProfile.js`, backed by `src/services/apiProfiles.js`'s `getCurrentProfile()` and enforced server-side by RLS (see "RLS/security boundary" below) — the frontend's role check is a routing convenience, not the security boundary.

## Data access pattern

Use this pattern for data-driven features:

1. `src/services/apiDomain.js`
   - Contains Supabase calls.
   - Throws user-facing errors when Supabase returns errors.

2. `src/features/domain/useDomain.js`
   - Uses TanStack Query or mutation hooks.
   - Defines query keys.

3. `src/features/domain/DomainTable.jsx`
   - Handles loading, error, filtering, pagination, and rendering.

4. `src/pages/...`
   - Composes layout, headings, and feature components.

## Current examples

- Subjects:
  - `src/services/apiSubjects.js`
  - `src/features/subjects/useSubjects.js`
  - `src/features/subjects/SubjectTable.jsx`
  - `src/pages/Records/Subjects.jsx`

## Worker account provisioning: Edge Functions

Two Supabase Edge Functions handle server-side worker Auth account provisioning. Both are admin-only, JWT-protected (`verify_jwt = true` in `supabase/config.toml`), and take `{ workerId }` from the client — never an email.

### `create-worker-account`

- **Purpose**: given a worker with no linked account yet, invites (or links, if an Auth account with that email already exists) a self-service Auth account for them.
- Requires the caller to be an `admin` (checked via `current_app_role()`; the real, non-bypassable boundary is the existing `link_worker_account` RPC's own admin check, which this function delegates to for the actual `profiles` write).
- Request body is `{ workerId }` only — the worker's email is always read server-side from `public.workers.email`, never accepted from the client.
- Uses `WORKER_INVITE_REDIRECT_URL` (a per-environment secret/env var) as the `redirectTo` for the invite email, so the invited worker lands on `/set-password`.
- Uses the Supabase service-role key **only inside this function's own server-side runtime**, only for the one call that structurally requires it (`auth.admin.inviteUserByEmail`) — the frontend never sees or sends a service-role key.

### `resend-worker-access-link`

- **Purpose**: for a worker who **already has** a linked account but needs a fresh password-setup/recovery link (e.g. their original invite link went stale, or they forgot their password later). A separate action and a separate function from `create-worker-account` — it never creates or links a `profiles` row.
- Requires the caller to be an `admin` (`current_app_role()` — this function has no RPC to delegate to, so this check is itself the real boundary; it's still SECURITY DEFINER and resolves from the caller's own verified JWT, not a client-supplied claim).
- Request body is `{ workerId }` only — same as `create-worker-account`, email is always read server-side from `public.workers.email`.
- Uses the same `WORKER_INVITE_REDIRECT_URL` to send the worker back to `/set-password`.
- Does **not** use the service-role key at all — `resetPasswordForEmail` is a normal anon-key-accessible GoTrue endpoint, so this function has an even smaller privilege footprint than `create-worker-account`.

Both functions reject any request body containing extra or differently-named keys (not just a literal `email` field), so there is no way to smuggle a caller-supplied email into either flow.

## Email templates

Local custom email templates live in `supabase/templates/` (`invite.html`, `recovery.html`) and are wired up via `supabase/config.toml`'s `[auth.email.template.invite]` / `[auth.email.template.recovery]` sections. Both templates:

- Use `{{ .ConfirmationURL }}` for the action link/button.
- Point the recipient to `/set-password` (via the Edge Functions' `WORKER_INVITE_REDIRECT_URL`, embedded in the confirmation/recovery URL that Supabase Auth generates).
- Contain no external images, remote assets, or tracking pixels.

**Local vs. remote:** `supabase/config.toml`'s `[auth.email.template.*]` and `[auth] additional_redirect_urls` only take effect for the **local** Supabase stack (`supabase start`). A remote/hosted Supabase project does not read this repo's `config.toml` for its live email templates or redirect allow-list — those must be configured separately, either in the Supabase Dashboard (Authentication → Email Templates, Authentication → URL Configuration) or via the equivalent remote project configuration/CLI commands, as an explicit, human-approved step. Applying local config changes is not sufficient to update a deployed project's behavior.

## Worker password recovery

- `/forgot-password` (`src/pages/ForgotPassword.tsx`, form logic in `src/features/authentication/ForgotPasswordForm.tsx`) lets a worker request a password-recovery email themselves, without any admin action. It calls `supabase.auth.resetPasswordForEmail` directly from the client (`requestPasswordRecovery` in `src/services/apiAuth.ts`) — no Edge Function, no service-role key.
- `redirectTo` is derived from the browser's own origin at request time (`` `${window.location.origin}/set-password` ``), **not** from `WORKER_INVITE_REDIRECT_URL` — that name is a server-only Edge Function secret and is never exposed to frontend code. Locally this resolves to the Vite dev origin (e.g. `http://localhost:5173/set-password`), already present in `supabase/config.toml`'s `additional_redirect_urls`. Before this flow is used against a deployed environment, a human must add that deployed origin's `/set-password` URL to the hosted Supabase Auth redirect allow-list, and confirm the Edge Functions' `WORKER_INVITE_REDIRECT_URL` targets the same URL so invitation and recovery links stay compatible.
- The response is identical whether or not the submitted email matches an account (`resetPasswordForEmail` itself does not distinguish this, and the UI must not add such a distinction) — this avoids email enumeration. A genuine failure (e.g. network error, the shared rate limit below) shows a generic, client-safe error state instead, never a raw Supabase error message.
- This self-service trigger shares the same `auth.rate_limit.email_sent` limit (`supabase/config.toml`, currently 2/hour) as the admin-triggered `create-worker-account` invite and `resend-worker-access-link` resend — a burst of one flow can cause another to be throttled within the same hour. This is accepted as-is for the current iteration rather than raised.
- `/set-password` itself does not distinguish an invitation session from a recovery session (see "Worker account provisioning: Edge Functions" above) — its copy is written to be accurate for either case, rather than branching on link type.
- The minimum password length is enforced as 8 characters both client-side (`SetPassword.tsx`) and in the local Supabase Auth config (`minimum_password_length` in `supabase/config.toml`). A hosted/remote Supabase project's equivalent setting is a separate, human-approved deployment prerequisite — this repo's local config change does not propagate to it automatically.

## Worker documents module

- `src/features/workers/documents/WorkerDocumentsView.jsx` is a single shared component, parametrized only by `workerId`, rendered by both:
  - `/workers/:id/documents` (staff/admin, `workerId` from the URL).
  - `/my-documents` (worker self-service, `workerId` resolved from the caller's own session/profile — never from the URL).
- Workers can upload, replace, and delete their own documents; staff/admin can do the same for any worker's documents — both governed entirely by RLS on `worker_documents` and the `worker_documents` storage bucket (see "RLS/security boundary" below), not by separate application-level permission logic.
- **Delete behavior** (`deleteWorkerDocument` in `src/services/apiWorkerDocuments.js`): fetches the document row first (to read its storage path, under normal RLS), deletes the database row, then deletes the storage object. If the DB row delete fails, the storage object is left untouched. If the storage delete fails *after* the DB row was already deleted, the row is **not** reinserted — the document is already correctly gone from the expediente — and a distinct warning toast tells the user the file may still need manual cleanup.
- **Replace behavior** (`replaceWorkerDocument` in `src/services/apiWorkerDocuments.ts`): uploads the new file to storage, then calls the `replace_worker_document_metadata` database RPC, which deletes the superseded row and inserts the replacement row inside one transaction. If the RPC call fails for any reason (an inactive-type rejection, the single-file integrity trigger, an RLS rejection, or any other database error), the whole transaction rolls back automatically — the previous metadata and storage object are left completely untouched — and only the newly uploaded storage object is cleaned up. If the RPC succeeds, the previous storage object is removed afterward, best-effort and non-fatal on failure.
- **Upload UI**: the native browser "Choose File" control is visually hidden and replaced with a styled "Seleccionar archivo" trigger button; the selected file's name (or "Ningún archivo seleccionado") is shown next to it before the upload/replace action runs.
- **Multi-file ("Evidencias bimestrales") document types** allow more than one file per type: each uploaded file gets its own Ver/Descargar/Eliminar actions, independent of the others. Deleting the last remaining file for such a type returns it to the same empty/pending state used before any file was ever uploaded — no special "all deleted" state.
- **Document type lifecycle (`is_active`)**: a retired document type is hidden from upload interfaces going forward, but a worker's own historical documents under it remain fully visible, downloadable, and deletable — never hidden because of the type's `is_active` value. A worker/administrator view includes a type's row only when it is active, or the worker being viewed already has documents under it; the PDF report applies the identical rule independently.

## RLS/security boundary

- Row Level Security is the actual enforcement boundary for `public.workers`, `public.worker_documents`, `public.profiles`, and the `worker_documents` bucket in `storage.objects` — any UI hiding of an action (e.g. an admin-only button) is convenience only, not the security mechanism.
- The frontend (`src/`) never uses a Supabase service-role key and never calls the Supabase Admin API — both are confined to the two Edge Functions' own server-side runtimes.
- Edge Functions are JWT-protected (`verify_jwt = true`) and perform their own admin-role checks (via `current_app_role()`, a `SECURITY DEFINER` SQL function that resolves the caller's role from their own verified JWT) before doing anything privileged.

## Environment

The code expects:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (the Supabase client also accepts `VITE_SUPABASE_KEY` as a fallback, but `VITE_SUPABASE_ANON_KEY` is the name used by `.env.example` and `README.md`, and is preferred).
