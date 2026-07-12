## MODIFIED Requirements

### Requirement: Schedule list/table rendering SHALL be preserved

The system SHALL render the scholar-schedule table (`RowScholarSchedule`,
`HourScheduleSubject`, `HourScheduleSubjectGroup`) and the teacher-schedule
table (`RowTeacherSchedule`, `HourScheduleTeacher`) with the same rows,
columns, time slots, and cell contents as before, for the same input data
— except that, per the `scholar-schedule-canonical-blocks` capability, a
free (unassigned) scholar-schedule cell renders an Add action instead of
the previous `--` placeholder, and, per the
`teacher-schedule-canonical-blocks` capability, a free (unassigned)
teacher-activity cell renders an Add action instead of the previous empty
placeholder, and a selected teacher with zero `schedule_teachers`/
`schedule_assignments` rows now renders the full grid instead of only the
table header. Every occupied cell's content, and the read-only scholar-
assignment half of each teacher-grid cell
(`HourScheduleSubjectGroup`), is unaffected. Add, Edit, and Delete
controls in both tables SHALL share a consistent, visibly-styled,
accessible button treatment (`ScheduleActionButton`/`ScheduleActionsRow`).
The teacher table's Monday 07:00–08:50 cell SHALL render either nothing
(when the selected teacher's computed `totalHours` is not exactly 40) or a
read-only "Homenaje / Tutoría" reserved-slot indicator (when it is exactly
40) — a derived institutional reservation, never a `schedule_teachers`
row — with no Add action available in either case for that specific cell
when reserved.

#### Scenario: Add, Edit, and Delete controls share a consistent, accessible design across both timetables

- WHEN the scholar-schedule table or the teacher-schedule table renders an
  Add, Edit, or Delete control
- THEN it SHALL be a native, focusable `<button type="button">` with a
  visible bordered surface, hover and active states, a descriptive
  `aria-label`, and a `title` tooltip ("Agregar horario"/"Editar
  horario"/"Eliminar horario" for the scholar table; "Agregar
  actividad"/"Editar actividad"/"Eliminar actividad" for the teacher
  table), using the shared `ScheduleActionButton`/`ScheduleActionsRow`
  components rather than a bare icon or `&nbsp;`-separated spacing
- AND Delete SHALL be visually distinguished by more than color alone
  (its distinct icon shape and label already differ from Edit's)

#### Scenario: Scholar schedule table renders identical time-slot grid

- WHEN a semester has scholar schedule assignments for a given group
- THEN the table SHALL show the same weekday columns (Lunes–Viernes), the
  same time-slot rows (7:00–8:50, 9:20–11:10, 11:10–13:00, 13:10–15:00,
  plus the two RECESO rows), and the same per-cell subject/teacher/group
  text for every occupied cell as before, for identical input data — a
  free cell renders an Add action (per `scholar-schedule-canonical-blocks`)
  in place of the previous `--` placeholder

#### Scenario: Teacher schedule table renders identical time-slot grid, including extra hours

- WHEN a selected teacher has schedule assignments and/or activities in the
  17:00–19:00 extracurricular block
- THEN the table SHALL show the same base time-slot rows as before, AND
  SHALL conditionally render the "HORARIO EXTRACURRICULAR" row and the
  17:00–19:00 row only when at least one schedule or activity exists at
  17:00:00, matching the pre-existing `hasExtraHours` condition exactly —
  a free cell in any rendered row renders an Add action (per
  `teacher-schedule-canonical-blocks`) in place of the previous empty
  placeholder

#### Scenario: A selected teacher with zero existing records still renders the full grid

- WHEN an admin selects a teacher who has no `schedule_teachers` rows and
  no `schedule_assignments` rows for the current semester
- THEN the teacher-schedule table SHALL still render every applicable row
  and cell (not just the table header), per
  `teacher-schedule-canonical-blocks`, while the `ScheduleTeacherPDF`
  export button SHALL remain gated on the existing `recordExist` condition,
  unchanged

#### Scenario: The Monday 07:00–08:50 cell reflects the derived Homenaje / Tutoría reservation, not a stored row

- WHEN the currently-selected teacher's computed `totalHours` is not
  exactly 40
- THEN the Monday 07:00–08:50 cell SHALL render no placeholder text (no
  `--`), and SHALL continue to offer its Add action like any other free
  cell
- WHEN the currently-selected teacher's computed `totalHours` is exactly
  40
- THEN that same cell SHALL render a read-only "Homenaje / Tutoría"
  indicator with a visually distinct reserved/occupied appearance, and
  SHALL NOT render an Add action for that cell — with no
  `schedule_teachers` row created, updated, or counted as a result

### Requirement: Teacher schedule (activity) create/edit/delete behavior SHALL be preserved

The system SHALL preserve the create, edit, and delete behavior of teacher
schedule activities — including its cross-check against both existing
teacher activities and scholar schedule assignments for the same worker,
which mutation function is called, and the default-value population on
edit — exactly as before, except that `start_time`/`end_time` are now
selected via a single canonical-block selector rather than two independent
fields, per the `teacher-schedule-canonical-blocks` capability. The
`schedule_teachers` payload shape itself (which columns are submitted) is
unchanged.

#### Scenario: Creating a new teacher activity

- WHEN a user submits the teacher activity form with no `scheduleToEdit`
- THEN the system SHALL call `createScheduleTeacher` with the submitted
  fields plus `semester_id`, with `start_time`/`end_time` derived from the
  selected canonical teacher block rather than independently submitted
- AND SHALL block submission with an error toast if `hasWorkerConflict`
  against the combined `[...scheduleTeachers, ...scheduleAssignments]` array
  detects an overlapping time range for the same worker

#### Scenario: Editing an existing teacher activity

- WHEN a user submits the teacher activity form with an existing
  `scheduleToEdit.id`
- THEN the system SHALL call `editScheduleTeacher` with that same `id`,
  excluding that record's own id from conflict detection, and SHALL
  preserve the existing default-value population from `scheduleToEdit`
  (excluding its embedded `semesters`/`workers` relation fields, matching
  the current destructure-and-discard pattern), with `start_time`/
  `end_time` resolved via the selected canonical teacher block rather than
  two independent fields

#### Scenario: Submitting Monday 07:00–08:50 for a 40-hour worker is rejected

- WHEN a user submits the teacher activity form (from any entry path —
  the top-level manual form, a free cell, or editing an existing activity
  into this slot) with `weekday` "Lunes" and the 07:00:00–08:50:00
  canonical block selected
- THEN the system SHALL compute the *submitted* `worker_id`'s total
  assigned hours from the full, semester-level `scheduleAssignments`/
  `scheduleTeachers` arrays — not the teacher originally selected in the
  table — and, if that total is exactly 40, SHALL block submission with a
  clear error toast and SHALL NOT call `createScheduleTeacher` or
  `editScheduleTeacher`
- AND changing the selected worker inside the form before submitting
  SHALL be evaluated against the newly-selected worker's own total hours,
  not the original teacher's

#### Scenario: Opening the edit form visibly preloads a valid activity

- WHEN an admin opens the edit form for a valid existing teacher activity
  (one whose stored `start_time`/`end_time` matches a canonical teacher
  block)
- THEN the weekday, teacher, activity text, and canonical block selectors
  SHALL all show the stored value as visibly selected once the form has
  finished loading, so the admin can save without having to reselect any
  of them

#### Scenario: A free-cell Add action preselects the currently-selected teacher

- WHEN an admin activates a free teacher-schedule cell's Add action
- THEN the opened form SHALL have the cell's implied teacher preselected
  as `worker_id` (not left blank), matching the fact that the teacher-
  schedule view is already scoped to one selected teacher, with only the
  activity text left for the admin to enter
