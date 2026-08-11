## Why

The repository's setup and verification documentation no longer reflects its TypeScript and Bun test suite, and contributors receive no automatic validation on pushes or pull requests. Aligning the documentation and adding a focused CI baseline reduces avoidable regressions before the forthcoming data-protection work.

## What Changes

- Make Bun the documented package manager and expose a canonical frontend test script.
- Update stale `.js`/`.jsx`, test-runner, TypeScript migration, and PWA offline claims.
- Add GitHub Actions validation for typecheck, lint, isolated Bun tests, and production build.
- Keep CI limited to frontend/tooling checks; Supabase local services and remote operations remain out of scope.
- Do not change routes, application behavior, database objects, RLS, storage, dependencies, or public data contracts.
- Risk level: low; changes are documentation and repository automation only.

## Capabilities

### New Capabilities

None. This change introduces repository tooling rather than product behavior.

### Modified Capabilities

None. Existing product requirements are unchanged.

## Impact

Affected files include `README.md`, `AGENTS.md`, `docs/ai/*`, `eslint.config.js`, `package.json`, `tsconfig.json`, a small test-runner script, and a new `.github/workflows/ci.yml`. GitHub-hosted CI will use the repository's pinned Bun version and lockfile; no new package dependency is introduced.
