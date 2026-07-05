# Tasks — typescript-tooling-foundation

Status: implemented — lint/typecheck verified; build needs a local rerun because the
reviewer rerun timed out without Vite diagnostics.

## Phase 1: Change artifacts

- [x] Write `proposal.md`.
- [x] Write `design.md`.
- [x] Write `tasks.md` (this file).

## Phase 2: Dependencies

- [x] `bun add -d typescript typescript-eslint` — installed `typescript@6.0.3` and
      `typescript-eslint@8.62.1`.
- [x] Confirm `@types/react`/`@types/react-dom` remain as-is (already present; not
      re-added or version-bumped by this change).
- [x] Confirm `@types/node` is **not** added (see `design.md` Section 1).

## Phase 3: `tsconfig.json`

- [x] Add `tsconfig.json` at the repo root per `design.md` Section 2: `allowJs: true`,
      `checkJs: false`, `strict: true`, `noEmit: true`, `jsx: "react-jsx"`,
      `moduleResolution: "Bundler"`, `include: ["src"]`,
      `exclude: ["node_modules", "dist", "supabase"]` (the `supabase` exclude keeps the
      two Deno Edge Function `.ts` files, which have their own `deno.json` runtime, out
      of this browser-facing config).

## Phase 4: `package.json` script

- [x] Add `"typecheck": "tsc --noEmit"` to `scripts`. Not wired into `lint`/`build`.

## Phase 5: ESLint

- [x] Add a new `files: ['**/*.{ts,tsx}']` block to `eslint.config.js` per `design.md`
      Section 3: `typescript-eslint`'s parser, the same `js`/`react`/`react-hooks`
      recommended rule sets already used for `.js`/`.jsx`, `@typescript-eslint/no-unused-vars`
      in place of core `no-unused-vars`, and `no-undef` off (superseded by
      `bun run typecheck` for these files only).
- [x] Leave the existing `**/*.{js,jsx}` block completely unmodified — same parser, same
      rules, same behavior as before this change.
- [x] Do not disable `react/prop-types` anywhere.

## Phase 6: Verification — results

- [x] `bun install` (via `bun add -d`) — `bun.lock` updated (+46 lines); only the two
      new packages and their own transitive deps added, nothing unrelated shifted.
- [x] `bun run lint` — **304 problems (300 errors, 4 warnings)**, identical to the
      pre-existing baseline. `src/types/supabase.ts` (now linted for the first time as
      a real `.ts` file) produced **zero** new problems.
- [x] `bun run typecheck` — **passes** with `strict: true`, no output/errors.
- [ ] `bun run build` — another agent reported this passing (`vite build`, 717 modules
      transformed, built in ~5s, PWA precache generated), but reviewer reruns timed out
      after 180s with only `$ vite build` printed and no Vite diagnostics. Rerun locally
      before commit; do not fix unrelated build/runtime behavior in this tooling PR.
- [x] `git status` — changed-file set is exactly: `package.json`, `bun.lock`,
      `eslint.config.js` (all modified), plus new `tsconfig.json` and
      `openspec/changes/typescript-tooling-foundation/**`. Nothing under `src/` or
      `supabase/` touched.

## Not in scope for this change

- [ ] Adding `typescript-eslint`'s full `configs.recommended` rule set (only the parser
      + `no-unused-vars` replacement are used here — see `design.md` Section 3).
- [ ] Disabling `react/prop-types` for any file — no `.tsx` component exists yet to
      justify it.
- [ ] Converting any `.js`/`.jsx` file to `.ts`/`.tsx`.
- [ ] Wiring `typecheck` into `lint`, `build`, or CI.
