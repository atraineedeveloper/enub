## 1. Helper — add the semester-relative grade function

- [x] 1.1 `src/helpers/calculateSemesterGroup.ts`: add a new named export
      `calculateSemesterGroupForSemester(entryYear: number | null | undefined, semesterCode: string | null | undefined): number`
      implementing the `termIndex`/`entryIndex` formula from design.md
      Decision 1. Keep the existing `calculateSemesterGroup` function and
      its default export completely unchanged.
- [x] 1.2 Implement the parsing regex from design.md Decision 2
      (`/^(\d{2}|\d{4})-?([AB])$/i`, applied after `.trim().toUpperCase()`),
      normalizing a 2-digit year to `2000 + year` — accepting both the
      `YYA`/`YYB` format (e.g. `26A`, `26B`) and the `YYYY-A`/`YYYY-B`
      format (e.g. `2026-A`, `2026-B`).
- [x] 1.3 Implement the fallback from design.md Decision 3: when
      `semesterCode` is `null`/`undefined`/does not match either supported
      format, `console.warn` the offending value (this is a recoverable
      degradation for unknown/legacy data, not a hard failure) and return
      `calculateSemesterGroup(entryYear)`.
- [x] 1.4 Implement the `grade < 1 → 1` floor, mirroring the existing
      function's `diffTime < 0` guard.

## 2. SemesterContext — carry the selected semester's code

- [x] 2.1 `src/pages/ScheduleDashboard.tsx`: add `semesterCode: string | null`
      to `SemesterContextValue` and populate it as
      `currentSemester?.semester ?? null` in the `SemesterContext.Provider`
      value.
- [x] 2.2 `src/pages/ScheduleDashboard.tsx`: update the `currentGroups`
      filter (design.md Decision 5, closed) from
      `calculateSemesterGroup(g.year_of_admission) <= 8` to
      `calculateSemesterGroupForSemester(g.year_of_admission, currentSemester?.semester) <= 8`
      — computed directly here (no `SemesterContext` read needed; this
      filter runs before the Provider is constructed and `currentSemester`
      is already in scope).

## 3. Schedules-module display call sites — switch to semester-scoped grade

- [x] 3.1 `src/features/schedules/CreateEditScholarSchedule.tsx`: read
      `semesterCode` from the existing `useContext(SemesterContext)` call;
      replace both call sites (`selectingGroup`'s `semesterFound`
      computation, and the group `<option>` label) with
      `calculateSemesterGroupForSemester(entryYear, semesterCode)`.
- [x] 3.2 `src/features/schedules/ShowScholarSchedule.tsx`: add
      `useContext(SemesterContext)`; replace the group dropdown label call
      site.
- [x] 3.3 `src/features/schedules/HourScheduleSubjectGroup.tsx`: add
      `useContext(SemesterContext)`; replace the schedule-cell group label
      call site.
- [x] 3.4 `src/features/schedules/TeacherAssignment.tsx`: add
      `useContext(SemesterContext)`; replace the grouped-subject row label
      call site.
- [x] 3.5 `src/pdf/Schedules/ScheduleGroupPDF.tsx`: add
      `useContext(SemesterContext)`; replace the PDF header
      "SEMESTRE: X°" call site.
- [x] 3.6 `src/pdf/Schedules/TeacherAssignmentPDF.tsx`: add
      `useContext(SemesterContext)`; replace the "SEMESTRE Y GRUPO" column
      call site.
- [x] 3.7 `src/pdf/Schedules/filterHourGroup.ts`: add a
      `semesterCode: string | null` parameter; replace its internal call
      site with `calculateSemesterGroupForSemester(entryYear, semesterCode)`.
- [x] 3.8 `src/pdf/Schedules/ScheduleTeacherPDF.tsx`: add
      `useContext(SemesterContext)`; pass `semesterCode` as the 4th
      argument at every `filterHourGroup(...)` call site (~25 call sites —
      audit the full file, not a sample, since a missed site fails to
      compile once `filterHourGroup`'s signature changes in 3.7, which is
      the safety net for this task).
- [x] 3.9 `src/pdf/WorkerSheetSemester.tsx`: no context needed — replace
      all 3 `calculateSemesterGroup` call sites (teacher, administrative,
      and hiring worker table bodies) with
      `calculateSemesterGroupForSemester(entryYear, semester[0]?.semester)`,
      using the component's existing `semester` prop.

## 4. Explicitly unchanged (verify, do not modify)

- [x] 4.1 Confirm `src/features/groups/GroupTable.tsx` still calls
      `calculateSemesterGroup(group.year_of_admission)` unchanged (today's
      date, no semester scoping) — this is the non-schedules-module screen
      the request requires to keep current-date behavior.
- [x] 4.2 Confirm `src/helpers/detectScheduleConflict.ts` is untouched (no
      import of either grade helper, no changes).
- [x] 4.3 Confirm no Supabase service/query file
      (`apiScheduleAssignments.ts`, `apiScheduleTeachers.ts`,
      `apiSemesters.ts`) changed — the semester code is sourced entirely
      from already-fetched client-side data.
- [x] 4.4 Confirm no group IDs, schedule assignment data, or database
      migration files changed.

## 5. Verification

- [x] 5.1 `bun run typecheck`
- [x] 5.2 `bun run build`
- [x] 5.3 `bun run lint`
- [x] 5.4 `bunx @fission-ai/openspec validate scope-group-grade-to-selected-semester --type change --strict`
- [ ] 5.5 Manual smoke test on `/semesters/:id` across at least two
      different semesters (e.g. one archived, one current) with groups of
      different `year_of_admission` values:
      - Group grade labels match design.md Decision 1's worked examples
        (both `year_of_admission = 2024` and `= 2023` cases) for the
        semester actually selected, not today's date.
      - Scholar schedule group dropdown, schedule table cells, teacher
        assignment summary, and all 4 PDF exports (`ScheduleGroupPDF`,
        `TeacherAssignmentPDF`, `ScheduleTeacherPDF`, `WorkerSheetSemester`)
        all show grades consistent with the selected semester.
      - Switching between two different semesters updates every grade
        label on the page (no stale grade from the previously-viewed
        semester) **and** updates which groups appear in every dropdown
        (design.md Decision 5 — the active-group filter is semester-scoped
        too, so group visibility should shift consistently with the
        labels, not stay fixed to today's date).
      - `/groups` (the standalone Groups admin table) is unaffected —
        grades there still reflect today's date, not any selected
        semester.
      - Open the browser console and confirm **no `console.warn` from
        `calculateSemesterGroupForSemester`'s fallback** appears while
        exercising real, production-like semester records (both a
        `YYA`/`YYB`-style record and a `YYYY-A`/`YYYY-B`-style record, per
        design.md Decision 2) — this confirms the parsing regex actually
        matches every real `semester` value in use, not just the two
        formats found during design research. If a warning does appear,
        capture the exact `semester` string that triggered it; per
        design.md Decision 3 this is expected only for unknown/legacy data,
        not for any record created through `CreateSemesterForm.tsx` or the
        current seed data.
- [ ] 5.6 Record pass/fail for each 5.5 item, plus the 5.1–5.4 command
      output, in this file's Verification Results section before
      considering this change complete.

## Verification Results

- Tasks 1.1–1.4: `calculateSemesterGroupForSemester` added as a new named
  export in `src/helpers/calculateSemesterGroup.ts`, purely additive — the
  existing `calculateSemesterGroup` function body and default export are
  byte-identical to before this change (confirmed via `git diff`, the only
  diff is the new function appended after it). Implements the
  `termIndex`/`entryIndex` formula, the `/^(\d{2}|\d{4})-?([AB])$/i` regex
  (case-insensitive via `.trim().toUpperCase()`), the `console.warn` +
  `calculateSemesterGroup(entryYear)` fallback for unparseable/missing
  codes, and the `grade < 1 → 1` floor.
- Tasks 2.1–2.2: `SemesterContextValue` gained `semesterCode: string | null`,
  populated as `currentSemester?.semester ?? null`. The `currentGroups`
  filter now uses `calculateSemesterGroupForSemester(g.year_of_admission, currentSemester?.semester) <= 8`.
  `currentSemester`'s computation was moved above `currentGroups` (it was
  previously computed after, but the filter now depends on it) — the only
  structural reordering in this change, required for the new filter to
  compile; no other line in `ScheduleDashboard.tsx` reordered.
- Tasks 3.1–3.9: all 9 schedules-module call sites switched from
  `calculateSemesterGroup(entryYear)` to
  `calculateSemesterGroupForSemester(entryYear, semesterCode)`, sourcing
  `semesterCode` from `useContext(SemesterContext)` in 6 components
  (`CreateEditScholarSchedule`, `ShowScholarSchedule`,
  `HourScheduleSubjectGroup`, `TeacherAssignment`, `ScheduleGroupPDF`,
  `ScheduleTeacherPDF`) and from the existing `semester` prop directly in
  `WorkerSheetSemester.tsx` (no context needed there, per design.md
  Decision 4). `filterHourGroup.ts` gained a `semesterCode` parameter;
  `ScheduleTeacherPDF.tsx` threads it through all 25 `filterHourGroup(...)`
  call sites — confirmed via `grep -c "filterHourGroup(" ` and
  `grep -c "semesterCode$"` both returning 25, and via a clean
  `bun run typecheck` (a missed call site would have failed to compile
  once `filterHourGroup`'s signature changed, per design.md's stated
  safety net).
- Tasks 4.1–4.4: confirmed via `git diff --stat` — zero changes to
  `src/features/groups/GroupTable.tsx`, `src/helpers/detectScheduleConflict.ts`,
  `src/services/apiScheduleAssignments.ts`, `apiScheduleTeachers.ts`,
  `apiSemesters.ts`, any migration file, or any group ID/schedule
  assignment data. `git status --short` confirms exactly the 11 files in
  this change's scope were touched — nothing else.
- `bun run typecheck` → clean, zero errors.
- `bunx @fission-ai/openspec validate scope-group-grade-to-selected-semester --type change --strict`
  → valid.
- `bun run build` → succeeds.
- `bun run lint` → 43 problems (39 errors, 4 warnings) — unchanged from the
  pre-existing baseline (matches the count recorded at the end of the
  immediately-prior `optimize-schedule-semester-scoped-queries` change).
  Every lint error inside a file this change touched
  (`CreateEditScholarSchedule.tsx`'s unused `useMutation`/`useQueryClient`/
  imports, `HourScheduleSubjectGroup.tsx`'s unused `Row`/state vars and
  unescaped-entity warnings, `ShowScholarSchedule.tsx`/`TeacherAssignment.tsx`'s
  unescaped-entity warnings, `calculateSemesterGroup.ts`'s unused
  `currentYear`/`currentMonth`/`currentDay` inside the untouched original
  function, `ScheduleGroupPDF.tsx`/`ScheduleTeacherPDF.tsx`/
  `TeacherAssignmentPDF.tsx`'s pre-existing unused-var errors) is
  confirmed pre-existing — none fall on a line this change added or
  modified (verified via `git diff` for each).
- Task 5.5 (manual smoke test) and 5.6 (recording its results): **not
  performed** — no browser/dev-server session was available in this
  implementation pass. Required before this change is considered fully
  complete, per this file's own instructions. In particular: the
  console-warning check against real `semester` records (both formats) has
  not been exercised, and the active-group-visibility-changes-with-semester
  behavior (design.md Decision 5) has not been visually confirmed.
