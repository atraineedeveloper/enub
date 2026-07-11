## 1. Helper — add the semester-relative grade function

- [ ] 1.1 `src/helpers/calculateSemesterGroup.ts`: add a new named export
      `calculateSemesterGroupForSemester(entryYear: number | null | undefined, semesterCode: string | null | undefined): number`
      implementing the `termIndex`/`entryIndex` formula from design.md
      Decision 1. Keep the existing `calculateSemesterGroup` function and
      its default export completely unchanged.
- [ ] 1.2 Implement the parsing regex from design.md Decision 2
      (`/^(\d{2}|\d{4})-?([AB])$/i`, applied after `.trim().toUpperCase()`),
      normalizing a 2-digit year to `2000 + year` — accepting both the
      `YYA`/`YYB` format (e.g. `26A`, `26B`) and the `YYYY-A`/`YYYY-B`
      format (e.g. `2026-A`, `2026-B`).
- [ ] 1.3 Implement the fallback from design.md Decision 3: when
      `semesterCode` is `null`/`undefined`/does not match either supported
      format, `console.warn` the offending value (this is a recoverable
      degradation for unknown/legacy data, not a hard failure) and return
      `calculateSemesterGroup(entryYear)`.
- [ ] 1.4 Implement the `grade < 1 → 1` floor, mirroring the existing
      function's `diffTime < 0` guard.

## 2. SemesterContext — carry the selected semester's code

- [ ] 2.1 `src/pages/ScheduleDashboard.tsx`: add `semesterCode: string | null`
      to `SemesterContextValue` and populate it as
      `currentSemester?.semester ?? null` in the `SemesterContext.Provider`
      value.
- [ ] 2.2 `src/pages/ScheduleDashboard.tsx`: update the `currentGroups`
      filter (design.md Decision 5, closed) from
      `calculateSemesterGroup(g.year_of_admission) <= 8` to
      `calculateSemesterGroupForSemester(g.year_of_admission, currentSemester?.semester) <= 8`
      — computed directly here (no `SemesterContext` read needed; this
      filter runs before the Provider is constructed and `currentSemester`
      is already in scope).

## 3. Schedules-module display call sites — switch to semester-scoped grade

- [ ] 3.1 `src/features/schedules/CreateEditScholarSchedule.tsx`: read
      `semesterCode` from the existing `useContext(SemesterContext)` call;
      replace both call sites (`selectingGroup`'s `semesterFound`
      computation, and the group `<option>` label) with
      `calculateSemesterGroupForSemester(entryYear, semesterCode)`.
- [ ] 3.2 `src/features/schedules/ShowScholarSchedule.tsx`: add
      `useContext(SemesterContext)`; replace the group dropdown label call
      site.
- [ ] 3.3 `src/features/schedules/HourScheduleSubjectGroup.tsx`: add
      `useContext(SemesterContext)`; replace the schedule-cell group label
      call site.
- [ ] 3.4 `src/features/schedules/TeacherAssignment.tsx`: add
      `useContext(SemesterContext)`; replace the grouped-subject row label
      call site.
- [ ] 3.5 `src/pdf/Schedules/ScheduleGroupPDF.tsx`: add
      `useContext(SemesterContext)`; replace the PDF header
      "SEMESTRE: X°" call site.
- [ ] 3.6 `src/pdf/Schedules/TeacherAssignmentPDF.tsx`: add
      `useContext(SemesterContext)`; replace the "SEMESTRE Y GRUPO" column
      call site.
- [ ] 3.7 `src/pdf/Schedules/filterHourGroup.ts`: add a
      `semesterCode: string | null` parameter; replace its internal call
      site with `calculateSemesterGroupForSemester(entryYear, semesterCode)`.
- [ ] 3.8 `src/pdf/Schedules/ScheduleTeacherPDF.tsx`: add
      `useContext(SemesterContext)`; pass `semesterCode` as the 4th
      argument at every `filterHourGroup(...)` call site (~25 call sites —
      audit the full file, not a sample, since a missed site fails to
      compile once `filterHourGroup`'s signature changes in 3.7, which is
      the safety net for this task).
- [ ] 3.9 `src/pdf/WorkerSheetSemester.tsx`: no context needed — replace
      all 3 `calculateSemesterGroup` call sites (teacher, administrative,
      and hiring worker table bodies) with
      `calculateSemesterGroupForSemester(entryYear, semester[0]?.semester)`,
      using the component's existing `semester` prop.

## 4. Explicitly unchanged (verify, do not modify)

- [ ] 4.1 Confirm `src/features/groups/GroupTable.tsx` still calls
      `calculateSemesterGroup(group.year_of_admission)` unchanged (today's
      date, no semester scoping) — this is the non-schedules-module screen
      the request requires to keep current-date behavior.
- [ ] 4.2 Confirm `src/helpers/detectScheduleConflict.ts` is untouched (no
      import of either grade helper, no changes).
- [ ] 4.3 Confirm no Supabase service/query file
      (`apiScheduleAssignments.ts`, `apiScheduleTeachers.ts`,
      `apiSemesters.ts`) changed — the semester code is sourced entirely
      from already-fetched client-side data.
- [ ] 4.4 Confirm no group IDs, schedule assignment data, or database
      migration files changed.

## 5. Verification

- [ ] 5.1 `bun run typecheck`
- [ ] 5.2 `bun run build`
- [ ] 5.3 `bun run lint`
- [ ] 5.4 `bunx @fission-ai/openspec validate scope-group-grade-to-selected-semester --type change --strict`
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

(To be filled in during implementation; do not pre-fill.)
