# Design: Fix TS Migration Blockers

## 1. `isLoading` → `isPending` — the one authorized behavior change

Confirmed (again, as in `convert-admin-catalog-features-to-ts`) against the installed
`@tanstack/react-query@^5.51.23` types: `useMutation`'s result has no `isLoading`
field, only `isPending`. The 4 affected files each had a documented cast keeping
`isCreating`/`isEditing` typed but always `undefined`:

```ts
const mutation = useMutation({ ... });
const { mutate } = mutation;
const isCreating = (mutation as unknown as { isLoading?: boolean }).isLoading;
```

Reverted to the direct, correct destructure:

```ts
const { mutate, isPending: isCreating } = useMutation({ ... });
```

This is a **real, intentional behavior change**, explicitly authorized by this
change's brief ("keep behavior changes limited to correctly using `isPending`"):
`disabled={isCreating}` (and equivalents) will now actually disable the relevant
inputs/buttons while a create/edit mutation is in flight, which it never did before.
Nothing else about the mutation changes — same `mutationFn`, same `onSuccess`/
`onError`, same React Query key/invalidation.

Applied identically in:
- `src/features/groups/CreateGroupForm.tsx` (`isCreating`)
- `src/features/semesters/CreateSemesterForm.tsx` (`isCreating`)
- `src/features/studyPrograms/useEditStudyProgram.ts` (`isEditing`)
- `src/features/roles/useEditRole.ts` (`isEditing`)

`CreateEditStudyProgramForm.tsx`/`CreateEditRoleForm.tsx` (the consumers of the two
hooks) need no change themselves — they already just do `disabled={isEditing}`; only
the value flowing into that prop becomes meaningful.

## 2. `FormRow.tsx` — widened `children`, `isValidElement` guard instead of a direct access

Before:

```tsx
interface FormRowProps {
  label?: string;
  error?: string;
  alignTop?: boolean;
  children: ReactElement<{ id?: string }>;
}

function FormRow({ label, error, children, alignTop }: FormRowProps) {
  return (
    <StyledFormRow $alignTop={alignTop}>
      {label && <Label htmlFor={children.props.id}>{label}</Label>}
      {children}
      {error && <Error>{error}</Error>}
    </StyledFormRow>
  );
}
```

After:

```tsx
interface FormRowProps {
  label?: string;
  error?: string;
  alignTop?: boolean;
  children: ReactNode;
}

function FormRow({ label, error, children, alignTop }: FormRowProps) {
  const htmlFor = isValidElement<{ id?: string }>(children)
    ? children.props.id
    : undefined;

  return (
    <StyledFormRow $alignTop={alignTop}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error && <Error>{error}</Error>}
    </StyledFormRow>
  );
}
```

Why this preserves every existing behavior exactly:

- **Single labeled control (the original, still-primary case):** `children` is one
  `ReactElement`, `isValidElement` narrows it to `ReactElement<{ id?: string }>`,
  `.props.id` access is identical to before. Same `htmlFor` value, same rendered
  `<label>`.
- **No-label, multi-button action row (the case that previously needed a fragment):**
  `children` is an array of elements. `isValidElement(children)` is `false` for an
  array, so `htmlFor` is `undefined` — but `label` is also falsy at every one of
  these call sites (verified — this pattern is only ever used without a `label`), so
  `{label && <Label htmlFor={htmlFor}>{label}</Label>}` never renders the `<label>`
  at all. `htmlFor`'s computed value is irrelevant in this branch, exactly as
  before. **No fragment wrapper needed anymore** — `children` being an array is now a
  valid `ReactNode`, and React renders an array of children exactly like a fragment
  would (no extra DOM node).
- **A hypothetical `label` + multiple-children combination (doesn't exist in this
  codebase today, verified by grep):** previously this would have thrown
  (`children.props.id` on an array has no `.props`, `undefined.id` throws — actually
  `children.props` on an array is simply `undefined`, and reading `.id` off that
  throws `TypeError`). Now it degrades gracefully: `htmlFor` becomes `undefined`, the
  `<label>` still renders (just without a `for` attribute wiring it to a specific
  control). This is a **strict robustness improvement** for a case that isn't
  exercised anywhere today, not a behavior change for any real call site.

`isValidElement<{ id?: string }>` is the standard React type guard
(`children is ReactElement<{ id?: string }>` inside the `?` branch) — no cast, no
`any`, and it's exported directly from `react`.

`FormRowVertical.tsx` is intentionally **not** touched — grepped every one of its
call sites; none currently passes multiple children, so there's no real-world case
this change would fix there, and touching it would be unrequested scope creep.

## 3. `Row.jsx` → `Row.tsx`

```tsx
import styled, { css } from "styled-components";

interface RowOwnProps {
  type?: "horizontal" | "vertical";
}

const Row = styled.div<RowOwnProps>`
  display: flex;
  padding: 1rem 0;

  ${(props) =>
    props.type === "horizontal" &&
    css`
      justify-content: space-between;
      align-items: center;
    `}

  ${(props) =>
    props.type === "vertical" &&
    css`
      flex-direction: column;
      gap: 1.6rem;
    `}
`;

Row.defaultProps = {
  type: "vertical",
};

export default Row;
```

Same CSS, same `defaultProps`, same export shape — only a typed generic added.
`"horizontal" | "vertical"` matches every real call site (grepped across the whole
`src/` tree: only these two literal values and the bare, prop-less `<Row>` form are
ever used) and `Row.jsx`'s own `defaultProps`/interpolation branches — not widened to
an arbitrary `string`.

### Removing the 5 local casts

`DegreeTable.tsx`, `SubjectTable.tsx`, `GroupTable.tsx`, `StudyProgramsTable.tsx`,
`RoleTable.tsx` each had:

```ts
import UntypedRow from "../../ui/Row";
type RowProps = HTMLAttributes<HTMLDivElement> & { type?: "horizontal" | "vertical" };
const Row = UntypedRow as ComponentType<RowProps>;
```

Replaced with a plain `import Row from "../../ui/Row";` in all 5 — `Row.tsx` now
supplies the same typing natively. The now-unused `ComponentType`/`HTMLAttributes`
type-only imports from `react` are removed from each file's import line too (left in
place, they'd be flagged by `@typescript-eslint/no-unused-vars`, worsening lint for
no reason).

## 4. `usePagination.js` → `usePagination.ts`

```ts
import { useState } from "react";

const PAGE_SIZE = 10;

export function usePagination<T>(data: T[] = []) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalCount = data.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const safePage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;

  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedData = data.slice(startIndex, startIndex + PAGE_SIZE);

  return {
    currentPage: safePage,
    totalPages,
    totalCount,
    paginatedData,
    setCurrentPage,
  };
}
```

Identical algorithm, byte-for-byte — only a generic type parameter added. Every real
call site (`DegreeTable.tsx`, `SubjectTable.tsx`, `GroupTable.tsx`,
`StudyProgramsTable.tsx`, `RoleTable.tsx`, plus still-`.jsx` callers in
`OtherTable.jsx`, `StateRoleTable.jsx`, `WorkerTable.jsx`) calls it with exactly one
array argument, so `T` infers correctly at each call site with no annotation needed
there. This closes the "accepted, documented gap" from
`convert-admin-catalog-features-to-ts` design.md Section 4 — `paginatedData` is now
`Degree[]`/`Subject[]`/etc. instead of an effectively-`any[]` value flowing into
`Table.Body`'s generic.

## 5. Verification results

Baseline going in: **211 problems (207 errors, 4 warnings)**.

- [x] `bun run typecheck` — passes with no errors across all touched files.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **211 problems (207 errors, 4 warnings)**, unchanged
      from baseline as expected. `CreateEditRoleForm.tsx`'s 1
      `@typescript-eslint/no-unused-vars` and `CreateSemesterForm.tsx`'s 3
      `react-hooks/rules-of-hooks` entries remain present.
- [x] `git status`/`git diff --stat` — changed-file set is exactly: `Row.jsx`
      deleted, `Row.tsx` added; `usePagination.js` deleted, `usePagination.ts` added;
      `FormRow.tsx` modified; the 4 `isLoading`→`isPending` files modified; the 5
      Row-cast files modified; the 4 fragment-wrapper files modified (2 of which
      overlap with the `isLoading` list) — 15 distinct files total, plus this
      change's own `proposal.md`/`design.md`/`tasks.md`. No `CreateSemesterForm.tsx`
      hook-order fix, no Supabase/query-key change, no other feature module.
