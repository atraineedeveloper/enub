## ADDED Requirements

### Requirement: Schedules-module group grades SHALL be computed relative to the selected semester's code

The system SHALL compute every group-grade label rendered inside the
schedules module (`ScheduleDashboard.tsx` and its full render tree,
including its PDF exporters) relative to the currently-selected semester's
code (`currentSemester.semester`), not relative to today's real-world date.

#### Scenario: Grade for a group admitted the same year the semester's B term belongs to

- WHEN a group has `year_of_admission = 2024` and the selected semester's
  code is `24B`
- THEN its computed grade SHALL be `1`

#### Scenario: Grade sequence advances one step per subsequent term, same entry year

- WHEN a group has `year_of_admission = 2024`
- THEN the selected semester `25A` SHALL compute grade `2`, `25B` SHALL
  compute grade `3`, `26A` SHALL compute grade `4`, and `26B` SHALL compute
  grade `5`

#### Scenario: Grade sequence for a group admitted one year earlier

- WHEN a group has `year_of_admission = 2023`
- THEN the selected semester `24A` SHALL compute grade `2`, `24B` SHALL
  compute grade `3`, `25A` SHALL compute grade `4`, and `25B` SHALL compute
  grade `5`

#### Scenario: Grade is not floored — a group not yet started computes below 1

- WHEN the selected semester's term precedes the group's assumed entry term
  (August of `year_of_admission`) — e.g. `year_of_admission = 2024` and the
  selected semester is `24A`, or `year_of_admission = 2025` and the
  selected semester is `25A`
- THEN the computed grade SHALL be `0` or negative, reflecting that the
  group's cohort has not started yet as of the selected semester — it SHALL
  NOT be floored or clamped to `1`, since that would make a not-yet-started
  group indistinguishable from a genuine first-semester group. Callers that
  need to exclude not-yet-started groups (see the active-group visibility
  filter requirement below) are responsible for checking `grade >= 1`
  themselves

### Requirement: Semester code parsing SHALL support both known formats and SHALL fall back safely when unparseable

The grade calculation SHALL support both semester code formats in current
use: `YYA`/`YYB` (e.g. `"26A"`, `"26B"`) and `YYYY-A`/`YYYY-B` (e.g.
`"2026-A"`, `"2026-B"`), case-insensitively. The system SHALL NOT assume
`semester` values are guaranteed to match only one of these two formats,
and SHALL NOT assume every future `semester` value matches either format.
For any `semester` value that matches neither supported format (unknown or
legacy data), the system SHALL fall back to the existing today's-date-based
`calculateSemesterGroup(entryYear)` and SHALL log the offending value as a
warning — this fallback path represents **degraded behavior for
unknown/legacy data only**, not the normal path, and SHALL NOT throw an
error or render an invalid (e.g. `NaN`) grade.

#### Scenario: A YYA/YYB semester code parses correctly

- WHEN the selected semester's code is `"26A"` or `"26B"`
- THEN it SHALL be parsed as the A or B term of year 2026, respectively

#### Scenario: A YYYY-A/YYYY-B semester code parses correctly

- WHEN the selected semester's code is `"2026-A"` or `"2026-B"`
- THEN it SHALL be parsed as the A or B term of year 2026, respectively —
  the same result as `"26A"`/`"26B"` for the same calendar term

#### Scenario: An unparseable or missing semester code falls back without crashing

- WHEN the selected semester's `semester` value is `null`, `undefined`, or
  matches neither the `YYA`/`YYB` nor the `YYYY-A`/`YYYY-B` format
- THEN the system SHALL log the offending value as a console warning and
  return `calculateSemesterGroup(entryYear)` (today's-date-based) instead of
  throwing an error or rendering an invalid grade, and this degraded
  behavior SHALL be limited to that unrecognized value — it SHALL NOT
  affect grade calculation for any other, correctly-formatted semester

### Requirement: The schedules module's active-group visibility filter SHALL use the same selected-semester time reference as its grade labels

`ScheduleDashboard.tsx`'s active-group filter (which determines which
groups appear at all in the schedules module's dropdowns and
`SemesterContext` value) SHALL compute each group's grade relative to the
selected semester's code, using the same
`calculateSemesterGroupForSemester` function and fallback behavior as every
grade label, and SHALL include a group only when that semester-relative
grade is within the valid academic range: `>= 1 AND <= 8`. A group whose
selected-semester-relative grade is below `1` has not started yet as of
that semester and SHALL be excluded, exactly like a group whose grade is
above `8` (already graduated) is excluded. The schedules module SHALL NOT
mix two different time references (a semester-relative grade for labels
and a today's-date-relative grade for visibility) within the same screen.

#### Scenario: Group visibility is evaluated against the selected semester, not today's date

- WHEN `ScheduleDashboard.tsx` builds its list of active groups for a
  selected semester
- THEN a group SHALL appear only if
  `calculateSemesterGroupForSemester(group.year_of_admission, currentSemester.semester)`
  is `>= 1 AND <= 8`, not `calculateSemesterGroup(group.year_of_admission) <= 8`

#### Scenario: A group not yet started in the selected semester is excluded

- WHEN a group has `year_of_admission = 2024` and the selected semester's
  code is `24A` (before the group's assumed `24B` entry term), or a group
  has `year_of_admission = 2025` and the selected semester's code is `25A`
- THEN that group's semester-relative grade SHALL be `<= 0`, and it SHALL
  NOT appear in the schedule group dropdown or `SemesterContext`'s
  `groups` value for that selected semester

#### Scenario: Switching semesters can change which groups are visible

- WHEN an admin switches from one selected semester to another
- THEN the set of groups appearing in the schedules module's dropdowns
  SHALL be re-evaluated against the newly-selected semester's code, and MAY
  differ from the previously-selected semester's group set as a result —
  both because groups may have graduated (grade `> 8`) and because groups
  may not have started yet (grade `< 1`)

### Requirement: Non-schedules-module screens SHALL keep using today's-date-based grade calculation

The system SHALL NOT change the grade calculation used by any screen
outside the schedules module (currently: `src/features/groups/GroupTable.tsx`,
the standalone Groups admin table) — those screens SHALL continue calling
the existing, unmodified `calculateSemesterGroup(entryYear)`.

#### Scenario: The Groups admin table is unaffected

- WHEN a user views `/groups` (outside the schedules module, with no
  selected-semester concept)
- THEN displayed grades SHALL continue to reflect today's real-world date,
  exactly as before this change

### Requirement: The selected semester's code SHALL reach every schedules-module display component without new Supabase queries

The system SHALL make the selected semester's code available to every
schedules-module component that renders a group grade by extending the
existing `SemesterContext` (or, where a component already receives the
semester directly as a prop, by using that prop) — not by expanding any
Supabase `select()` call or adding a new query.

#### Scenario: SemesterContext carries the selected semester's code

- WHEN `ScheduleDashboard.tsx` builds `SemesterContext`'s value
- THEN it SHALL include the selected semester's code (sourced from
  `currentSemester.semester`, the same semester record already fetched by
  `useSemesters()`), and SHALL NOT require any change to
  `getScheduleAssignments`/`getScheduleTeachers`'s Supabase `select()` calls

#### Scenario: A PDF exporter with an existing semester prop uses that prop directly

- WHEN `WorkerSheetSemester.tsx` (which already receives `semester: Semester[]`
  as a prop from `ScheduleDashboard.tsx`) computes a group grade
- THEN it SHALL use its own `semester` prop's code, not `SemesterContext`,
  since it already has direct access to the selected semester
