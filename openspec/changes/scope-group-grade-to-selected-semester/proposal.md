## Why

The schedules module displays a group's grade ("1°"–"8°") via
`calculateSemesterGroup(group.year_of_admission)`, which computes the grade
relative to **today's real-world date**. Every call site that renders a
group's grade inside the schedules module (`ScheduleDashboard.tsx`'s active-group
filter, `CreateEditScholarSchedule.tsx`'s group dropdown and subject filter,
`ShowScholarSchedule.tsx`'s group dropdown, `HourScheduleSubjectGroup.tsx`'s
schedule cells, `TeacherAssignment.tsx`, and four PDF exporters —
`ScheduleGroupPDF.tsx`, `TeacherAssignmentPDF.tsx`, `ScheduleTeacherPDF.tsx`
via `filterHourGroup.ts`, and `WorkerSheetSemester.tsx`) uses this same
today's-date-based function.

This is wrong whenever an admin is working inside a semester other than the
current real-world one — for example browsing archived semester `24B` in
`26A`, or preparing next semester `26B` ahead of time. In both cases every
grade label on the page is calculated against today's date instead of the
semester actually being viewed, showing the wrong grade for every group.

The fix: calculate group grades relative to the **selected semester's code**
(`currentSemester.semester`, e.g. `"26A"`), not today's date, everywhere
inside the schedules module — while leaving the existing today's-date
behavior untouched for every other screen that still needs it (e.g. the
standalone Groups admin table).

## What Changes

- Add a new helper, `calculateSemesterGroupForSemester(entryYear, semesterCode)`,
  alongside the existing `calculateSemesterGroup` in
  `src/helpers/calculateSemesterGroup.ts` (new named export; the existing
  default export is untouched). It parses `semesterCode` (e.g. `"26A"`,
  `"2026-A"`) into a year/term pair and computes the grade as a step count
  from the group's assumed entry term (August of `entryYear`) to the
  selected term — see `design.md` for the exact formula and its verification
  against every example in this proposal.
- Extend `ScheduleDashboard.tsx`'s `SemesterContext` value with the selected
  semester's code (`semesterCode: string | null`), so every schedules-module
  descendant can read it without new prop-drilling through intermediate
  components.
- Update every schedules-module call site that currently computes a group's
  grade with `calculateSemesterGroup(entryYear)` to instead call
  `calculateSemesterGroupForSemester(entryYear, semesterCode)`, sourcing
  `semesterCode` from `SemesterContext` (or, for `WorkerSheetSemester.tsx`
  and `filterHourGroup.ts`, from a prop/parameter they already receive or
  can receive without new context plumbing).
- Leave `src/helpers/calculateSemesterGroup.ts`'s existing
  `calculateSemesterGroup` function and every one of its non-schedules-module
  callers (currently only `src/features/groups/GroupTable.tsx`) completely
  unchanged.

## Capabilities

**New Capabilities:**
- `schedule-semester-relative-group-grades`: covers computing every
  schedules-module group-grade label relative to the selected semester's
  code instead of today's date, including the parsing/fallback behavior for
  semester codes and the exact grade formula.

**Modified Capabilities:**
- `schedule-typescript-safety`: this capability's "Existing route/page
  integration SHALL be preserved" requirement currently asserts
  `SemesterContext`'s shape is exactly `{ groups, workers, subjects,
  scheduleAssignments }`. This change adds a `semesterCode` field to that
  shape; the requirement's scenario is updated to describe the new field
  while its other scenario (tab-switching behavior) is unchanged.

## Impact

- Affected code (display/computation only, no data writes):
  `src/helpers/calculateSemesterGroup.ts`, `src/pages/ScheduleDashboard.tsx`,
  `src/features/schedules/CreateEditScholarSchedule.tsx`,
  `src/features/schedules/ShowScholarSchedule.tsx`,
  `src/features/schedules/HourScheduleSubjectGroup.tsx`,
  `src/features/schedules/TeacherAssignment.tsx`,
  `src/pdf/Schedules/ScheduleGroupPDF.tsx`,
  `src/pdf/Schedules/TeacherAssignmentPDF.tsx`,
  `src/pdf/Schedules/ScheduleTeacherPDF.tsx`,
  `src/pdf/Schedules/filterHourGroup.ts`, `src/pdf/WorkerSheetSemester.tsx`.
- Not changed: `src/features/groups/GroupTable.tsx` (and any other
  non-schedules-module screen), `src/helpers/detectScheduleConflict.ts`,
  any Supabase service/query, `src/types/supabase.ts`, database schema,
  migrations, schedule assignment data, group IDs.
- No new dependencies, no pagination, no table unification, no schema
  changes.
- Risk is concentrated in: (1) the semester-code parsing format — real seed
  data (`supabase/seed.sql`) uses `"2026-A"` while `CreateSemesterForm.tsx`
  generates `"26A"` for new records going forward; both formats are
  explicitly supported, with a logged, degraded fallback to today's-date
  calculation for anything outside them (see `design.md` Decisions 2–3);
  (2) `ScheduleDashboard.tsx`'s active-group filter
  (`calculateSemesterGroup(...) <= 8`) also becomes semester-scoped, per
  `design.md` Decision 5 — the schedules module uses one consistent time
  reference (the selected semester) for both grade labels and group
  visibility, not two; (3) the mechanical parameter-threading required in
  `ScheduleTeacherPDF.tsx` (~25 call sites of `filterHourGroup`), which is
  high in line count but low in logic risk.
