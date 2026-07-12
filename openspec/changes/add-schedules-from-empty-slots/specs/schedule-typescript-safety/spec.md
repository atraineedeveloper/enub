## MODIFIED Requirements

### Requirement: Schedule list/table rendering SHALL be preserved

The system SHALL render the scholar-schedule table (`RowScholarSchedule`,
`HourScheduleSubject`, `HourScheduleSubjectGroup`) and the teacher-schedule
table (`RowTeacherSchedule`, `HourScheduleTeacher`) with the same rows,
columns, time slots, and cell contents as before, for the same input data
— except that, per the `scholar-schedule-canonical-blocks` capability, a
free (unassigned) scholar-schedule cell now renders an Add action instead
of the previous `--` placeholder. Every occupied cell's content, and every
teacher-schedule cell, is unaffected.

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
  17:00:00, matching the pre-existing `hasExtraHours` condition exactly

### Requirement: Schedule assignment (scholar) create/edit/delete behavior SHALL be preserved

The system SHALL preserve the create, edit, and delete behavior of scholar
schedule assignments — including its worker/group time-conflict detection,
which mutation function is called, and the payload-stripping behavior on
edit — exactly as before, except that `start_time`/`end_time` are now
selected via a single canonical-block selector rather than two independent
fields, per the `scholar-schedule-canonical-blocks` capability. The
`schedule_assignments` payload shape itself (which columns are submitted)
is unchanged.

#### Scenario: Creating a new scholar schedule assignment

- WHEN a user submits the scholar schedule form with no `scheduleToEdit`
- THEN the system SHALL call the create path (`createScheduleAssignments`
  from `useCreateScheduleAssignments`) with the submitted fields plus the
  resolved `semester_id`, with `start_time`/`end_time` derived from the
  selected canonical block rather than independently submitted
- AND SHALL block submission with an error toast if `hasWorkerConflict` or
  `hasGroupConflict` detects an overlapping existing assignment for the
  same weekday/time range

#### Scenario: Editing an existing scholar schedule assignment

- WHEN a user submits the scholar schedule form with an existing
  `scheduleToEdit.id`
- THEN the system SHALL call the edit path (`editScheduleAssignment` from
  `useEditScheduleAssignment`) with the same `id`, excluding that same
  record's own id from conflict detection
- AND SHALL strip the embedded `groups`/`semesters`/`subjects`/`workers`
  relation objects from the payload before submitting, exactly as the
  pre-existing `delete data.groups` / `delete data.semesters` /
  `delete data.subjects` / `delete data.workers` calls do

#### Scenario: Opening the edit form visibly preloads every stored field

- WHEN an admin opens the edit form for a valid existing scholar schedule
  assignment (one whose stored `start_time`/`end_time` matches a canonical
  block)
- THEN the weekday, group, subject, canonical block, and worker selectors
  SHALL all show the stored value as visibly selected once the form has
  finished loading — including the subject, whose options are only
  available once populated for the assignment's stored group — so the
  admin can save without having to reselect any of them
- AND opening the edit form for a second, different assignment (a
  different group/subject combination) immediately afterward SHALL show
  that second assignment's own stored values, with no leftover selection
  from the previously-opened assignment

#### Scenario: Changing the group during an edit clears an incompatible subject

- WHEN an admin, while editing an existing assignment, selects a different
  group whose valid subjects do not include the currently-selected subject
- THEN the subject options SHALL be recalculated for the newly-selected
  group and the subject selection SHALL be cleared, requiring the admin to
  choose a subject that is valid for the new group before saving
- AND if the admin instead re-selects the same group the assignment
  already had, the subject selection SHALL remain unchanged

#### Scenario: Deleting a scholar schedule assignment

- WHEN a user confirms deletion of a scholar schedule assignment row
- THEN the system SHALL call `deleteScheduleAssignment` with that row's `id`
  and SHALL invalidate the `["scheduleAssignments"]` query key on success,
  matching current behavior
