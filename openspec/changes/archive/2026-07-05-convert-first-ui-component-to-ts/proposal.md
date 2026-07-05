# Proposal: Convert First UI Component to TS

## Status

Draft

## Why

`typescript-tooling-foundation` (already merged) made the toolchain able to build and
lint a `.ts`/`.tsx` file, but no real application component had converted yet — the
only file in scope was a generated, non-component `.ts` file
(`src/types/supabase.ts`). This change is the first real test of the Phase 2 ("leaf
components") plan from `openspec-ts-migration-foundation`'s design.md: convert exactly
one small, self-contained UI component to prove the workflow end-to-end (types, lint,
build) before converting anything with real complexity.

`src/ui/ErrorMessage.jsx` was chosen because it is the simplest possible case: one
component, one optional string prop, no hooks, no children, no event handlers, used
identically (`<ErrorMessage message={...} />`) from every call site.

## What changes

- `src/ui/ErrorMessage.jsx` → `src/ui/ErrorMessage.tsx`, with an explicit
  `ErrorMessageProps` interface (`message?: string`) replacing the untyped default
  parameter as the source of prop shape.

## What does not change

- No other component is converted or modified. All call sites
  (`DegreeTable.jsx`, `GroupTable.jsx`, `OtherTable.jsx`, `RoleTable.jsx`,
  `SemesterTable.jsx`, `StateRoleTable.jsx`, `WorkerTable.jsx`,
  `StudyProgramsTable.jsx`, `SubjectTable.jsx`, `WorkerDocumentsView.jsx`,
  `ScheduleDashboard.jsx`) import `ErrorMessage` without a file extension already, so
  none of them need an import change — Vite/the bundler resolves `.tsx` the same way
  it resolved `.jsx`.
- No rendered output, prop name, default value, or styling changes. The
  `StyledErrorMessage` styled-component and its CSS are byte-identical to the
  original.
- No dependency is added — `styled-components@6` ships its own TypeScript types.
- `eslint.config.js`, `tsconfig.json`, and `package.json` are not touched — verified by
  direct experiment (see `design.md`) that `eslint-plugin-react`'s `react/prop-types`
  rule already recognizes the new TS interface without any config change.
- No other pre-existing lint error is fixed.

## Impact

- **Affected code:** `src/ui/ErrorMessage.jsx` removed, `src/ui/ErrorMessage.tsx`
  added. No other file.
- **Affected lint baseline:** the single `react/prop-types` error previously reported
  for `ErrorMessage.jsx` (line 14) disappears; nothing else changes (see `design.md`
  for the verified before/after count).
