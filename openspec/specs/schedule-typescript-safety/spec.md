# schedule-typescript-safety Specification

## Purpose
TBD - created by archiving change plan-schedules-typescript-migration. Update Purpose after archive.
## Requirements
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

### Requirement: Group schedule (scholar-schedule-by-group) selection behavior SHALL be preserved

The system SHALL preserve `ShowScholarSchedule.jsx`'s group-selection and
filtering behavior: selecting a group in the dropdown filters
`scheduleAssignments` to that group's `group_id` and renders only the
matching rows, exactly as today.

#### Scenario: Selecting a group filters the displayed schedule

- WHEN a user selects a group from the group dropdown
- THEN the system SHALL filter the full `scheduleAssignments` array to only
  records whose `group_id` matches the selected group's id (numeric
  comparison via unary `+`, matching current behavior) and SHALL render
  `RowScholarSchedule` only when at least one match exists

#### Scenario: No group selected shows no schedule table body

- WHEN no group is selected (initial state)
- THEN the system SHALL render zero filtered schedules, matching the current
  `if (!selectedGroupId) return [];` short-circuit

### Requirement: React Query and Supabase call behavior SHALL be preserved exactly

The system SHALL preserve every existing React Query `staleTime` (or absence
of one), cache-invalidation call, and Supabase mutation (insert/update/delete)
shape used by the schedules feature's hooks and services. For the two read
queries (`useScheduleAssignments`, `useScheduleTeachers`), the `queryKey` and
underlying `select()` call SHALL include a `semester_id` filter scoped to the
currently-selected semester, per the `schedule-semester-scoped-queries`
capability — this requirement no longer asserts those two reads stay
byte-for-byte unscoped, but does still require every other aspect of their
behavior, and all mutation behavior, to remain unchanged.

#### Scenario: Query keys and invalidation targets are unchanged

- WHEN any schedules hook (`useScheduleAssignments`, `useScheduleTeachers`,
  `useCreateScheduleAssignments`, `useEditScheduleAssignments`,
  `useDeleteScheduleAssignment`, `useCreateScheduleTeacher`,
  `useEditScheduleTeacher`, `useDeleteScheduleTeacher`) runs after this
  change
- THEN the two read hooks' `queryKey` SHALL be `["scheduleAssignments", semesterId]`
  / `["scheduleTeachers", semesterId]` — semester-scoped, not the old bare
  `["scheduleAssignments"]` / `["scheduleTeachers"]` — but SHALL remain
  prefix-compatible with the existing invalidation targets: every mutation
  hook SHALL continue to call
  `queryClient.invalidateQueries({ queryKey: ["scheduleAssignments"] })` /
  `["scheduleTeachers"]` unchanged, and that call SHALL still invalidate the
  semester-scoped query key via TanStack Query's default prefix matching
- AND each hook SHALL call the same `apiScheduleAssignments.ts`/
  `apiScheduleTeachers.ts` function with the same arguments as before,
  aside from the two read functions now also receiving `semesterId`

#### Scenario: Supabase select/insert/update/delete shapes are unchanged

- WHEN a schedules hook reads or writes data
- THEN the underlying Supabase call's selected columns and embedded
  relations (e.g. `getScheduleAssignments()`'s `select("*, workers(id, name),
  subjects(id, name), groups(id, year_of_admission, letter, degrees(id,
  code, name)), semesters(id, school_year)")`, or `getScheduleTeachers()`'s
  `select("*, workers(*), semesters(*)")`) SHALL remain unchanged, and every
  mutation call (`insert`, `update`, `.eq("id", id)`, `delete`) SHALL remain
  exactly as it is today
- AND the only change to either read function's `select()` call SHALL be an
  additional `.eq("semester_id", semesterId)` filter, scoping which rows are
  returned without altering which columns/relations are selected or how
  writes are performed

#### Scenario: Read query staleTime is unchanged

- WHEN `useScheduleAssignments`/`useScheduleTeachers` runs
- THEN it SHALL keep the existing `staleTime: 30 * 1000` behavior, unaffected
  by the added `semesterId` parameter and `enabled` guard

### Requirement: Existing route/page integration SHALL be preserved

The system SHALL preserve `src/pages/ScheduleDashboard.tsx`'s existing
integration with the schedules feature: its `SemesterContext` shape and
value, its tab-switching behavior between scholar and teacher schedules, and
every prop it passes into `ScholarSchedule`/`TeacherSchedule`.

#### Scenario: SemesterContext consumers keep receiving the same shape

- WHEN `CreateEditScholarSchedule` (or any future consumer) reads
  `useContext(SemesterContext)`
- THEN it SHALL receive the same `{ groups, workers, subjects,
  scheduleAssignments }` shape that `ScheduleDashboard.tsx` already provides,
  unchanged by this migration

#### Scenario: Tab switching behavior is unchanged

- WHEN a user switches between "Horario Escolar" and "Horario del Maestro" on
  the schedule dashboard
- THEN the same `ScholarSchedule`/`TeacherSchedule` components SHALL mount
  with the same props as before migration

### Requirement: PDF exporter files SHALL be explicitly excluded from this migration

The system SHALL NOT convert, rename, or modify any file under `src/pdf/**`
(including `src/pdf/Schedules/ScheduleGroupPDF.jsx`,
`ScheduleTeacherPDF.jsx`, `TeacherAssignmentPDF.jsx`, and
`src/pdf/WorkerSheetSemester.jsx`) as part of the schedules TypeScript
migration this capability governs. Any typing friction this causes in a
converted schedules file (e.g. a component that renders a PDF exporter with
props the exporter's untyped defaults narrow incorrectly) SHALL be resolved
with a local, type-only cast at the schedules-file call site, not by
converting the PDF file.

#### Scenario: A converted schedule component still renders an unconverted PDF exporter

- WHEN `ShowScholarSchedule.tsx` (post-migration) renders
  `<ScheduleGroupPDF schedules={filteredSchedules} />`
- THEN `ScheduleGroupPDF.jsx` SHALL remain a `.jsx` file, untouched by this
  migration, and any type mismatch between the two SHALL be resolved with a
  local cast in `ShowScholarSchedule.tsx`, not a change to
  `ScheduleGroupPDF.jsx`

### Requirement: Pre-existing bug handling

The migration SHALL identify pre-existing schedule bugs and MUST NOT silently
fix them unless `design.md` marks them as explicitly authorized fixes. Where
research for this migration identifies real, pre-existing bugs (not
migration-created friction) in the schedules feature, the plan records them
as known issues in `design.md`'s Closed Decisions section, and the
implementation does not change observable behavior for any such bug beyond
what that section explicitly authorizes.

#### Scenario: A pre-existing bug is preserved by default

- WHEN a migrated file contains a bug that predates this migration and is not
  listed in `design.md`'s Closed Decisions as an authorized fix
- THEN the migrated TypeScript version SHALL preserve the exact same runtime
  behavior, including the bug, unmodified

#### Scenario: An explicitly authorized fix is applied, and only that fix

- WHEN a bug is listed in `design.md`'s Closed Decisions as an explicitly
  authorized fix (schedule mutation hooks' `isLoading` → `isPending`, or
  `HourScheduleTeacher`'s undefined `setEditModal` reference)
- THEN the implementation SHALL apply that specific fix and MUST NOT extend
  it into a broader redesign, refactor, or behavior change beyond what
  `design.md` describes for that decision

