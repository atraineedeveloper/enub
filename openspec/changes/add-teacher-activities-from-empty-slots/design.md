## Context

`CreateEditTeacherSchedule.tsx` registers two independent react-hook-form
fields, `start_time` and `end_time`, each a `<Select>` populated from
`src/helpers/constants.ts`:

```ts
export const START_TIMES = [
  { value: "07:00:00", label: "7:00" },
  { value: "09:20:00", label: "9:20" },
  { value: "11:10:00", label: "11:10" },
  { value: "13:10:00", label: "13:10" },
  { value: "17:00:00", label: "17:00" },
] as const;

export const END_TIMES = [
  { value: "08:50:00", label: "8:50" },
  { value: "11:10:00", label: "11:10" },
  { value: "13:00:00", label: "13:00" },
  { value: "15:00:00", label: "15:00" },
  { value: "19:00:00", label: "19:00" },
] as const;
```

Nothing pairs a given `start_time` with its matching `end_time` — the same
gap the scholar-side change (`add-schedules-from-empty-slots`, archived as
the `scholar-schedule-canonical-blocks` capability) closed for
`schedule_assignments`. `apiScheduleTeachers.ts`'s
`createEditScheduleTeachers()` — the one function both
`useCreateScheduleTeacher` and `useEditScheduleTeacher` call — validates
only that the payload is a non-null object; it does not check `worker_id`,
`weekday`, or `start_time`/`end_time` at all today.

`schedule_teachers` (same migration file as `schedule_assignments`) stores
`start_time`/`end_time` as plain `time without time zone` columns with no
`CHECK` constraint.

Every hour-counting site that reads `schedule_teachers` groups activities
by **trimmed activity text**, not by row, then multiplies the resulting
count by 2 — confirmed identical in all three places:

```ts
// ShowTeacherSchedule.tsx, TeacherAssignment.tsx, WorkerSheetSemester.tsx
const countTeacherSchedules = filteredSchedulesTeacher.reduce(
  (acc, item) => {
    const trimmedAcitivity = item.activity!.trim();
    acc[trimmedAcitivity] = (acc[trimmedAcitivity] ?? 0) + 1;
    return acc;
  },
  {}
);
// ...
uniqueTeacherSchedule.forEach((schedule) => (total += schedule.quantity * 2));
```

This grouping never inspects `start_time` — it counts occurrences of each
distinct activity string and multiplies by 2 per occurrence, which is
exactly `rowCount * 2` restated per-activity-name instead of flatly. A row
in the 17:00–19:00 block is counted by this same code path, identically to
a row in any other block — there is no special case to find or fix (see
Decision 2). `TeacherAssignmentPDF.tsx` and `ScheduleTeacherPDF.tsx`
consume the same pre-computed `uniqueTeacherSchedule`/`totalHours` values
(the former) or independently filter by exact `start_time` per weekday
cell for layout purposes only, not for hour totals (the latter, via
`filterHourActivity.ts` — display-only, unaffected by this change).

`HourScheduleSubjectTeacher.tsx` (the teacher-schedule table's per-cell
renderer) filters by `weekday`+`start_time` only, same as the scholar
side's pre-fix bug: a legacy row with a wrong `end_time` would render as
if it were a normal block, its wrong end time invisible in the grid.

Free-cell rendering: when `activitiesHour.length === 0`,
`HourScheduleSubjectTeacher.tsx` renders `<p></p>` with no create
affordance. `RowTeacherSchedule.tsx` already threads `semesterId` down to
`HourScheduleSubjectTeacher` (added by the semester-scoping change), but
never threads the selected `workerId` — `ShowTeacherSchedule.tsx` holds
`selectedWorkerId` locally and only ever uses it to compute
`filteredSchedulesTeacher`/`filteredSchedulesAssignments`; it never passes
the id itself further down. `workers` (the full list) does reach
`HourScheduleSubjectTeacher` today, but only so its existing edit form can
offer the full teacher dropdown — it is not usable to identify *which*
teacher is currently selected.

`ShowTeacherSchedule.tsx` gates both `RowTeacherSchedule` and
`ScheduleTeacherPDF` on:

```ts
const recordExist =
  filteredSchedulesTeacher.length > 0 || filteredSchedulesAssignments.length > 0;
```

A teacher with zero activities and zero scholar assignments sees no grid
at all — only the table header — which would also hide every cell's new
Add action. This is the same class of bug the scholar-side change shipped
with (`ShowScholarSchedule.tsx` originally gated `RowScholarSchedule` on
`filteredSchedules.length > 0`) and had to fix after a code-review finding
post-implementation. This design applies that fix from the start (Decision
10) rather than repeating the mistake.

## Goals / Non-Goals

**Goals:**
- Every new or edited teacher activity's `start_time`/`end_time` pair
  exactly matches one of the 5 canonical teacher blocks — enforced at both
  the form and the service layer, mirroring the scholar-side guarantee.
- Every free teacher-schedule cell offers a one-click Add path that
  preselects everything the cell already implies (semester, teacher,
  weekday, block), leaving only activity text for the admin.
- A selected teacher with zero existing records still sees the full grid
  and every cell's Add action, correct from this change's first version.
- Existing invalid legacy rows are left untouched but are discoverable and
  correctable through the normal edit flow.
- Zero change to conflict detection, PDF content, hour-counting formulas,
  scholar-schedule behavior, or database schema.

**Non-Goals:**
- No automatic splitting, reinterpretation, or normalization of existing
  invalid `schedule_teachers` rows.
- No change to scholar-schedule scheduling
  (`schedule_assignments`, `CreateEditScholarSchedule.tsx`,
  `HourScheduleSubject.tsx`, `RowScholarSchedule.tsx`,
  `ShowScholarSchedule.tsx`, `ScholarSchedule.tsx`, `scheduleBlocks.ts`) —
  a different, already-hardened entity, explicitly out of scope.
- No change to the read-only scholar-assignment half of each teacher-grid
  cell (`HourScheduleSubjectGroup.tsx`) — it already has its own edit/
  delete controls from the scholar-schedule capability; this change adds
  an Add action only to the teacher-activity half of the cell
  (`HourScheduleSubjectTeacher.tsx`).
- No database migration or `CHECK` constraint in this change.
- No change to `detectScheduleConflict.ts`.
- No relabeling of the top-level "+ Agregar horario de actividades"
  button — unlike the scholar-side change, this proposal was not asked to
  rename it, so it stays as-is (see Decision 11).
- No semester-wide (cross-teacher) invalid-row summary — the new warning
  banner is scoped to the currently-selected teacher, matching the
  scholar-side precedent and the existing one-teacher-at-a-time table view.

## Decisions

**1. Where do the teacher canonical block definitions live, and how do
they relate to `scheduleBlocks.ts`?**

A new file, `src/features/schedules/teacherScheduleBlocks.ts`, colocated
with the scholar module it depends on but never modifies:

```ts
import { SCHEDULE_BLOCKS, type ScheduleBlock } from "./scheduleBlocks";

export const TEACHER_SCHEDULE_BLOCKS: ScheduleBlock[] = [
  ...SCHEDULE_BLOCKS,
  { start_time: "17:00:00", end_time: "19:00:00", label: "17:00 - 19:00" },
];

export function getTeacherBlockByStartTime(startTime: string | null | undefined): ScheduleBlock | undefined;
export function getTeacherBlockByTimes(startTime: string | null | undefined, endTime: string | null | undefined): ScheduleBlock | undefined;
export function isCanonicalTeacherBlock(startTime: string | null | undefined, endTime: string | null | undefined): boolean;
```

The 4 shared intervals (07:00–08:50 through 13:10–15:00) are **imported**
from `scheduleBlocks.ts`, not re-typed — a single source of truth for
those 4 values, matching the request's "without duplicating" constraint.
The dependency is one-directional: `teacherScheduleBlocks.ts` reads from
`scheduleBlocks.ts`; nothing in `scheduleBlocks.ts` or the scholar-schedule
feature imports from the teacher module, so scholar behavior cannot
regress as a side effect of this change. `isCanonicalTeacherBlock` accepts
all 5 blocks including 17:00–19:00; `isCanonicalBlock` (scholar's,
unchanged) continues to accept only the original 4 — the two policies stay
independently enforceable, satisfying "without mixing scholar-only and
teacher-only rules." A `schedule_teachers` row is never validated against
`isCanonicalBlock`, and a `schedule_assignments` row is never validated
against `isCanonicalTeacherBlock`.

**2. How is the 17:00–19:00 block represented and counted as 2 hours?**

Represented identically to the other 4 blocks — the 5th entry in
`TEACHER_SCHEDULE_BLOCKS`, with no special-cased shape or separate type.
Counted identically too: every hour-counting site that reads
`schedule_teachers` (`ShowTeacherSchedule.tsx`, `TeacherAssignment.tsx`,
`TeacherAssignmentPDF.tsx`, `WorkerSheetSemester.tsx`) groups by trimmed
activity text and multiplies the occurrence count by 2 — this grouping
never inspects `start_time`, so a 17:00–19:00 row is already counted
exactly the same as a 07:00–08:50 row, today, with zero code change
required (see Context and Decision 7/item 28's inspection result). The
form-level guarantee this change adds (every row is exactly one canonical
block) is what makes that pre-existing `quantity * 2` formula exactly
correct for every row, including 17:00–19:00 ones — the same relationship
the scholar-side change established for `schedule_assignments`.

**3. How does the block selector map to `start_time` and `end_time`?**

Same mechanism as the scholar side, replicated in the teacher form: one
registered field, reusing the existing `start_time` name, `<Select>`
options built from `TEACHER_SCHEDULE_BLOCKS`
(`<option value={block.start_time}>{block.label}</option>`). The "Hora
Fin" `FormRow` is deleted; "Hora Inicio" becomes "Bloque horario". At
submit time:

```ts
const block = getTeacherBlockByStartTime(data.start_time);
if (!block) {
  toast.error("Bloque horario inválido.");
  return;
}
data.end_time = block.end_time;
```

placed **before** the existing `hasWorkerConflict` check (order matters:
conflict detection must see the resolved `end_time`, not an undefined
one) and before the create/edit mutation call. `schedule_teachers`'
payload shape is otherwise unchanged.

**4. How do the selected `workerId` and `semesterId` reach each cell?**

`semesterId` already reaches `HourScheduleSubjectTeacher` today (added by
the semester-scoping change) via `ShowTeacherSchedule` →
`RowTeacherSchedule` → `TimeSlotRow`/`DayCell` → `HourScheduleSubjectTeacher`.
`workerId` does not — `ShowTeacherSchedule.tsx`'s `selectedWorkerId` state
is used only to compute the two filtered arrays, never passed further.
This change adds `workerId: string` and a computed `workerLabel: string`
(via the same `capitalizeName(selectedWorker.name)` expression already
used for the worker `<option>` labels, mirroring the scholar-side
`groupLabel` precedent for accessible labeling) to the same prop chain
`semesterId` already uses:
`ShowTeacherSchedule` → `RowTeacherSchedule` → `TimeSlotRow` → `DayCell` →
`HourScheduleSubjectTeacher`. The existing `workers` (full list) prop is
unchanged and keeps serving its current purpose (the edit form's teacher
dropdown) — `workerId`/`workerLabel` are additive, not a replacement.

**5. How does creation from a free cell pass defaults into
react-hook-form?**

`CreateEditTeacherSchedule` gains one new, optional prop, mirroring the
scholar side's `initialValues`:

```ts
interface TeacherScheduleInitialValues {
  weekday?: string;
  worker_id?: number;
  start_time?: string;
}
```

`defaultValues` becomes `isEditSession ? editValues : (initialValues ??
{})`. Unlike the scholar form (which leaves both subject *and* worker
unselected from a free cell, since the cell only implies group), the
teacher-schedule view is already scoped to one selected teacher, so the
cell's implied `worker_id` **is** preselected — only `activity` (the
free-text field) is left for the admin to fill in, per the request's
requirement 10/11. `weekday` and `worker_id` remain ordinary, changeable
`<select>` defaults (not locked/disabled), matching the scholar
precedent — an admin can still redirect the activity to a different
teacher or day before saving if the cell's implied values aren't quite
right.

**6. How does edit mode preload a valid activity?**

Unlike the scholar form's `subject_id` field (whose options depend on an
async, group-filtered computation — the actual root cause of a bug found
by manual review in the scholar-side change), every field in
`CreateEditTeacherSchedule` has a fully static, synchronously-available
option list: `weekday` (`WEEKDAYS` constant), `worker_id` (the `workers`
prop, already loaded before the form mounts), `activity` (free-text, no
options), and the new `start_time` block selector
(`TEACHER_SCHEDULE_BLOCKS`, a static array). react-hook-form's
`defaultValues`, applied once at mount, is therefore sufficient for all
four fields with no equivalent of the scholar-side `setValue`/`useRef`
re-sync effect needed — there is no async gap for it to paper over. This
asymmetry is called out explicitly so implementation does not
copy-paste an unnecessary fix from the scholar form. The only field
needing special handling is the block selector's *value*, not its
timing: mirroring the scholar side's Decision 4,

```ts
const editedBlock = isEditSession
  ? getTeacherBlockByTimes(editValues.start_time, editValues.end_time)
  : undefined;
```

is computed once; if found, `defaultValues.start_time` is
`editedBlock.start_time` (normal case, no visible change); if not found
(invalid legacy interval), `start_time` is omitted from `defaultValues`
(left unselected) and a warning renders above the "Bloque horario"
`FormRow`, identical in spirit to the scholar-side message:
`El intervalo actual (${editValues.start_time}–${editValues.end_time}) no corresponde a un bloque válido. Seleccione el bloque correcto para continuar.`
The field's existing `required` validation blocks submission until the
admin explicitly picks one of the 5 blocks.

**7. How are invalid legacy intervals detected and surfaced?**

Mirrors the scholar side's Decision 8, scoped to the selected teacher
instead of the selected group. `ShowTeacherSchedule.tsx` already computes
`filteredSchedulesTeacher`; a new derived value,

```ts
const invalidActivities = useMemo(
  () => filteredSchedulesTeacher.filter((s) => !isCanonicalTeacherBlock(s.start_time, s.end_time)),
  [filteredSchedulesTeacher]
);
```

renders a small warning banner above the table when non-empty, listing
each affected row's weekday, activity text, and raw `start_time`–`end_time`
(there is no "subject" concept for teacher activities — the activity text
itself is the descriptive field, filling the same role the scholar
banner's subject/teacher columns played). Nothing about this banner
touches `scheduleTeachers` data; it is a pure read/render addition, scoped
to the currently-selected teacher (not semester-wide), matching the
existing one-teacher-at-a-time table view and the request's constraint.

**8. How does service validation protect both create and update paths?**

`apiScheduleTeachers.ts`'s `createEditScheduleTeachers()` — the one
function both `useCreateScheduleTeacher` and `useEditScheduleTeacher`
call — gains one new check, placed immediately after its existing
payload-shape guard and before the insert/update query is built:

```ts
if (
  typeof newScheduleTeachers.start_time !== "string" ||
  typeof newScheduleTeachers.end_time !== "string" ||
  !isCanonicalTeacherBlock(newScheduleTeachers.start_time, newScheduleTeachers.end_time)
) {
  throw new Error("El horario debe corresponder a un bloque académico válido.");
}
```

This runs unconditionally for both create and edit, mirroring the scholar
service's unconditional check (this form always submits every registered
field together; there is no partial-update path). Scope is intentionally
limited to the canonical-block check only — `createEditScheduleTeachers()`
today has no `worker_id`/`weekday` presence validation at all (unlike its
scholar counterpart), and adding that is a pre-existing gap, not something
this change's canonical-block requirement asks for; adding it anyway would
be an unrelated refactor. The already-correct `getScheduleTeachers()` and
`deleteScheduleTeachers()` are not touched.

**9. How do conflicts against both teacher activities and scholar
assignments remain correct?**

Unchanged. `CreateEditTeacherSchedule.tsx`'s `onSubmit` already builds
`[...scheduleTeachers, ...scheduleAssignments]` and calls
`hasWorkerConflict` against the combined array before submitting — this
logic is not touched. The only ordering requirement this change adds is
that the block-resolution step (Decision 3) must run *before* that
existing conflict check, so `hasWorkerConflict` evaluates the resolved
`end_time` rather than an unresolved one — the same lesson already applied
on the scholar side. `detectScheduleConflict.ts` itself is not modified:
its strict-inequality overlap math already works correctly for canonical
blocks and for legacy invalid intervals from either table, confirmed by
inspection (unchanged since the scholar-side change's own Decision 6/
Non-Goal, which reached the same conclusion for the same file).

**10. How does a zero-activity teacher still render the full timetable?**

`ShowTeacherSchedule.tsx`'s `recordExist` gate
(`filteredSchedulesTeacher.length > 0 || filteredSchedulesAssignments.length > 0`)
is replaced, for the purpose of rendering `RowTeacherSchedule`, with a
gate on `selectedWorkerId !== null` — a teacher is selected, full stop,
regardless of whether either array has any rows yet. `ScheduleTeacherPDF`
keeps its existing `recordExist` gate unchanged (a PDF export button for a
teacher with nothing to export has nothing to add — matching the
`pdf-exporter-safety` capability's requirement that PDF button visibility
conditions stay exactly as they are today). This is the same shape of fix
the scholar-side change had to apply reactively, after a code-review
finding, to `ShowScholarSchedule.tsx`'s equivalent
`filteredSchedules.length > 0` gate; this design applies it proactively so
the first implementation of this change does not ship the same bug.

**11. Does the top-level manual Add button remain, and is it relabeled?**

Yes, unchanged in placement, label, and behavior
(`TeacherSchedule.tsx`'s "+ Agregar horario de actividades" button,
`ActionsBar`). It renders the same `CreateEditTeacherSchedule` component
this change updates, so it automatically gains the single canonical-block
selector — no separate implementation, no code change to
`TeacherSchedule.tsx` itself beyond what Decision 4's prop-threading
requires elsewhere. Unlike the scholar-side change (where the user
explicitly asked for a relabel to "Agregar horario manualmente"), this
proposal received no such instruction, so the label stays
"+ Agregar horario de actividades" — explicitly decided, not an oversight,
and consistent with "no unrelated refactors."

**12. Manual tests required (see `tasks.md` for the full checklist)**

All 5 canonical blocks (including 17:00–19:00) create and edit correctly;
the block `<select>` never offers a 6th, non-canonical option; conflict
detection still blocks an overlapping submission against both another
teacher activity and a scholar assignment for the same worker; the
free-cell Add flow across at least 2 different weekdays/blocks correctly
preselects semester, teacher, and block while leaving activity text empty;
occupied-cell edit/delete controls are unaffected; a teacher with zero
existing records still renders the full grid with every cell's Add action;
free-cell Add buttons are keyboard-operable (`Tab` + `Enter`/`Space`);
editing a deliberately-inserted invalid legacy activity (e.g. a test
`07:00:00`–`13:00:00` row) shows the warning and an unselected block, and
saving after picking a valid block corrects it; the invalid-row banner
appears for that test row and disappears once corrected; teacher
assignment totals and all 4 PDF exporters remain visually correct for
valid data, including a teacher with a 17:00–19:00 activity.

## No-migration justification

Not required, for the same reasons the scholar-side change (Decision 9 of
its own design.md) already established and which apply identically here:
no `CHECK` constraint exists on `schedule_teachers` today; retrofitting one
onto a table that may already contain invalid rows would require `ADD
CONSTRAINT ... CHECK (...) NOT VALID` plus a later `VALIDATE CONSTRAINT`
step, meaningfully more scope than this change's stated goal; the
service-layer check (Decision 8) already closes the "any caller, not just
the UI" gap; flagged as a legitimate future hardening step for both tables
together, not silently dropped.

## Risks / Trade-offs

- **Deeper prop-threading path than the scholar side**: `workerId`/
  `workerLabel` must pass through `RowTeacherSchedule.tsx`'s existing
  `TimeSlotRow` → `DayCell` → `HourScheduleSubjectTeacher` structure (one
  more layer than the scholar side's flatter row component), across
  multiple `TimeSlotRow` call sites (including the conditional
  17:00–19:00 one). Mechanical but must be complete — a missed pass-through
  fails at `bun run typecheck`, not silently, once
  `HourScheduleSubjectTeacher`'s new props become required.
- **Two independent canonical-block policies in one feature area**:
  `isCanonicalBlock` (4 blocks) and `isCanonicalTeacherBlock` (5 blocks)
  must never be swapped at a call site — a `schedule_teachers` row
  validated against the 4-block scholar policy would incorrectly reject
  every legitimate 17:00–19:00 activity. Mitigated by keeping the two
  modules and their exports clearly named and by scoping every new file
  touched in this change to the teacher side only.
- **Invalid-legacy-data UX (Decision 6)**: the admin must understand *why*
  the block field is empty on first opening an invalid activity's edit
  form — mitigated by the same explicit warning message pattern already
  validated (via its own manual-review fix) on the scholar side.
- **Warning banner scope (Decision 7)**: limited to the selected teacher,
  not semester-wide — same accepted trade-off as the scholar side's
  group-scoped banner, for the same reason (consistency with the existing
  one-teacher-at-a-time view).
- **No DB-level enforcement**: a direct SQL write outside the app could
  still insert a non-canonical interval into `schedule_teachers` — same
  residual risk already accepted for `schedule_assignments`, and outside
  what any application-layer change can close.
