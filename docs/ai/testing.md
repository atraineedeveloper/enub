# Testing and Verification Guide

ENU uses Bun's built-in test runner for frontend and shared TypeScript code. The canonical `bun run test` script runs every `src` test file sequentially in its own Bun process, preventing module mocks from leaking between suites. Deno Edge Function tests and SQL/pgTAP tests use their own runtimes and remain separate.

When Supabase frontend variables are absent, the runner injects safe localhost placeholders so imported modules can initialize before test mocks. Tests must never depend on real credentials or make remote calls.

## Canonical verification commands

Use the Bun version declared in `package.json` and install from the committed lockfile:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run test
bun run build
```

GitHub Actions runs this same frontend baseline for pushes to `main` and pull requests targeting `main`. A separate Supabase CI job also starts a fresh local Postgres instance from the committed migrations, asserts that the local database is PostgreSQL 17 to match ENU production's major version, runs database linting on the application-owned `public` and `private` schemas with errors as the failure threshold, and executes the complete local pgTAP suite. CI never requires production Supabase credentials for these checks.

The CI job pins Supabase CLI 2.113.0 rather than inheriting the older repository lockfile version because a clean checkout must resolve a PostgreSQL 17 local image. The explicit server-version assertion is the final guard: a future CLI/config regression that starts a different PostgreSQL major fails CI before lint or pgTAP can provide a misleading result.

## Focused frontend tests

During implementation, run only the affected tests for faster feedback, then run `bun run test` before completion:

```bash
bun test --isolate src/path/to/affected-area
```

Do not include `supabase/functions` in the frontend test script. Those tests target Deno APIs and are validated separately when an Edge Function changes.

## Supabase local verification

Use these commands only against the local Supabase stack unless a human explicitly approves remote inspection or changes:

```bash
bun run supabase:status
bun run supabase:start
bun run supabase:reset
bun run supabase:lint
bun run supabase:test
bun run supabase:stop
```

For the database-only CI path, GitHub Actions uses the pinned Supabase CLI directly:

```bash
supabase db start
# verify server_version starts with 17.
supabase db lint --local --schema public,private --fail-on error
supabase test db --local
```

The `extensions` schema is deliberately excluded from application linting because it contains third-party extension implementation code such as pgTAP. Those extensions are exercised through the database test runner rather than treated as ENU-owned PL/pgSQL source.

Never run remote Supabase commands as a substitute for local verification.

## Verification by change type

### Documentation or repository tooling

- Run `bun run typecheck` and `bun run lint`.
- Run `bun run test` when test discovery, scripts, dependencies, or CI change.
- Run `bun run build` when Vite, PWA, bundling, or deployment configuration changes.
- Validate the relevant OpenSpec change.

### UI, routing, form, or shared logic

- Run the canonical verification commands.
- Run focused tests while iterating.
- Manually verify behavior not reasonably covered by automation, including responsive and dark-mode behavior for visual changes.

### Supabase query or mutation

- Run the canonical frontend checks.
- Run relevant service tests.
- Run `bun run supabase:lint`; run `bun run supabase:test` when database behavior, RLS, RPCs, triggers, or policies change.
- Verify both authorized and unauthorized paths. RLS, not hidden UI, is the security boundary.

### Database migration

- Run `bun run supabase:reset`, `bun run supabase:lint`, and `bun run supabase:test` locally.
- Document affected tables, functions, triggers, policies, storage objects, compatibility, and deployment order.
- Never modify a linked or remote project without explicit human approval.

### Edge Function

- Run the function's Deno tests using the commands documented in its `deno.json` or active OpenSpec change.
- Verify request-shape validation, caller authorization, safe errors, and secret isolation.
- Run the canonical frontend checks if client contracts or calls change.

### Worker documents

Verify both `/workers/:id/documents` as staff/admin and `/my-documents` as a worker when shared behavior changes. Cover upload, replace, delete, view/download, single- and multi-file types, inactive types, failure cleanup, and cross-worker RLS isolation.

## Manual verification

Manual checks are required when automation cannot demonstrate the affected behavior. Record only relevant checks, such as:

- Happy, empty, loading, and error states.
- Responsive and dark-mode presentation.
- Permission and RLS behavior.
- PWA install/update behavior.
- Post-deployment configuration that cannot be represented in the repository.

If a check cannot be run, leave it incomplete and state the reason. Never claim an unexecuted check passed.
