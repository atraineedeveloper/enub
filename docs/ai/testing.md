# Testing and Verification Guide

This project currently has no automated JavaScript test runner. Until one is added, every feature spec must include a manual verification plan and must pass lint/build checks before being considered complete.

## Current verification commands

Use Bun by default in this project.

```bash
bun run lint
bun run build
bun run preview
```

Equivalent npm commands are acceptable when Bun is unavailable:

```bash
npm run lint
npm run build
npm run preview
```

## Supabase local verification commands

Use these only against the local Supabase stack unless a human explicitly approves remote inspection or remote changes.

```bash
bunx supabase status
bunx supabase start
bunx supabase stop
bunx supabase db reset
bunx supabase db lint
bunx supabase test db --local
bunx supabase migration list
```

Do not run remote Supabase commands without explicit human approval.

## Required verification for every change

Every feature, bug fix, or refactor must include a verification section in its spec under `specs/active/<feature-name>/verification-plan.md` or inside the feature spec itself.

At minimum, verify:

- Lint passes or existing baseline is documented.
- Build passes.
- The affected route or user flow was manually checked.
- Loading, empty, success, and error states were checked when relevant.
- Supabase behavior was checked when data access changed.
- Documentation was updated when routes, behavior, setup, data contracts, or feature structure changed.

## Verification by change type

### UI-only change

Run:

```bash
bun run lint
bun run build
bun run dev
```

Manually verify:

- Affected route renders correctly.
- Responsive behavior is not broken.
- Dark mode still uses existing CSS variables.
- Empty/loading/error states still work.
- No unrelated routes changed visually.

### Form or validation change

Run:

```bash
bun run lint
bun run build
```

Manually verify:

- Valid input works.
- Required fields are enforced.
- Invalid input shows clear user-facing errors.
- Supabase errors are surfaced through the existing toast/error convention.
- Form reset/cancel/edit flows still work.

### Supabase read/query change

Run:

```bash
bun run lint
bun run build
bunx supabase db lint
```

Manually verify:

- Query returns the expected records for an authorized user.
- Query returns no unauthorized records.
- Empty states work.
- Loading states work.
- Error states show user-facing messages, not raw stack traces.

### Supabase insert/update/delete change

Run:

```bash
bun run lint
bun run build
bunx supabase db lint
```

Manually verify:

- Authorized user can perform the operation.
- Unauthorized user cannot perform the operation.
- RLS, not frontend hiding, is the real enforcement boundary.
- The UI invalidates/refetches the relevant TanStack Query cache.
- The UI shows a success toast on success.
- The UI shows a clear error toast on failure.
- No service-role key or Admin API call is introduced in `src/`.

### Database migration change

Run:

```bash
bunx supabase db reset
bunx supabase db lint
bun run build
```

Manually verify:

- Migration applies cleanly from a reset local database.
- Any RLS policy change is documented in the relevant spec.
- Existing affected flows still work after the migration.
- New tables/columns/functions are documented in `docs/ai/api.md` or `docs/ai/architecture.md` when relevant.

### Edge Function change

Run:

```bash
bun run build
bunx supabase db lint
```

Manually verify locally when possible:

- Function accepts only the documented request shape.
- Function rejects extra or unsafe caller-supplied fields.
- Function checks the caller's role server-side when privileged.
- Service-role usage, if required, stays inside the Edge Function runtime only.
- Frontend never receives, imports, stores, logs, or commits service-role secrets.
- Environment variables required by the function are documented.

### Worker documents change

Manually verify both routes because they share the same document view:

- `/workers/:id/documents` as staff/admin.
- `/my-documents` as a worker.

Check:

- Upload.
- Replace.
- Delete.
- View/download.
- Single-file document type behavior.
- Multi-file `Evidencias` behavior.
- Empty state after deleting the last file.
- RLS blocks another worker from accessing or mutating documents they do not own.

## Manual verification template

Use this in each feature spec.

```md
# Verification Plan - <feature-name>

## Automated checks

- [ ] `bun run lint`
- [ ] `bun run build`

## Manual checks

- [ ] Route checked:
- [ ] Happy path checked:
- [ ] Empty state checked:
- [ ] Loading state checked:
- [ ] Error state checked:
- [ ] Dark mode checked:
- [ ] Responsive behavior checked:

## Supabase checks, if applicable

- [ ] Authorized user can perform the action.
- [ ] Unauthorized user is blocked by RLS.
- [ ] Expected rows/storage objects changed.
- [ ] No service-role/Admin API usage was added to `src/`.

## Documentation checks

- [ ] `docs/ai/architecture.md` updated if architecture/routes/feature structure changed.
- [ ] `docs/ai/api.md` updated if Supabase tables, RPCs, Edge Functions, storage, or contracts changed.
- [ ] `README.md` updated if product-level behavior or setup changed.
```

## When a check cannot be run

Do not mark it as passed. Document it clearly:

```md
- [ ] `bunx supabase db reset` — not run because Docker/Supabase local was unavailable.
```

A task may still be reviewed, but the PR/spec must state what was not verified.
