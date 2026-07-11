## MODIFIED Requirements

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

#### Scenario: Query keys reflect the scoped semester and invalidation still targets them

- WHEN `useScheduleAssignments(semesterId)` or `useScheduleTeachers(semesterId)`
  runs
- THEN its `queryKey` SHALL be `["scheduleAssignments", semesterId]` or
  `["scheduleTeachers", semesterId]` respectively
- AND the existing mutation hooks (`useCreateScheduleAssignments`,
  `useEditScheduleAssignments`, `useDeleteScheduleAssignment`,
  `useCreateScheduleTeacher`, `useEditScheduleTeacher`,
  `useDeleteScheduleTeacher`) SHALL continue to call
  `queryClient.invalidateQueries({ queryKey: ["scheduleAssignments"] })` /
  `["scheduleTeachers"]` unchanged, and that call SHALL still invalidate the
  semester-scoped query key via TanStack Query's default prefix matching

#### Scenario: Mutation Supabase call shapes are unchanged

- WHEN a schedules hook creates, edits, or deletes a record
- THEN the underlying Supabase call in
  `apiScheduleAssignments.ts`/`apiScheduleTeachers.ts` (`insert`, `update`,
  `.eq("id", id)`, `delete`) SHALL remain exactly as it is today — only the
  two read functions' `select()` calls gain a `semester_id` filter

#### Scenario: Read query staleTime is unchanged

- WHEN `useScheduleAssignments`/`useScheduleTeachers` runs
- THEN it SHALL keep the existing `staleTime: 30 * 1000` behavior, unaffected
  by the added `semesterId` parameter and `enabled` guard
