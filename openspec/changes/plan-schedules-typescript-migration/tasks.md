# Tasks — plan-schedules-typescript-migration

Status: **Phase 0 (confirmations relevant to Phases 1–5), Phase 1 (query/
mutation hooks), Phase 2 (leaf cell components), Phase 3 (forms), Phase 4
(show/list containers), and Phase 5 (tab containers) implemented and
verified.** Phase 6 not started — do not begin without explicit instruction
to continue. Do not check off any item without actually doing the work and
re-verifying it.

## 1. Planning artifacts (this change)

- [x] Confirm `proposal.md` accurately states Why/What Changes/Capabilities/Impact,
      including the two explicitly authorized fixes
- [x] Confirm `specs/schedule-typescript-safety/spec.md` requirements cover
      list/table behavior, assignment behavior, teacher schedule behavior,
      group schedule behavior, React Query/Supabase behavior, route/page
      integration, the PDF-exporter exclusion boundary, and pre-existing-bug
      handling (default preservation plus the two authorized exceptions)
- [x] Confirm every requirement in `spec.md` has a body containing SHALL or
      MUST immediately after its `### Requirement:` header, not only in the
      header text
- [x] Confirm `design.md` includes Context, Goals/Non-Goals, Decisions,
      Risks/Trade-offs, Migration Plan, and a Closed Decisions section (not
      Open Questions) covering all 5 prior questions
- [x] Run `openspec validate` against this change and resolve any structural
      errors it reports — passed: "Change 'plan-schedules-typescript-migration' is valid"
- [x] Run `bunx @fission-ai/openspec validate plan-schedules-typescript-migration --type change --strict`
      and resolve any error it reports — passed: "Change 'plan-schedules-typescript-migration' is valid"
- [x] Get explicit human sign-off that the 5 Closed Decisions in `design.md`
      are acceptable before any implementation task below begins

## 2. Phase 0 — confirm closed decisions still hold (blocks all later phases)

- [x] Re-check (do not assume) that `CreateScholarSchedule.jsx`,
      `EditScholarSchedule.jsx`, and `RowTeacherAssignment.jsx` still have
      zero live importers; if any now has one, stop and re-plan that file
      before proceeding (Decision 1) — re-confirmed via grep: still zero live
      importers, unchanged from planning
- [x] Confirm the `isLoading` → `isPending` fix (Decision 2) will be applied
      to exactly the 6 schedule mutation hooks and their consuming
      components, with no change to query keys, mutation functions,
      invalidation, or Supabase calls
- [x] Confirm the `HourScheduleTeacher.jsx` `setEditModal` fix (Decision 3)
      will be the minimal, sibling-pattern-consistent fix, with no modal
      redesign
- [x] Confirm the `subjects.semester == semesterFound` comparison (Decision 4)
      will be preserved via local type normalization/cast, not rewritten to
      strict equality
- [x] Confirm the 3 duplicated `groupData` helper copies (Decision 5) will
      each be typed independently in place, with no consolidation — 2 of the
      3 in-scope copies (`ShowTeacherSchedule.tsx`, `TeacherAssignment.tsx`)
      are now typed independently in Phase 4; the third remains in the
      out-of-scope PDF exporters, untouched

## 3. Phase 1 — query/mutation hooks

- [x] Convert `useScheduleAssignments.js` → `.ts`
- [x] Convert `useScheduleTeachers.js` → `.ts`
- [x] Convert `useCreateScheduleAssignments.js` → `.ts`
- [x] Convert `useEditScheduleAssignments.js` → `.ts`
- [x] Convert `useDeleteScheduleAssignment.js` → `.ts`
- [x] Convert `useCreateScheduleTeacher.js` → `.ts`
- [x] Convert `useEditScheduleTeacher.js` → `.ts`
- [x] Convert `useDeleteScheduleTeacher.js` → `.ts`
- [x] Apply the authorized `isLoading` → `isPending` fix (Decision 2) in all
      6 mutation hooks above; leave `useScheduleAssignments.ts`/
      `useScheduleTeachers.ts` untouched beyond typing (they use `isLoading`
      correctly already — query hooks, not mutations)
- [x] Run `bun run typecheck`, `bun run build`, `bun run lint` after Phase 1;
      resolve before continuing — typecheck clean, build clean
      (`✓ built in 7.89s`), lint unchanged at 205 problems (201 errors, 4
      warnings), none attributable to the 8 converted files

## 4. Phase 2 — leaf cell components

- [x] Convert `HourScheduleSubject.jsx` → `.tsx`
- [x] Convert `HourScheduleSubjectGroup.jsx` → `.tsx`
- [x] Convert `HourScheduleTeacher.jsx` → `.tsx`
- [x] Apply the authorized `setEditModal` fix (Decision 3) in
      `HourScheduleTeacher.tsx`: add the same
      `const [editModal, setEditModal] = useState(false)` declaration its
      sibling components already have; do not change any other modal
      behavior
- [x] Update every component that consumes the 6 mutation hooks'
      `isCreating`/`isEditing`/`isDeleting` values to reflect the
      `isLoading` → `isPending` rename (Decision 2) — no consumer-side code
      change was needed: `HourScheduleSubject.tsx`/`HourScheduleSubjectGroup.tsx`
      (`useDeleteScheduleAssignment`) and `HourScheduleTeacher.tsx`
      (`useDeleteScheduleTeacher`) already destructure `isDeleting` by name,
      which Phase 1 already wired to the hook's real `isPending` value
      transparently
- [x] Convert `RowScholarSchedule.jsx` → `.tsx`
- [x] Convert `RowTeacherSchedule.jsx` → `.tsx`
- [x] Added local `ComponentType` casts for `CreateEditScholarSchedule`
      (still untyped, Phase 3) in `HourScheduleSubject.tsx`/
      `HourScheduleSubjectGroup.tsx` — its `semesterId` param has no
      destructured default so TS infers it as required, though the real
      component always falls back to `editValues.semester_id` when editing
- [x] Run `bun run typecheck`, `bun run build`, `bun run lint` after Phase 2;
      resolve before continuing — typecheck clean (after adding the 2 local
      casts above), build clean (`✓ built in 8.02s`), lint dropped to 168
      problems (164 errors, 4 warnings) from the 205 baseline

## 5. Phase 3 — forms

- [x] Convert `CreateEditScholarSchedule.jsx` → `.tsx`
- [x] Convert `CreateEditTeacherSchedule.jsx` → `.tsx`
- [x] Apply Decision 4 to the `subjects.semester == semesterFound`
      comparison: use a local type normalization/cast that preserves the
      current runtime comparison result; do not convert to strict equality —
      normalized to `Number(subject.semester) == semesterFound` (both sides
      numeric, loose `==` operator kept unchanged, matching every existing
      input's comparison result exactly)
- [x] Apply the `isLoading` → `isPending` rename (Decision 2) to this
      phase's forms' disabled/loading UI wiring — no source change was
      needed: both forms already destructure `isCreating`/`isEditing` by
      name from the Phase 1 hooks, which already resolve to the hooks' real
      `isPending` values
- [x] Run `bun run typecheck`, `bun run build`, `bun run lint` after Phase 3;
      resolve before continuing — typecheck clean on the first pass (no
      follow-up fixes needed), build clean (`✓ built in 5.92s`), lint
      dropped to 156 problems (152 errors, 4 warnings) from the 168 baseline

## 6. Phase 4 — show/list containers

- [x] Convert `ShowScholarSchedule.jsx` → `.tsx` — no local cast was needed
      for `ScheduleGroupPDF`: unlike `WorkerSheetSemester.jsx`, its
      destructured `{ schedules }` prop has no default value, so TS never
      narrowed it to `never[]`
- [x] Convert `ShowTeacherSchedule.jsx` → `.tsx` — same finding: no local
      cast needed for `ScheduleTeacherPDF` (its `{ schedulesScholar,
      scheduleTeacher, totalHours }` props also have no destructured
      defaults)
- [x] Convert `TeacherAssignment.jsx` → `.tsx` — same finding: no local cast
      needed for `TeacherAssignmentPDF` (its `{ groupedSubjects,
      uniqueTeacherSchedule, currentWorker }` props also have no
      destructured defaults)
- [x] Type each file's own copy of the `groupData` helper in place, per
      Decision 5 — do not extract a shared helper module — typed
      independently in `ShowTeacherSchedule.tsx` (`key: "subject_id"`) and
      `TeacherAssignment.tsx` (`key: "subject_id" | "group_id"`, since that
      file also calls it recursively grouping by `group_id`)
- [x] Run `bun run typecheck`, `bun run build`, `bun run lint` after Phase 4;
      resolve before continuing — typecheck clean on the first pass (no
      casts or follow-up fixes needed), build clean (`✓ built in 6.50s`),
      lint dropped to 138 problems (134 errors, 4 warnings) from the 156
      baseline

## 7. Phase 5 — tab containers

- [x] Convert `ScholarSchedule.jsx` → `.tsx`; remove the dead `workers`/
      `subjects` props passed into `CreateEditScholarSchedule` (never read
      there — see `design.md`) — removed the two JSX attributes on the
      `<CreateEditScholarSchedule>` call only; `groups` was kept since it's
      still forwarded to `ShowScholarSchedule`. `workers`/`subjects` remain
      in `ScholarScheduleProps` (so `ScheduleDashboard.tsx`'s existing call
      needs no change) but are no longer destructured/bound to a local name,
      so they don't become new unused-variable lint noise
- [x] Convert `TeacherSchedule.jsx` → `.tsx` — no dead prop-threading found
      or removed here (not listed for this file); all props it forwards to
      `CreateEditTeacherSchedule`/`ShowTeacherSchedule`/`TeacherAssignment`
      are genuinely read by those components' real Props interfaces
- [x] Grep for explicit `.jsx`/`.js`-extension imports of every file renamed
      in Phases 1–5; fix only those pointing at renamed schedules files —
      none found anywhere in the repo (only two stale, informational
      comments in already-committed Phase 2 files, left untouched)
- [x] Run `bun run typecheck`, `bun run build`, `bun run lint` after Phase 5;
      resolve before continuing — typecheck failed once (a real, unrelated
      pre-existing mismatch surfaced in `ScheduleDashboard.tsx`'s `subjects`
      prop; resolved by typing `ScholarScheduleProps.subjects` as optional
      rather than touching the page file — see `design.md`-style note
      above), then clean; build clean (`✓ built in 4.92s`); lint dropped to
      129 problems (125 errors, 4 warnings) from the 138 baseline

## 8. Phase 6 — full verification

- [ ] Run `openspec validate` on the implementation change
- [ ] Run `bunx @fission-ai/openspec validate <implementation-change-name> --type change --strict`
- [ ] Run `bun run typecheck` (full repo)
- [ ] Run `bun run build` (full repo)
- [ ] Run `bun run lint` (full repo); record before/after totals against the
      205-problem baseline recorded in `design.md`
- [ ] Manual smoke check: both schedule tabs render on `/semesters/:id`
- [ ] Manual smoke check: create/edit/delete a scholar schedule assignment,
      including a conflict-detection rejection case
- [ ] Manual smoke check: create/edit/delete a teacher activity, including a
      conflict-detection rejection case
- [ ] Manual smoke check: group filter (scholar) and worker filter (teacher)
      both still filter correctly
- [ ] Manual smoke check: all 3 schedule-related PDF export buttons still
      produce a PDF with unchanged content
- [ ] Manual smoke check: mutation buttons/selects now visibly disable during
      in-flight create/edit/delete requests (Decision 2's authorized fix)
- [ ] Manual smoke check: closing the teacher-activity edit modal no longer
      throws a `ReferenceError` (Decision 3's authorized fix)
- [ ] Confirm `CreateScholarSchedule.jsx`, `EditScholarSchedule.jsx`, and
      `RowTeacherAssignment.jsx` are unmodified in the diff (Decision 1)
- [ ] Confirm no shared `groupData` helper module was introduced and all
      copies remain in their original files (Decision 5)
- [ ] Confirm `git status`/`git diff --stat` changed-file set matches exactly
      what Phases 1–5 intended — no unrelated file touched

## 9. Not in scope for the eventual implementation change

- [ ] Do not convert any file under `src/pdf/**`
- [ ] Do not convert `src/helpers/**`
- [ ] Do not convert `src/services/apiScheduleAssignments.js`/
      `apiScheduleTeachers.js` beyond what a local cast cannot resolve
- [ ] Do not migrate, delete, or otherwise modify `CreateScholarSchedule.jsx`,
      `EditScholarSchedule.jsx`, or `RowTeacherAssignment.jsx` (Decision 1)
- [ ] Do not consolidate the duplicated `groupData` helper implementations
      (Decision 5)
- [ ] Do not convert `subjects.semester == semesterFound` to strict equality
      as a "cleanup" (Decision 4)
- [ ] Do not modify `package.json`, `tsconfig.json`, `eslint.config.js`, or
      any generated Supabase type
- [ ] Do not fix any lint issue this plan didn't explicitly call out
      (`react/no-unescaped-entities`, unused imports/vars) beyond the two
      authorized fixes (Decisions 2 and 3)
