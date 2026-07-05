# Tasks — plan-schedules-typescript-migration

Status: **Planning only. No implementation task below is started or
complete.** This task list governs a future implementation change; it is
recorded here so the phase structure, validation gates, and closed decisions
are on record before any file is touched. Do not check off any item without
actually doing the work and re-verifying it.

## 1. Planning artifacts (this change)

- [ ] Confirm `proposal.md` accurately states Why/What Changes/Capabilities/Impact,
      including the two explicitly authorized fixes
- [ ] Confirm `specs/schedule-typescript-safety/spec.md` requirements cover
      list/table behavior, assignment behavior, teacher schedule behavior,
      group schedule behavior, React Query/Supabase behavior, route/page
      integration, the PDF-exporter exclusion boundary, and pre-existing-bug
      handling (default preservation plus the two authorized exceptions)
- [ ] Confirm every requirement in `spec.md` has a body containing SHALL or
      MUST immediately after its `### Requirement:` header, not only in the
      header text
- [ ] Confirm `design.md` includes Context, Goals/Non-Goals, Decisions,
      Risks/Trade-offs, Migration Plan, and a Closed Decisions section (not
      Open Questions) covering all 5 prior questions
- [ ] Run `openspec validate` against this change and resolve any structural
      errors it reports
- [ ] Run `bunx @fission-ai/openspec validate plan-schedules-typescript-migration --type change --strict`
      and resolve any error it reports
- [ ] Get explicit human sign-off that the 5 Closed Decisions in `design.md`
      are acceptable before any implementation task below begins

## 2. Phase 0 — confirm closed decisions still hold (blocks all later phases)

- [ ] Re-check (do not assume) that `CreateScholarSchedule.jsx`,
      `EditScholarSchedule.jsx`, and `RowTeacherAssignment.jsx` still have
      zero live importers; if any now has one, stop and re-plan that file
      before proceeding (Decision 1)
- [ ] Confirm the `isLoading` → `isPending` fix (Decision 2) will be applied
      to exactly the 6 schedule mutation hooks and their consuming
      components, with no change to query keys, mutation functions,
      invalidation, or Supabase calls
- [ ] Confirm the `HourScheduleTeacher.jsx` `setEditModal` fix (Decision 3)
      will be the minimal, sibling-pattern-consistent fix, with no modal
      redesign
- [ ] Confirm the `subjects.semester == semesterFound` comparison (Decision 4)
      will be preserved via local type normalization/cast, not rewritten to
      strict equality
- [ ] Confirm the 3 duplicated `groupData` helper copies (Decision 5) will
      each be typed independently in place, with no consolidation

## 3. Phase 1 — query/mutation hooks

- [ ] Convert `useScheduleAssignments.js` → `.ts`
- [ ] Convert `useScheduleTeachers.js` → `.ts`
- [ ] Convert `useCreateScheduleAssignments.js` → `.ts`
- [ ] Convert `useEditScheduleAssignments.js` → `.ts`
- [ ] Convert `useDeleteScheduleAssignment.js` → `.ts`
- [ ] Convert `useCreateScheduleTeacher.js` → `.ts`
- [ ] Convert `useEditScheduleTeacher.js` → `.ts`
- [ ] Convert `useDeleteScheduleTeacher.js` → `.ts`
- [ ] Apply the authorized `isLoading` → `isPending` fix (Decision 2) in all
      6 mutation hooks above; leave `useScheduleAssignments.ts`/
      `useScheduleTeachers.ts` untouched beyond typing (they use `isLoading`
      correctly already — query hooks, not mutations)
- [ ] Run `bun run typecheck`, `bun run build`, `bun run lint` after Phase 1;
      resolve before continuing

## 4. Phase 2 — leaf cell components

- [ ] Convert `HourScheduleSubject.jsx` → `.tsx`
- [ ] Convert `HourScheduleSubjectGroup.jsx` → `.tsx`
- [ ] Convert `HourScheduleTeacher.jsx` → `.tsx`
- [ ] Apply the authorized `setEditModal` fix (Decision 3) in
      `HourScheduleTeacher.tsx`: add the same
      `const [editModal, setEditModal] = useState(false)` declaration its
      sibling components already have; do not change any other modal
      behavior
- [ ] Update every component that consumes the 6 mutation hooks'
      `isCreating`/`isEditing`/`isDeleting` values to reflect the
      `isLoading` → `isPending` rename (Decision 2)
- [ ] Convert `RowScholarSchedule.jsx` → `.tsx`
- [ ] Convert `RowTeacherSchedule.jsx` → `.tsx`
- [ ] Run `bun run typecheck`, `bun run build`, `bun run lint` after Phase 2;
      resolve before continuing

## 5. Phase 3 — forms

- [ ] Convert `CreateEditScholarSchedule.jsx` → `.tsx`
- [ ] Convert `CreateEditTeacherSchedule.jsx` → `.tsx`
- [ ] Apply Decision 4 to the `subjects.semester == semesterFound`
      comparison: use a local type normalization/cast that preserves the
      current runtime comparison result; do not convert to strict equality
- [ ] Apply the `isLoading` → `isPending` rename (Decision 2) to this
      phase's forms' disabled/loading UI wiring
- [ ] Run `bun run typecheck`, `bun run build`, `bun run lint` after Phase 3;
      resolve before continuing

## 6. Phase 4 — show/list containers

- [ ] Convert `ShowScholarSchedule.jsx` → `.tsx` (local cast for the
      out-of-scope `ScheduleGroupPDF` call site)
- [ ] Convert `ShowTeacherSchedule.jsx` → `.tsx` (local cast for the
      out-of-scope `ScheduleTeacherPDF` call site)
- [ ] Convert `TeacherAssignment.jsx` → `.tsx` (local cast for the
      out-of-scope `TeacherAssignmentPDF` call site)
- [ ] Type each file's own copy of the `groupData` helper in place, per
      Decision 5 — do not extract a shared helper module
- [ ] Run `bun run typecheck`, `bun run build`, `bun run lint` after Phase 4;
      resolve before continuing

## 7. Phase 5 — tab containers

- [ ] Convert `ScholarSchedule.jsx` → `.tsx`; remove the dead
      `workers`/`subjects`/`groups` props passed into
      `CreateEditScholarSchedule` (never read there — see `design.md`)
- [ ] Convert `TeacherSchedule.jsx` → `.tsx`
- [ ] Grep for explicit `.jsx`/`.js`-extension imports of every file renamed
      in Phases 1–5; fix only those pointing at renamed schedules files
- [ ] Run `bun run typecheck`, `bun run build`, `bun run lint` after Phase 5;
      resolve before continuing

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
