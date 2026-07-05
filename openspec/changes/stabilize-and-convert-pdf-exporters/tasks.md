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

## 3. Phase 3 — Convert schedule PDF components to TypeScript

> Scope note: Phase 3 was re-scoped (per explicit approval) to cover all
> three remaining schedule PDF *components* in one phase — `ScheduleGroupPDF`,
> `ScheduleTeacherPDF` (originally slated for Phase 2, deferred when Phase 2
> was re-scoped to helper modules first), and `TeacherAssignmentPDF`
> (originally this phase's sole target). `WorkerSheetSemester` remains
> deferred to the next phase.
>
> Correction to this task's original `currentWorker` typing: `design.md`'s
> Data-Shape Analysis stated `currentWorker: Worker | undefined`, but reading
> the actual call site (`TeacherAssignment.tsx`'s
> `currentWorker = workers.filter((worker) => worker.id === selectedWorkerId)`,
> and this file's own `currentWorker[0].name` access) shows the prop is
> actually `Worker[]` (0 or 1 entries), never a single `Worker`. Typed as
> `Worker[]` below to match reality instead of the design doc's assumption.

- [x] Convert `src/pdf/Schedules/ScheduleGroupPDF.jsx` to
      `ScheduleGroupPDF.tsx`, typing `schedules` as `ScheduleAssignment[]`,
      typing `state_roles` data via a local
      `Database["public"]["Tables"]["state_roles"]["Row"]` type alias (cast at
      this file's own boundary, since `useStateRoles.js` stays untyped/out of
      scope), and adding a local `JsPdfWithAutoTable` type
      (`jsPDF & { autoTable: (options: UserOptions) => void }`) for the
      `autoTable` call. Preserves the Phase 1 `availableRoles`/
      `availableStateRoles` defensive-fallback lines exactly (only added
      `RowInput[]` typing on the surrounding `infoSchool`/`data` arrays and a
      `!` on the pre-existing, previously out-of-scope `utilities[0]` access).
- [x] Convert `src/pdf/Schedules/ScheduleTeacherPDF.jsx` to
      `ScheduleTeacherPDF.tsx`, typing `schedulesScholar` as
      `ScheduleAssignment[]`, `scheduleTeacher` as `ScheduleTeacher[]`,
      `totalHours` as `number`; same `state_roles`/`autoTable` typing and same
      Phase 1 fallback preservation as `ScheduleGroupPDF.tsx`.
- [x] Convert `src/pdf/Schedules/TeacherAssignmentPDF.jsx` to
      `TeacherAssignmentPDF.tsx`, typing `groupedSubjects` as
      `Record<string, ScheduleAssignment[]>` (matching
      `TeacherAssignment.tsx`'s own `groupData()` return shape),
      `uniqueTeacherSchedule` as `{ name: string; quantity: number }[]`, and
      `currentWorker` as `Worker[]` (see scope note above).
- [x] Add optional chaining/fallback for this file's `roles[0]` access
      (`roles?.[0]?.workers?.name ?? ""` / `roles?.[0]?.role ?? ""`,
      matching the Phase 1 fallback shape) — null-safety only; this file does
      not currently crash, this is type-driven hardening per the spec's
      Requirement scope, not a bug fix.
- [x] Add the `lastAutoTable: { finalY: number }` member to this file's
      `JsPdfWithAutoTable` type, alongside `autoTable`.
- [x] Drop the explicit `.ts`/`.tsx` extensions on this file's own
      `Button`/`Spinner`/`useRoles` imports and the other two converted
      files' `Button`/`Spinner`/`useRoles`/`filterHour*` imports — required
      because `tsc` rejects explicit `.ts`/`.tsx` import extensions without
      `allowImportingTsExtensions` (not set, out of scope to change) once the
      importing file itself becomes type-checked; `.js` extension imports are
      unaffected and left unchanged.
- [ ] Manually re-run all three export actions and compare output against the
      pre-Phase-3 baseline (structure/labels/fonts/margins unchanged).
- [x] `bun run typecheck`
- [x] `bun run build`
- [x] `bun run lint` (record before/after counts)

## 4. Phase 4 — Convert WorkerSheetSemester to TypeScript

> Correction to this task's original plan: `workers` is typed as
> `WorkerWithDetails[]`, not `Worker[]` — the component's own body reads
> `worker.date_of_admissions`/`worker.sustenance_plazas`, fields that only
> exist on `WorkerWithDetails` (`ScheduleDashboard.tsx` calls
> `useWorkers({ fullDetails: true })`, so the runtime data always has them;
> the base `Worker` type just doesn't say so). `ScheduleDashboard.tsx`'s
> existing `ComponentType<{ workers: Worker[]; ... }>` cast turned out to
> **not** need narrowing — `bun run typecheck` passes with that file
> completely untouched, so the second original task item ("update
> `ScheduleDashboard.tsx`'s cast") was not needed and nothing there changed.

- [x] Convert `src/pdf/WorkerSheetSemester.jsx` to `WorkerSheetSemester.tsx`,
      typing `workers: WorkerWithDetails[]` (see correction above),
      `semester: Semester[]`, `scheduleAssignments?: ScheduleAssignment[]`,
      `scheduleTeachers?: ScheduleTeacher[]` (optional with `= []` defaults,
      matching the existing destructuring defaults), reusing `Role` (via
      `useRoles()`, already typed) and adding a local `JsPdfWithAutoTable`
      type (`jsPDF & { autoTable: (options: UserOptions) => void; internal:
      jsPDF["internal"] & { getCurrentPageInfo: () => PageInfo } }`) for the
      `autoTable` call and the `internal.getCurrentPageInfo()` call (missing
      from jsPDF's bundled types despite existing at runtime — the gap
      `design.md` anticipated for this file specifically).
- [x] Type this file's local helper functions (`transformDate`,
      `getFileExtension`, `groupData`, `normalizeMultilineText`,
      `buildFunctionPerformedText`, `drawWorkerPhotoInCell`,
      `drawPageHeaderFooter`, `drawMixedCenteredLine`,
      `drawCenteredWrappedText`, `findRoleByKeywords`, `toUpperEs`) — all were
      implicit-`any`-parameter closures under the old `.jsx`/`checkJs:false`
      setup; `strict: true` requires explicit parameter types once the file
      itself is type-checked. No logic in any of them changed.
- [x] Preserve the existing defensive `availableRoles`/`findRoleByKeywords`/
      `leftFooterRole`/`rightFooterRole`/footer-fallback logic exactly
      (byte-identical aside from the added `keywords: string[] = []` and
      `value: string = ""` parameter type annotations).
- [ ] Manually re-run the export action and compare output against the
      pre-Phase-4 baseline (structure/header/table/signature output
      unchanged).
- [x] `bun run typecheck`
- [x] `bun run build`
- [x] `bun run lint` (record before/after counts)

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
- Phase 3 code conversion: done. `bunx @fission-ai/openspec validate ... --strict`
  passes; `bun run typecheck` clean; `bun run build` succeeds; `bun run lint`
  is 89 problems (85 errors, 4 warnings) — down from the 129 baseline (-40).
  The entire delta is `react/prop-types` errors disappearing (47 across the
  three converted files, e.g. `'schedules' is missing in props validation`)
  now that real TS prop types replace runtime prop-types checking — an
  expected, inherent side effect of TypeScript conversion (the same pattern
  seen in every earlier `.jsx`→`.tsx` conversion in this migration), not
  independent lint cleanup. The 7 pre-existing unused-variable errors in
  these three files (`Spinner`, `isLoadingRoles`, `isLoadingStateRoles`,
  `stateRoles`, two unused `data` callback params) were left exactly as they
  were — same 7 problems, now reported under `@typescript-eslint/no-unused-vars`
  instead of core `no-unused-vars` (the `.tsx` ESLint block swaps that rule),
  not removed or otherwise touched.
- Phase 3 manual check: _pending_ — not performed in this turn (no
  browser/dev-server session available); must be done before Phase 4 begins
- Phase 4 code conversion: done. `bunx @fission-ai/openspec validate ... --strict`
  passes; `bun run typecheck` clean; `bun run build` succeeds; `bun run lint`
  is 83 problems (79 errors, 4 warnings) — down from the Phase 3 baseline of
  89 (-6). All 6 fewer are `react/prop-types` errors in this one file
  disappearing (confirmed by linting the pre-conversion `.jsx` in isolation:
  exactly 6 problems, all `react/prop-types`, 0 remaining after conversion) —
  same expected, inherent side effect as every earlier phase's conversions,
  not independent cleanup. `src/pages/ScheduleDashboard.tsx`,
  `src/features/schedules/**`, `src/features/workers/**`, `src/pdf/Schedules/**`,
  and `useRoles()` all confirmed untouched via `git status`.
- Phase 4 manual check: _pending_ — not performed in this turn (no
  browser/dev-server session available); must be done before Phase 5 begins
- Final manual smoke pass (4/4 PDFs): _pending_
- Final lint count (before → after): _pending_
