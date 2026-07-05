# Tasks — convert-core-ui-components-to-ts

Status: implemented — typecheck/lint verified; build needs a local rerun because the
reviewer rerun timed out without Vite diagnostics.

## Phase 1: Change artifacts

- [x] Write `proposal.md`.
- [x] Write `design.md`.
- [x] Write `tasks.md` (this file).

## Phase 2: Pre-conversion checks

- [x] Confirmed via `bun run lint` that none of the 6 target files currently produce
      any `react/prop-types` errors (see `design.md` Section 1) — set expectations
      that this batch's lint delta would be 0, not a drop.
- [x] Grepped every real call site's `variation`/`size` values (Button) and `as`
      values (Heading) across `src/` to confirm the literal unions used aren't wider
      or narrower than actual usage.
- [x] Grepped every import of `Pagination.tsx`/`ConfirmDelete.tsx`'s `Button` cast
      pattern to confirm both were the only files using it.

## Phase 3: Conversion

- [x] `src/ui/Button.tsx` — `ButtonOwnProps` (`size?: "small"|"medium"|"large"`,
      `variation?: "primary"|"secondary"|"danger"`) on the existing
      `styled.button.withConfig(...)` call; same `defaultProps`; deleted
      `Button.jsx`.
- [x] `src/ui/ButtonIcon.tsx` — no interface needed (bare `styled.button`); deleted
      `ButtonIcon.jsx`.
- [x] `src/ui/Spinner.tsx` — no interface needed; deleted `Spinner.jsx`.
- [x] `src/ui/SpinnerMini.tsx` — no interface needed; deleted `SpinnerMini.jsx`.
- [x] `src/ui/SpinnerFullPage.tsx` — no interface needed (zero props); deleted
      `SpinnerFullPage.jsx`.
- [x] `src/ui/Heading.tsx` — `HeadingOwnProps` (`as?: "h1"|"h2"|"h3"|"h4"`) on
      `styled.h1`; verified no collision with styled-components' own built-in `as`
      prop; deleted `Heading.jsx`.
- [x] Removed the now-redundant local `Button` cast from `src/ui/Pagination.tsx` and
      `src/ui/ConfirmDelete.tsx`; both back to a plain `import Button from "./Button"`.
      No other change to either file.

## Phase 4: Unplanned but necessary — broken explicit-extension imports

- [x] `bun run build` failed: `Could not resolve "../ui/Spinner.jsx"` from
      `src/pdf/WorkerSheetSemester.jsx`.
- [x] Grepped for every `ui/{Button,ButtonIcon,Spinner,SpinnerMini,SpinnerFullPage,Heading}.jsx`
      reference across `src/`; found 4 files affected (see `design.md` Section 3):
      `src/pdf/Schedules/ScheduleGroupPDF.jsx`, `ScheduleTeacherPDF.jsx`,
      `TeacherAssignmentPDF.jsx`, `src/pdf/WorkerSheetSemester.jsx`.
- [x] Updated exactly the import path string (`.jsx` → `.tsx`) in each; no other line
      in any of these 4 files touched. Re-grepped afterward — zero remaining
      references to any of these 6 files with a `.jsx` extension anywhere in `src/`.

## Phase 5: Verification — results

- [x] `bun run typecheck` — passes, no errors (both before and after removing the
      Pagination/ConfirmDelete casts).
- [ ] `bun run build` — another agent reported this failed once (Phase 4), was fixed,
      then passed. Reviewer rerun with `timeout 180s bun run build` timed out after
      printing only `$ vite build` and no Vite diagnostics. Rerun locally before
      commit; do not fix unrelated build/runtime behavior in this TS conversion batch.
- [x] `bun run lint` — total: **290 problems (286 errors, 4 warnings)** — unchanged
      from baseline, exactly as predicted in Phase 2 (none of the 6 files ever
      contributed any `react/prop-types` errors).
- [x] `git status`/`git diff --stat` — changed-file set is exactly: 6 `src/ui/*.jsx`
      deletions + 6 `src/ui/*.tsx` additions, `Pagination.tsx`/`ConfirmDelete.tsx`
      modified (cast removal only), 4 `src/pdf/**` files modified (import path only),
      and `openspec/changes/convert-core-ui-components-to-ts/**`. No other file, no
      `eslint.config.js`/`tsconfig.json`/`package.json` change.

## Not in scope for this change

- [ ] Converting `Table.jsx`, `Modal.jsx`, `Menus.jsx`, `FormRow.jsx`, or any feature
      component.
- [ ] Any other change to `Pagination.tsx`/`ConfirmDelete.tsx` beyond the cast
      removal.
- [ ] Any other change to the 4 `src/pdf/**` files beyond the one import path each.
- [ ] Fixing any other pre-existing lint error.
