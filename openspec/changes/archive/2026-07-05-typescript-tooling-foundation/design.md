# Design: TypeScript Tooling Foundation

## 1. Dependencies

- **Add** `typescript` (dev). Nothing in the repo installs a TS compiler today —
  `@types/react`/`@types/react-dom` are already present (came in with Vite's React
  template) but are inert without `typescript` itself.
- **`@types/node` is not added.** Nothing in `tsconfig.json`'s `include` (see below)
  touches Node-only APIs — `src/` is browser code, and `lib: ["DOM", ...]` covers it.
  Add it later only if a `.ts` file actually needs a Node type (e.g. a Vite config
  rewrite), not preemptively.
- **Add** `typescript-eslint` (dev) — the combined parser+plugin package, needed so
  `.ts`/`.tsx` files parse and lint correctly (see Section 3). Not listed in the
  original "TypeScript dev dependencies" set because it's a lint dependency, not a
  compiler dependency, but it's required for the ESLint change to do anything real
  rather than being a no-op glob extension.

## 2. `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "supabase"]
}
```

Notable decisions:

- **`strict: true`.** This matches `openspec-ts-migration-foundation`'s Phase 0 plan and
  keeps newly-added `.ts`/`.tsx` files on a strong default from the start. Because
  `checkJs: false` keeps existing `.js`/`.jsx` files out of type-checking, strict mode
  does not create a brownfield cleanup burden for the current app. The one existing
  generated file in scope, `src/types/supabase.ts`, passes strict checking.
- **`allowJs: true`, `checkJs: false`.** Lets `.ts`/`.tsx` files import from existing
  `.js`/`.jsx` files without a compiler error, but does not type-check the `.js`/`.jsx`
  files themselves — matches `openspec-ts-migration-foundation`'s "no `.js`/`.jsx` file
  is type-checked yet" constraint exactly.
- **`moduleResolution: "Bundler"`** matches how Vite actually resolves modules
  (dependency `exports` fields, no forced file extensions) and requires TypeScript ≥5.0,
  which the installed version satisfies.
- **`noEmit: true`** — Vite/esbuild does the actual transpilation; `tsc` here is a
  checker only, never a build step. `bun run build` is unaffected by this file.
- **`include: ["src"]`, `exclude: [..., "supabase"]`.** `supabase/functions/*/index.ts`
  (the two Deno Edge Functions) are real `.ts` files already in the repo, each with its
  own `deno.json` and Deno-specific module resolution (remote/`npm:` specifiers, Deno
  globals) — fundamentally incompatible with this browser/Bundler-resolution
  `tsconfig.json`. Scoping `include` to `src/` only keeps them out without needing a
  second, Deno-flavored `tsconfig.json` in this change.
- **A real file is already in scope: `src/types/supabase.ts`.** This is a generated
  Supabase `Database` type file (611 lines, self-contained, no imports), referenced
  today only via a JSDoc `@type` comment in `src/services/supabase.js` — never actually
  imported at runtime. It was previously invisible to any tooling (not `.js`/`.jsx`, so
  outside `eslint.config.js`'s glob; no `tsconfig.json` existed to check it at all).
  This change is the first time it is type-checked (`bun run typecheck`) and linted
  (new ESLint block, Section 3) — a real, non-hypothetical proof point for this
  tooling, not just a hypothetical future file.

## 3. ESLint

`eslint.config.js` gets one new block, scoped to `**/*.{ts,tsx}`, sitting alongside the
existing unmodified `**/*.{js,jsx}` block:

```js
import tseslint from 'typescript-eslint'
// ...
{
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: globals.browser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: { react: { version: '18.3' } },
  plugins: {
    react,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
    '@typescript-eslint': tseslint.plugin,
  },
  rules: {
    ...js.configs.recommended.rules,
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
    ...reactHooks.configs.recommended.rules,
    'react/jsx-no-target-blank': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'no-undef': 'off',
  },
}
```

Decisions, rule by rule (cross-referencing the "keep active" list from this change's
brief and from `openspec-ts-migration-foundation`'s design.md):

- **Deliberately not** spreading `typescript-eslint`'s full `configs.recommended` (which
  is itself an array of config objects covering many additional `@typescript-eslint/*`
  rules). That would add a large new surface of rules with no prior baseline to compare
  against, on the very first PR that makes `.ts`/`.tsx` lintable at all — exactly the
  "overcomplicate" this change was told to avoid. Instead this block reuses the same
  `js`/`react`/`react-hooks` recommended rule sets already governing `.js`/`.jsx`, so a
  `.ts`/`.tsx` file is held to the *same* bar as a `.js`/`.jsx` file today, not a new,
  stricter one. Expanding the TS-specific rule set is a decision for whichever future
  change actually starts converting files.
- **`react/prop-types` stays on** for `.ts`/`.tsx` in this block. There is no `.tsx`
  component anywhere yet to justify turning it off (the one existing `.ts` file has no
  React component in it), and `openspec-ts-migration-foundation`'s design.md is explicit
  that this rule is retired **per file**, only once that file has real TS prop types —
  never as a blanket flip. Turning it off here, pre-emptively, for a rule glob with zero
  real components in it yet, would be exactly the "globally, without justification" case
  the brief warns against.
- **`react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` stay on**, unchanged
  — both come from `eslint-plugin-react-hooks`'s own AST traversal, which works
  identically whether the parser is `espree` or `@typescript-eslint/parser`; nothing
  about TypeScript changes what a conditional hook call or a stale dependency array is.
- **`no-unused-vars` (core) is turned off and replaced with
  `@typescript-eslint/no-unused-vars`** for this block only — same intent as the core
  rule, but type-aware enough not to false-positive on TS-only constructs (e.g. a type
  used only in an annotation, function overload signatures). `.js`/`.jsx` files are
  unaffected; they keep the core rule exactly as today.
- **`no-undef` (core) is turned off for `.ts`/`.tsx` only.** This is a real, deliberate
  narrowing, not an oversight — it's why the task brief said "`no-undef` for JS"
  specifically rather than listing it unscoped. The reasoning: `.js`/`.jsx` files have
  no compiler at all, so ESLint's `no-undef` is their *only* defense against a reference
  to an undeclared variable — it stays on, unchanged. `.ts`/`.tsx` files get a strictly
  stronger version of that same check for free from `bun run typecheck` (a real
  compiler catching genuine unresolved references, not just ESLint's static scope
  analysis, which has a known history of false positives on TypeScript-only constructs
  like ambient/global type declarations). This mirrors `typescript-eslint`'s own
  published guidance for TS codebases. It is not a reduction in real-defect coverage —
  it's swapping a weaker check for a stronger one that already exists in this change's
  new `typecheck` script.

## 4. `package.json`

- New script: `"typecheck": "tsc --noEmit"`.
- Not wired into `lint` or `build` in this change — kept as its own explicit command so
  it can be run (and its output evaluated) independently before anyone decides to make
  it a required CI/verification step.

## 5. Verification plan for this change

- [ ] `bun install` — installs `typescript` and `typescript-eslint`; confirm `bun.lock`
      updates and no unrelated dependency shifts.
- [ ] `bun run lint` — record the new total. Expected: the pre-existing 304-problem
      `.js`/`.jsx` baseline unchanged, plus whatever `src/types/supabase.ts` newly
      surfaces now that it's linted for the first time (expected to be zero or very
      close to it, since it's flat generated type declarations with no unused
      identifiers or undefined references) — reported as a separate, explicit number,
      not folded silently into "still 304."
- [ ] `bun run typecheck` — expected to pass with `strict: true`
      (`src/types/supabase.ts` is the only `.ts` file in scope, and it is
      self-contained). Any error here is investigated and reported, not silently worked
      around.
- [ ] `bun run build` — must still pass; `tsconfig.json`/`noEmit: true` must not affect
      Vite's own build. If it hangs or fails for a reason unrelated to this change (pre-
      existing), document that explicitly rather than fixing it as part of this PR.
- [ ] `git status`/`git diff --stat` — confirm only `package.json`, the lockfile,
      `tsconfig.json` (new), `eslint.config.js`, and `openspec/changes/typescript-tooling-foundation/**`
      changed; nothing under `src/` or `supabase/` was modified.
