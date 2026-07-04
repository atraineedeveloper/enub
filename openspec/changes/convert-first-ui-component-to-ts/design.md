# Design: Convert First UI Component to TS

## 1. Why `ErrorMessage`

Chosen against `openspec-ts-migration-foundation`'s Phase 2 criteria ("presentational/
leaf components, small prop surfaces"): one prop (`message`, optional string with a
default), no hooks, no children/render-props, no internal state, no event handlers.
Lowest possible blast radius for the first real conversion.

## 2. The conversion

Before (`src/ui/ErrorMessage.jsx`):

```jsx
function ErrorMessage({ message = "Ocurrió un error al cargar los datos." }) {
  return <StyledErrorMessage>{message}</StyledErrorMessage>;
}
```

After (`src/ui/ErrorMessage.tsx`):

```tsx
interface ErrorMessageProps {
  message?: string;
}

function ErrorMessage({
  message = "Ocurrió un error al cargar los datos.",
}: ErrorMessageProps) {
  return <StyledErrorMessage>{message}</StyledErrorMessage>;
}
```

- `message?: string` matches the existing implicit contract exactly: optional (every
  call site either passes a string or omits it), same default value, same rendered
  output.
- The `styled.p` definition and its template-literal CSS are untouched, character for
  character.
- No import changes anywhere: every one of the 9+ call sites imports via
  `from "../../ui/ErrorMessage"` (no extension), which Vite/esbuild resolves to
  whichever extension is actually present — `.tsx` today, `.jsx` before. Verified by
  grepping every `ErrorMessage` import in `src/` before making the change.

## 3. Whether `eslint.config.js` needs to change — verified, not assumed

`openspec-ts-migration-foundation`'s design.md and `typescript-tooling-foundation`'s
design.md both anticipated that `react/prop-types` would eventually need to be
disabled for `.ts`/`.tsx` files, "only once those files carry real TS prop types."
`ErrorMessage.tsx` is the first file to reach that condition, so before writing this
design doc, two throwaway probe files were lint-tested directly (not part of this
change's diff, deleted immediately after):

1. A `.tsx` file with the exact same shape as `ErrorMessage.tsx` (destructured prop
   with a default, typed via an `interface` and an inline parameter annotation) —
   **zero** `react/prop-types` errors.
2. The same file with the type annotation removed (plain JS-style destructuring,
   otherwise identical) — `react/prop-types` **did** fire ("'message' is missing in
   props validation"), confirming the rule is genuinely active in the `.ts`/`.tsx`
   ESLint block and that probe 1's clean result isn't a fluke (e.g. the glob silently
   not matching).

Conclusion: `eslint-plugin-react@7.35.0`'s `prop-types` rule already resolves
locally-declared TypeScript `interface`/type-annotated destructured parameters without
any config change — it doesn't need `react/prop-types` turned off to recognize a real
TS type. **`eslint.config.js` is not modified by this change.** The "disable
`react/prop-types` per-file once it has real types" plan from the earlier design docs
turns out to be unnecessary in practice, at least for this rule/version combination:
the rule already behaves correctly once real types are present, rather than needing to
be turned off. This is recorded here so it isn't rediscovered by trial and error on the
next conversion.

## 4. Verification plan

- [ ] `bun run typecheck` — passes, no errors for `ErrorMessage.tsx`.
- [ ] `bun run build` — passes; `dist/` output for pages importing `ErrorMessage`
      unaffected.
- [ ] `bun run lint` — total drops from 304 to exactly **303** (300 → 299 errors, 4
      warnings unchanged): the one `react/prop-types` error previously reported at
      `src/ui/ErrorMessage.jsx:14` disappears, and nothing else changes. If the count
      differs from this exact prediction, investigate before reporting success rather
      than assuming it's fine.
- [ ] `git status`/`git diff --stat` — confirm the changed-file set is exactly
      `src/ui/ErrorMessage.jsx` (deleted), `src/ui/ErrorMessage.tsx` (added), plus
      `openspec/changes/convert-first-ui-component-to-ts/**`. No other `src/` file,
      no `eslint.config.js`, no `tsconfig.json`, no `package.json`.
- [ ] Manual sanity check: every route that renders `ErrorMessage` on an error path
      (Degrees, Groups, Others, Roles, Semesters, State Roles, Workers, Study Programs,
      Subjects, worker documents, Schedule Dashboard) still shows the same message —
      not re-verified live in this change since no logic changed, but the call-site
      list above is the reference for what to check if a regression is ever reported.
