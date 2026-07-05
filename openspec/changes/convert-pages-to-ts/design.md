# Design: Convert Pages to TS

## 1. All 17 files are real page components — straightforward `.tsx` renames

Read every file in `src/pages/*` and `src/pages/Records/*` plus `App.tsx`
before converting anything. All 17 render real JSX and are lazy-imported by
`App.tsx` via `lazy(() => import("./pages/..."))` with no explicit extension
— confirming no import-path fix would be needed in `App.tsx` itself regardless
of what got renamed. Fourteen of the seventeen have no props, no local
state beyond a trivial `useState`, and no context — they convert with zero
new type annotations; the type-checker simply starts checking code that was
already correct.

## 2. `Dashboard.tsx` — transient-prop styled-components

`StatIcon`/`ActionCard` read `$theme`/`$accent` props inside their template
literals (`iconThemes[p.$theme]`, `p.$accent === "gold"`). Declared as
`styled.div<{ $theme: string }>`/`styled.div<{ $accent: string }>` —
the same transient-prop pattern used throughout this migration's already-
converted styled-components (e.g. `ScheduleDashboard.tsx`'s own `Tab`,
Section 3 below). `iconThemes`/`tabAccents`-style lookup objects
(`Record<string, {...}>`) typed so the `?.` fallback (`iconThemes[p.$theme]?.bg ?? "..."`)
keeps working exactly as before for any theme key not in the map.

## 3. `ScheduleDashboard.tsx` — the one page with real typing work

### `SemesterContext`

`export const SemesterContext = createContext(null)` infers `Context<null>` —
the file's own `<SemesterContext.Provider value={{ groups: ..., workers: ...,
subjects: ..., scheduleAssignments: ... }}>` would fail to compile against
that (an object literal isn't assignable to `null`). Typed explicitly:

```ts
interface SemesterContextValue {
  groups: Group[];
  workers: Worker[];
  subjects: Subject[];
  scheduleAssignments: unknown[];
}

export const SemesterContext = createContext<SemesterContextValue | null>(null);
```

`groups`/`workers` are `Group[]`/`Worker[]` (not `| undefined`) because the
values actually placed into the provider (`currentGroups`, `sortedCurrentWorkers`)
are always-defined results of `.filter()` calls, past the component's early
`isLoading`/error returns. `scheduleAssignments` is typed `unknown[]` rather
than a precise shape: its value comes from `useScheduleAssignments()`
(`src/features/schedules/`, explicitly out of scope), an untyped hook whose
inferred return is effectively `any`-shaped — modeling it more precisely would
mean reasoning about `src/features/schedules` internals this change isn't
meant to touch. The one real consumer of this context,
`CreateEditScholarSchedule.jsx` (also in `src/features/schedules`, untyped),
is unaffected either way (`checkJs: false`).

### Non-null assertions at existing dereference sites

`useWorkers`, `useSubjects`, `useGroups`, `useSemesters` (all already `.ts`)
and the out-of-scope `useScheduleAssignments`/`useScheduleTeachers` all return
`T[] | undefined` (or an effectively-`any` equivalent) until their query
resolves. The component's own early-return guard only checks each hook's
`isLoading`/`error` flag, never the data variable itself, so TS can't narrow
`groups`/`workers`/`semesters`/`scheduleAssignments`/`scheduleTeachers` to
defined afterward — the same shape of gap as `roles` in the (deferred)
`src/pdf` PDF exporters. Added `!` at each existing dereference
(`groups!.filter(...)`, `workers!.filter(...)`, `scheduleAssignments!.filter(...)`,
`scheduleTeachers!.filter(...)`, `semesters!.find(...)`, `subjects!` when
building the context value) rather than introducing a new guard — matching
the standing rule and every prior phase's identical treatment of this exact
`useQuery`-return-is-possibly-undefined gap.

`+id!` (the `useParams()` string, unary-converted for the `semester_id`
comparisons): `useParams()` types every param as `string | undefined`; the
existing code already assumed it via bare `+id`. Asserted at the two
call sites (`+id!`) rather than adding a new "missing id" guard the original
never had.

## 4. Unplanned discovery: `WorkerSheetSemester`'s untyped defaults break its now-checked caller

Covered in `proposal.md`'s "Unplanned discovery" section. The fix, in full:

```ts
import UntypedWorkerSheetSemester from "../pdf/WorkerSheetSemester";
import type { ComponentType } from "react";

const WorkerSheetSemester = UntypedWorkerSheetSemester as ComponentType<{
  workers: Worker[];
  semester: Semester[];
  scheduleAssignments?: unknown[];
  scheduleTeachers?: unknown[];
}>;
```

`scheduleAssignments`/`scheduleTeachers` are typed `unknown[]` (optional,
matching the real component's own `= []` defaults) rather than the more
precise `ScheduleAssignmentForPdf[]`/`ScheduleTeacherForPdf[]` shapes a full
PDF-exporter conversion would use — inventing that precision here, for a file
this change isn't converting, would be modeling `src/pdf` internals out of
turn. `workers`/`semester` are typed against the real, already-`.ts`
`Worker`/`Semester` types since those are genuinely accurate (the runtime
values really are `Worker[]`/`Semester[]`).

## 5. Unplanned discovery: `FormRowVertical.tsx`'s single-child constraint

Covered in `proposal.md`. Fix mirrors `FormRow.tsx` (`fix-ts-migration-blockers`)
exactly:

```ts
// before
interface FormRowVerticalProps {
  children: ReactElement<{ id?: string }>;
}
// {label && <Label htmlFor={children.props.id}>{label}</Label>}

// after
interface FormRowVerticalProps {
  children: ReactNode;
}
const htmlFor = isValidElement<{ id?: string }>(children)
  ? children.props.id
  : undefined;
// {label && <Label htmlFor={htmlFor}>{label}</Label>}
```

Zero behavior change: at runtime, the multi-child case was already reaching
this component before (`.jsx`, unchecked) and never crashed, because
`SetPassword`'s final `<FormRowVertical>` doesn't pass a `label` — the only
line that would have read `children.props.id` is short-circuited by
`label &&` before it ever evaluates. The type now accurately describes what
was always true, rather than something new being permitted.

## 6. Pre-conversion lint baseline (confirmed via `bun run lint`, per file)

All 17 target files: **0** `react/prop-types`, `no-undef`, or any other
errors — every page is either prop-less or (in `ScheduleDashboard.jsx`'s case)
only carries the pre-existing `react-refresh/only-export-components` warning
for co-exporting `SemesterContext` alongside the default component (unrelated
to typing, persists identically post-conversion). Since no page had a
props-validation error to begin with, no page-specific lint improvement was
expected or found — confirmed by grepping the post-conversion lint output for
each of the 17 new filenames.

## 7. Verification plan — results

Baseline going in: **206 problems**.

- [x] `bun run typecheck` — failed twice against real, distinct issues
      (Sections 4 and 5 above), each fixed with a local cast / a same-pattern
      fix to an already-`.tsx` sibling component. Final run: clean, no errors.
- [x] `bun run build` — clean pass, `✓ built in 4.79s`, no diagnostics.
- [x] `bun run lint` — total: **205 problems (201 errors, 4 warnings)**.
      Confirmed via per-file grep that none of the 17 converted pages, nor
      `FormRowVertical.tsx`, appear with any error in the output (only
      `ScheduleDashboard.tsx`'s pre-existing warning, same as before, now
      under the new filename/line number). The 1-point drop from 206 isn't
      attributable to any specific page (none had a prior error) — noted
      here rather than overclaimed.
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 17
      renamed pages, `FormRowVertical.tsx`, and this change's own
      `proposal.md`/`design.md`/`tasks.md`. No other file — `App.tsx`,
      `src/pdf/**`, `src/features/schedules/**`, `eslint.config.js`,
      `tsconfig.json`, `package.json` all untouched.
