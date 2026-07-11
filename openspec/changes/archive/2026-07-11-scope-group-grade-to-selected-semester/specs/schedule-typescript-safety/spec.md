## MODIFIED Requirements

### Requirement: Existing route/page integration SHALL be preserved

The system SHALL preserve `src/pages/ScheduleDashboard.tsx`'s existing
integration with the schedules feature: its tab-switching behavior between
scholar and teacher schedules, and every prop it passes into
`ScholarSchedule`/`TeacherSchedule`. `SemesterContext`'s shape gains one
additional field, `semesterCode`, per the `schedule-semester-relative-group-grades`
capability — this requirement no longer asserts the context shape is
exactly `{ groups, workers, subjects, scheduleAssignments }` with no other
fields, but does still require every existing field's value and every other
aspect of the page's integration to remain unchanged.

#### Scenario: SemesterContext consumers keep receiving the same shape

- WHEN `CreateEditScholarSchedule` (or any other consumer) reads
  `useContext(SemesterContext)`
- THEN it SHALL receive the same `groups`, `workers`, `subjects`, and
  `scheduleAssignments` fields and values that `ScheduleDashboard.tsx`
  already provides, unchanged in shape or content
- AND it SHALL additionally receive a `semesterCode: string | null` field
  set to the currently-selected semester's code (`currentSemester.semester ?? null`)

#### Scenario: Tab switching behavior is unchanged

- WHEN a user switches between "Horario Escolar" and "Horario del Maestro" on
  the schedule dashboard
- THEN the same `ScholarSchedule`/`TeacherSchedule` components SHALL mount
  with the same props as before migration
