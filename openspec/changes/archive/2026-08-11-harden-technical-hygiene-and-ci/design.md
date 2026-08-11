## Context

The application source is TypeScript, Bun is pinned in `package.json`, and 45 `src` test files run with Bun's built-in test runner. Documentation still describes the former JavaScript/manual-test state. The repository has no GitHub Actions workflow, and Supabase tests require a separate local service stack that should not be introduced into this baseline.

## Goals / Non-Goals

**Goals:**

- Establish one reproducible validation command set locally and in GitHub Actions.
- Make contributor and AI guidance match the current repository.
- Describe PWA offline behavior without implying offline Supabase data access.

**Non-Goals:**

- Run Docker-backed Supabase tests in CI.
- Change application, PWA caching, database, or deployment behavior.
- Add dependencies or regenerate the lockfile.

## Decisions

1. Add a small Bun test runner that discovers `src/**/*.test.ts(x)` files and invokes `bun test --isolate` once per file, sequentially; expose it as `bun run test` and make CI invoke package scripts. A single Bun 1.2.6 discovery process lets `mock.module` state from DOM suites interfere across files even with `--isolate`. Process isolation preserves the existing tests without excluding failures. The runner supplies non-secret localhost Supabase placeholders only when those variables are absent so modules can initialize before per-suite mocks; no network calls are introduced. Restricting discovery to `src` excludes Deno-oriented Edge Function tests and SQL tests with different runtimes.
2. Use one GitHub Actions job on pushes to `main` and pull requests targeting `main`, with `actions/checkout@v4`, `oven-sh/setup-bun@v2`, the version from `package.json`, and `bun install --frozen-lockfile`.
3. Run typecheck, lint, tests, and build sequentially for a clear baseline. Job splitting is unnecessary at the current repository size and would repeat installation work.
4. Keep the PWA configuration unchanged. Documentation will state that the service worker precaches the application shell and static assets; authenticated Supabase operations still require connectivity.
5. Update only stale extension references that describe application conventions. Generated font `.js` assets and `vite.config.js` remain valid exceptions.

## Risks / Trade-offs

- [Per-file process isolation is slower and more verbose] → Keep execution sequential and deterministic; the current 45-file suite remains comfortably within the CI timeout.
- [Action major tags are mutable] → Use widely adopted official actions now; commit-SHA pinning can be introduced later with dependency automation.
- [Supabase regressions are not covered by this job] → State the limitation explicitly and retain the existing local `supabase:lint` and `supabase:test` commands.
