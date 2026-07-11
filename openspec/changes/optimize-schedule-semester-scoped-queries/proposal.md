## Why

`ScheduleDashboard.tsx` loads schedules by calling `useScheduleAssignments()`
and `useScheduleTeachers()` with no arguments. Both hooks call
`getScheduleAssignments()` / `getScheduleTeachers()`
(`src/services/apiScheduleAssignments.ts`, `src/services/apiScheduleTeachers.ts`),
which run an unfiltered `select()` against `schedule_assignments` /
`schedule_teachers` — every row in both tables, for every semester, every
time the page loads. `ScheduleDashboard.tsx` then filters the result down to
the current semester client-side:

```ts
const scheduleAssignmentsBySemester = scheduleAssignments!.filter((s) => s.semester_id === +id!);
const scheduleTeachersBySemester = scheduleTeachers!.filter((s) => s.semester_id === +id!);
```

Supabase/PostgREST caps `select()` responses at a default row limit (1000
rows unless `Range`/pagination is used). Once either table crosses that
limit, this unfiltered query silently truncates the result set instead of
erroring, and the client-side filter then operates on an incomplete dataset
— schedules for the selected semester can be missing from the page (scholar
schedule table, teacher schedule table, conflict detection, the semester PDF
export, and the teacher assignment-hours summary) with no visible error.
Growth in either table (more semesters accumulating over school years) makes
this failure mode more likely over time, not less.

The fix is to query by the already-known `semester_id` (the route's `id`
param) at the Supabase level, so the database returns only the rows the page
needs — correct regardless of how large either table grows, and cheaper on
every load besides.

## What Changes

- `getScheduleAssignments` (`src/services/apiScheduleAssignments.ts`) and
  `getScheduleTeachers` (`src/services/apiScheduleTeachers.ts`) accept a
  `semesterId` argument and add `.eq("semester_id", semesterId)` to their
  existing `select()` call. No other part of either `select()` (columns,
  embedded relations) changes.
- `useScheduleAssignments` and `useScheduleTeachers`
  (`src/features/schedules/useScheduleAssignments.ts`,
  `useScheduleTeachers.ts`) accept a `semesterId` parameter, pass it through
  to the service call, include it in their `queryKey`
  (`["scheduleAssignments", semesterId]` / `["scheduleTeachers", semesterId]`),
  and only run once a `semesterId` is available.
- `ScheduleDashboard.tsx` passes the route's `id` into both hooks and drops
  the now-redundant client-side `.filter((s) => s.semester_id === +id!)`
  calls — the data returned is already scoped to the selected semester.
- No other file changes. `ScholarSchedule`, `TeacherSchedule`,
  `CreateEditScholarSchedule`, `CreateEditTeacherSchedule`,
  `detectScheduleConflict`, `TeacherAssignment`, and the PDF exporters all
  already receive semester-scoped arrays as props from `ScheduleDashboard.tsx`
  today — once the hooks return only the selected semester's rows, every
  downstream consumer keeps working with no prop-shape or behavior change.

## Capabilities

**New Capabilities:**
- `schedule-semester-scoped-queries`: covers the new requirement that
  schedule assignment and schedule teacher reads are scoped to a semester at
  the Supabase query level, not filtered client-side after an unscoped fetch.

**Modified Capabilities:**
- `schedule-typescript-safety`: this capability's "React Query and Supabase
  call behavior SHALL be preserved exactly" requirement currently asserts
  the `scheduleAssignments`/`scheduleTeachers` query keys and the underlying
  `select()` calls stay byte-for-byte unchanged and unscoped. This change
  updates that requirement to describe the new semester-scoped query key and
  `select()` shape, while leaving every other requirement in that capability
  (rendering, create/edit/delete behavior, conflict detection, context
  shape, PDF exclusion) untouched.

## Impact

- Affected code: `src/services/apiScheduleAssignments.ts`,
  `src/services/apiScheduleTeachers.ts`,
  `src/features/schedules/useScheduleAssignments.ts`,
  `src/features/schedules/useScheduleTeachers.ts`,
  `src/pages/ScheduleDashboard.tsx`.
- Not changed: `src/features/schedules/CreateEditScholarSchedule.tsx`,
  `CreateEditTeacherSchedule.tsx`, `ScholarSchedule.tsx`, `TeacherSchedule.tsx`,
  `TeacherAssignment.tsx`, `ShowScholarSchedule.tsx`, `ShowTeacherSchedule.tsx`,
  `src/helpers/detectScheduleConflict.ts`, the 6 schedule mutation hooks
  (`useCreateScheduleAssignments`, `useEditScheduleAssignments`,
  `useDeleteScheduleAssignment`, `useCreateScheduleTeacher`,
  `useEditScheduleTeacher`, `useDeleteScheduleTeacher`), any PDF exporter
  under `src/pdf/**`, database schema, and Supabase migrations.
- No new dependencies, no pagination, no table unification.
- Risk is concentrated in: (1) whether the 6 existing mutation hooks'
  `invalidateQueries({ queryKey: ["scheduleAssignments"] })` /
  `["scheduleTeachers"]` calls still invalidate the new, longer,
  semester-suffixed query keys (TanStack Query v5 partial-key matching is
  expected to cover this — must be verified, not assumed, since it is not
  changed by this proposal); (2) the route param `id` being a string that
  must be coerced the same way the removed client-side filter already did
  (`+id!`), applied at the new Supabase `.eq()` boundary instead.
