# Design: Convert Core UI Components to TS (batch)

## 1. Why none of these 6 files previously had `react/prop-types` errors

Checked via `bun run lint` before converting anything: **zero** `react/prop-types`
errors existed for any of `Button.jsx`, `ButtonIcon.jsx`, `Spinner.jsx`,
`SpinnerMini.jsx`, `SpinnerFullPage.jsx`, `Heading.jsx`. Reason: `react/prop-types`
inspects React function components that destructure a `props` parameter.
`ButtonIcon`/`Spinner`/`SpinnerMini` are bare `styled.xxx` calls with no wrapper
function at all — there's no component-with-props for the rule to see.
`SpinnerFullPage` is a function component but takes zero props. `Button`/`Heading` do
have "props" (`size`/`variation`, `as`), but they're read only inside
`styled-components`' own tagged-template interpolation callbacks
(`(props) => sizes[props.size]`), never destructured as a React component's function
parameter — invisible to `react/prop-types` either way. This is why this batch's
expected lint delta (Section 4) is different from every prior batch: there's nothing
here for that rule to have ever flagged.

## 2. Per-file typing

### `Button.tsx` — the main motivation for this batch

- Confirmed via grep across all of `src/`: every real call site passes `variation`
  only as `"secondary"` or `"danger"` (or omits it, relying on the
  `defaultProps: { variation: "primary" }`), and `size` only as `"small"` or `"large"`
  (or omits it, relying on `defaultProps: { size: "medium" }`). No dynamic/computed
  value, no value outside `sizes`/`variations`' own keys anywhere. So
  `type ButtonSize = "small" | "medium" | "large"` and
  `type ButtonVariation = "primary" | "secondary" | "danger"` are not widened beyond
  what's actually used, per this batch's constraint.
- `const Button = styled.button.withConfig({...})<ButtonOwnProps>\`...\`` — same
  `shouldForwardProp`, same CSS, same `defaultProps` assignment as the original
  `.jsx`. The only source change inside the template itself is a TypeScript-only
  non-null assertion when indexing the CSS lookup objects:
  `sizes[props.size!]` / `variations[props.variation!]` (runtime-equivalent to the
  original `sizes[props.size]` / `variations[props.variation]`). This is required
  because `size`/`variation` are typed optional (callers may omit them, relying on
  `defaultProps`), while `strict` mode will not allow a `Record<ButtonSize, …>` to be
  indexed with `ButtonSize | undefined`.
- Exported the same way (`export default Button`), same public API.

### `ButtonIcon.tsx`, `Spinner.tsx`, `SpinnerMini.tsx`, `SpinnerFullPage.tsx`

- No custom prop interface added to any of these four. `ButtonIcon`/`Spinner`/
  `SpinnerMini` are bare `styled.xxx`/`styled(IconComponent)` calls — `children`,
  `onClick`, `disabled`, etc. already come from `styled-components`' own built-in
  typing for native elements (confirmed: `bun run typecheck` passes with no
  annotation needed, and `ButtonIcon`'s sole real caller, `Logout.jsx`, passes
  `disabled`, `onClick`, and a `children` icon element — all already covered).
  `SpinnerFullPage` is a function component with zero props, so there's nothing to
  type. This satisfies "type children as ReactNode unless the implementation
  requires a stricter type" — the implementation requires nothing stricter, so
  nothing was added.

### `Heading.tsx`

- Every real call site (`grep`'d across `src/`) passes `as="h1"`, `"h2"`, `"h3"`, or
  `"h4"` — matching exactly the four CSS branches already in the component. Declared
  `type HeadingLevel = "h1" | "h2" | "h3" | "h4"` and
  `interface HeadingOwnProps { as?: HeadingLevel }`, applied as
  `styled.h1<HeadingOwnProps>`.
- Risk investigated before writing this doc: `as` is also `styled-components`' own
  reserved, built-in polymorphic prop (it actually changes the *rendered* HTML tag,
  not just the CSS branch — this component reuses that built-in mechanic, since
  `as="h3"` genuinely renders an `<h3>`, and the same value also picks the matching
  CSS branch). Declaring a custom generic `as` prop risked a type collision with
  `styled-components`' own built-in `as` typing. Tested directly: `bun run typecheck`
  passes with no conflict — `styled-components`' generic merges the two cleanly.

## 3. Unplanned, but necessary: fixing broken explicit-extension imports

`bun run build` failed immediately after the rename:
`Could not resolve "../ui/Spinner.jsx" from "src/pdf/WorkerSheetSemester.jsx"`.
Unlike every prior batch, these two components (`Button`, `Spinner`) are imported
with an **explicit `.jsx` extension** at 4 call sites — a pattern that happens not to
exist anywhere in the previous two batches' call sites, which is why this didn't come
up before:

- `src/pdf/Schedules/ScheduleGroupPDF.jsx` — `Button.jsx`, `Spinner.jsx`
- `src/pdf/Schedules/ScheduleTeacherPDF.jsx` — `Button.jsx`, `Spinner.jsx`
- `src/pdf/Schedules/TeacherAssignmentPDF.jsx` — `Button.jsx`, `Spinner.jsx`
- `src/pdf/WorkerSheetSemester.jsx` — `Spinner.jsx` (its `Button` import already had
  no extension, so it needed no change)

Fixed by changing exactly the extension in each import string (`.jsx` → `.tsx`) —
`grep`'d for every remaining `ui/*.jsx` reference to these 6 files afterward and
confirmed none remain. No other line in any of these 4 files was touched; none of
them are in this batch's target-file list and none were otherwise modified. (One
unrelated hit from the same grep, a comment in `WorkerDocumentsView.jsx` mentioning
"`Button.jsx`" in prose, was left alone — it's a code comment, not an import.)

## 4. Removing the `Pagination.tsx`/`ConfirmDelete.tsx` local `Button` casts

`Button.tsx` now natively types `size`/`variation`, so the local
`UntypedButton as ComponentType<ButtonProps>` cast from
`convert-simple-ui-components-to-ts` is redundant. Removed from both files — reverted
each back to a plain `import Button from "./Button"`, with no other change to either
file's props, JSX, or behavior. `bun run typecheck` still passes with the casts gone,
confirming `Button.tsx`'s own typing is sufficient on its own.

## 5. Verification plan — results

Baseline going in: **290 problems (286 errors, 4 warnings)**, confirmed via
`bun run lint` to include **zero** entries for any of the 6 target files before
converting (Section 1).

- [x] `bun run typecheck` — passes, no errors, both before and after removing the
      `Pagination`/`ConfirmDelete` casts.
- [ ] `bun run build` — another agent reported that this failed once on the 4
      explicit-`.jsx` extension imports (Section 3), was fixed, then passed. Reviewer
      rerun with `timeout 180s bun run build` timed out after printing only
      `$ vite build` and no Vite diagnostics, matching the environment caveat seen in
      prior TS migration reviews. Rerun locally before commit.
- [x] `bun run lint` — total: **290 problems (286 errors, 4 warnings)** — unchanged
      from baseline, as predicted in Section 1 (none of the 6 files ever contributed
      any `react/prop-types` errors, so there was nothing to remove).
- [x] `git status`/`git diff --stat` — changed-file set: the 6 `.jsx` → `.tsx`
      renames, `Pagination.tsx`/`ConfirmDelete.tsx` (cast removal only), the 4
      `src/pdf/**` files (import-extension fix only), and
      `openspec/changes/convert-core-ui-components-to-ts/**`. No other file.
