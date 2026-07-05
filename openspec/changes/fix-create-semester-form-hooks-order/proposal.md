# Proposal: Fix CreateSemesterForm Hooks-Order Errors

## Status

Draft

## Why

`CreateSemesterForm.tsx` has carried 3 `react-hooks/rules-of-hooks` errors
(`useQueryClient`, `useForm`, `useMutation`, each "may be executed more than once.
Possibly because it is called in a loop") since before the TS migration even started
— flagged as a real, verified defect in `openspec-ts-migration-foundation`'s original
lint baseline, and deliberately left untouched through every subsequent TS-migration
change as out of scope. This change is the dedicated fix.

**The actual root cause is not a conditional or out-of-order hook call** — reading the
file, all three hooks are called unconditionally, as the first three statements in
the component, in the same order every render; there is no early return before them
and no branch around them. Confirmed by direct experiment (two throwaway probe
files, not part of this diff): the installed `eslint-plugin-react-hooks@5.1.0-rc.0`
(a release-candidate of that plugin's rewritten, flow-based rules-of-hooks analyzer)
produces this exact false-positive for **any** component that calls hooks and *also*
contains a `for` loop anywhere later in the same function body — even when the loop
neither wraps nor precedes the hook calls and never touches a hook. Removing the loop
(replacing it with `Array.from(...)`, which has no `ForStatement` AST node) made the
false positive disappear in the probe; adding the loop back reproduced it.
`CreateSemesterForm.tsx` has two such `for` loops (building the `options`/
`optionsYear` dropdown arrays), which is why it — and only it, of all the
TS-migrated forms — has ever shown this error.

## What changes

- `src/features/semesters/CreateSemesterForm.tsx`: the two `for` loops that build
  the `options` (semester codes) and `optionsYear` (school-year ranges) dropdown
  arrays are rewritten using `Array.from(...)`, producing byte-identical arrays in
  the same order, with no `for`/`while`/`for...of`/`for...in` construct left
  anywhere in the component.

## What does not change

- The three hooks (`useQueryClient`, `useForm`, `useMutation`) are not moved,
  reordered, wrapped, or given a new early-return guard — they were never
  conditional or out-of-order to begin with; nothing about their call site changes.
- No `mutationFn`, `onSuccess`, `onError`, React Query key, or invalidation call
  changes.
- No Supabase query changes (this file doesn't call Supabase directly).
- No validation behavior, submit behavior, loading (`isCreating`) behavior, close-
  modal behavior, or default values change — `options`/`optionsYear` compute the
  exact same string arrays, in the exact same order, from the exact same inputs
  (`currentYear`, `lastYear`), every render, exactly as before.
- No UI copy, styling, or layout changes.
- No dependency added or version changed — `eslint-plugin-react-hooks` stays at its
  current installed version; this is a code-shape fix, not a tooling upgrade.
- No other file converted or modified.

## Impact

- **Affected code:** 1 file, 2 loop constructs rewritten.
- **Affected lint baseline:** the 3 `react-hooks/rules-of-hooks` errors on
  `CreateSemesterForm.tsx` are expected to disappear. No other file's lint count
  should change — in particular, `CreateEditRoleForm.tsx`'s unrelated, pre-existing
  `no-unused-vars`/`@typescript-eslint/no-unused-vars` entry is untouched by this
  change.
