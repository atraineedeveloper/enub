# Tasks: Stabilize and Convert PDF Exporters

## 0. Phase 0 — Diagnosis (no code changes)

- [ ] Confirm, against the running dev app and local Supabase instance, that
      exporting the teacher schedule PDF (`ScheduleTeacherPDF`) throws
      `Cannot read properties of undefined (reading 'role')`.
- [ ] Confirm that exporting the scholar group schedule PDF (`ScheduleGroupPDF`)
      throws the identical error (same `roles[1]`/`stateRoles[1]` construct).
- [ ] Confirm `roles` table has exactly 1 row and `state_roles` table has
      exactly 1 row in the local seeded database (matches `supabase/seed.sql`).
- [ ] Confirm exporting `TeacherAssignmentPDF` and `WorkerSheetSemester` does
      NOT currently throw, under the same seed data.
- [ ] Record all four confirmations in this file's Verification Results
      section before starting Phase 1.

## 1. Phase 1 — Repair unsafe roles/state_roles indexing

- [x] In `src/pdf/Schedules/ScheduleGroupPDF.jsx`, replace the four unguarded
      `roles[0]`/`roles[1]`/`stateRoles[0]`/`stateRoles[1]` accesses in the
      `infoSchool` table body with optional-chained accesses and an explicit
      empty-string/no-op fallback, matching the pattern in
      `src/pdf/WorkerSheetSemester.jsx`.
- [x] In `src/pdf/Schedules/ScheduleTeacherPDF.jsx`, apply the identical
      repair to its `infoSchool` table body (same four accesses, same
      fallback shape).
- [x] Verify no other line in either file changes (repair is limited to the
      identified unsafe accesses, per the `pdf-exporter-safety` spec's
      "PDF repairs are minimal and data-shape explicit" requirement).
- [x] Manually re-run the export action for both PDFs against the local
      seeded database (1 row each in `roles`/`state_roles`) and confirm no
      error is thrown and the PDF downloads.
- [x] `bun run typecheck`
- [x] `bun run build`
- [x] `bun run lint` (record before/after counts in Verification Results)

## 2. Phase 2 — Convert PDF helper modules to TypeScript

> Scope note: Phase 2 was re-scoped (per explicit approval) to convert the
> three PDF helper modules first, ahead of the PDF component conversions.
> Component conversion (`ScheduleGroupPDF.jsx`/`ScheduleTeacherPDF.jsx` to
> `.tsx`, originally listed here) moves to a later phase; see Verification
> Results below.

- [x] Convert `src/pdf/Schedules/filterHour.js` to `filterHour.ts`, typing
      `schedules` as `ScheduleAssignment[]` (from
      `src/features/schedules/useScheduleAssignments.ts`); preserve filtering
      and return-value behavior exactly, using non-null assertions at the
      existing (already-unguarded) `subjects`/`workers`/`.name` dereference
      sites rather than adding new guards.
- [x] Convert `src/pdf/Schedules/filterHourGroup.js` to `filterHourGroup.ts`,
      typing `schedules` as `ScheduleAssignment[]`; same non-null-assertion
      treatment for `subjects`/`groups`/`degrees`/`.name` dereferences.
- [x] Convert `src/pdf/Schedules/filterHourActivity.js` to
      `filterHourActivity.ts`, typing `schedules` as `ScheduleTeacher[]` (from
      `useScheduleTeachers.ts`); no null-safety additions needed (`.activity`
      is read only inside a template literal).
- [x] Update `src/pdf/Schedules/ScheduleGroupPDF.jsx`'s and
      `ScheduleTeacherPDF.jsx`'s import specifiers for the three renamed
      helper modules (`.js` → `.ts`, matching the explicit-`.ts`-extension
      convention already used for `useRoles.ts` in these same files); no
      other line in either component file changed.
- [x] Manually re-run both export actions and compare output against Phase 1's
      post-repair baseline (structure/labels/fonts/margins unchanged).
- [x] `bun run typecheck`
- [x] `bun run build`
- [x] `bun run lint` (record before/after counts)

## 3. Phase 3 — Convert TeacherAssignmentPDF to TypeScript

- [ ] Convert `src/pdf/Schedules/TeacherAssignmentPDF.jsx` to
      `TeacherAssignmentPDF.tsx`, typing `groupedSubjects`,
      `uniqueTeacherSchedule: ScheduleTeacher[]`, `currentWorker: Worker | undefined`
      per `design.md`'s Data-Shape Analysis.
- [ ] Add optional chaining/fallback for the `roles[0]` access (null-safety
      only — this file does not currently crash; this is a type-driven
      hardening, not a bug fix per the spec's Requirement scope).
- [ ] Add the `lastAutoTable: { finalY: number }` member to this file's
      `JsPdfWithAutoTable`-equivalent type, alongside `autoTable`.
- [ ] Update `src/features/schedules/TeacherAssignment.tsx` import
      path/extension if required; no prop or behavior changes.
- [ ] Manually re-run the export action and compare output against the
      pre-Phase-3 baseline.
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] `bun run lint` (record before/after counts)

## 4. Phase 4 — Convert WorkerSheetSemester to TypeScript

- [ ] Convert `src/pdf/WorkerSheetSemester.jsx` to `WorkerSheetSemester.tsx`,
      typing `workers: Worker[]`, `semester: Semester[]`,
      `scheduleAssignments: ScheduleAssignment[]`,
      `scheduleTeachers: ScheduleTeacher[]` (replacing the `unknown[]`
      placeholders currently used in `ScheduleDashboard.tsx`'s cast), and the
      same `Role`/`autoTable` typing as the other three files.
- [ ] Update `src/pages/ScheduleDashboard.tsx` to remove or narrow its
      existing `WorkerSheetSemester` `ComponentType` cast now that the
      component is natively typed; no other change to this file.
- [ ] Manually re-run the export action and compare output against the
      pre-Phase-4 baseline.
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] `bun run lint` (record before/after counts)

## 5. Phase 5 — Final verification

- [ ] `bunx @fission-ai/openspec validate stabilize-and-convert-pdf-exporters --type change --strict`
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] `bun run lint` (record final before/after counts across the whole change)
- [ ] Grep for any remaining explicit `.jsx`/`.js` imports of the four
      converted files and fix any stale extensions.
- [ ] Confirm `src/services/**`, `src/types/supabase.ts`, `supabase/**`,
      `package.json`, `tsconfig.json`, `eslint.config.js` are untouched by
      `git diff --stat` against the change's base commit.
- [ ] Confirm the three orphaned schedule files
      (`CreateScholarSchedule.jsx`, `EditScholarSchedule.jsx`,
      `RowTeacherAssignment.jsx`) are untouched.
- [ ] Run the full manual PDF smoke pass (all four exporters) and record
      pass/fail per PDF below.

## Verification Results

(To be filled in during implementation; do not pre-fill.)

- Phase 0 diagnosis confirmations: _pending_ (not run this phase; root cause
  re-confirmed by static analysis and `supabase/seed.sql` inspection, not by
  driving the live app)
- Phase 1 code repair: done. `bunx @fission-ai/openspec validate ... --strict`
  passes; `bun run typecheck` clean; `bun run build` succeeds; `bun run lint`
  is 129 problems (125 errors, 4 warnings) both before and after the repair
  (0 delta — confirmed by stashing the Phase 1 diff and re-running lint).
- Phase 1 manual repair check (ScheduleGroupPDF / ScheduleTeacherPDF): done.
  Human smoke test performed in the browser after the Phase 1 repair: both
  `ScheduleTeacherPDF` and `ScheduleGroupPDF` exports were run against the
  local seeded database; the previous `.role` error no longer appears; both
  PDFs generate successfully; basic structure/header/table output was
  visually confirmed. Confirms the Phase 1 repair works at runtime.
- Phase 2 code conversion: done. `bunx @fission-ai/openspec validate ... --strict`
  passes; `bun run typecheck` clean; `bun run build` succeeds; `bun run lint`
  is 129 problems (125 errors, 4 warnings) — identical to the Phase 1
  baseline (0 delta). `filterHour.js`/`filterHourGroup.js`/`filterHourActivity.js`
  converted to `.ts`; `ScheduleGroupPDF.jsx`/`ScheduleTeacherPDF.jsx` untouched
  except their three import specifiers. Phase 2's original scope (converting
  `ScheduleGroupPDF`/`ScheduleTeacherPDF` to `.tsx`) is deferred to a later
  phase.
- Phase 2 manual check: done. Human smoke test performed in the browser after
  converting the PDF helper modules to TypeScript: both `ScheduleTeacherPDF`
  and `ScheduleGroupPDF` exports were run; both PDFs generate successfully;
  the previous `.role` error did not return; basic structure/header/table
  output was visually confirmed.
- Phase 3 manual check: _pending_
- Phase 4 manual check: _pending_
- Final manual smoke pass (4/4 PDFs): _pending_
- Final lint count (before → after): _pending_
