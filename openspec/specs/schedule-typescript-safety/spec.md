# schedule-typescript-safety Specification

## Purpose
TBD - created by archiving change plan-schedules-typescript-migration. Update Purpose after archive.
## Requirements
### Requirement: Schedule list/table rendering SHALL be preserved

The system SHALL render the scholar-schedule table (`RowScholarSchedule`,
`HourScheduleSubject`, `HourScheduleSubjectGroup`) and the teacher-schedule
table (`RowTeacherSchedule`, `HourScheduleTeacher`) with the same rows,
columns, time slots, and cell contents after migration as before it, for the
same input data.

#### Scenario: Scholar schedule table renders identical time-slot grid

- WHEN a semester has scholar schedule assignments for a given group
- THEN the migrated table SHALL show the same weekday columns (Lunes–Viernes),
  the same time-slot rows (7:00–8:50, 9:20–11:10, 11:10–13:00, 13:10–15:00,
  plus the two RECESO rows), and the same per-cell subject/teacher/group text
  as the pre-migration table, for identical input data

#### Scenario: Teacher schedule table renders identical time-slot grid, including extra hours

- WHEN a selected teacher has schedule assignments and/or activities in the
  17:00–19:00 extracurricular block
- THEN the migrated table SHALL show the same base time-slot rows as before,
  AND SHALL conditionally render the "HORARIO EXTRACURRICULAR" row and the
  17:00–19:00 row only when at least one schedule or activity exists at
  17:00:00, matching the pre-migration `hasExtraHours` condition exactly

### Requirement: Schedule assignment (scholar) create/edit/delete behavior SHALL be preserved

The system SHALL preserve the create, edit, and delete behavior of scholar
schedule assignments exactly as implemented in `CreateEditScholarSchedule.jsx`
today, including its worker/group time-conflict detection.

#### Scenario: Creating a new scholar schedule assignment

- WHEN a user submits the scholar schedule form with no `scheduleToEdit`
- THEN the system SHALL call the create path (`createScheduleAssignments`
  from `useCreateScheduleAssignments`) with the submitted fields plus the
  resolved `semester_id`
- AND SHALL block submission with an error toast if `hasWorkerConflict` or
  `hasGroupConflict` detects an overlapping existing assignment for the same
  weekday/time range

#### Scenario: Editing an existing scholar schedule assignment

- WHEN a user submits the scholar schedule form with an existing
  `scheduleToEdit.id`
- THEN the system SHALL call the edit path (`editScheduleAssignment` from
  `useEditScheduleAssignment`) with the same `id`, excluding that same
  record's own id from conflict detection
- AND SHALL strip the embedded `groups`/`semesters`/`subjects`/`workers`
  relation objects from the payload before submitting, exactly as the
  pre-migration `delete data.groups` / `delete data.semesters` /
  `delete data.subjects` / `delete data.workers` calls do

#### Scenario: Deleting a scholar schedule assignment

- WHEN a user confirms deletion of a scholar schedule assignment row
- THEN the system SHALL call `deleteScheduleAssignment` with that row's `id`
  and SHALL invalidate the `["scheduleAssignments"]` query key on success,
  matching current behavior

### Requirement: Teacher schedule (activity) create/edit/delete behavior SHALL be preserved

The system SHALL preserve the create, edit, and delete behavior of teacher
schedule activities exactly as implemented in `CreateEditTeacherSchedule.jsx`
today, including its cross-check against both existing teacher activities and
scholar schedule assignments for the same worker.

#### Scenario: Creating a new teacher activity

- WHEN a user submits the teacher activity form with no `scheduleToEdit`
- THEN the system SHALL call `createScheduleTeacher` with the submitted
  fields plus `semester_id`
- AND SHALL block submission with an error toast if `hasWorkerConflict`
  against the combined `[...scheduleTeachers, ...scheduleAssignments]` array
  detects an overlapping time range for the same worker

#### Scenario: Editing an existing teacher activity

- WHEN a user submits the teacher activity form with an existing
  `scheduleToEdit.id`
- THEN the system SHALL call `editScheduleTeacher` with that same `id`,
  excluding that record's own id from conflict detection, and SHALL preserve
  the existing default-value population from `scheduleToEdit` (excluding its
  embedded `semesters`/`workers` relation fields, matching the current
  destructure-and-discard pattern)

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

The system SHALL preserve every existing React Query key, `staleTime` (or
absence of one), cache-invalidation call, and Supabase query/mutation shape
used by the schedules feature's hooks and services.

#### Scenario: Query keys and invalidation targets are unchanged

- WHEN any schedules hook (`useScheduleAssignments`, `useScheduleTeachers`,
  `useCreateScheduleAssignments`, `useEditScheduleAssignments`,
  `useDeleteScheduleAssignment`, `useCreateScheduleTeacher`,
  `useEditScheduleTeacher`, `useDeleteScheduleTeacher`) runs after migration
- THEN it SHALL use the exact same `queryKey`/invalidated key
  (`["scheduleAssignments"]` or `["scheduleTeachers"]`) as its pre-migration
  version, and SHALL call the same `apiScheduleAssignments.js`/
  `apiScheduleTeachers.js` function with the same arguments

#### Scenario: Supabase select/insert/update/delete shapes are unchanged

- WHEN a schedules hook reads or writes data
- THEN the underlying Supabase call (e.g. `getScheduleAssignments()`'s
  `select("*, workers(id, name), subjects(id, name), groups(id,
  year_of_admission, letter, degrees(id, code, name)), semesters(id,
  school_year)")`, or `getScheduleTeachers()`'s `select("*, workers(*),
  semesters(*)")`) SHALL remain byte-for-byte unchanged — typing describes
  the existing shape, it does not alter what is fetched or sent

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

