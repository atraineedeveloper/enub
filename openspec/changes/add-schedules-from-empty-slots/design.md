## Context

`CreateEditScholarSchedule.tsx` today registers two independent
react-hook-form fields, `start_time` and `end_time`, each a `<Select>` with
its own hardcoded option list:

```tsx
<Select id="start_time" {...register("start_time", {...})}>
  <option value="07:00:00">7:00</option>
  <option value="09:20:00">9:20</option>
  <option value="11:10:00">11:10</option>
  <option value="13:10:00">13:10</option>
</Select>
...
<Select id="end_time" {...register("end_time", {...})}>
  <option value="08:50:00">8:50</option>
  <option value="11:10:00">11:10</option>
  <option value="13:00:00">13:00</option>
  <option value="15:00:00">15:00</option>
</Select>
```

Nothing pairs a given `start_time` with its matching `end_time` — any
combination of the two lists is submittable, and `apiScheduleAssignments.ts`'s
`createEditScheduleAssignments()` (the function both `useCreateScheduleAssignments`
and `useEditScheduleAssignment` actually call) validates only that
`worker_id` and (for create) `semester_id` are present — it does not touch
`start_time`/`end_time` at all.

`schedule_assignments` (`supabase/migrations/20260702000000_remote_schema.sql`)
stores `start_time`/`end_time` as plain `time without time zone` columns
with no `CHECK` constraint — the database has never enforced a valid
interval.

Every hour-counting site in the codebase already assumes one row = one
2-hour block, confirmed by inspection of all four:
- `ShowTeacherSchedule.tsx` / `TeacherAssignment.tsx`:
  `groupedSubjects[subject].length * 2`
- `TeacherAssignmentPDF.tsx`: same `groupedSubjects[subject].length * 2`
- `WorkerSheetSemester.tsx`: same pattern, `numHours`/`totalHours` built the
  same way

`HourScheduleSubject.tsx` (the scholar-schedule table's per-cell renderer)
filters by `weekday`+`start_time` only — it does not check `end_time` at
all when deciding what to render in a cell:

```tsx
const subjectHour = schedules.filter((schedule) => {
  return schedule.weekday === weekday && schedule.start_time === startTime;
});
```

This means today's one known invalid row (`07:00:00`–`11:10:00`) already
renders in the grid as if it were a normal `07:00–08:50` assignment — its
wrong `end_time` is invisible in the UI. This is the concrete bug the
canonical-block policy exists to prevent.

Free-cell rendering: when `subjectHour.length === 0`,
`HourScheduleSubject.tsx` renders `<p>--</p>` with no create affordance.
`RowScholarSchedule.tsx` passes only `schedules`/`weekday`/`startTime` into
each of its 10 `HourScheduleSubject` instances — no `semesterId` or
`groupId` reaches that deep today (the group filter lives one level up in
`ShowScholarSchedule.tsx`, and `semesterId` isn't threaded past
`ScholarSchedule.tsx` at all for the schedule-viewing path — it's only
passed into the top-level `+ Agregar horario escolar` button's own
`CreateEditScholarSchedule` instance).

## Goals / Non-Goals

**Goals:**
- Every new or edited scholar schedule assignment's `start_time`/`end_time`
  pair exactly matches one of the 4 canonical blocks — enforced at both the
  form (can't select anything else) and the service layer (can't insert/
  update anything else, regardless of caller).
- Every free scholar-schedule cell offers a one-click Add path that
  preselects everything the cell already implies (semester, group,
  weekday, block), leaving only subject and teacher for the admin.
- Existing invalid legacy rows are left untouched but are discoverable and
  correctable through the normal edit flow.
- Zero change to conflict detection, PDF content, hour-counting formulas,
  or database schema.

**Non-Goals:**
- No automatic splitting, reinterpretation, or normalization of existing
  invalid rows.
- No change to teacher-activity scheduling (`schedule_teachers`,
  `CreateEditTeacherSchedule.tsx`, `HourScheduleTeacher.tsx`,
  `RowTeacherSchedule.tsx`) — a different table with a legitimate extra
  17:00–19:00 extracurricular slot, explicitly out of scope.
- No database migration or `CHECK` constraint in this change.
- No change to `detectScheduleConflict.ts`.
- No semester-wide (cross-group) invalid-row summary — the new warning
  banner is scoped to the currently-selected group, matching the existing
  one-group-at-a-time table view (flagged as an open question below, not
  silently expanded).

## Decisions

**1. Where do the canonical block definitions live?**

A new file, `src/features/schedules/scheduleBlocks.ts`, colocated with the
scholar-schedule feature (not `src/helpers/constants.ts`, which holds the
teacher-activity `START_TIMES`/`END_TIMES` — a different, larger set
including the 17:00–19:00 slot that must stay untouched and unrelated).
This mirrors the precedent set by `src/features/semesters/nextSemesterCode.ts`
in the immediately-prior `generate-next-semester` change: a small,
feature-scoped, pure-logic module with no React dependency, exporting both
the data and the functions that operate on it:

```ts
export interface ScheduleBlock {
  start_time: string;
  end_time: string;
  label: string;
}

export const SCHEDULE_BLOCKS: ScheduleBlock[] = [
  { start_time: "07:00:00", end_time: "08:50:00", label: "7:00 - 8:50" },
  { start_time: "09:20:00", end_time: "11:10:00", label: "9:20 - 11:10" },
  { start_time: "11:10:00", end_time: "13:00:00", label: "11:10 - 13:00" },
  { start_time: "13:10:00", end_time: "15:00:00", label: "13:10 - 15:00" },
];

export function getBlockByStartTime(startTime: string | null | undefined): ScheduleBlock | undefined;
export function getBlockByTimes(startTime: string | null | undefined, endTime: string | null | undefined): ScheduleBlock | undefined;
export function isCanonicalBlock(startTime: string | null | undefined, endTime: string | null | undefined): boolean;
```

`getBlockByStartTime` is safe to use as a block's unique key because no two
canonical blocks share a `start_time` (confirmed: all 4 are distinct).

**2. How does the block selector map to `start_time` and `end_time`?**

The form keeps exactly one registered time field, reusing the existing
`start_time` field name (not inventing a separate `block_id` field) — its
`<Select>` options are the 4 `SCHEDULE_BLOCKS`, each `<option value={block.start_time}>{block.label}</option>`.
The "Hora Fin" `FormRow`/`<Select>` is deleted outright, and the "Hora de
inicio" `FormRow`'s `label` changes to `"Bloque horario"`. At submit time,
`onSubmit` resolves the full block from the submitted `start_time` and
injects `end_time` before calling the existing, unmodified create/edit
functions:

```ts
const block = getBlockByStartTime(data.start_time);
if (!block) {
  toast.error("Bloque horario inválido.");
  return;
}
data.end_time = block.end_time;
```

This keeps `schedule_assignments`' payload shape and every column exactly
as it is today — only how `start_time`/`end_time` are *produced* changes,
matching this change's non-goal of preserving database access semantics.
The `<select>` itself is the primary guard (only 4 values are ever
selectable); this `onSubmit` check is defense-in-depth for the one case
where a submitted `start_time` might not resolve — see Decision 4.

**3. How does creation from a free cell pass defaults into react-hook-form?**

`CreateEditScholarSchedule` gains one new, optional prop:

```ts
interface ScholarScheduleInitialValues {
  weekday?: string;
  group_id?: number;
  start_time?: string;
}
```

passed as `initialValues?: ScholarScheduleInitialValues`. The existing
`defaultValues` computation:

```ts
defaultValues: (isEditSession ? editValues : {}) as FieldValues,
```

becomes:

```ts
defaultValues: (isEditSession ? editValues : (initialValues ?? {})) as FieldValues,
```

`initialValues.start_time` is literally a canonical block's `start_time`
(the cell already knows its own block), so it drops straight into the same
`start_time` field the block `<select>` reads — no separate resolution
needed at this stage. The existing mount-time `useEffect` that pre-populates
`filteredSubjects` for edit mode is extended to also run for the free-cell
create case, so the subject list is correctly filtered for the preselected
group immediately, not only after the admin manually reselects the group:

```ts
useEffect(() => {
  if (isEditSession) {
    selectingGroup(editValues.group_id);
  } else if (initialValues?.group_id) {
    selectingGroup(initialValues.group_id);
  }
}, [isEditSession, editValues.group_id, initialValues?.group_id, selectingGroup]);
```

This preserves the existing, already-`useCallback`-memoized `selectingGroup`
(from the `eliminate-eslint-baseline` change) and its render-loop safety
reasoning unchanged — only one new, narrowly-scoped branch is added to an
effect that already exists.

**4. How does edit mode handle an invalid legacy interval?**

On mount, `CreateEditScholarSchedule` computes, once, from the record being
edited (not from any admin input):

```ts
const editedBlock = isEditSession
  ? getBlockByTimes(editValues.start_time, editValues.end_time)
  : undefined;
```

- If `editedBlock` is found (the common case — every row created after
  this change, and any legacy row that happens to already be valid), the
  block `<select>`'s `defaultValues.start_time` is set to
  `editedBlock.start_time` (identical to today's behavior for valid rows —
  no visible change).
- If `editedBlock` is `undefined` (the invalid-legacy-data case), the
  computed `defaultValues.start_time` for that field is **omitted**
  (left as `""`, matching the field's own `"Seleccione..."` empty option) —
  the system does not guess. A visible warning renders directly above the
  "Bloque horario" `FormRow`:
  `El intervalo actual (${editValues.start_time}–${editValues.end_time}) no corresponde a un bloque válido. Seleccione el bloque correcto para continuar.`
  The field's existing `required` validation (`register("start_time", { required: ... })`)
  already blocks submission until the admin explicitly picks one of the 4
  blocks — no new validation mechanism needed, just the warning and the
  deliberately-omitted default. This satisfies the request's constraint
  that the system must not automatically split or reinterpret an invalid
  row (constraint 19) while still routing the admin through the existing,
  familiar edit flow to fix it (constraint 20's "manual correction").

**5. How does service/mutation validation prevent invalid intervals from
being inserted directly?**

`apiScheduleAssignments.ts`'s `createEditScheduleAssignments()` — the one
function both the create and edit mutation hooks actually call — gains one
new check, placed alongside its existing `worker_id`/`semester_id`
presence checks, before the insert/update query is built:

```ts
if (
  typeof newScheduleAssignment.start_time !== "string" ||
  typeof newScheduleAssignment.end_time !== "string" ||
  !isCanonicalBlock(newScheduleAssignment.start_time, newScheduleAssignment.end_time)
) {
  throw new Error("El horario debe corresponder a un bloque académico válido.");
}
```

This runs unconditionally for both create and edit, since this form always
submits every registered field together (there is no partial-field-update
path) — matching the existing unconditional `worker_id` check. This closes
the gap a UI-only restriction can't: a direct API call, a stale form
session, or a manipulated payload cannot insert or update a row with a
non-canonical interval, regardless of which caller is used. The unrelated,
already-confirmed-dead `createScheduleAssignments()` function (no live
callers — the mutation hooks both use `createEditScheduleAssignments`) is
not touched.

**6. How are teacher assigned hours calculated from canonical blocks?**

Unchanged. Every hour-counting site (`ShowTeacherSchedule.tsx`,
`TeacherAssignment.tsx`, `TeacherAssignmentPDF.tsx`,
`WorkerSheetSemester.tsx`) already computes `rowCount * 2`. Once this
change guarantees every new/edited row is exactly one 2-hour canonical
block, that formula is — and remains — exactly correct. No file in this
group is touched.

**7. Do existing summaries and PDFs already count rows as 2 hours, or do
they need adjustment?**

Already correct, confirmed by inspection (Decision 6) — no adjustment
needed anywhere. The only residual concern is pre-existing: an invalid
legacy row (spanning what should be 2 blocks) is currently under-counted
as 2 hours instead of 4 by this same formula, silently. This change does
not alter the formula to compensate for bad data (that would obscure the
problem further); it surfaces the bad row instead (Decision 8) so it can
be corrected at the source, after which the existing formula is correct
for it too.

**8. How are invalid existing rows detected and surfaced for manual
correction?**

`ShowScholarSchedule.tsx` already computes `filteredSchedules` (the
currently-selected group's rows). A new derived value,

```ts
const invalidSchedules = useMemo(
  () => filteredSchedules.filter((s) => !isCanonicalBlock(s.start_time, s.end_time)),
  [filteredSchedules]
);
```

is used to render a small warning banner above the table whenever
`invalidSchedules.length > 0`, listing each affected row's weekday,
subject, teacher, and raw `start_time`–`end_time` (enough detail to find
and open it for editing — the click target is "open the edit modal for
this row," reusing the existing edit entry point unchanged). This is
scoped to the selected group (matching what the table already displays),
not a semester-wide scan — see the Open Questions below for the explicit
trade-off. Nothing about this banner touches `scheduleAssignments` data;
it's a pure read/render addition.

**9. Does the top-level manual Add button remain?**

Yes, unchanged in placement and behavior (`ScholarSchedule.tsx`'s
`+ Agregar horario escolar` button, `ActionsBar`). It renders the same
`CreateEditScholarSchedule` component this change updates, so it
automatically gains the single canonical-block selector — no separate
implementation, no code change to `ScholarSchedule.tsx` itself. It
continues to require the admin to pick weekday and group manually (no
cell-derived preselection, since it has no cell context) — matching its
current fully-manual behavior exactly, per the request's explicit
allowance ("may remain as a secondary path").

**10. Manual tests required (see `tasks.md` for the full checklist)**

All 4 canonical blocks create and edit correctly; the block `<select>`
never offers a 5th, non-canonical option; conflict detection still blocks
an overlapping worker/group submission for a canonical block; the
free-cell Add flow across at least 2 different weekdays/blocks correctly
preselects semester, group, and block while leaving subject/teacher empty;
occupied-cell edit/delete controls are unaffected; editing a deliberately
-inserted invalid legacy row (e.g. a test `07:00:00`–`11:10:00` row) shows
the warning and an unselected block, and saving after picking a valid
block corrects it; the invalid-row banner appears for that test row and
disappears once corrected; teacher assignment totals and the 4 PDF
exporters remain visually correct for valid data.

## No-migration justification (constraint: only add one if design proves
it required)

Not required. Reasoning:
- No `CHECK` constraint exists on `schedule_assignments` today (confirmed
  via `supabase/migrations/20260702000000_remote_schema.sql`) — there is no
  existing DB-level guarantee this change would be "removing."
- Retrofitting a `CHECK` constraint onto a table that already contains at
  least one known-invalid row requires `ADD CONSTRAINT ... CHECK (...) NOT VALID`
  (a standard constraint would fail to apply at all against existing bad
  data) plus a separate, later `VALIDATE CONSTRAINT` step once legacy rows
  are corrected — meaningfully more scope than this change's stated goal.
- The service-layer check (Decision 5) already closes the "any caller,
  not just the UI" gap the request is concerned about — the same
  reasoning and precedent as the immediately-prior `generate-next-semester`
  change's Decision 6 (duplicate/sequential-order enforcement kept at the
  application layer, DB uniqueness deferred as a non-blocking follow-up).
- Flagged here as a legitimate future hardening step, not silently
  dropped — worth a dedicated follow-up once (or if) all legacy invalid
  rows are corrected, at which point `NOT VALID` wouldn't even be needed.

## Risks / Trade-offs

- **Prop-threading depth (3 components, ~10+ call sites in
  `RowScholarSchedule.tsx` alone)**: mechanical but must be complete — a
  missed call site fails at `bun run typecheck`, not silently, once
  `HourScheduleSubject`'s new props become required. Verified by running
  typecheck as part of this change's own verification, not assumed.
- **Invalid-legacy-data UX (Decision 4)**: the admin must understand *why*
  the block field is empty on first opening an invalid row's edit form.
  Mitigated by the explicit warning message rather than a bare validation
  error only surfacing on submit attempt.
- **Warning banner scope (Decision 8)**: limited to the selected group,
  not semester-wide. An admin who never selects a group containing an
  invalid row won't see it flagged. Accepted as the minimal, consistent-
  with-existing-architecture choice; flagged as an explicit open question
  rather than silently expanding scope to a semester-wide scan.
- **No DB-level enforcement (see justification above)**: a direct SQL
  write (outside the app entirely) could still insert a non-canonical
  interval. Accepted — the same class of residual risk already accepted
  for semester-code duplicate/sequential enforcement in the prior change,
  and outside what any application-layer change can close.
