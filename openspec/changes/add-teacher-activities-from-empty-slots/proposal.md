## Why

`CreateEditTeacherSchedule.tsx` exposes two fully independent `<Select>`
fields, "Hora Inicio" and "Hora Fin", each populated from
`src/helpers/constants.ts`'s `START_TIMES`/`END_TIMES` lists. Nothing ties
one to the other — an admin can pick `07:00` as the start and `13:00` as
the end, producing a `schedule_teachers` row that spans three academic
blocks plus two recesses. This is the exact class of data-entry error the
immediately-prior change (`add-schedules-from-empty-slots`, now archived as
the `scholar-schedule-canonical-blocks` capability) already fixed for
`schedule_assignments`. Teacher activities have never received the same
fix, even though every hour-counting site that reads `schedule_teachers`
(`ShowTeacherSchedule.tsx`, `TeacherAssignment.tsx`,
`TeacherAssignmentPDF.tsx`, `WorkerSheetSemester.tsx`) already assumes one
row equals one block equals 2 hours — the same latent assumption the
scholar-side change found and enforced.

Teacher activities are not identical to scholar assignments, though: they
have one extra legitimate block (17:00–19:00, the extracurricular slot
`RowTeacherSchedule.tsx` already conditionally renders), no `group_id`
(only `worker_id`), and their own service function, table renderer, and
conflict cross-check against scholar assignments. This proposal brings
`schedule_teachers` to the same canonical-block discipline and empty-cell
creation UX scholar assignments already have, without merging the two
entities' rules together.

Separately, `HourScheduleSubjectTeacher.tsx` renders an empty teacher-
schedule cell as a bare `<p></p>` with no way to create an activity
directly from that cell, and `ShowTeacherSchedule.tsx` currently gates the
entire grid on `recordExist` (`filteredSchedulesTeacher.length > 0 ||
filteredSchedulesAssignments.length > 0`) — a teacher with zero existing
activities and zero scholar assignments sees no grid at all, only the
table header. This is the same empty-state gating bug the scholar-side
change shipped with and had to fix after a code-review finding; this
proposal's design applies that lesson from the start instead of
re-discovering it.

## What Changes

- Add `src/features/schedules/teacherScheduleBlocks.ts`, a new module that
  re-exports the 4 shared canonical blocks from the existing
  `scheduleBlocks.ts` (no duplication of those 4 intervals) and appends the
  teacher-only 5th block (17:00:00–19:00:00), exposing
  `TEACHER_SCHEDULE_BLOCKS`, `getTeacherBlockByStartTime`,
  `getTeacherBlockByTimes`, `isCanonicalTeacherBlock`. `scheduleBlocks.ts`
  itself is not modified — the dependency runs one way (teacher module
  reads from the scholar module), so scholar behavior cannot regress.
- Replace `CreateEditTeacherSchedule.tsx`'s two independent "Hora Inicio"/
  "Hora Fin" selects with one selector labeled "Bloque horario", populated
  from `TEACHER_SCHEDULE_BLOCKS`. The selected block's start time is the
  form's only registered time field; `end_time` is resolved from the same
  list at submit time, before the existing conflict check and the existing,
  unmodified `create`/`edit` mutations run.
- `apiScheduleTeachers.ts`'s `createEditScheduleTeachers()` — the one
  function both the create and edit mutation hooks call — rejects any
  `start_time`/`end_time` pair that doesn't exactly match one of the 5
  canonical teacher blocks, before every insert or update.
- `HourScheduleSubjectTeacher.tsx` renders an accessible, native `<button>`
  Add action in every free teacher-schedule cell (replacing the current
  empty `<p></p>`), opening `CreateEditTeacherSchedule` with the current
  semester, the selected teacher, the cell's weekday, and the cell's
  canonical block preselected — activity text is left for the admin to
  enter. This requires threading `workerId`/`workerLabel` (the selected
  teacher, not previously available at this depth) down through
  `ShowTeacherSchedule.tsx` → `RowTeacherSchedule.tsx` →
  `HourScheduleSubjectTeacher.tsx`, alongside the `semesterId` that
  already reaches that depth.
- `ShowTeacherSchedule.tsx` renders the full grid (and every applicable
  cell's Add action) as soon as a teacher is selected, even with zero
  existing activities/assignments — fixing the `recordExist` gate before
  it ships, rather than after — while keeping `ScheduleTeacherPDF` gated
  on `recordExist` (a PDF with nothing to show has no reason to render its
  button), matching the scholar-side change's corrected pattern exactly.
- Editing an existing activity whose stored `start_time`/`end_time`
  doesn't match any canonical teacher block leaves the block selector
  unselected and shows an explicit warning, exactly mirroring the scholar-
  side invalid-legacy-row handling — no guessing, no silent
  normalization.
- `ShowTeacherSchedule.tsx` gains a small, read-only warning banner
  listing any currently-displayed (selected-teacher) activity whose
  stored interval doesn't match a canonical teacher block.
- The top-level "+ Agregar horario de actividades" button
  (`TeacherSchedule.tsx`) is unchanged in placement, label, and behavior;
  it opens the same, now-updated `CreateEditTeacherSchedule` form, so it
  automatically gets the single canonical-block selector too, with no
  teacher/weekday/block preselected (matching its current fully-manual
  behavior).
- No change to `detectScheduleConflict.ts`: `hasWorkerConflict` already
  works correctly across the combined `[...scheduleTeachers,
  ...scheduleAssignments]` array regardless of which table a row comes
  from or whether its interval is canonical.
- No PDF exporter file changes: every PDF/summary that counts hours already
  groups by unique activity text and multiplies `quantity * 2` (or sums
  `length * 2`) per row, without branching on the specific `start_time` —
  the 17:00–19:00 block is already counted correctly today, and stays
  correct without any code change (documented in `design.md`).
- No database migration, no change to `src/helpers/constants.ts`'s
  `WEEKDAYS`/`START_TIMES`/`END_TIMES` (only `START_TIMES`/`END_TIMES`
  become unused by `CreateEditTeacherSchedule.tsx` as a result of this
  change; they are not deleted — an explicitly out-of-scope cleanup, not
  silently dropped), and no existing `schedule_teachers` row is modified,
  split, or deleted.

## Capabilities

**New Capabilities:**
- `teacher-schedule-canonical-blocks`: covers the 5 canonical teacher-
  activity blocks, the single "Bloque horario" selector, block-derived
  `start_time`/`end_time`, service-layer validation, the free-cell Add
  flow, the zero-activity-teacher rendering fix, and invalid-legacy-data
  detection/reporting for `schedule_teachers`.

**Modified Capabilities:**
- `schedule-typescript-safety`: two requirements need narrow updates —
  "Schedule list/table rendering SHALL be preserved" (free teacher-schedule
  cells now render an Add action instead of an empty cell, and a selected
  teacher with zero records now renders the full grid) and "Teacher
  schedule (activity) create/edit/delete behavior SHALL be preserved" (the
  form's time-selection mechanism changes from two independent selects to
  one canonical-block selector; conflict detection, mutation calls, and
  payload shape are unaffected, and every other scenario under both
  requirements is unchanged).

## Impact

- Affected code: `src/features/schedules/CreateEditTeacherSchedule.tsx`,
  `src/features/schedules/HourScheduleTeacher.tsx`,
  `src/features/schedules/RowTeacherSchedule.tsx`,
  `src/features/schedules/ShowTeacherSchedule.tsx`,
  `src/services/apiScheduleTeachers.ts`.
- New file: `src/features/schedules/teacherScheduleBlocks.ts`.
- Not changed: `src/features/schedules/scheduleBlocks.ts` (read-only
  dependency, not modified), `src/features/schedules/CreateEditScholarSchedule.tsx`,
  `HourScheduleSubject.tsx`, `RowScholarSchedule.tsx`,
  `ShowScholarSchedule.tsx`, `ScholarSchedule.tsx` (scholar-schedule
  behavior is untouched), `src/features/schedules/HourScheduleSubjectGroup.tsx`
  (the read-only scholar-assignment half of each teacher-grid cell — out of
  scope, this change only adds an Add action to the teacher-activity half),
  `src/helpers/detectScheduleConflict.ts`, any PDF exporter under
  `src/pdf/**`, `src/helpers/constants.ts`, database schema, migrations,
  and no existing `schedule_teachers` row.
- No new dependencies.
- Risk is concentrated in: (1) threading `workerId`/`workerLabel` through
  `RowTeacherSchedule.tsx`'s existing multi-level `TimeSlotRow`/`DayCell`
  structure (more indirection than the scholar side's flatter
  `RowScholarSchedule.tsx`) — a missed pass-through fails at typecheck,
  not silently; (2) getting the `ShowTeacherSchedule.tsx` empty-state gate
  right without repeating the scholar-side mistake of tying it to
  `recordExist`; (3) the service-layer validation needing to apply
  identically to both create and edit without adding unrelated
  field-presence checks `createEditScheduleTeachers()` doesn't already have
  (out of scope — a pre-existing gap, not this change's concern).
