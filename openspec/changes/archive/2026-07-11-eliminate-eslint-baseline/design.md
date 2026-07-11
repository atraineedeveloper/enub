## Context

`bun run lint` (`eslint .`, config in `eslint.config.js`) currently reports
43 problems (39 errors, 4 warnings) across 18 files. `eslint.config.js`
itself is not changed by this proposal — every finding is fixed by editing
the flagged file, never by relaxing the rule that flagged it. The four rule
families involved:

- `@typescript-eslint/no-unused-vars` (`'no-unused-vars': 'off'` +
  `'@typescript-eslint/no-unused-vars': 'error'` for `.ts`/`.tsx`, per
  `eslint.config.js`'s TypeScript block) — 33 findings.
- `react/no-unescaped-entities` — 8 findings (across 4 files, 2 each).
- `react-hooks/exhaustive-deps` (from `reactHooks.configs.recommended.rules`)
  — 2 findings (warnings).
- `react-refresh/only-export-components` (`'warn'`,
  `{ allowConstantExport: true }`) — 2 findings (warnings).

Every file was read in full before deciding its fix (not just the flagged
line), specifically to catch two non-obvious cases this document calls out
below: a cascading unused-variable dependency
(`CreateEditScholarSchedule.tsx`) and a cross-component dead-state proof
(`HourScheduleSubject.tsx`/`HourScheduleSubjectGroup.tsx`/
`HourScheduleTeacher.tsx`, verified against `Modal.tsx`/`ConfirmDelete.tsx`).

## Goals / Non-Goals

**Goals:**
- `bun run lint` exits 0 with 0 errors and 0 warnings.
- Every fix is either a mechanical dead-code removal, a JSX entity
  substitution with identical rendered output, a component/non-component
  file split, or a `useCallback`-based hook-dependency correction that
  preserves exactly when each effect fires.
- `bun run typecheck` and `bun run build` stay clean throughout.

**Non-Goals:**
- No change to `eslint.config.js` (no rule disabled, downgraded, or
  reconfigured).
- No blanket (`/* eslint-disable */`) or per-line (`// eslint-disable-next-line`)
  disable comment anywhere.
- No renaming an unused binding to `_x` to silence the rule — this
  codebase's `@typescript-eslint/no-unused-vars` config has no
  `argsIgnorePattern`/`varsIgnorePattern` set, so an underscore prefix
  would not even silence the rule; the only correct fix is removal.
- No behavior change to schedules, conflict detection, PDF contents,
  routing, authentication, or database access — every fix below is
  classified specifically to demonstrate this.
- No unrelated refactor (no consolidating duplicate `groupData` helpers, no
  fixing the pre-existing `isCreating`-only-disables-nothing-during-creation
  gap this audit surfaced, no touching the current git branch or archiving
  any other in-flight OpenSpec change).

## Classification

Every finding falls into exactly one of four categories. Categories 1–2 are
low-risk mechanical work; category 3 is a structural file split verified by
import-graph tracing; category 4 is the only category requiring behavioral
reasoning about *when* code runs, not just *whether* a binding is read.

### Category 1 — Mechanical removal (dead imports/variables/parameters)

| File | Finding(s) | Fix |
|---|---|---|
| `src/features/authentication/useLogin.ts` | `err` unused in `onError: (err: Error) => {...}` | Drop the parameter: `onError: () => {...}`. TanStack Query calls `onError` with up to 3 args; a zero-param function is structurally compatible. |
| `src/features/otherData/CreateEditOtherForm.tsx` | inner `onSuccess: (data: unknown) => {...}`'s `data` unused | Drop the parameter. (Distinct from the outer, used `onSubmit(data: Record<string, unknown>)` — not touched.) |
| `src/features/stateRoles/CreateEditStateRoleForm.tsx` | same pattern, inner `onSuccess: (data: unknown) => {...}` | Same fix. |
| `src/features/schedules/CreateEditTeacherSchedule.tsx` | `Input` import unused (only `Textarea` is rendered); `semesters`/`workerData` destructured from `scheduleToEdit` and never read | Drop the `Input` import. Drop `semesters,`/`workers: workerData,` from the destructuring, keeping `const { id: editId, ...editValues } = scheduleToEdit \|\| {};`. Confirmed inert: `editValues` only feeds `useForm`'s `defaultValues` for *registered* fields — react-hook-form ignores unregistered keys in `defaultValues`, so whether `semesters`/`workers` are excluded from `editValues` or left inside it, submitted `data` (from `handleSubmit`) is identical either way. |
| `src/features/schedules/HourScheduleSubject.tsx` | `editModal`/`deleteModal` unused | See Category 4 below — decided jointly with the other two modal-row files. |
| `src/features/schedules/HourScheduleSubjectGroup.tsx` | `Row` import unused; `editModal`/`deleteModal` unused | Drop the `Row` import (never rendered). `editModal`/`deleteModal`: see Category 4. |
| `src/features/schedules/HourScheduleTeacher.tsx` | `editModal` unused | See Category 4. |
| `src/helpers/calculateSemesterGroup.ts` | `currentYear`/`currentMonth`/`currentDay` computed, never read anywhere in the function | Delete all 3 lines (and their now-orphaned inline comments). Confirmed via full-function read: `now`, `startDate`, `diffTime`, `grade`, `checkDate` are the only values the rest of the function actually uses. |
| `src/pdf/Schedules/ScheduleGroupPDF.tsx` | `data` unused in `willDrawPage: function (data) {...}` | Drop the parameter. The sibling `didDrawPage: function (data) {...}` callback *does* use `data.settings.margin.left` — not touched. |
| `src/pdf/Schedules/ScheduleTeacherPDF.tsx` | same `willDrawPage` `data` pattern | Same fix. |
| `src/pdf/Schedules/TeacherAssignmentPDF.tsx` | `Spinner` import unused (never rendered — this file has no loading gate, unlike its siblings `ScheduleGroupPDF.tsx`/`ScheduleTeacherPDF.tsx`, which do use their `isLoadingRoles`/`isLoadingStateRoles`); `isLoadingRoles`/`isLoadingStateRoles`/`stateRoles` unused; `data` unused in its own `willDrawPage` callback | Drop `Spinner`. Drop `isLoading: isLoadingRoles` from the `useRoles()` destructure, keeping `roles` (still used via `roles?.[0]?.workers?.name`/`roles?.[0]?.role`). For `useStateRoles()`: **neither** returned value (`isLoadingStateRoles`, `stateRoles`) is read anywhere in this file — see the dedicated note below on why the call itself is kept. Drop `data` from `willDrawPage`, matching the other two PDF files. |
| `src/ui/MainNav.tsx` | `isActive` unused in `style={({ isActive }) => ({ textDecoration: "none" })}` | Drop the destructured parameter: `style={() => ({ textDecoration: "none" })}`. The *other*, separate render-prop usage a line below (`{({ isActive }) => (...)}`, the `children` function) *does* use `isActive` for `color`/`borderLeft` — not touched; these are two independent functions passed to two different `NavLink` render-prop slots. |

**Cascading case, `CreateEditScholarSchedule.tsx` (`isWorking`/`isCreating`):**
`isWorking` (`const isWorking = isCreating || isEditing;`) is never read
after being assigned — confirmed via full-file read, every `disabled={...}`
in this form uses `isEditing` directly, never `isWorking` or `isCreating`.
Deleting only the `isWorking` line, however, would leave `isCreating`
itself newly-unused (its *only* other reference was the `isWorking`
computation) — a lint error the original 39-error baseline does not show
today, precisely because `isCreating` currently *is* "used" (read on the
right-hand side of the dead `isWorking` assignment). The correct fix
removes both together: delete the `isWorking` line, and drop `isCreating`
from `const { isCreating, createScheduleAssignments } = useCreateScheduleAssignments();`
(keeping `createScheduleAssignments`, which is called in `onSubmit`). This
is flagged explicitly because it is the one case in this change where
fixing the *reported* finding, in isolation, would introduce a *new* one —
exactly the kind of gap `tasks.md`'s "re-run lint after each file" step
exists to catch.

**Why `useStateRoles()` stays a bare call in `TeacherAssignmentPDF.tsx`,
not a full removal:** unlike every other finding in this table, removing
the *entire* `const { isLoading: isLoadingStateRoles, stateRoles } = useStateRoles();`
line would stop this component from ever issuing that query at all — a
change to what the app *does* (one fewer network request/cache entry on
render), not merely to what it *reads*. Since this change's overriding
goal is zero behavior change, the call is kept
(`useStateRoles();`, no destructuring) so the exact same fetch still
happens; only the two unused *bindings* are removed. This mirrors how
`isLoadingRoles` is dropped from `useRoles()`'s destructure while the
`useRoles()` call itself stays, for the same reason.

**Consequential import cleanups** (not separately reported by ESLint today,
because removing the *flagged* binding first exposes these — verified via
re-running lint after each file, not assumed): removing `editModal`/
`deleteModal` (Category 4) leaves `useState` itself unused in
`HourScheduleTeacher.tsx` (its only use) — drop the whole
`import { useState } from "react";` line. In `HourScheduleSubject.tsx` and
`HourScheduleSubjectGroup.tsx`, `useState` is used *only* for
`editModal`/`deleteModal` too, but each file's import line also carries
`type ComponentType` (`HourScheduleSubjectGroup.tsx` also carries
`useContext`) which stay — so those two lines are edited down to
`import { type ComponentType } from "react";` and
`import { useContext, type ComponentType } from "react";` respectively,
not deleted outright.

### Category 2 — JSX rendering cleanup (unescaped quotation marks)

All 4 findings are the identical pattern: a literal `"` character in JSX
text (outside any `{}` expression), used to visually quote a group letter
(e.g. `"A"`) next to a computed grade. Fixed by replacing each raw `"` with
the `&quot;` HTML entity, which renders as the identical `"` glyph — purely
a source-level escaping change, zero visual/DOM-text difference.

| File | Line(s) | Text before | Text after |
|---|---|---|---|
| `src/features/schedules/CreateEditScholarSchedule.tsx` | ~158 | `"{group.letter}" - {group.degrees!.code}` | `&quot;{group.letter}&quot; - {group.degrees!.code}` |
| `src/features/schedules/ShowScholarSchedule.tsx` | ~62 | `"{group.letter}" - {group.degrees!.code}` | `&quot;{group.letter}&quot; - {group.degrees!.code}` |
| `src/features/schedules/HourScheduleSubjectGroup.tsx` | ~51–52 | `° "` then `{...letter}` then `" - {...}` | `° &quot;` then `{...letter}` then `&quot; - {...}` |
| `src/features/schedules/TeacherAssignment.tsx` | ~210, 216 | `° "` then `{...letter}` then `") &nbsp;...` | `° &quot;` then `{...letter}` then `&quot;) &nbsp;...` |

### Category 3 — Fast Refresh module separation

Both warnings share one root cause: a file exports both a React component
and a non-component value, which defeats Fast Refresh's ability to hot-swap
just the component. `react.configs`'s `allowConstantExport: true` only
exempts simple literal constants — a `Context` object or a custom hook
still trips the rule. The fix in both cases is the same shape: extract the
non-component export(s) into a new file with **zero** component exports (so
the rule has nothing to flag there), leaving the original file exporting
only the component.

**`src/context/DarkModeContext.tsx`** (warns on exporting both
`DarkModeProvider` and `useDarkMode`):
- New file `src/context/useDarkMode.ts` — moves the `DarkModeContext`
  object (`createContext<DarkModeContextValue | undefined>(undefined)`),
  the `DarkModeContextValue` interface, and the `useDarkMode` hook itself.
  Exports only non-components (`DarkModeContext`, `useDarkMode`) — no
  warning possible here, since the rule only fires when a component export
  is *mixed with* a non-component one in the same file.
- `src/context/DarkModeContext.tsx` keeps only `DarkModeProvider`, importing
  `DarkModeContext` from the new file. Its export stays
  `export { DarkModeProvider };` — a named export, unchanged shape, so
  `App.tsx`'s `import { DarkModeProvider } from "./context/DarkModeContext"`
  needs no change.
- `src/ui/DarkModeToggle.tsx` — its only importer of `useDarkMode` — updates
  `import { useDarkMode } from "../context/DarkModeContext"` to
  `import { useDarkMode } from "../context/useDarkMode"`.
- Re-exporting `useDarkMode` from `DarkModeContext.tsx` (to avoid touching
  `DarkModeToggle.tsx`) was considered and rejected: `react-refresh/only-export-components`
  flags a file's export *statements*, not where the underlying value is
  implemented — a re-export would still mix a non-component export into
  the component file and the warning would persist. Updating the one real
  importer is required, not optional.

**`src/pages/ScheduleDashboard.tsx`** (warns on exporting both
`ScheduleDashboard` (default) and `SemesterContext`):
- New file `src/pages/SemesterContext.ts` — moves the `SemesterContext`
  object (`createContext<SemesterContextValue | null>(null)`) and the
  `SemesterContextValue` interface. No hook wrapper exists for this context
  today (every consumer calls `useContext(SemesterContext)` directly), so
  none is introduced — this stays a minimal, same-shape extraction.
- `src/pages/ScheduleDashboard.tsx` imports `SemesterContext` from the new
  file and keeps its existing `export default ScheduleDashboard;` —
  unchanged, so `App.tsx`'s `lazy(() => import("./pages/ScheduleDashboard"))`
  needs no change.
- 7 consumer files update their import path from
  `"../../pages/ScheduleDashboard"` to `"../../pages/SemesterContext"` (same
  relative depth, so the change is a pure string substitution, not a path
  restructure): `CreateEditScholarSchedule.tsx`,
  `HourScheduleSubjectGroup.tsx`, `ShowScholarSchedule.tsx`,
  `TeacherAssignment.tsx`, `ScheduleGroupPDF.tsx`, `ScheduleTeacherPDF.tsx`,
  `TeacherAssignmentPDF.tsx`. Same "re-export doesn't work" reasoning as
  above rules out avoiding this.
- Neither `SemesterContextValue` nor `DarkModeContextValue` is imported as
  a type by any file outside its own definition file (confirmed via
  full-tree grep) — no third file needs a type-import path update.

### Category 4 — Hook dependency correction requiring behavioral care

Both warnings are `react-hooks/exhaustive-deps` flagging a `useEffect` that
calls a same-component function (`selectingGroup`/`selectingWorker`)
without listing it as a dependency. **Naively adding the raw function name
to the dependency array is explicitly rejected in both cases**: neither
function is wrapped in `useCallback` today, so each is a *new function
reference on every render*. Adding an every-render-unstable value to a
`useEffect`'s dependency array makes the effect re-run on every render;
both effects call `setState` (`setFilteredSubjects` /
`setFilteredSchedulesTeacher`+`setFilteredSchedulesAssignments`), and a
`.filter()` call always returns a new array reference — so a state update
happens on every re-run, triggering another render, triggering the effect
again: an infinite render loop. This is exactly the risk the request
called out by name.

**Fix pattern (identical for both):** wrap the handler in `useCallback`
with its actual closure dependencies, then list the memoized callback (not
the raw closure values it replaces) in the `useEffect`'s dependency array,
alongside any value the effect body reads *directly*.

**`src/features/schedules/CreateEditScholarSchedule.tsx`** —
`selectingGroup` reads `groups`, `subjects`, `semesterCode` (all from
`SemesterContext`) and calls `setFilteredSubjects`. Fix:
```ts
const selectingGroup = useCallback(
  (value: string | number | null | undefined) => {
    // unchanged body
  },
  [groups, subjects, semesterCode]
);

useEffect(() => {
  if (isEditSession) {
    selectingGroup(editValues.group_id);
  }
}, [isEditSession, editValues.group_id, selectingGroup]);
```
The `onChange={(e) => selectingGroup(e.target.value)}` call site in the
group `<Select>` is unaffected — same function, just a stable reference
now. Re-render safety: `setFilteredSubjects` (the only state this component
owns that the effect can trigger) does not change `groups`/`subjects`/
`semesterCode` (both come from context, populated by the parent
`ScheduleDashboard`), so a `setFilteredSubjects`-triggered re-render does
not produce a new `selectingGroup` reference and does not re-fire the
effect — no loop.

**`src/features/schedules/ShowTeacherSchedule.tsx`** — `selectingWorker`
reads `scheduleTeachers`, `scheduleAssignments` (props) and calls
`setSelectedWorkerId`, `setFilteredSchedulesTeacher`,
`setFilteredSchedulesAssignments`. Fix:
```ts
const selectingWorker = useCallback(
  (workerId: string | number) => {
    // unchanged body
  },
  [scheduleTeachers, scheduleAssignments]
);

useEffect(() => {
  if (selectedWorkerId) selectingWorker(selectedWorkerId);
}, [selectedWorkerId, selectingWorker]);
```
`scheduleTeachers`/`scheduleAssignments` are dropped from the effect's own
array (no longer read directly there) — they're still covered, via
`selectingWorker`'s own `useCallback` deps, satisfying exhaustive-deps
without duplicating the same reactive values in two places. The
`onChange={(e) => selectingWorker(e.target.value)}` call site is
unaffected. Re-render safety: same shape as above — this component's own
state setters don't feed back into `scheduleTeachers`/`scheduleAssignments`
(both are props from the parent), so no loop.

## Risks / Trade-offs

- **Hook-dependency fixes (Category 4) are the highest-scrutiny part of
  this change** — they alter *when* `selectingGroup`/`selectingWorker`
  run, not just code hygiene. Mitigated by the explicit render-loop
  analysis above and by dedicated manual verification items (see Manual
  Verification Plan) exercising both the group-select and worker-select
  flows, including switching selections repeatedly to watch for runaway
  re-renders.
- **Cross-component dead-state removal (Category 1/4,
  `editModal`/`deleteModal`)** depends on `Modal.Window`'s `cloneElement`
  override behavior continuing to hold. Verified by reading `Modal.tsx`
  (`cloneElement(children, { onCloseModal: close })` always overrides
  whatever `onCloseModal` the parent passed) and `ConfirmDelete.tsx`
  (calls the *received* `onCloseModal`, i.e. always the injected `close`)
  directly, not assumed. Mitigated further by manual verification of every
  affected modal (scholar schedule edit/delete, teacher activity edit).
- **Fast Refresh module splits (Category 3) touch 8 import sites total.**
  A missed or mistyped import path fails `bun run typecheck`/`bun run build`
  immediately and loudly (a missing-module error), not silently — low risk
  of a silent regression, but real risk of blocking the change until every
  path is correct. Both commands are required verification steps before
  this change is considered done.
- **No risk to Supabase/query/mutation behavior**: no file in this change
  touches a `src/services/**` file, a query key, or a mutation call.

## Manual Verification Plan

Required before this change is considered complete (recorded in `tasks.md`):

1. **Login failure behavior** (`useLogin.ts`): submit invalid credentials,
   confirm the "El correo o contraseña son incorrectos" toast still
   appears and the app does not navigate away.
2. **Other-data and state-role forms** (`CreateEditOtherForm.tsx`,
   `CreateEditStateRoleForm.tsx`): edit one row in each; confirm the
   success toast, modal close, and table refresh are unchanged.
3. **Group and teacher schedule selection** (`ShowScholarSchedule.tsx`,
   `ShowTeacherSchedule.tsx`, `TeacherAssignment.tsx`): select a group in
   the scholar-schedule group dropdown and confirm the filtered table
   renders correctly; select a teacher in the teacher-schedule and
   teacher-assignment dropdowns and confirm the same; switch selections
   back and forth several times watching for any freeze/runaway
   re-rendering (the Category 4 risk).
4. **Schedule editing** (`CreateEditScholarSchedule.tsx`): open the edit
   form for an existing scholar schedule assignment, confirm the group/
   subject fields populate correctly (exercises the `selectingGroup`
   `useEffect` fix on mount), change the group, confirm the subject list
   updates (exercises the `onChange`-triggered call site), and save.
5. **Schedule modals** (`HourScheduleSubject.tsx`,
   `HourScheduleSubjectGroup.tsx`, `HourScheduleTeacher.tsx`): open and
   close each component's edit and delete modals (where present); confirm
   every modal still closes correctly after a successful edit/delete and
   after cancel — this is the direct test of the `editModal`/`deleteModal`
   removal's "provably dead" claim.
6. **Teacher assignments** (`TeacherAssignment.tsx`,
   `TeacherAssignmentPDF.tsx`): select a teacher with both scholar
   assignments and activities, confirm hour totals render correctly, and
   generate the PDF — confirm content is unchanged (exercises the
   `isLoadingRoles`/`useStateRoles()` bare-call decision).
7. **Schedule PDF exports** (`ScheduleGroupPDF.tsx`,
   `ScheduleTeacherPDF.tsx`, `TeacherAssignmentPDF.tsx`): generate one PDF
   from each exporter, confirm headers/footers render (exercises the
   `willDrawPage`/`didDrawPage` parameter fix — a missed `data` reference
   inside `willDrawPage` would have already failed typecheck, but the
   rendered header content is still worth a visual spot check).
8. **Dark-mode switching** (`DarkModeContext.tsx`/`useDarkMode.ts`/
   `DarkModeToggle.tsx`): toggle dark mode, confirm the theme applies
   immediately and persists across a reload — exercises the Category 3
   file split end-to-end.
9. **Navigation active states** (`MainNav.tsx`): navigate between at least
   two of the sidebar links and the "Administrar horarios" link, confirm
   the active-state styling (bold color, left border) still highlights the
   current route correctly — exercises the `isActive` parameter removal
   without touching the *other*, still-used `isActive` usage one line
   below.
10. **Route-based semester dashboard behavior** (`ScheduleDashboard.tsx`/
    `SemesterContext.ts`): navigate to `/semesters/:id` for an existing
    semester, confirm the page loads, both tabs (Horario Escolar/Horario
    del Maestro) render, and the group/teacher dropdowns are populated —
    exercises the Category 3 `SemesterContext` file split end-to-end,
    across all 7 updated consumer files at once.
