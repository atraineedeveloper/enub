# schedule-semester-scoped-queries Specification

## Purpose
TBD - created by archiving change optimize-schedule-semester-scoped-queries. Update Purpose after archive.
## Requirements
### Requirement: Schedule assignment and teacher reads SHALL be scoped by semester at the query level

The system SHALL filter `schedule_assignments` and `schedule_teachers` reads
to the currently-selected semester at the Supabase query level
(`.eq("semester_id", semesterId)`), instead of fetching every row across all
semesters and filtering client-side after the fact.

#### Scenario: Fetching schedule assignments for a semester

- WHEN `ScheduleDashboard.tsx` loads for a given semester `id`
- THEN `getScheduleAssignments` SHALL be called with that `id` and SHALL
  issue a `schedule_assignments` `select()` filtered to
  `semester_id = id`, returning only that semester's rows regardless of how
  many total rows exist across all semesters

#### Scenario: Fetching schedule teacher activities for a semester

- WHEN `ScheduleDashboard.tsx` loads for a given semester `id`
- THEN `getScheduleTeachers` SHALL be called with that `id` and SHALL issue a
  `schedule_teachers` `select()` filtered to `semester_id = id`, returning
  only that semester's rows regardless of how many total rows exist across
  all semesters

#### Scenario: Correctness is independent of table size

- WHEN either `schedule_assignments` or `schedule_teachers` holds more rows
  than Supabase/PostgREST's default unpaginated row limit (1000), across all
  semesters combined
- THEN a page load for any single semester SHALL still return that
  semester's complete set of rows, because the query is scoped by
  `semester_id` before the row limit is ever reached — not truncated by an
  unfiltered fetch followed by client-side filtering

#### Scenario: Reads wait for a valid numeric semesterId

- WHEN the route param the semester id is derived from is missing or does
  not parse to a finite number (e.g. `useParams().id` is `undefined`, or a
  malformed non-numeric route segment)
- THEN `useScheduleAssignments`/`useScheduleTeachers` SHALL NOT issue a
  Supabase query (their `enabled` condition SHALL be `false`), and SHALL NOT
  fetch an unscoped or `semester_id = NaN` result set, matching the
  pre-existing behavior of this edge case (an effectively-empty schedule
  view) rather than surfacing a new error state

### Requirement: Downstream schedule consumers SHALL receive unchanged data shapes

The system SHALL NOT change the shape of the data passed into
`ScholarSchedule`, `TeacherSchedule`, `CreateEditScholarSchedule` (via
`SemesterContext`), `CreateEditTeacherSchedule`, `TeacherAssignment`,
`ShowScholarSchedule`, `ShowTeacherSchedule`, `detectScheduleConflict`'s
callers, or any PDF exporter under `src/pdf/**` as a result of scoping reads
by semester — each already only ever received semester-filtered arrays as
props before this change.

#### Scenario: SemesterContext and component props are unchanged in shape

- WHEN `ScheduleDashboard.tsx` builds `SemesterContext`'s value and passes
  props to `ScholarSchedule`/`TeacherSchedule`
- THEN `scheduleAssignments`/`scheduleTeachers` SHALL still be plain arrays
  of the same `ScheduleAssignment[]`/`ScheduleTeacher[]` element shape as
  before this change — only how those arrays are populated (server-scoped
  fetch vs. client-side filter of an unscoped fetch) changes

#### Scenario: Conflict detection, forms, and PDFs behave identically

- WHEN a user creates or edits a scholar schedule assignment or teacher
  activity, or exports a schedule/semester PDF
- THEN `hasWorkerConflict`/`hasGroupConflict`, `CreateEditScholarSchedule`,
  `CreateEditTeacherSchedule`, and every PDF exporter SHALL behave exactly as
  they did before this change, for the same underlying data

