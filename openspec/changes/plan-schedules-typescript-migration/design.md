# Design: Plan Schedules TypeScript Migration

This is a planning document. No file under `src/` is changed by this change.
Every finding below was gathered by reading all 23 files in
`src/features/schedules/`, their consumers, their services, and the current
`bun run lint` output on 2026-07-05, against a baseline of **205 lint
problems** (post-`convert-pages-to-ts`).

## Context

`src/features/schedules/` is the last major untyped feature domain. It backs
two route-level pages already migrated to TypeScript
(`src/pages/ScheduleDashboard.tsx`, which owns a typed `SemesterContext`
consumed by `CreateEditScholarSchedule.jsx`) and renders four PDF exporters
that remain untyped and out of scope
(`src/pdf/Schedules/ScheduleGroupPDF.jsx`, `ScheduleTeacherPDF.jsx`,
`TeacherAssignmentPDF.jsx`, `src/pdf/WorkerSheetSemester.jsx`). Every other
feature domain converted so far (`workers`, `workers/documents`, admin
catalog features, core UI, pages) followed the same pattern: read everything
first, write a design doc, then convert in small phases. Schedules is larger
and messier than any of those — it contains three genuinely dead/orphaned
files and at least two live, pre-existing bugs — so it gets its own planning
pass before any conversion begins.

## Goals

- Produce an accurate, complete map of what would need to change to convert
  `src/features/schedules/**` to TypeScript, file by file.
- Separate "will need a type annotation" (expected, mechanical) from "is
  already broken today" (a real bug, independent of TypeScript) so a future
  implementer doesn't accidentally fix — or accidentally preserve — the wrong
  thing without an explicit decision.
- Recommend a phase breakdown and branch strategy for the actual migration.

## Non-Goals

- Converting any file. This change writes OpenSpec artifacts only.
- Fixing any lint error, rule-of-hooks violation, or `isLoading`/`isPending`
  bug found during research.
- Deciding, unilaterally, to delete the three dead files identified below —
  that's flagged as an open question for the approver, not decided here.
- Migrating `src/pdf/**` (explicitly out of scope, per instruction — PDF
  exporters have their own, separate, not-yet-started migration).
- Migrating `src/helpers/**` (`calculateSemesterGroup.js`,
  `capitalizeFirstLetter.js`, `detectScheduleConflict.js`, `constants.js`,
  `sortWorkersBySurname.js`) — shared across multiple feature domains, not
  schedules-specific; local casts are the expected resolution for any typing
  friction they cause.
- Migrating `src/services/apiScheduleAssignments.js`/`apiScheduleTeachers.js`
  — service-layer files stay untyped per this repo's established convention
  unless a type-only fix is impossible without touching them.

## Exact Target Files (23, all in `src/features/schedules/`)

| File | Role | Live or dead? |
|---|---|---|
| `ScholarSchedule.jsx` | Tab container: create-form modal trigger + `ShowScholarSchedule` | Live |
| `ShowScholarSchedule.jsx` | Group selector + filtered table + `ScheduleGroupPDF` (out of scope) | Live |
| `RowScholarSchedule.jsx` | Fixed weekly grid, renders `HourScheduleSubject` per cell | Live |
| `HourScheduleSubject.jsx` | One cell: subject/teacher text + edit/delete modals | Live |
| `HourScheduleSubjectGroup.jsx` | Alternate per-cell renderer (multi-schedule variant) used by `RowTeacherSchedule`'s `DayCell` | Live |
| `CreateEditScholarSchedule.jsx` | Real create/edit form; reads data via `SemesterContext`, not props | Live |
| `CreateScholarSchedule.jsx` | Older create-only form (props-driven) | **Dead** — imported nowhere |
| `EditScholarSchedule.jsx` | Exports a component literally named `CreateScholarSchedule`; fetches its own data, never actually edits | **Dead** — imported once, into an unused local binding |
| `TeacherSchedule.jsx` | Tab container: create-activity modal trigger + sub-tabs (`ShowTeacherSchedule`/`TeacherAssignment`) | Live |
| `ShowTeacherSchedule.jsx` | Worker selector + filtered schedule/activity tables + `ScheduleTeacherPDF` (out of scope) | Live |
| `RowTeacherSchedule.jsx` | Fixed weekly grid (`TimeSlotRow`/`DayCell`/`BreakRow`), renders `HourScheduleSubjectGroup` + `HourScheduleTeacher` per cell | Live |
| `HourScheduleTeacher.jsx` | One cell: teacher activity text + edit/delete modals (exports `HourScheduleSubjectTeacher`) | Live — **contains a real bug**, see below |
| `CreateEditTeacherSchedule.jsx` | Real create/edit form for teacher activities | Live |
| `TeacherAssignment.jsx` | "Asignación horaria" sub-tab: hours summary table + `TeacherAssignmentPDF` (out of scope) | Live |
| `RowTeacherAssignment.jsx` | Placeholder stub (`<div>RowTeacherAssignment</div>`) | **Dead** — imported nowhere |
| `useScheduleAssignments.js` | Query hook: list all scholar schedule assignments | Live |
| `useScheduleTeachers.js` | Query hook: list all teacher activities | Live |
| `useCreateScheduleAssignments.js` | Mutation hook: create | Live — **`isLoading` bug**, see below |
| `useEditScheduleAssignments.js` | Mutation hook: edit | Live — **`isLoading` bug** |
| `useDeleteScheduleAssignment.js` | Mutation hook: delete | Live — **`isLoading` bug** |
| `useCreateScheduleTeacher.js` | Mutation hook: create activity | Live — **`isLoading` bug** |
| `useEditScheduleTeacher.js` | Mutation hook: edit activity | Live — **`isLoading` bug** |
| `useDeleteScheduleTeacher.js` | Mutation hook: delete activity | Live — **`isLoading` bug** |

## Files Explicitly Out of Scope

- `src/pdf/Schedules/ScheduleGroupPDF.jsx`, `ScheduleTeacherPDF.jsx`,
  `TeacherAssignmentPDF.jsx`, `src/pdf/WorkerSheetSemester.jsx` — PDF
  exporters, separate migration, per explicit instruction.
- `src/helpers/calculateSemesterGroup.js`, `capitalizeFirstLetter.js`,
  `detectScheduleConflict.js`, `constants.js`, `sortWorkersBySurname.js` —
  shared helpers, not schedules-specific.
- `src/services/apiScheduleAssignments.js`, `apiScheduleTeachers.js` —
  service layer.
- `src/pages/ScheduleDashboard.tsx` — already converted
  (`convert-pages-to-ts`); an eventual schedules migration may need to touch
  its `ScholarSchedule`/`TeacherSchedule` import lines only if those files'
  extensions change, which they won't (extension-less imports already).
- `src/ui/**` — already typed; no blocker comparable to `FormRowVertical.tsx`
  (found and fixed during `convert-pages-to-ts`) was found in this research
  for any component the schedules feature renders (`Modal`, `ConfirmDelete`,
  `Select`, `Form`, `FormRow`, `Button`, `Row`, `Input`, `Textarea` are all
  already `.tsx`).
- `src/features/workers/useWorkers.ts`, `subjects/useSubjects.ts`,
  `groups/useGroups.ts`, `semesters/useSemesters.ts` — already typed,
  reused, not modified.

## Current Behavior Summary

Two parallel schedule types share one dashboard (`ScheduleDashboard.tsx`,
already typed):

1. **Scholar schedules** (`schedule_assignments` table): a group's weekly
   class timetable — subject, teacher, weekday, time range, tied to a
   `group_id`/`subject_id`/`worker_id`/`semester_id`. Created/edited via
   `CreateEditScholarSchedule.jsx`, listed via `ShowScholarSchedule.jsx`
   (filterable by group), rendered as a fixed 5-day × 4-slot grid.
2. **Teacher schedules** (`schedule_teachers` table): a teacher's own
   non-classroom activities (tutoring, committee time, etc.) — weekday, time
   range, free-text `activity`, tied to `worker_id`/`semester_id`.
   Created/edited via `CreateEditTeacherSchedule.jsx`, listed via
   `ShowTeacherSchedule.jsx` (filterable by worker), and combined with that
   worker's scholar schedule in a second sub-tab, `TeacherAssignment.jsx`
   ("Asignación horaria"), which computes total weekly hours and feeds
   `TeacherAssignmentPDF` (out of scope).

Both flows share the same conflict-detection helper
(`detectScheduleConflict.js`, out of scope) and the same fixed set of
weekday/time-slot constants, hardcoded independently in at least four files
rather than imported from the one `constants.js` that exists (`WEEKDAYS`/
`START_TIMES`/`END_TIMES` — only `CreateEditTeacherSchedule.jsx` actually
imports them; `CreateScholarSchedule.jsx`, `EditScholarSchedule.jsx`, and
`CreateEditScholarSchedule.jsx` each hardcode their own `<option>` lists
inline instead).

## Known Lint/Type Issues (schedules-only subset of the 205-problem baseline)

Per-file counts, confirmed via `bun run lint`:

| File | Errors | Notable rule(s) |
|---|---:|---|
| `CreateEditScholarSchedule.jsx` | 12 (+1 warning) | 6 unused imports, 3 missing prop-types, 1 unused var (`isWorking`), 2 unused `data` params, 2 unescaped quotes, 1 exhaustive-deps warning |
| `CreateEditTeacherSchedule.jsx` | 8 | 1 unused import, 6 missing prop-types, 2 unused destructured vars |
| `CreateScholarSchedule.jsx` (dead) | 10 | 1 unused import, 8 missing prop-types, 2 unescaped quotes |
| `EditScholarSchedule.jsx` (dead) | 8 | 1 unused import, 2 missing prop-types, 1 `jsx-no-undef`, **4 rules-of-hooks errors**, 2 unescaped quotes |
| `HourScheduleSubject.jsx` | 6 | 4 missing prop-types, 2 unused state vars |
| `HourScheduleSubjectGroup.jsx` | 8 | 2 unused imports, 4 missing prop-types, 2 unused state vars, 2 unescaped quotes (10 total, recount below) |
| `HourScheduleTeacher.jsx` | 7 | 5 missing prop-types, **1 `no-undef`** |
| `RowScholarSchedule.jsx` | 1 | missing prop-types |
| `RowTeacherAssignment.jsx` (dead) | 0 | — |
| `RowTeacherSchedule.jsx` | 22 | all missing prop-types (heavy prop drilling through `DayCell`/`TimeSlotRow`) |
| `ScholarSchedule.jsx` | 5 | missing prop-types |
| `ShowScholarSchedule.jsx` | 6 | 4 missing prop-types, 2 unescaped quotes |
| `ShowTeacherSchedule.jsx` | 7 (+1 warning) | 6 missing prop-types, 1 exhaustive-deps warning |
| `TeacherAssignment.jsx` | 9 | 7 missing prop-types, 2 unescaped quotes |
| `TeacherSchedule.jsx` | 4 | missing prop-types |
| all 6 mutation hooks (`use{Create,Edit,Delete}Schedule{Assignments,Teacher}.js`) | 0 each | clean lint — the `isLoading`/`isPending` issue is a **type** bug, not a lint rule this project's config catches |

The overwhelming majority of errors (well over 100) are `react/prop-types` —
expected to disappear entirely once real TypeScript prop types exist, exactly
as happened in every prior `convert-*-to-ts` change. `react/no-unescaped-
entities` (quote characters in JSX text, ~10 occurrences across 4 files) and
unused-import/-variable errors are unrelated to typing and will persist under
their `@typescript-eslint/no-unused-vars` name post-conversion unless a task
explicitly authorizes cleaning them up (see the spec's bug-preservation
requirement).

## Real Bugs vs. Migration-Only Issues

This is the most important section for whoever approves implementation.

### Real, pre-existing bugs (independent of TypeScript, found via lint + reading)

1. **All 6 mutation hooks use `isLoading` instead of `isPending`.**
   `useCreateScheduleAssignments`, `useEditScheduleAssignments`,
   `useDeleteScheduleAssignment`, `useCreateScheduleTeacher`,
   `useEditScheduleTeacher`, `useDeleteScheduleTeacher` all destructure
   `isLoading` from `useMutation()`. TanStack Query v5 renamed this to
   `isPending` for mutations — `isLoading` doesn't exist on the mutation
   result at all, so `isCreating`/`isEditing`/`isDeleting` are always
   `undefined` in every one of these hooks. Every `disabled={isCreating}`-
   style prop across the whole schedules feature has never actually disabled
   anything during a mutation. This is the exact same historical bug already
   found and fixed, file by file, throughout the rest of this migration
   (`useCreateWorker.js`, `useEditWorker.js`, worker-documents mutation
   hooks, etc.) — TypeScript will not force a fix here (`isLoading` typed as
   `undefined` is not an error by itself unless something dereferences it
   strictly), so this bug will silently survive a naive migration unless a
   task explicitly calls it out.
2. **`HourScheduleTeacher.jsx`'s `onCloseModal={() => setEditModal(false)}`
   references an undefined `setEditModal`.** This file never declares
   `editModal`/`setEditModal` state at all (unlike its sibling
   `HourScheduleSubject.jsx`, which does declare — but never meaningfully
   uses — the equivalent pair). This is a live `no-undef` error: closing the
   "edit teacher activity" modal after a successful edit throws a
   `ReferenceError` at runtime today. This is a **real, currently-reachable
   bug** (unlike the two "Spinner is not defined" issues below, which live in
   dead code) that a TypeScript conversion will surface as a compile error
   the implementer cannot silently ignore.
3. **`EditScholarSchedule.jsx` calls hooks conditionally, after an early
   `return <Spinner />`,** and `Spinner` is never imported in that file
   (`react/jsx-no-undef`). Combined with point 4 below, this file is
   thoroughly broken — but it is **dead code** (see below), so this bug has
   zero live impact today. A literal, naive TypeScript conversion of this
   file would need real restructuring (moving all hooks above the early
   return) just to type-check, which is disproportionate effort for a file
   nothing renders.
4. **`EditScholarSchedule.jsx` never actually edits anything.** Despite its
   filename, its `isEditSession`/`scheduleToEdit` machinery, and its
   `defaultValues: isEditSession ? editValues : {}` logic, its `onSubmit`
   always calls the plain `createScheduleAssignments` (insert-only) service
   function — never an update. If this file were ever wired up and used to
   "edit" a record, it would silently create a duplicate row instead. Dead
   code today; would be a functional bug if ever un-deadened.

### Dead / orphaned files (confirmed via grep — zero live importers)

- `CreateScholarSchedule.jsx` — not imported anywhere.
- `EditScholarSchedule.jsx` — imported exactly once, by
  `HourScheduleSubjectGroup.jsx`, into a local binding
  (`import CreateScholarSchedule from "./EditScholarSchedule"`) that is
  itself never referenced anywhere in that file's JSX (confirmed by its own
  `'CreateScholarSchedule' is defined but never used` lint error). The
  actual edit UI in `HourScheduleSubjectGroup.jsx` uses the correct,
  live `CreateEditScholarSchedule` component instead.
- `RowTeacherAssignment.jsx` — a placeholder stub, not imported anywhere.

These three files match the `src/features/schedules/*` glob and would
technically be "in scope" by directory, but converting genuinely dead code
that contains real bugs (rules-of-hooks violations, an undefined `Spinner`)
is wasted, risky effort with zero behavior to preserve. **Closed: excluded
from the conversion task list entirely** (see Closed Decisions, Decision 1)
rather than spending a phase making broken, unreachable code type-check.
Deletion, if ever done, is its own separate change — not this migration's.

### Dead state / dead prop-threading (harmless, but worth noting so a converter doesn't "fix" it into something new)

- `HourScheduleSubject.jsx` and `HourScheduleSubjectGroup.jsx` both declare
  `editModal`/`deleteModal` state that is set but never read — the `Modal`/
  `Modal.Open`/`Modal.Window` compound component manages its own open/close
  state internally, so these locals do nothing observable. Preserve as-is
  (adding types to genuinely-unused state is harmless) rather than removing
  it, since removing it is a behavior-neutral cleanup this plan doesn't
  authorize.
- `ScholarSchedule.jsx` passes `workers`/`subjects`/`groups` as props to
  `<CreateEditScholarSchedule>`, but that component's actual signature is
  `{ semesterId, scheduleToEdit, onCloseModal }` — it reads
  `workers`/`subjects`/`groups` from `SemesterContext` instead. These three
  props are silently ignored today (harmless because `checkJs: false` never
  flagged it). **This will very likely surface as a real TypeScript error**
  once `CreateEditScholarSchedule.tsx` has a `Props` interface without those
  three keys — JSX prop passing is checked via excess-property rules against
  object-literal-shaped attributes. Expected fix: remove the three dead
  props from the `ScholarSchedule.tsx` call site (a behavior-neutral
  deletion, since the props were never read) rather than adding them to the
  `Props` interface.
- A module-level-import/hook-destructure name collision in
  `CreateEditScholarSchedule.jsx`: it imports `createScheduleAssignments`
  from the service layer (unused) and separately destructures a same-named
  `createScheduleAssignments` from `useCreateScheduleAssignments()` (used).
  The inner one always wins at runtime (correct today); the outer import is
  simply dead. No behavior risk, just a naming smell worth a task-list note
  so nobody "fixes" the wrong one.

## Data-Shape Analysis

**Scholar schedule assignment** (`schedule_assignments` row, from
`useScheduleAssignments()` → `getScheduleAssignments()`'s select
`"*, workers(id, name), subjects(id, name), groups(id, year_of_admission,
letter, degrees(id, code, name)), semesters(id, school_year)"`):

- Base row: `id`, `created_at`, `weekday: string | null`,
  `start_time: string | null`, `end_time: string | null`,
  `worker_id: number | null`, `subject_id: number | null`,
  `group_id: number | null`, `semester_id: number | null` (confirmed against
  `src/types/supabase.ts`; all FK columns are nullable).
- Embeds (all to-one, all nullable since every FK above is nullable):
  `workers: Pick<Worker, "id"|"name"> | null`,
  `subjects: Pick<Subject, "id"|"name"> | null`,
  `groups: (Pick<Group, "id"|"year_of_admission"|"letter"> & { degrees:
  Pick<Degree, "id"|"code"|"name"> | null }) | null`,
  `semesters: Pick<Semester, "id"|"school_year"> | null`.
- This exact shape was already modeled once, as `ScheduleAssignmentForPdf`,
  during the (subsequently reverted) PDF-exporter conversion work — the same
  reasoning applies here and the type can be re-derived identically.
- **Known footgun:** `subjects.semester` (used in
  `CreateEditScholarSchedule.jsx`'s `selectingGroup`: `subject.semester ==
  semesterFound`) is a nullable **string** column, compared with loose `==`
  against `calculateSemesterGroup()`'s **numeric** return value. This
  currently "works" only via JS's loose-equality numeric coercion. A strict
  comparison (`===`) would break it; TypeScript will likely flag the
  existing `==` as a comparison between unrelated types once both operands
  are typed, forcing an explicit decision (coerce one side, or keep `==`
  with a type assertion) rather than a silent pass-through.

**Teacher schedule activity** (`schedule_teachers` row, from
`useScheduleTeachers()` → `getScheduleTeachers()`'s select `"*, workers(*),
semesters(*)"`):

- Base row: `id`, `created_at`, `activity: string | null`,
  `weekday: string | null`, `start_time: string | null`,
  `end_time: string | null`, `worker_id: number | null`,
  `semester_id: number | null`.
- Embeds (full rows, both nullable): `workers: Worker | null`,
  `semesters: Semester | null`.
- Also already modeled once, as `ScheduleTeacherForPdf`, during the reverted
  PDF work.

**Group schedule** is not a separate data shape — `ShowScholarSchedule.jsx`
filters the same `ScheduleAssignmentForPdf`-shaped array by `group_id`.

**Derived/computed shapes** (not table rows, need locally-defined types):

- `groupedSubjects: Record<string, ScheduleAssignment[]>` — the result of a
  `groupData(array, key)` helper duplicated **verbatim in three separate
  files** (`ShowTeacherSchedule.jsx`, `TeacherAssignment.jsx`, and the
  now-reverted `WorkerSheetSemester.jsx`/`TeacherAssignmentPDF.jsx` in
  `src/pdf`), each with its own local, structurally-identical
  implementation. Not shared via any common module today.
- `uniqueTeacherSchedule: { name: string; quantity: number }[]` — computed in
  `ShowTeacherSchedule.jsx` and `TeacherAssignment.jsx`, again independently.

## Supabase/Service Shape Analysis

- `apiScheduleAssignments.js` exports **two different create paths**:
  `createScheduleAssignments(newScheduleAssignment)` (plain insert, no id
  param, used only by the two dead files) and
  `createEditScheduleAssignments(newScheduleAssignment, id)` (the real
  create-or-update path, used by `useCreateScheduleAssignments.js`/
  `useEditScheduleAssignments.js`, which the live `CreateEditScholarSchedule`
  form actually goes through). A future implementer must not conflate these
  — only `createEditScheduleAssignments` needs a signature type; the plain
  `createScheduleAssignments` export is only reached from the two dead files,
  which per Closed Decisions Decision 1 are neither migrated nor deleted, so
  it needs no typing work in this migration at all.
- Both service files' `createEdit*` functions destructure options with
  defaults in a way that (per every prior phase's finding) will need a local
  cast at each hook call site — same "destructured-default narrows to a
  literal" class of TypeScript friction as `createEditWorkers`/
  `uploadWorkerDocument`/etc. elsewhere in this migration. Expect this to
  recur here, not a new kind of problem.
- Neither service file has any RLS/storage/bucket concern (no file uploads
  in this domain) — purely relational CRUD over `schedule_assignments`/
  `schedule_teachers`.

## Component Dependency Map

```
ScheduleDashboard.tsx (typed, out of scope for this migration)
├── SemesterContext (typed, provides groups/workers/subjects/scheduleAssignments)
├── ScholarSchedule.jsx
│   ├── CreateEditScholarSchedule.jsx  (reads SemesterContext, not props)
│   └── ShowScholarSchedule.jsx
│       ├── RowScholarSchedule.jsx
│       │   └── HourScheduleSubject.jsx
│       │       └── CreateEditScholarSchedule.jsx (edit path, same component)
│       └── ScheduleGroupPDF.jsx (src/pdf, OUT OF SCOPE)
└── TeacherSchedule.jsx
    ├── CreateEditTeacherSchedule.jsx
    ├── ShowTeacherSchedule.jsx
    │   ├── RowTeacherSchedule.jsx
    │   │   ├── HourScheduleSubjectGroup.jsx
    │   │   │   └── CreateEditScholarSchedule.jsx (edit path, same component)
    │   │   └── HourScheduleTeacher.jsx (exports HourScheduleSubjectTeacher)
    │   │       └── CreateEditTeacherSchedule.jsx (edit path, same component)
    │   └── ScheduleTeacherPDF.jsx (src/pdf, OUT OF SCOPE)
    └── TeacherAssignment.jsx
        └── TeacherAssignmentPDF.jsx (src/pdf, OUT OF SCOPE)

Orphaned (no live edge into the tree above):
  CreateScholarSchedule.jsx
  EditScholarSchedule.jsx (imported once, into an unused binding)
  RowTeacherAssignment.jsx
```

## Phase Breakdown (proposed, for the eventual implementation change)

Mirrors this repo's established "hooks/services first, leaf components next,
container components last" ordering from every prior `convert-*-to-ts`
change:

1. **Phase 0 — confirm closed decisions.** Re-read the Closed Decisions
   section before writing any code: confirm the three dead files still have
   zero live importers (re-check, don't assume the finding is still true by
   the time implementation starts), and confirm the two authorized fixes
   (`isLoading`→`isPending`, `HourScheduleTeacher`'s `setEditModal`) are
   scoped exactly as Decisions 2 and 3 describe before touching any file.
2. **Phase 1 — query/mutation hooks.** `useScheduleAssignments.ts`,
   `useScheduleTeachers.ts` (straightforward — mirror `useWorkers.ts`'s
   pattern), then the 6 mutation hooks (with the `isLoading`/`isPending`
   decision applied uniformly).
3. **Phase 2 — leaf cell components.** `HourScheduleSubject.tsx`,
   `HourScheduleSubjectGroup.tsx`, `HourScheduleTeacher.tsx` (fixing the
   `setEditModal` bug is mandatory here — it's a compile error, not a
   style choice), `RowScholarSchedule.tsx`, `RowTeacherSchedule.tsx`.
4. **Phase 3 — forms.** `CreateEditScholarSchedule.tsx`,
   `CreateEditTeacherSchedule.tsx` — the highest-complexity files (context
   consumption, conflict detection, conditional create/edit branching).
5. **Phase 4 — show/list containers.** `ShowScholarSchedule.tsx`,
   `ShowTeacherSchedule.tsx`, `TeacherAssignment.tsx` — each renders one
   out-of-scope PDF exporter; each needs exactly one local cast.
6. **Phase 5 — tab containers.** `ScholarSchedule.tsx`, `TeacherSchedule.tsx`
   — also where the dead `workers`/`subjects`/`groups` props into
   `CreateEditScholarSchedule` get removed (Real Bugs section).
7. **Phase 6 — verification.** Full `typecheck`/`build`/`lint`/manual smoke
   pass across both scholar and teacher schedule flows.

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Conditional-hook file (`EditScholarSchedule.jsx`) would block a clean typecheck pass if it were included | N/A — closed by Decision 1 | Low (dead code) | Not migrated at all (Decision 1); no restructuring task needed |
| `setEditModal` undefined-identifier bug becomes a hard compile error | Certain, if `HourScheduleTeacher.jsx` is converted at all | Medium (must be fixed to compile, not optional) | Authorized, minimal fix in Phase 2 per Decision 3 — not a "preserve the bug" case, since TS cannot compile a reference to a never-declared identifier |
| `isLoading`/`isPending` bug would be silently preserved because TS doesn't force a fix | N/A — closed by Decision 2 | Low-medium (already broken today) | Fix authorized and scoped by Decision 2; applied uniformly across all 6 mutation hooks in Phase 1 |
| `ScholarSchedule.jsx`'s dead prop-threading into `CreateEditScholarSchedule` breaks the build via excess-property errors | High | Low (one-line fix per occurrence) | Called out explicitly in Phase 5; remove the three dead props at the call site |
| `subjects.semester == semesterFound` loose-equality type mismatch | Medium | Low (isolated to `selectingGroup` in two forms) | Local type normalization/cast that preserves current comparison semantics, per Decision 4, in Phase 3 |
| Duplicated `groupData` helper (3+ independent copies) tempts an implementer to "helpfully" consolidate it into a shared module | Medium | Medium (an unauthorized refactor, out of scope for a type-only migration) | Explicit non-goal per Decision 5; each copy typed independently, in place |
| PDF exporter prop-shape drift (untyped defaults narrowing to `never[]`) | High (already seen in the reverted PDF-conversion attempt) | Low (known pattern, known fix) | Local `ComponentType` cast at each of the 3 call sites, exactly as done for `WorkerSheetSemester` in `ScheduleDashboard.tsx` |
| Migration reawakens dead files by "completing" them (e.g. fixing `EditScholarSchedule.jsx` into a working alternate edit path) | N/A — closed by Decision 1 | High (introduces a second, divergent edit code path) | Explicit non-goal; Decision 1 leaves all three dead files untouched, never "fixed into a second implementation" |

## Verification Plan

For the eventual implementation change (not this one):

- `openspec validate` after each artifact update in this planning change, and
  again before archiving the eventual implementation change.
- `bun run typecheck` after every phase — must be clean before moving to the
  next phase, matching this repo's established per-phase discipline.
- `bun run build` after every phase.
- `bun run lint` after every phase, comparing against the 205-problem
  baseline recorded here; expect a large drop once `react/prop-types`
  disappears feature-wide, similar in shape to every prior `convert-*-to-ts`
  change's lint delta.
- Manual schedule smoke checks (see below) after Phase 6, before merge.

## Manual Checks (for the eventual implementation change)

- Open `/semesters/:id`, confirm both "Horario Escolar" and "Horario del
  Maestro" tabs render their existing tables with real data.
- Create a new scholar schedule assignment; confirm it appears in the grid
  and that attempting a conflicting worker/group/time combination is
  blocked with the existing error toast.
- Edit an existing scholar schedule assignment via its pencil icon; confirm
  the form pre-fills and the update reflects in the grid without creating a
  duplicate row.
- Delete a scholar schedule assignment; confirm the row disappears and the
  success toast fires.
- Repeat create/edit/delete for a teacher activity; confirm the "Asignación
  horaria" sub-tab's computed hours update accordingly.
- Confirm the group-filter dropdown (`ShowScholarSchedule`) and worker-filter
  dropdown (`ShowTeacherSchedule`) both still filter correctly.
- Confirm all three PDF-export buttons (group schedule, teacher schedule,
  teacher assignment) still render/download a PDF with unchanged content —
  functional smoke check only; full PDF-output verification is that
  migration's own responsibility, not this one's.
- Confirm buttons/selects now visibly disable during a create/edit/delete
  mutation, where they did not before (Decision 2's authorized fix).
- Confirm closing the teacher-activity edit modal no longer throws
  (Decision 3's authorized fix).

## Rollback/Cancel Criteria

- If Phase 1 (hooks) cannot reach a clean `bun run typecheck` without
  touching `src/services/apiScheduleAssignments.js`/`apiScheduleTeachers.js`
  beyond a local cast, stop and re-scope — this plan assumes local casts
  suffice, matching every prior service-layer encounter in this migration.
- If any phase's manual smoke check reveals a behavior change beyond the two
  explicitly-authorized fixes (Decisions 2 and 3) or the dead-prop removal
  (`ScholarSchedule.jsx`), revert that phase's commits and re-plan rather
  than patching forward.
- If implementation-time re-checking (Phase 0) finds a live importer for any
  of the three files Decision 1 treats as dead, stop and re-plan that file's
  disposition before proceeding — do not convert it inline under an
  assumption this document already contradicts.

## Recommendation: One Branch or Multiple?

**One branch, phased commits within it** (not one branch per phase, not one
giant unreviewed commit). Rationale:

- Every prior `convert-*-to-ts` change in this repo's history landed as a
  single PR per change, with the phase structure expressed as sequential,
  individually-verified commits (typecheck/build/lint run after each) rather
  than separate branches or separate PRs. Splitting this into multiple
  branches would fragment review of a feature whose files are tightly
  interdependent (the same `SemesterContext`, the same conflict-detection
  helper, the same PDF-exporter boundary) in a way that makes partial-branch
  review harder, not easier, without a corresponding benefit.
- The dependency order (hooks → leaf cells → forms → containers → tab
  roots) is a strict enough chain that landing it out of order across
  separate branches would leave intermediate states with type errors (a leaf
  cell converted before its parent still expects the old JS shape).
- Decision 1 (dead files are neither migrated nor deleted here) removes what
  would otherwise have been the one real reason to split into a separate
  branch — there is no "delete the 3 dead files" PR to sequence ahead of the
  main migration, since deletion isn't part of this migration at all. A
  future dead-file cleanup change, if pursued, is independent of this one
  and doesn't need to precede or follow it on any particular branch.

## Closed Decisions

All five questions raised during planning have been decided. These decisions
are binding on the eventual implementation change — they are not
re-litigated per phase, and no task may go beyond what's authorized here.

### Decision 1 — Dead/orphaned files

`CreateScholarSchedule.jsx`, `EditScholarSchedule.jsx`, and
`RowTeacherAssignment.jsx` are **not migrated and not deleted** as part of
the schedules TypeScript migration. They are treated as orphaned/dead files
and deferred to a separate cleanup change filed after the schedules
migration lands. The implementation agent **MUST NOT** modify any of these
three files unless later evidence (re-checked at implementation time, not
assumed from this planning pass) shows one of them has a live importer after
all — in that case, stop and re-plan rather than converting it inline. This
reverses this document's earlier "recommend deleting them" position in favor
of leaving the repository's current file set untouched by this migration
entirely; deletion is its own follow-up decision, made by its own change.

### Decision 2 — TanStack Query mutation pending state

The schedules migration is **explicitly authorized** to replace invalid
`isLoading` usage with TanStack Query v5's `isPending` in all 6 schedule
mutation hooks (`useCreateScheduleAssignments`, `useEditScheduleAssignments`,
`useDeleteScheduleAssignment`, `useCreateScheduleTeacher`,
`useEditScheduleTeacher`, `useDeleteScheduleTeacher`) and in every component
that destructures their `isCreating`/`isEditing`/`isDeleting` return values.
This is an authorized **behavior fix**, not a pure type annotation: the
existing disabled/loading UI state is broken today (always `undefined`) and
will visibly start working once fixed. Scope of the fix is strictly the
`isLoading` → `isPending` rename and its knock-on `disabled={...}` wiring —
React Query keys, mutation functions (`mutationFn`), `onSuccess`/`onError`
handlers, invalidation targets, and every underlying Supabase call **MUST
remain unchanged**.

### Decision 3 — `HourScheduleTeacher`'s undefined `setEditModal`

The schedules migration is **explicitly authorized** to fix the live
`setEditModal` `no-undef` runtime bug in `HourScheduleTeacher.jsx`. The fix
**MUST** be minimal and based on the existing local modal-state pattern
already present in its sibling components (`HourScheduleSubject.jsx`/
`HourScheduleSubjectGroup.jsx` both declare `const [editModal, setEditModal]
= useState(false)` alongside a `deleteModal` counterpart, even though that
state is itself decorative there — see the Real Bugs section). Adding the
same declaration to `HourScheduleTeacher.jsx` is the minimal, pattern-
consistent fix. The fix **MUST NOT** redesign modal open/close behavior,
change what triggers the edit modal, or introduce any new UI behavior beyond
making the existing `onCloseModal={() => setEditModal(false)}` callback
reference a real, declared state setter.

### Decision 4 — Loose-equality type mismatch

The schedules migration **MUST** preserve the current comparison semantics
of `subject.semester == semesterFound` in `selectingGroup` (both the live
`CreateEditScholarSchedule.jsx` and the deferred-per-Decision-1 dead files).
Loose equality **MUST NOT** be converted to strict equality as a cleanup —
that would be a silent behavior change to a comparison this plan has no
mandate to alter. If TypeScript's type checker rejects the loose-equality
comparison once both operands are typed (string vs. number), the
implementation **MUST** resolve it with a local type normalization or cast
(e.g. normalizing one side to match the other's type before comparing, or an
explicit assertion) that preserves the exact current runtime comparison
result for every input — not a rewritten comparison operator.

### Decision 5 — Duplicated `groupData` helper

The three independent, structurally-identical copies of the `groupData`
helper (`ShowTeacherSchedule.jsx`, `TeacherAssignment.jsx`, and the
out-of-scope PDF exporters) are **not** de-duplicated during this
TypeScript migration. Each copy is typed independently, in place, preserving
its own file's existing behavior exactly. De-duplication into a shared
helper module is documented here as a **separate, post-migration cleanup**
candidate — explicitly out of scope for a type-only migration, and not to be
done opportunistically "while we're in there."
