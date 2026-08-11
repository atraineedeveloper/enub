## 1. Canonical repository commands

- [x] 1.1 Add the per-file isolated `src` Bun test runner and expose it through `package.json` without changing dependencies or the lockfile.
- [x] 1.2 Add a GitHub Actions workflow that installs from the frozen Bun lockfile and runs typecheck, lint, tests, and build.

## 2. Documentation alignment

- [x] 2.1 Update `README.md` to use Bun, list current validation scripts, and accurately describe PWA offline limits.
- [x] 2.2 Update `AGENTS.md`, `openspec/config.yaml`, and `docs/ai/*` references to the current TypeScript paths and automated test baseline.
- [x] 2.3 Remove obsolete pre-TypeScript migration commentary from `eslint.config.js` while preserving the active rule set.

## 3. Verification

- [x] 3.1 Install dependencies with `bun install --frozen-lockfile`.
- [x] 3.2 Run `bun run typecheck` and `bun run lint`.
- [x] 3.3 Run `bun run test` and `bun run build`.
- [x] 3.4 Validate the OpenSpec change strictly and inspect the final diff for scope and secret safety.
