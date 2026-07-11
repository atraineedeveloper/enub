## Context

`src/helpers/calculateSemesterGroup.ts` exports one function,
`calculateSemesterGroup(entryYear)`, which computes a group's grade
(1°–8°+) by diffing **today's real-world date** against an assumed entry
date of August 1 of `entryYear`. A full-tree grep for every call site
(`grep -rl calculateSemesterGroup src`) found exactly 11 files:

| File | Role | In schedules module? |
|---|---|---|
| `src/pages/ScheduleDashboard.tsx` | Filters `groups` to grade ≤ 8 for `SemesterContext`/dropdowns | Yes |
| `src/features/schedules/CreateEditScholarSchedule.tsx` | Group dropdown label; filters subjects by computed grade | Yes |
| `src/features/schedules/ShowScholarSchedule.tsx` | Group dropdown label | Yes |
| `src/features/schedules/HourScheduleSubjectGroup.tsx` | Schedule-cell group label | Yes |
| `src/features/schedules/TeacherAssignment.tsx` | Grouped-subject row label | Yes |
| `src/pdf/Schedules/ScheduleGroupPDF.tsx` | PDF header "SEMESTRE: X°" | Yes |
| `src/pdf/Schedules/TeacherAssignmentPDF.tsx` | PDF "SEMESTRE Y GRUPO" column | Yes |
| `src/pdf/Schedules/filterHourGroup.ts` | Per-cell label text, called from `ScheduleTeacherPDF.tsx` (~25 call sites) | Yes |
| `src/pdf/WorkerSheetSemester.tsx` | 3 call sites across teacher/administrative/hiring worker tables | Yes |
| `src/features/groups/GroupTable.tsx` | Standalone Groups admin table, filters grade ≤ 8 | **No** |
| `src/helpers/calculateSemesterGroup.ts` | The function itself | — |

Every "Yes" file is reachable only from `src/pages/ScheduleDashboard.tsx`,
and every one of them renders **inside** `ScheduleDashboard.tsx`'s
`<SemesterContext.Provider>` (confirmed by tracing the render tree:
`ScholarSchedule`/`TeacherSchedule` and everything they mount —
`ShowScholarSchedule` → `RowScholarSchedule` → `HourScheduleSubject`/
`HourScheduleSubjectGroup`, `TeacherSchedule` → `TeacherAssignment`/
`ShowTeacherSchedule` → `ScheduleTeacherPDF`/`RowTeacherSchedule` — plus
`WorkerSheetSemester`, mounted directly in `ScheduleDashboard.tsx`'s own
JSX). `CreateEditScholarSchedule.tsx` already reads `SemesterContext`
directly (`useContext(SemesterContext)`) for `groups`/`workers`/`subjects`/
`scheduleAssignments` — this is the established precedent this change
follows for the other 6 components that don't yet read it.

`GroupTable.tsx` is the standalone `/groups` admin page, entirely outside
`ScheduleDashboard.tsx`'s tree, with no concept of a "selected semester" —
it correctly keeps using today's-date-based `calculateSemesterGroup`
unchanged (constraint from the request: preserve current-date calculation
for non-schedule screens).

## Goals / Non-Goals

**Goals:**
- Every group-grade label rendered inside the schedules module
  (`ScheduleDashboard.tsx` and its full render tree) reflects the grade
  relative to the **selected semester's code**
  (`currentSemester.semester`), not today's date.
- Preserve `calculateSemesterGroup(entryYear)`'s existing today's-date
  behavior, unchanged, for `GroupTable.tsx` and any other non-schedules
  screen.
- Minimal, additive design: one new helper function, one new
  `SemesterContext` field, and mechanical call-site updates — no
  restructuring of component hierarchy, no new routes, no schema changes.

**Non-Goals:**
- No change to `schedule_assignments`/`schedule_teachers` data, group IDs,
  or `src/helpers/detectScheduleConflict.ts`'s conflict-detection logic —
  none of these read or depend on a computed grade.
- No Supabase query/select shape changes. The selected semester's code is
  already fully available client-side (`ScheduleDashboard.tsx`'s own
  `currentSemester`, sourced from `useSemesters()`, and
  `WorkerSheetSemester.tsx`'s existing `semester` prop) — there is no need
  to expand any embedded relation (e.g. adding `semester` to
  `getScheduleAssignments()`'s `select("..., semesters(id, school_year)")`)
  just to get the code onto each row. This also avoids reopening
  `schedule-semester-scoped-queries`'s "Supabase select ... shapes are
  unchanged" requirement, settled in the immediately-prior change.
- No database migration (constraint: only if absolutely necessary — it
  isn't; nothing here touches the database).
- No change to `calculateSemesterGroup`'s existing signature, export style,
  or its today's-date algorithm.

## Decisions

**1. What is the exact grade formula for `calculateSemesterGroupForSemester`?**

Terms alternate strictly in calendar order: A(year) precedes B(year)
precedes A(year+1). Assign each term a monotonic integer index:

```
termIndex(year, letter) = year * 2 + (letter === "A" ? 0 : 1)
```

The group's cohort is assumed to start the B term of `entryYear` (August 1
— matching the existing function's own assumption, preserved verbatim:
"Asumimos que la generación ingresó el 1 de Agosto del entryYear"). So:

```
entryIndex = entryYear * 2 + 1   // B(entryYear)
grade = termIndex(targetYear, targetLetter) - entryIndex + 1
if (grade < 1) grade = 1          // mirrors the existing function's
                                   // `if (diffTime < 0) return 1;` guard
```

Verified against every example in the request:

| entryYear | target | termIndex | entryIndex | grade | matches request? |
|---|---|---|---|---|---|
| 2024 | 24B | 4049 | 4049 | 1 | ✅ 1° |
| 2024 | 25A | 4050 | 4049 | 2 | ✅ 2° |
| 2024 | 25B | 4051 | 4049 | 3 | ✅ 3° |
| 2024 | 26A | 4052 | 4049 | 4 | ✅ 4° |
| 2024 | 26B | 4053 | 4049 | 5 | ✅ 5° |
| 2023 | 24A | 4048 | 4047 | 2 | ✅ 2° |
| 2023 | 24B | 4049 | 4047 | 3 | ✅ 3° |
| 2023 | 25A | 4050 | 4047 | 4 | ✅ 4° |
| 2023 | 25B | 4051 | 4047 | 5 | ✅ 5° |

All 9 examples match exactly. This is a pure arithmetic formula — no
date-diffing, no loops — deliberately simpler than the existing
`calculateSemesterGroup`'s while-loop, since "which academic term" is
already known input here (the selected semester's code), unlike
`calculateSemesterGroup` which has to derive it from today's date.

**2. How is `semesterCode` (e.g. `"26A"`) parsed into `{ year, letter }`?**

Regex: `/^(\d{2}|\d{4})-?([AB])$/i`, applied after `.trim().toUpperCase()`.
- 2-digit year → add 2000 (`26` → `2026`). This assumes all semester codes
  belong to the 2000s, a reasonable simplifying assumption for this school's
  operating timeframe, not indefinitely future-proof — noted here as a
  known, accepted limitation, not silently assumed.
- 4-digit year → used as-is.
- Optional `-` between year and letter, so both observed real formats parse
  identically:
  - `CreateSemesterForm.tsx` generates `"26A"` / `"26B"` (2-digit, no
    separator) for every semester created through the UI going forward.
  - `supabase/seed.sql`'s local dev seed data uses `"2026-A"` / `"2026-B"`
    (4-digit, hyphenated) — **confirmed by inspection to be a different
    format than what the form generates**, i.e. `semester` is a free-text
    `string | null` column (`src/types/supabase.ts`) with **no enforced
    format** at the database or application layer. This is exactly the
    "not guaranteed to match the pattern" case the request asked to be
    documented, not assumed away.

**3. What happens when `semesterCode` doesn't match the regex (or is
`null`/`undefined`)?**

`calculateSemesterGroupForSemester` falls back to
`calculateSemesterGroup(entryYear)` (today's-date-based — the exact
pre-existing behavior) and calls `console.warn` with the offending value,
matching this codebase's established pattern of logging before falling
back rather than throwing (e.g. `apiScheduleAssignments.ts`'s
`console.error(error)` calls use `console.error` for hard failures; this
uses `console.warn` since it is a recoverable degradation, not a failed
operation). This fallback path is explicitly for **unknown/legacy data
only** — every semester code created going forward via
`CreateSemesterForm.tsx` (`"26A"`/`"26B"`) and every currently-seeded value
(`"2026-A"`/`"2026-B"`) both parse successfully (Decision 2); this path
exists for values outside both known formats (e.g. hand-edited database
rows, future format changes) and represents **degraded behavior**, not the
normal path. Rationale: this function's job is rendering a label, not
gating a page — silently degrading to the old, familiar
(if wrong-for-this-semester) behavior is safer than crashing a render or
showing `NaN°`, and the `console.warn` makes bad `semester` data
discoverable rather than silently wrong. This directly satisfies the
request's constraint 9 ("If semester labels are not guaranteed to match
the pattern YYA/YYB, document the fallback or validation behavior").

**4. How does the semester code reach each of the 9 non-`GroupTable.tsx`
call sites, without new prop-drilling through every intermediate
component?**

`SemesterContext` (defined in `ScheduleDashboard.tsx`, already wrapping
every one of these components — see Context table above) gains one new
field:

```ts
interface SemesterContextValue {
  groups: Group[];
  workers: Worker[];
  subjects: Subject[];
  scheduleAssignments: unknown[];
  semesterCode: string | null;   // NEW
}
```

populated as `semesterCode: currentSemester?.semester ?? null`. Each of the
6 components that don't yet read `SemesterContext`
(`ShowScholarSchedule.tsx`, `HourScheduleSubjectGroup.tsx`,
`TeacherAssignment.tsx`, `ScheduleGroupPDF.tsx`, `ScheduleTeacherPDF.tsx`,
and `CreateEditScholarSchedule.tsx` which already reads the context object
but needs the new field) adds/extends a `useContext(SemesterContext)` call
— the same pattern `CreateEditScholarSchedule.tsx` already uses today. This
requires **zero prop changes** to any intermediate component
(`ScholarSchedule`, `TeacherSchedule`, `RowScholarSchedule`,
`ShowTeacherSchedule`, etc.) — that is the entire point of using context
here instead of threading a new prop through 3–4 component layers.

Two exceptions that do **not** use context, because they have a more
direct path already:
- `WorkerSheetSemester.tsx` already receives `semester: Semester[]` as a
  prop directly from `ScheduleDashboard.tsx`
  (`semester={currentSemester ? [currentSemester] : []}`) — it reads
  `semester[0]?.semester` directly, no context needed.
- `filterHourGroup.ts` is a plain function, not a component — it cannot
  call `useContext`. Its signature gains a new parameter,
  `semesterCode: string | null`, and its one caller
  (`ScheduleTeacherPDF.tsx`, a component) reads `semesterCode` from context
  once and passes it through at each of its ~25 `filterHourGroup(...)` call
  sites — mechanical parameter threading, not a logic change.

**5. Should `ScheduleDashboard.tsx`'s active-group filter
(`groups!.filter((g) => calculateSemesterGroup(g.year_of_admission) <= 8)`)
also switch to the semester-scoped calculation? *(Closed)***

**Yes.** This filter determines which groups are considered "current"
(grade ≤ 8, i.e. not yet graduated) and therefore appear at all in every
group dropdown/context value on the page. Leaving it on today's-date logic
while every label elsewhere on the same page is semester-relative would mix
two different time contexts within one screen: a group could be
display-label-correct everywhere but still be silently excluded from (or
wrongly included in) a past or future semester's dropdowns, because the
exclusion decision itself would still use today's date. The schedules
module must use one consistent time reference (the selected semester), not
two.

The filter changes from:

```ts
const currentGroups = groups!.filter((g) => calculateSemesterGroup(g.year_of_admission) <= 8);
```

to:

```ts
const currentGroups = groups!.filter((g) => calculateSemesterGroupForSemester(g.year_of_admission, currentSemester?.semester) <= 8);
```

computed in `ScheduleDashboard.tsx` directly (it already has
`currentSemester` in scope — no `SemesterContext` read needed here, since
this filter runs before the `SemesterContext.Provider` is even
constructed). This uses the exact same helper, parsing rules, and fallback
as every label call site (Decisions 1–3) — including the same
`console.warn`-and-fall-back-to-today's-date behavior if `currentSemester?.semester`
doesn't parse, so an unparseable `semester` value degrades this filter back
to its pre-existing (today's-date) behavior rather than hiding every group
or crashing the page.

## Risks / Trade-offs

- **Semester code format inconsistency (Decisions 2–3)**: real, confirmed
  by inspection (seed data vs. form-generated codes differ). Mitigated by a
  lenient regex covering both observed formats, plus a logged fallback for
  anything else — not a blocking risk, but worth a follow-up decision on
  whether to normalize `semester` values in the database (out of scope
  here; no migration is proposed).
- **Mechanical call-site churn in `ScheduleTeacherPDF.tsx`**: ~25
  `filterHourGroup(...)` call sites each need one new argument appended.
  High line count, low logic risk (pure parameter threading, no branching
  changes) — but real regression risk if any call site is missed (that
  specific cell would silently keep using the old, unparameterized
  `filterHourGroup` signature and fail to compile, not fail silently at
  runtime, since TypeScript will require the new parameter once the
  signature changes).
- **Active-group filter now double-duty (Decision 5)**: the same filter
  that decides page-level group visibility now also depends on
  `calculateSemesterGroupForSemester`'s fallback behavior — if
  `currentSemester?.semester` is unparseable, the filter silently reverts
  to today's-date visibility rules (Decision 5), which is the intended,
  documented degradation, not a silent bug, but worth confirming during
  manual verification with a semester whose code is known-good.
- **Fallback masking bad data**: if `semester` values drift from the two
  known formats (Decision 2) more than currently observed, the
  `console.warn`-based fallback silently reverts to today's-date behavior
  per call site rather than surfacing a visible error in the UI. Acceptable
  per Decision 3's reasoning (label/visibility computation shouldn't crash
  the page) and explicitly scoped to unknown/legacy data only — not
  expected to trigger for any semester code created through the app's own
  form or currently seeded — but worth monitoring console output during
  manual verification (task 5.5).
