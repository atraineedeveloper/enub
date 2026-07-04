# Tasks — convert-admin-catalog-features-to-ts

Status: **Phase 1 (degrees, subjects) and Phase 2 (groups, semesters) implemented;
typecheck/lint verified.** The implementer reported build passing, but independent
review timed out locally after Vite started. Phase 3 (studyPrograms, roles) not
started — do not begin without explicit instruction to continue.

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

## Phase 3: studyPrograms, roles — NOT STARTED

Do not begin without explicit instruction.

## Not in scope for this change (any phase)

- [ ] Converting `src/services/apiDegrees.js`, `apiSubjects.js`, `apiGroups.js`,
      `apiSemesters.js`, or `supabase.js`.
- [ ] Fixing `supabase.js`'s misapplied JSDoc `@type` comment.
- [ ] Converting `src/hooks/usePagination.js`, `src/ui/Row.jsx`, `src/ui/Form.jsx`, or
      `src/helpers/calculateSemesterGroup.js` (the local `Row` `type`-prop cast in
      `DegreeTable.tsx`/`SubjectTable.tsx`/`GroupTable.tsx` is the accepted
      workaround for now — see `design.md` Section 4b).
- [ ] Adding a null-check/fallback for `name`/`code`/`letter`/`year_of_admission`
      fields that the existing code already calls methods on unconditionally.
- [ ] Converting any schedules, workers, PDF, page, or other out-of-scope file that
      happens to import `useDegrees`/`useSubjects`/`useGroups`/`useSemesters`.

## Flagged for a real follow-up (not fixed here — typed to match current behavior only)

- [ ] **`CreateGroupForm.tsx`/`CreateSemesterForm.tsx`: `useMutation`'s destructured
      `isLoading` should be `isPending`** (TanStack Query v5 renamed it; `isLoading`
      has never existed on a mutation result in this app's installed version, so
      `isCreating` has always been `undefined` and `disabled={isCreating}` has never
      actually disabled anything during submission). Real, pre-existing bug,
      confirmed via `design.md` P2.3 — worth its own small fix, deliberately not done
      as part of this TS-only migration.
- [ ] **`FormRow.tsx`'s `children` type may need widening** to accept either one
      element or an array/fragment of elements — discovered because the no-label
      action-row pattern (`<FormRow><Button/><Button/></FormRow>`) appears in both
      `CreateGroupForm.tsx` and `CreateSemesterForm.tsx`, worked around here with a
      `<>...</>` wrapper rather than reopening the already-shipped
      `convert-remaining-shared-ui-to-ts` change (`design.md` P2.5). Worth revisiting
      once more feature forms are converted and this pattern recurs.
