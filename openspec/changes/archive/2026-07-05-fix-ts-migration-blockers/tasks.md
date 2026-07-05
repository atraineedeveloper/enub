# Tasks — fix-ts-migration-blockers

Status: implemented; typecheck/lint verified. The implementer reported build
passing, but independent review timed out locally after Vite started.

## Change artifacts

- [x] Write `proposal.md`.
- [x] Write `design.md`.
- [x] Write `tasks.md` (this file).

## Pre-conversion checks

- [x] Confirmed via `bun run lint` that `Row.jsx`/`usePagination.js` have 0
      `react/prop-types` errors today (`design.md` proposal Impact section).
- [x] Grepped every real `<Row ...>` call site across `src/` — only
      `type="horizontal"`, `type="vertical"`, and bare `<Row>` are ever used.
- [x] Grepped every real `usePagination(...)` call site — always called with exactly
      one array argument.
- [x] Grepped `FormRowVertical.tsx`'s call sites — none currently pass multiple
      children, so it's left untouched.
- [x] Confirmed the exact 4 files with the `isLoading` cast workaround via the two
      prior changes' design docs.

## Bug fix: `isLoading` → `isPending`

- [x] `src/features/groups/CreateGroupForm.tsx` — reverted to
      `const { mutate, isPending: isCreating } = useMutation({...})`; removed the
      `mutation` variable and cast comment.
- [x] `src/features/semesters/CreateSemesterForm.tsx` — same.
- [x] `src/features/studyPrograms/useEditStudyProgram.ts` — reverted to
      `const { mutate: editStudyProgramMutate, isPending: isEditing } = useMutation({...})`.
- [x] `src/features/roles/useEditRole.ts` — same, for `editRole`/`isEditing`.
- [x] Confirmed no `mutationFn`, `onSuccess`, `onError`, or query key changed in any
      of the 4 files.

## Typing cleanup: `FormRow.tsx`

- [x] Widened `children` to `ReactNode`; `htmlFor` computed via
      `isValidElement<{ id?: string }>(children) ? children.props.id : undefined`.
- [x] Confirmed single-labeled-control call sites still get the correct `htmlFor`
      (same `.props.id` access, now behind a type guard instead of a direct read).
- [x] `FormRowVertical.tsx` left untouched.

## Shared helper conversions

- [x] `src/ui/Row.tsx` — `RowOwnProps { type?: "horizontal" | "vertical" }` on
      `styled.div<RowOwnProps>`; same CSS, same `defaultProps`. Deleted `Row.jsx`.
- [x] `src/hooks/usePagination.ts` — `usePagination<T>(data: T[] = [])`; identical
      algorithm. Deleted `usePagination.js`.

## Cleanup in already-migrated files (now unnecessary)

- [x] Removed the local `Row` cast (and now-unused `ComponentType`/`HTMLAttributes`
      imports) from: `DegreeTable.tsx`, `SubjectTable.tsx`, `GroupTable.tsx`,
      `StudyProgramsTable.tsx`, `RoleTable.tsx` — plain
      `import Row from "../../ui/Row"` in each.
- [x] Removed the `<>...</>` fragment wrapper around the two-button action row in:
      `CreateGroupForm.tsx`, `CreateSemesterForm.tsx`,
      `CreateEditStudyProgramForm.tsx`, `CreateEditRoleForm.tsx`.
- [x] No import path updated anywhere else; no other file touched.

## Verification — results

- [x] `bun run typecheck` — passes, no errors, first attempt.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **211 problems (207 errors, 4 warnings)** — unchanged
      from baseline, exactly as predicted (neither `Row.jsx` nor `usePagination.js`
      contributed any `react/prop-types` errors). Confirmed
      `CreateEditRoleForm.tsx`'s 1 `no-unused-vars` and `CreateSemesterForm.tsx`'s 3
      `react-hooks/rules-of-hooks` entries remain present, unchanged in substance.
- [x] `git status`/`git diff --stat` — changed-file set is exactly: `Row.jsx`
      deleted, `Row.tsx` added; `usePagination.js` deleted, `usePagination.ts`
      added; `FormRow.tsx` modified; the 4 `isLoading`→`isPending` files modified;
      the 5 Row-cast files modified; the 4 fragment-wrapper files modified (2
      overlapping with the `isLoading` list) — 15 distinct files total, plus this
      change's own `proposal.md`/`design.md`/`tasks.md`. No other file.

## Not in scope for this change

- [ ] Fixing `CreateSemesterForm.tsx`'s 3 pre-existing `react-hooks/rules-of-hooks`
      errors.
- [ ] Any Supabase query, React Query key, or invalidation change.
- [ ] Any UI copy, layout, or styling change.
- [ ] Converting `workers`, `pages`, `pdf`, `schedules`, or any other feature module.
- [ ] Widening `FormRowVertical.tsx`'s children typing.
- [ ] Adding any dependency.
