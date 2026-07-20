# API and Data Contracts

This document describes ENU's application-facing API/data contracts. ENU is a React/Vite frontend backed by Supabase, so most data access happens through Supabase client calls in `src/services/api*.js`, plus a small number of Supabase Edge Functions for privileged flows.

## Data-access rule

Frontend components should not call Supabase directly.

Use this pattern:

```txt
src/services/apiDomain.js              # Supabase queries/mutations
src/features/<domain>/useDomain.js     # TanStack Query hooks/mutations
src/features/<domain>/*.jsx            # UI
src/pages/...                          # route-level composition
```

The service layer should:

- Contain Supabase calls.
- Convert Supabase errors into clear user-facing `Error` messages.
- Avoid leaking stack traces or raw database internals to UI.
- Avoid service-role/Admin API usage in `src/`.

## Environment variables

The frontend expects:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`VITE_SUPABASE_ANON_KEY` is preferred. If legacy fallback support exists for `VITE_SUPABASE_KEY`, do not introduce new references to the fallback unless maintaining existing compatibility.

Never commit real `.env` values.

## Authentication and roles

Application role data lives in `public.profiles`.

Known role states:

- `admin`
- `staff`
- `worker`
- no profile row / unknown role

Expected behavior:

- `admin` and `staff` access staff/admin routes.
- `worker` accesses worker self-service routes such as `/my-documents`.
- A session with no usable profile goes to `/pending-access`.
- `/set-password` is reachable for invite/recovery flows.

Frontend role checks are routing convenience only. Supabase RLS is the actual security boundary.

## RLS/security contract

Any API/data change must preserve these rules:

- Workers can access only their own worker-linked data.
- Staff/admin access must be granted intentionally by RLS or approved database functions.
- No frontend code may bypass RLS.
- No service-role key may appear in `src/`.
- No Supabase Admin API call may appear in `src/`.
- Edge Functions must validate caller role server-side before privileged work.

## Supabase tables currently important to app behavior

Document table names here when a feature touches them. Keep this list updated as the schema evolves.

### `public.profiles`

Purpose:

- Maps Supabase Auth users to application roles.
- For worker accounts, links an Auth user to a specific `public.workers` row via `worker_id`.

Important fields:

- `id` — same as `auth.users.id`.
- `role` — `admin`, `staff`, or `worker`.
- `worker_id` — present for worker profiles.

Contract:

- No profile row means no application access.
- Worker profile access is limited to the linked worker.

### `public.workers`

Purpose:

- Stores worker/staff/personnel records used by the school management system.
- Worker self-service account creation uses the worker's stored email.

Contract:

- Edge Functions that provision worker accounts accept `workerId`, not caller-supplied email.
- Email is resolved server-side from `public.workers`.

### `public.worker_documents`

Purpose:

- Stores uploaded document metadata for workers.

Important contract:

- Documents are linked to a worker.
- Storage object path is stored in the row.
- RLS controls who can read/write/delete.
- Workers can manage their own documents.
- Staff/admin can manage documents for workers as allowed by policies.

Delete contract:

1. Fetch the document row by `id` under normal RLS to read `storage_path`.
2. Delete the `worker_documents` row.
3. Only after the row delete succeeds, delete the storage object.
4. If the row delete fails, do not attempt storage deletion.
5. If storage deletion fails after row deletion, do not reinsert the row; show a clear warning/error toast.

### `public.worker_document_types`

Purpose:

- Defines document types required/available for worker expedientes.

Contract:

- Some types may allow multiple files, such as `Evidencias bimestrales`.
- UI must preserve multi-file behavior when adding upload/replace/delete actions.
- `is_active` (`boolean`, `NOT NULL`, default `true`) marks whether a type currently accepts new uploads/replacements. Retiring a type never deletes its historical `worker_documents` rows or storage objects; upload interfaces hide a type only when it is inactive *and* the worker being viewed has no existing documents under it. A `BEFORE INSERT OR UPDATE` trigger enforces this at the database layer regardless of client state.

### `public.worker_document_categories`

Purpose:

- Groups document types into document categories.

Contract:

- UI renders documents grouped by category.

## Storage buckets

### `worker_documents`

Purpose:

- Stores files uploaded for worker expedientes.

Contract:

- Storage access must be governed by Supabase policies.
- UI actions should not assume that hiding a button is security.
- File deletion should follow the `worker_documents` delete contract above.
- Storage paths should come from trusted database rows, not caller-supplied values.

## Edge Functions

Edge Functions live under:

```txt
supabase/functions/<function-name>/index.ts
```

### `create-worker-account`

Purpose:

- Creates/invites or links a worker self-service Auth account.

Request contract:

```json
{
  "workerId": 123
}
```

Rules:

- Caller must be admin.
- The function must read the worker email server-side from `public.workers`.
- The client must not send an email.
- Extra request keys must be rejected.
- Uses `WORKER_INVITE_REDIRECT_URL` for redirecting the invite flow to `/set-password`.
- Service-role usage, if required, stays inside the Edge Function runtime only.

### `resend-worker-access-link`

Purpose:

- Sends a fresh password setup/recovery link for a worker who already has a linked account.

Request contract:

```json
{
  "workerId": 123
}
```

Rules:

- Caller must be admin.
- Does not create or link a `profiles` row.
- Reads email server-side from `public.workers`.
- Rejects extra request keys.
- Uses `WORKER_INVITE_REDIRECT_URL` to route the worker to `/set-password`.

## Email templates

Local templates live in:

```txt
supabase/templates/invite.html
supabase/templates/recovery.html
```

Local configuration lives in:

```txt
supabase/config.toml
```

Important contract:

- Local `config.toml` affects the local Supabase stack only.
- A remote/hosted Supabase project requires separate Dashboard or approved remote configuration.
- Templates should point workers to `/set-password` through Supabase's generated confirmation/recovery URL.

## UI-facing data contract rules

When adding or changing data returned to UI:

- Document new fields in the feature spec.
- Keep field names consistent with existing Supabase column names unless mapping is intentional.
- Do not expose internal-only fields to user-facing components unless needed.
- Do not expose secrets, tokens, or service-role-only values.
- Handle null/empty states explicitly.

## Mutation conventions

For create/update/delete actions:

- Put Supabase mutation logic in `src/services/api*.js`.
- Wrap it in a feature hook using TanStack Query.
- Invalidate relevant query keys after success.
- Show success toast on success.
- Show clear error toast on failure.
- Disable relevant button/control while mutation is pending.
- Avoid page-wide spinners for row-level actions when a button-level loading state is enough.

## Documentation requirement for API/data changes

If a change modifies any of the following, update this file:

- Supabase table.
- Column contract.
- RLS behavior.
- RPC/database function.
- Edge Function request/response.
- Storage bucket/path behavior.
- Environment variable.
- Auth/role contract.

Also update the active feature spec under:

```txt
specs/active/<feature-name>/
```
