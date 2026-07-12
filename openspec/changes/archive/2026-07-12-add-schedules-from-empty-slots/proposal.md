## Why

`CreateEditScholarSchedule.tsx` currently exposes two fully independent
`<Select>` fields, "Hora de inicio" and "Hora Fin", each populated from a
hardcoded list of start/end times. Nothing ties one to the other — an
admin can pick `07:00` as the start and `11:10` as the end, producing a
`schedule_assignments` row spanning two academic blocks
(07:00–08:50 and 09:20–11:10) plus the 8:50–9:20 recess in between. This
was never an intended "multi-block" assignment; it is a data-entry error
the form's own design makes trivially easy to commit, and at least one such
row (`07:00–11:10`) already exists in real data.

The school's actual scheduling policy has exactly four valid academic
blocks per day, each worth 2 assigned hours. Every hour-counting site in
the codebase (`TeacherAssignment.tsx`, `ShowTeacherSchedule.tsx`,
`TeacherAssignmentPDF.tsx`, `WorkerSheetSemester.tsx`) already computes
hours as `rowCount * 2` — i.e., the codebase already assumes one row equals
one block equals 2 hours everywhere it counts hours. The only place that
assumption isn't enforced is the form that creates the rows in the first
place. A `07:00–11:10` row silently breaks that assumption (it's really 2
blocks' worth of time counted as 1), and nothing today detects or reports
this.

Separately, `HourScheduleSubject.tsx` renders an empty scholar-schedule
cell as a plain `--` with no way to create a schedule directly from that
cell — every new assignment must go through the top-level "+ Agregar
horario escolar" button, re-entering weekday, group, and time from
scratch even though the table cell the admin clicked already implies all
three.

## What Changes

- Replace `CreateEditScholarSchedule.tsx`'s two independent time selects
  with one selector labeled "Bloque horario", populated from a new
  canonical-blocks list (07:00–08:50, 09:20–11:10, 11:10–13:00,
  13:10–15:00). The selected block's start time is the form's only
  registered time field; its end time is resolved from the same canonical
  list at submit time, immediately before calling the existing, unmodified
  `create`/`edit` mutations — the `schedule_assignments` payload shape
  (`start_time`, `end_time`, plus every other column) does not change.
- Add a new canonical-blocks helper (`src/features/schedules/scheduleBlocks.ts`)
  that is the single source of truth for the 4 valid blocks, used by both
  the form (UI-level restriction) and the service layer (defense-in-depth
  validation for direct/manipulated calls).
- `apiScheduleAssignments.ts`'s `createEditScheduleAssignments()` rejects
  any `start_time`/`end_time` pair that doesn't exactly match one canonical
  block, before every insert or update — closing the gap a UI-only
  restriction can't close.
- `HourScheduleSubject.tsx` renders an "Add" action in every free scholar-
  schedule cell (replacing the current `--` placeholder), opening
  `CreateEditScholarSchedule` with the current semester, the selected
  group, the cell's weekday, and the cell's canonical block preselected —
  subject and teacher are left for the admin to choose. The preselected
  block can be changed, but only to one of the 4 canonical blocks. This
  requires threading `semesterId` and the selected `groupId` down through
  `ShowScholarSchedule.tsx` → `RowScholarSchedule.tsx` →
  `HourScheduleSubject.tsx` (currently only `weekday`/`startTime` flow
  that far).
- Editing an existing row whose stored `start_time`/`end_time` doesn't
  match any canonical block (the invalid-legacy-data case) leaves the new
  block selector unselected and shows an explicit warning, rather than
  guessing which block was intended or silently normalizing the interval
  on save — the admin must explicitly pick the correct block before the
  row can be saved.
- `ShowScholarSchedule.tsx` gains a small, read-only warning banner
  listing any currently-displayed (selected-group) row whose stored
  interval doesn't match a canonical block, so invalid legacy data is
  discoverable without having to notice a subtly-wrong end time in the
  grid.
- The top-level "+ Agregar horario escolar" button (`ScholarSchedule.tsx`)
  is unchanged in placement and behavior; it opens the same, now-updated
  `CreateEditScholarSchedule` form, so it automatically gets the single
  canonical-block selector too, with no group/weekday/block preselected
  (matching its current fully-manual behavior).
- No PDF exporter file changes: every PDF's hour-counting formula is
  already `rowCount * 2`, and empty-cell PDF text (`filterHour.ts`'s `"--"`
  fallback) has no interactive equivalent to add — a static document has
  no "Add" affordance to render.
- No database migration: no `CHECK` constraint exists on
  `schedule_assignments.start_time`/`end_time` today, and retrofitting one
  onto a table that already contains an invalid row would require an
  explicit `NOT VALID` migration plus a follow-up validation pass — out of
  scope for a change whose validation goal is fully met by UI + service
  layer enforcement (see `design.md` Decision 9).
- No existing row is modified, split, or deleted by this change.

## Capabilities

**New Capabilities:**
- `scholar-schedule-canonical-blocks`: covers the 4 canonical academic
  blocks, the single "Bloque horario" selector, block-derived
  `start_time`/`end_time`, service-layer validation, the free-cell Add
  flow, and invalid-legacy-data detection/reporting.

**Modified Capabilities:**
- `schedule-typescript-safety`: two requirements need narrow updates —
  "Schedule list/table rendering SHALL be preserved" (free scholar-schedule
  cells now render an Add action instead of `--`) and "Schedule assignment
  (scholar) create/edit/delete behavior SHALL be preserved" (the form's
  time-selection mechanism changes from two independent selects to one
  canonical-block selector; conflict detection, mutation calls, and payload
  shape are unaffected and every other scenario under both requirements is
  unchanged).

## Impact

- Affected code: `src/features/schedules/CreateEditScholarSchedule.tsx`,
  `src/features/schedules/HourScheduleSubject.tsx`,
  `src/features/schedules/RowScholarSchedule.tsx`,
  `src/features/schedules/ShowScholarSchedule.tsx`,
  `src/features/schedules/ScholarSchedule.tsx` (prop threading only),
  `src/services/apiScheduleAssignments.ts`.
- New file: `src/features/schedules/scheduleBlocks.ts`.
- Not changed: `src/helpers/detectScheduleConflict.ts` (interval-overlap
  math already works correctly for canonical blocks and for legacy invalid
  rows alike — confirmed by inspection, not modified), any PDF exporter
  under `src/pdf/**`, `src/features/schedules/HourScheduleTeacher.tsx` /
  `RowTeacherSchedule.tsx` / `CreateEditTeacherSchedule.tsx` (teacher
  activities use a different table and legitimately need the existing
  17:00–19:00 extracurricular block — out of scope, this change is scoped
  to `schedule_assignments` only), `src/helpers/constants.ts`'s
  `START_TIMES`/`END_TIMES` (still used by teacher activities, untouched),
  database schema, migrations, and no existing `schedule_assignments` row.
- No new dependencies.
- Risk is concentrated in: (1) the free-cell Add flow's prop threading
  through 3 intermediate components, each with several existing call
  sites that must all receive the new props correctly — a missed one fails
  loudly at typecheck, not silently; (2) the invalid-legacy-data edit
  path, which must neither guess a block nor silently pass validation with
  a mismatched interval; (3) the service-layer validation needing to
  apply identically to both the create and edit paths of
  `createEditScheduleAssignments()` without affecting any other field's
  existing validation.
