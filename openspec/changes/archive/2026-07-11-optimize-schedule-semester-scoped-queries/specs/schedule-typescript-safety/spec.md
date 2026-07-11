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
