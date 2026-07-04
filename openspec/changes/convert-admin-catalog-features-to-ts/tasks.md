# Tasks — convert-admin-catalog-features-to-ts

Status: **Phase 1 (degrees, subjects) implemented; typecheck/lint verified.** The
implementer reported build passing, but independent review timed out locally after
Vite started. Phase 2 (groups, semesters) and Phase 3 (studyPrograms, roles) not
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

## Phase 2: groups, semesters — NOT STARTED

Do not begin without explicit instruction.

## Phase 3: studyPrograms, roles — NOT STARTED

Do not begin without explicit instruction.

## Not in scope for this change (any phase)

- [ ] Converting `src/services/apiDegrees.js`, `apiSubjects.js`, or `supabase.js`.
- [ ] Fixing `supabase.js`'s misapplied JSDoc `@type` comment.
- [ ] Converting `src/hooks/usePagination.js` or `src/ui/Row.jsx` (the local cast in
      `DegreeTable.tsx`/`SubjectTable.tsx` is the accepted workaround for now — see
      `design.md` Section 4b).
- [ ] Adding a null-check/fallback for `name`/`code` fields that the existing code
      already calls string methods on unconditionally.
- [ ] Converting any schedules, workers, PDF, page, or other out-of-scope file that
      happens to import `useDegrees`/`useSubjects`.
