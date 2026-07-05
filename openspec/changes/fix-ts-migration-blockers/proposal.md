# Proposal: Fix TS Migration Blockers

## Status

Draft

## Why

`convert-admin-catalog-features-to-ts` (and, before it, `convert-remaining-shared-ui-to-ts`)
flagged two recurring, real issues rather than fixing them, since fixing either was
out of scope for a pure rename-and-type migration:

1. `useMutation`'s destructured `isLoading` doesn't exist in the installed TanStack
   Query v5 (only `isPending` does) — so `isCreating`/`isEditing` has always been
   `undefined` at runtime in 4 files, and the corresponding `disabled={...}` has never
   actually disabled a field during submission.
2. `FormRow.tsx`'s `children: ReactElement<{ id?: string }>` type requires exactly one
   child, forcing a `<>...</>` fragment wrapper at every no-label, multi-button action
   row — a workaround needed in 4 forms so far.

Both were deliberately deferred, not ignored — this change is that deferred follow-up.
Separately, `Row.jsx` and `usePagination.js` have needed a local, duplicated
type-only cast/gap in every feature-table file converted so far (5 files for `Row`,
implicitly for `usePagination`'s loosely-typed `paginatedData`) — converting both
properly removes the duplication at the source.

## What changes

- **`isLoading` → `isPending`** in the 4 files that had the documented cast
  workaround: `src/features/groups/CreateGroupForm.tsx`,
  `src/features/semesters/CreateSemesterForm.tsx`,
  `src/features/studyPrograms/useEditStudyProgram.ts`,
  `src/features/roles/useEditRole.ts`. Each reverts to a plain destructure
  (`const { mutate, isPending: isCreating } = useMutation({...})`), removing the
  `mutation`-variable-plus-cast workaround entirely.
- **`src/ui/FormRow.tsx`**: `children` widened from `ReactElement<{ id?: string }>` to
  `ReactNode`; the `htmlFor` value is now computed with a `React.isValidElement` type
  guard instead of a direct `children.props.id` access, so a single labeled control
  still gets `htmlFor` wired correctly, and multiple/other children no longer need a
  fragment wrapper to satisfy the type.
- **`src/ui/Row.jsx` → `.tsx`**: `RowOwnProps { type?: "horizontal" | "vertical" }`
  applied as a `styled.div<RowOwnProps>` generic — matches every real call site and
  `Row.jsx`'s own `defaultProps`.
- **`src/hooks/usePagination.js` → `.ts`**: made generic
  (`usePagination<T>(data: T[] = [])`), so `paginatedData` is properly typed per
  caller instead of the previously-accepted `any[]`-ish gap.
- **Cleanup in already-migrated files**, now that the above exist:
  - Removed the local `Row` cast (`UntypedRow as ComponentType<RowProps>`) from the 5
    `.tsx` feature tables that had it: `DegreeTable.tsx`, `SubjectTable.tsx`,
    `GroupTable.tsx`, `StudyProgramsTable.tsx`, `RoleTable.tsx` — each now imports
    `Row` directly from `../../ui/Row`.
  - Removed the now-unnecessary `<>...</>` fragment wrapper around the 4 two-button
    action rows: `CreateGroupForm.tsx`, `CreateSemesterForm.tsx`,
    `CreateEditStudyProgramForm.tsx`, `CreateEditRoleForm.tsx`.

## What does not change

- `CreateSemesterForm.tsx`'s 3 pre-existing `react-hooks/rules-of-hooks` errors are
  explicitly **not** touched — out of scope per instruction.
- No Supabase query, React Query key, invalidation, or `mutationFn` changed anywhere.
- No UI copy, layout, or styling changed — `Row`'s CSS, `FormRow`'s label/error
  markup, and every form's visible text are byte-identical.
- No other feature module (`workers`, `pages`, `pdf`, `schedules`, etc.) touched.
- No dependency added.
- `FormRowVertical.tsx` is **not** touched — it has the same `children.props.id`
  shape as `FormRow.tsx` did, but no real call site currently needs multiple
  children through it (verified by grep), so widening it isn't required; doing so
  anyway would be scope creep beyond what's needed here.

## Impact

- **Affected code:** 4 files get `isLoading` → `isPending`; `FormRow.tsx` retyped;
  `Row.jsx` → `.tsx`; `usePagination.js` → `.ts`; 5 files lose their local `Row`
  cast; 4 files lose their fragment wrapper. 15 files total.
- **Behavior change (intentional, explicitly authorized):** in the same 4 files,
  form fields now actually disable while their mutation is pending, matching what
  `disabled={...}` always looked like it did. No other behavior changes anywhere.
- **Affected lint baseline:** `Row.jsx`/`usePagination.js` had 0 `react/prop-types`
  errors to begin with (neither is a React component with unvalidated props in the
  way the rule checks), so no lint-count change is expected from those two
  conversions specifically; see `design.md` for the exact verified before/after.
