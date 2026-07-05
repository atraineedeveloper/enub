# Tasks — convert-admin-catalog-features-to-ts

Status: **All three phases implemented; typecheck/lint verified.** The implementer
reported build passing, but independent review timed out locally after Vite started.
This completes the admin catalog feature-module migration once a clean local build
transcript is confirmed.

## Phase 1: degrees, subjects — DONE

### Change artifacts

- [x] Write `proposal.md`.
- [x] Write `design.md`.
- [x] Write `tasks.md` (this file).

### Pre-conversion checks

- [x] Ran `bun run lint` and recorded the exact per-file baseline: `DegreeRow.jsx` 4,
      `SubjectRow.jsx` 12, `DegreeTable.jsx`/`SubjectTable.jsx`/`useDegrees.js`/
      `useSubjects.js` 0 each (see `design.md` Section 6).
- [x] Read `src/types/supabase.ts`'s `degrees`/`subjects`/`study_programs` `Row`
      types and cross-checked against `apiDegrees.js`/`apiSubjects.js`'s actual
      `.select(...)` calls to confirm the joined shape (`design.md` Section 2).
- [x] Confirmed `src/services/supabase.js`'s Supabase client is not generically typed
      with `Database` (its one JSDoc `@type` comment is misapplied to a different
      line) — informs why `apiDegrees.js`/`apiSubjects.js` return loosely-typed data
      and why the `useQuery` generic is needed (`design.md` Section 1).
- [x] Identified every existing non-null string-method call on a nullable schema
      field (`name.toUpperCase()`, `degree.name/code.toLowerCase()`,
      `subject.name.toLowerCase()`) to plan non-null assertions instead of new
      runtime guards (`design.md` Section 3).
- [x] Grepped for explicit `.jsx`/`.js`-extension imports of all 6 target files
      across `src/`, and for every out-of-scope `.jsx` consumer of
      `useDegrees`/`useSubjects` — found none needing a change (`design.md`
      Section 5).

### Conversion

- [x] `src/features/degrees/useDegrees.ts` — exports `Degree` (from
      `Database["public"]["Tables"]["degrees"]["Row"]`), `useQuery<Degree[]>`.
      Deleted `useDegrees.js`.
- [x] `src/features/degrees/DegreeRow.tsx` — `DegreeRowProps { degree: Degree }`.
      Deleted `DegreeRow.jsx`.
- [x] `src/features/degrees/DegreeTable.tsx` — no props; `handleSearch` typed
      `(e: ChangeEvent<HTMLInputElement>)`; non-null assertions on
      `degree.name`/`degree.code` in the filter (preserving existing behavior — see
      `design.md` Section 3). Deleted `DegreeTable.jsx`.
- [x] `src/features/subjects/useSubjects.ts` — exports `Subject` (generated
      `subjects` Row intersected with nullable embedded `study_programs`/`degrees`
      rows), `useQuery<Subject[]>`. Deleted `useSubjects.js`.
- [x] `src/features/subjects/SubjectRow.tsx` — `SubjectRowProps { subject: Subject }`;
      non-null assertions on `name!.toUpperCase()`, `study_programs!.year`, and
      `degrees!.code`. Deleted `SubjectRow.jsx`.
- [x] `src/features/subjects/SubjectTable.tsx` — no props; `handleSearch` typed;
      non-null assertion on `subject.name!.toLowerCase()` in the filter. Deleted
      `SubjectTable.jsx`.
- [x] Fixed the one unplanned issue found via `bun run typecheck`: `Row.jsx` (out of
      scope, untyped) has a custom `type` prop invisible to TS from a `.tsx` caller;
      added a local `as ComponentType<RowProps>` cast in both `DegreeTable.tsx` and
      `SubjectTable.tsx` — `Row.jsx` itself is untouched (`design.md` Section 4b).
- [x] No import path updated anywhere (confirmed unnecessary in pre-conversion
      checks).
- [x] No other file modified; `apiDegrees.js`, `apiSubjects.js`, `supabase.js`,
      `usePagination.js`, `Row.jsx`, `eslint.config.js`, `tsconfig.json`,
      `package.json` all untouched.

### Verification — results

- [x] `bun run typecheck` — failed once (`Row`'s untyped `type` prop), fixed, then
      passes with no errors.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **237 problems (233 errors, 4 warnings)**, down from
      253 by exactly the predicted 16 (`DegreeRow` 4, `SubjectRow` 12).
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 6 renames and
      `openspec/changes/convert-admin-catalog-features-to-ts/**`. No other file.

## Phase 2: groups, semesters — DONE

### Pre-conversion checks

- [x] Ran `bun run lint` and recorded the exact per-file baseline: `GroupRow.jsx` 6,
      `SemesterRow.jsx` 4, `CreateSemesterForm.jsx` 1 `react/prop-types` + 3
      pre-existing `react-hooks/rules-of-hooks` (already classified as real defects
      in `openspec-ts-migration-foundation`, not to be fixed here);
      `GroupTable.jsx`/`useGroups.js`/`CreateGroupForm.jsx`/`SemesterTable.jsx`/
      `useSemesters.js` 0 each (`design.md` Phase 2 Section P2.2).
- [x] Read `src/types/supabase.ts`'s `groups`/`semesters` `Row` types and confirmed
      `groups.degree_id`'s nullability against `apiGroups.js`'s
      `select("*, degrees(*)")` join (`design.md` Section P2.1).
- [x] Grepped for explicit `.jsx`/`.js`-extension imports of all 8 target files, and
      for out-of-scope `.jsx` consumers — found none needing a change.

### Conversion

- [x] `src/features/groups/useGroups.ts` — exports `Group` (generated Row
      intersected with nullable embedded `degrees`), `useQuery<Group[]>`. Deleted
      `useGroups.js`.
- [x] `src/features/groups/GroupRow.tsx` — `GroupRowProps { group: Group }`;
      non-null assertion on `degrees!.code`; removed a dead, already-ignored
      `role="row"` prop on `<Table.Row>` (discovery — `design.md` P2.6). Deleted
      `GroupRow.jsx`.
- [x] `src/features/groups/GroupTable.tsx` — no props; `handleSearch` typed;
      non-null assertions on `group.year_of_admission!`/`group.letter!` and on the
      pre-existing `groups!.filter(...)` ternary branch; local `Row` `type`-prop cast
      (same pattern as Phase 1). Deleted `GroupTable.jsx`.
- [x] `src/features/groups/CreateGroupForm.tsx` — no props; reuses `Degree` from
      `../degrees/useDegrees`; non-null assertion on `degrees!.map(...)`; fixed the
      `useMutation().isLoading` typing gap (discovery — `design.md` P2.3) and the
      `errors.message` typing gap (discovery — P2.4) and the two-child `<FormRow>`
      (discovery — P2.5), all via local, zero-behavior-change casts/wrapping.
      Deleted `CreateGroupForm.jsx`.
- [x] `src/features/semesters/useSemesters.ts` — exports `Semester` (plain generated
      Row, no embeds), `useQuery<Semester[]>`. Deleted `useSemesters.js`.
- [x] `src/features/semesters/SemesterRow.tsx` — `SemesterRowProps { semester: Semester }`.
      Deleted `SemesterRow.jsx`.
- [x] `src/features/semesters/SemesterTable.tsx` — no props; `handleSearch` typed;
      non-null assertions on `sem.semester!`/`sem.school_year!`. Deleted
      `SemesterTable.jsx`.
- [x] `src/features/semesters/CreateSemesterForm.tsx` —
      `CreateSemesterFormProps { onCloseModal?: () => void }`; same
      `isLoading`/`errors.message`/two-child-`FormRow` fixes as `CreateGroupForm.tsx`;
      hook-call structure (including the 3 pre-existing `rules-of-hooks` violations)
      preserved byte-identical. Deleted `CreateSemesterForm.jsx`.
- [x] No import path updated anywhere (confirmed unnecessary in pre-conversion
      checks).
- [x] No other file modified; `apiGroups.js`, `apiSemesters.js`,
      `calculateSemesterGroup.js`, `Form.jsx`, `FormRow.tsx`, `Row.jsx`,
      `eslint.config.js`, `tsconfig.json`, `package.json` all untouched.

### Verification — results

- [x] `bun run typecheck` — failed 4 times (P2.3–P2.6 in `design.md`), each fixed,
      then passes with no errors.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **226 problems (222 errors, 4 warnings)**, down from
      237 by exactly the predicted 11. Confirmed `CreateSemesterForm.tsx`'s 3
      `react-hooks/rules-of-hooks` entries remain present, unchanged.
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 8 renames and
      `openspec/changes/convert-admin-catalog-features-to-ts/**`. No other file.

## Phase 3: studyPrograms, roles — DONE

### Pre-conversion checks

- [x] Ran `bun run lint` and recorded the exact per-file baseline: `StudyProgramRow.jsx`
      5, `CreateEditStudyProgramForm.jsx` 2, `RoleRow.jsx` 6,
      `CreateEditRoleForm.jsx` 2 `react/prop-types` + 1 pre-existing `no-unused-vars`
      (unused `data` param); `StudyProgramsTable.jsx`/`useStudyPrograms.js`/
      `useEditStudyProgram.js`/`RoleTable.jsx`/`useRoles.js`/`useEditRole.js` 0 each
      (`design.md` Phase 3 Section P3.4).
- [x] Read `src/types/supabase.ts`'s `study_programs`/`roles`/`workers` `Row` types
      and confirmed `roles.worker_id`'s nullability against `apiRoles.js`'s
      `select("*, workers(*))")` join (`design.md` Section P3.1).
- [x] Grepped for explicit `.jsx`/`.js`-extension imports of all 10 target files
      across `src/` — found 4 matches, all `useRoles.js` imports in out-of-scope PDF
      files (`design.md` Section P3.5).
- [x] Confirmed `RoleRow.jsx`/`RoleTable.jsx` use their own local styled-components
      (not the shared `src/ui/Table.tsx`), so no `Table.Row`-style cast/discovery
      applies there.

### Conversion

- [x] `src/features/studyPrograms/useStudyPrograms.ts` — exports `StudyProgram`
      (plain generated Row, no embeds), `useQuery<StudyProgram[]>`. Deleted
      `useStudyPrograms.js`.
- [x] `src/features/studyPrograms/useEditStudyProgram.ts` — local
      `EditStudyProgramVariables`; same documented `isLoading` cast as Phase 2.
      Deleted `useEditStudyProgram.js`.
- [x] `src/features/studyPrograms/StudyProgramRow.tsx` — `StudyProgramRowProps { program: StudyProgram }`.
      Deleted `StudyProgramRow.jsx`.
- [x] `src/features/studyPrograms/StudyProgramsTable.tsx` — no props; `handleSearch`
      typed; non-null assertion on `program.name!.toLowerCase()`; local `Row`
      `type`-prop cast. Deleted `StudyProgramsTable.jsx`.
- [x] `src/features/studyPrograms/CreateEditStudyProgramForm.tsx` —
      `CreateEditStudyProgramFormProps { programToEdit?: Partial<StudyProgram>; onCloseModal?: () => void }`;
      non-null assertion on `editId!`; `errors.message` cast; two-button `<FormRow>`
      wrapped in a fragment (same Phase 2 pattern). Deleted
      `CreateEditStudyProgramForm.jsx`.
- [x] `src/features/roles/useRoles.ts` — exports `Role` (generated Row intersected
      with nullable embedded `workers`), `useQuery<Role[]>`. Deleted `useRoles.js`.
- [x] `src/features/roles/useEditRole.ts` — local `EditRoleVariables`; same
      documented `isLoading` cast. Deleted `useEditRole.js`.
- [x] `src/features/roles/RoleRow.tsx` — `RoleRowProps { role: Role }`; non-null
      assertion on `role.workers!.name`. Deleted `RoleRow.jsx`.
- [x] `src/features/roles/RoleTable.tsx` — no props; `handleSearch` typed; non-null
      assertions on `role.workers!.name!.toLowerCase()`; local `Row` `type`-prop
      cast; own local `Table`/`TableHeader`/`TableFooter` styled-components needed no
      changes beyond the rename. Deleted `RoleTable.jsx`.
- [x] `src/features/roles/CreateEditRoleForm.tsx` —
      `CreateEditRoleFormProps { roleToEdit?: Partial<Role>; onCloseModal?: () => void }`;
      non-null assertion on `editId!`; `errors.message` cast; two-button `<FormRow>`
      wrapped in a fragment; pre-existing unused `data` param in the nested
      `onSuccess` callback preserved verbatim; fixed the unplanned `workers` possibly-
      undefined typecheck failure (discovery — `design.md` P3.6) with
      `workers!.map(...)`. Deleted `CreateEditRoleForm.jsx`.
- [x] Fixed the one import-path issue found via grep: updated `useRoles.js` →
      `useRoles.ts` in the one import line each of `TeacherAssignmentPDF.jsx`,
      `ScheduleGroupPDF.jsx`, `ScheduleTeacherPDF.jsx`, `WorkerSheetSemester.jsx`
      (discovery — `design.md` P3.5). No other line in any of these 4 files touched.
- [x] No other file modified; `apiStudyPrograms.js`, `apiRoles.js`,
      `capitalizeFirstLetter.js`, `useWorkers.js`, `Row.jsx`, `FormRow.tsx`,
      `Table.tsx`, `Modal.tsx`, `Menus.tsx`, `eslint.config.js`, `tsconfig.json`,
      `package.json` all untouched.

### Verification — results

- [x] `bun run typecheck` — failed once (P3.6, `workers` possibly undefined), fixed,
      then passes with no errors.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **211 problems (207 errors, 4 warnings)**, down from
      226 by exactly the predicted 15. Confirmed `CreateEditRoleForm.tsx`'s 1
      `@typescript-eslint/no-unused-vars` entry remains present, unchanged.
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 10 renames,
      the 4 PDF files' one-line import fix each, and
      `openspec/changes/convert-admin-catalog-features-to-ts/**`. No other file.

## Migration status: complete

All three phases (degrees/subjects, groups/semesters, studyPrograms/roles) done.
Cumulative lint movement across this whole change: **253 → 211** (42
`react/prop-types` errors removed across the three phases), zero regressions in any
other rule at any step.

## Not in scope for this change (any phase)

- [ ] Converting `src/services/apiDegrees.js`, `apiSubjects.js`, `apiGroups.js`,
      `apiSemesters.js`, `apiStudyPrograms.js`, `apiRoles.js`, `apiWorkers.js`, or
      `supabase.js`.
- [ ] Fixing `supabase.js`'s misapplied JSDoc `@type` comment.
- [ ] Converting `src/hooks/usePagination.js`, `src/ui/Row.jsx`, `src/ui/Form.jsx`,
      `src/helpers/calculateSemesterGroup.js`, `src/helpers/capitalizeFirstLetter.js`,
      or `src/features/workers/useWorkers.js` (the local `Row` `type`-prop cast used
      across `DegreeTable.tsx`/`SubjectTable.tsx`/`GroupTable.tsx`/
      `StudyProgramsTable.tsx`/`RoleTable.tsx` is the accepted workaround for now —
      see `design.md` Section 4b).
- [ ] Adding a null-check/fallback for any nullable schema field that the existing
      code already calls methods on unconditionally.
- [ ] Converting any schedules, workers, PDF, page, or other out-of-scope file
      beyond the 4 PDF files' one-line `useRoles` import-extension fix.

## Flagged for a real follow-up (not fixed here — typed to match current behavior only)

- [ ] **`useMutation`'s destructured `isLoading` should be `isPending`**
      (TanStack Query v5 renamed it; `isLoading` has never existed on a mutation
      result in this app's installed version). Affects `CreateGroupForm.tsx`,
      `CreateSemesterForm.tsx`, `useEditStudyProgram.ts`, `useEditRole.ts` — in every
      case the destructured `isLoading`/`isEditing`/`isCreating` has always been
      `undefined` at runtime, so the corresponding `disabled={...}` has never
      actually disabled anything during submission. Real, pre-existing bug across 4
      files now, confirmed via `design.md` P2.3 — worth its own small fix,
      deliberately not done as part of this TS-only migration.
- [ ] **`FormRow.tsx`'s `children` type may need widening** to accept either one
      element or an array/fragment of elements — the no-label action-row pattern
      (`<FormRow><Button/><Button/></FormRow>`) now appears in 4 forms
      (`CreateGroupForm.tsx`, `CreateSemesterForm.tsx`,
      `CreateEditStudyProgramForm.tsx`, `CreateEditRoleForm.tsx`), each worked around
      with a `<>...</>` wrapper rather than reopening the already-shipped
      `convert-remaining-shared-ui-to-ts` change (`design.md` P2.5). Worth revisiting
      now that the pattern has recurred in every mutation-form feature converted so
      far.
