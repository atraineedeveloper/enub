# Proposal: TypeScript Tooling Foundation

## Status

Draft

## Why

`openspec-ts-migration-foundation` (already merged) authorized a 4-phase TS rollout but
deliberately stopped at documentation — no dependency, config, or `.js`/`.jsx` change.
Phase 0 of that plan ("Tooling only") is this change: make the toolchain able to build
and lint a `.ts`/`.tsx` file *if one is added later*, without converting or
type-checking any existing file yet.

`@types/react`/`@types/react-dom` are already present as dev dependencies (added
incidentally with Vite's React template) but `typescript` itself was never added, so
there is no compiler and no `tsconfig.json` yet.

## What changes

- Add `typescript` as a dev dependency (`@types/react`/`@types/react-dom` already
  exist; `@types/node` is not added — see `design.md` for why it isn't needed yet).
- Add `tsconfig.json`: `allowJs: true`, `checkJs: false`, `strict: true`, `noEmit: true`,
  `jsx: "react-jsx"`, `moduleResolution: "Bundler"`.
- Add a `typecheck` script (`tsc --noEmit`) to `package.json`.
- Extend `eslint.config.js`'s `files` glob so a `.ts`/`.tsx` file parses correctly if one
  is added, without changing any rule's behavior for existing `.js`/`.jsx` files.

## What does not change

- No `.js`/`.jsx` file is renamed, converted, or moved.
- No `src/` runtime behavior changes.
- `react/prop-types` is not disabled anywhere — there is no `.tsx` file yet to justify
  it, and `openspec-ts-migration-foundation`'s design.md is explicit that this rule
  turns off per-file, only once that file has real TS prop types.
- `react-hooks/rules-of-hooks`, `no-undef`, `no-unused-vars`, and
  `react-hooks/exhaustive-deps` all stay active and unchanged for existing
  `.js`/`.jsx` files.
- No existing lint error is fixed or newly suppressed.
- `specs/active/` is not touched.

## Impact

- **Affected code:** `package.json`, `tsconfig.json` (new), `eslint.config.js`. No file
  under `src/` or `supabase/` changes.
- **Affected process:** any future PR may now add a `.ts`/`.tsx` file and get real type
  checking (`bun run typecheck`) and lint support for it. No PR is required to.
