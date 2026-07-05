# Proposal: Convert Core UI Components to TS (batch)

## Status

Draft

## Why

`convert-simple-ui-components-to-ts` hit an unplanned wrinkle: `Pagination.tsx` and
`ConfirmDelete.tsx` both pass `size`/`variation` to `Button.jsx`, which is untyped, so
each needed a local, duplicated type-only cast just to typecheck. This change converts
`Button.jsx` itself (plus five other small, foundational `src/ui` components it's
usually paired with) so that cast stops being necessary — and so every future `.tsx`
file can use `Button` directly, with no per-file workaround.

## What changes

- `src/ui/Button.jsx` → `.tsx`: adds `size?: "small" | "medium" | "large"` and
  `variation?: "primary" | "secondary" | "danger"` as a typed generic on the existing
  `styled.button.withConfig(...)` call. Same `sizes`/`variations` CSS lookup objects,
  same `shouldForwardProp`, same `defaultProps`.
- `src/ui/ButtonIcon.jsx` → `.tsx`: no custom prop interface needed — it's a bare
  `styled.button` with no transient props; native `children`/`onClick`/`disabled`
  typing already comes from `styled-components`' own HTML-element typings.
- `src/ui/Spinner.jsx`, `src/ui/SpinnerMini.jsx`, `src/ui/SpinnerFullPage.jsx` → `.tsx`:
  same — no props on any of the three today, so no interface is added.
- `src/ui/Heading.jsx` → `.tsx`: adds `as?: "h1" | "h2" | "h3" | "h4"` as a typed
  generic on `styled.h1`, matching the four CSS branches the component already
  switches on and every literal value actually passed at any call site.
- Remove the now-redundant local `Button` type cast from `src/ui/Pagination.tsx` and
  `src/ui/ConfirmDelete.tsx`, since `Button.tsx` now supplies that same shape natively.

## What does not change

- No other component is converted or modified. `Table.jsx`, `Modal.jsx`, `Menus.jsx`,
  `FormRow.jsx`, and every feature component are explicitly out of scope.
- No rendered output, CSS, prop name, or default value changes for any of the 6 files.
  `Button`'s `defaultProps` (`variation: "primary"`, `size: "medium"`) are unchanged.
- No dependency added.
- `eslint.config.js`, `tsconfig.json`, and `package.json` are not touched.
- Beyond removing the local cast, `Pagination.tsx` and `ConfirmDelete.tsx` are not
  otherwise altered — same props, same JSX, same behavior.

## Necessary import fix (found via `bun run build`, not part of the original plan)

Four files import `Button` or `Spinner` with an **explicit `.jsx` extension**
(`src/pdf/Schedules/ScheduleGroupPDF.jsx`, `ScheduleTeacherPDF.jsx`,
`TeacherAssignmentPDF.jsx`, `src/pdf/WorkerSheetSemester.jsx`) — the only call sites
across all three TS-migration batches so far that don't import extension-less. Each
needed its import path updated from `.jsx` to `.tsx`; nothing else in any of these 4
files changed. See `design.md` Section 3.

## Impact

- **Affected code:** 6 files renamed `src/ui/*.jsx` → `src/ui/*.tsx`; 2 files
  (`Pagination.tsx`, `ConfirmDelete.tsx`) lose their now-unnecessary local `Button`
  cast; 4 files under `src/pdf/` have one import path each updated
  (`.jsx` → `.tsx`, string only). No other file.
- **Affected lint baseline:** none of these 6 files currently produce any
  `react/prop-types` errors — see `design.md` Section 1 for why — so, unlike prior
  batches, this change is not expected to move the lint total. The real payoff is
  type coverage and removing the Pagination/ConfirmDelete workaround, not a lint-count
  drop.
