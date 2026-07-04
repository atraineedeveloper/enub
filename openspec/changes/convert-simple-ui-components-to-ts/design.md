# Design: Convert Simple UI Components to TS (batch)

## 1. Per-file prop shape (derived from actual call sites, not guessed)

Each component's prop shape was checked against every real call site in `src/` before
typing, not inferred from the component body alone.

### `SearchBar`

- Call sites (`DegreeTable`, `SemesterTable`, `StateRoleTable`, `WorkerTable`,
  `GroupTable`, `OtherTable`, `StudyProgramsTable`, `SubjectTable`, `RoleTable`): all
  pass `value={searchTerm}` (a `useState<string>`), `onChange={handleSearch}` (a plain
  `function handleSearch(e) { setSearchTerm(e.target.value) }`), and a literal string
  `placeholder`.
- `interface SearchBarProps { value: string; onChange: ChangeEventHandler<HTMLInputElement>; placeholder?: string }`
  — `ChangeEventHandler<HTMLInputElement>` (from `react`) matches the native `<input>`
  it's wired to, and is the precise callback type requested rather than a bare
  `Function`.

### `Pagination`

- Call sites (8 table features): `currentPage`/`totalPages`/`totalCount` are always
  numbers (`useState<number>` / derived counts), `onPageChange` is always a `useState`
  setter (`setCurrentPage`) called with a single number.
- `interface PaginationProps { currentPage: number; totalPages: number; totalCount: number; onPageChange: (page: number) => void }`.

### `Breadcrumbs`

- Call sites (`Semesters.jsx`: `[{ label: "Administrar horarios" }]`;
  `ScheduleDashboard.jsx`: `[{ label: "...", to: "/semesters" }, { label: "..." }]`) —
  `to` is present on some items, absent on others; `label` always present.
- `interface BreadcrumbItem { label: string; to?: string }`,
  `interface BreadcrumbsProps { items?: BreadcrumbItem[] }` (matches the existing
  `items = []` default).

### `ConfirmDelete`

- Call sites (`HourScheduleSubject`, `HourScheduleTeacher`,
  `HourScheduleSubjectGroup`, `WorkerDocumentsView`): `resourceName` always a string
  (literal or `document.file_name`), `disabled` always a boolean (`isDeleting`),
  `onConfirm` always a no-arg callback. `onCloseModal` is passed at 3 of the 4 call
  sites but **omitted** at the `WorkerDocumentsView` site — confirming it must stay
  optional, matching the existing `onCloseModal?.()` optional-call in the component
  body.
- `interface ConfirmDeleteProps { resourceName: string; onConfirm?: () => void; disabled?: boolean; onCloseModal?: () => void }`.
  `onConfirm` is also typed optional even though every current call site passes it,
  since the component body already guards it with `onConfirm?.()` — the prop type
  should describe the component's actual contract, not just today's call sites.

### `ProtectedRoute`

- Sole caller (`src/App.jsx`) always wraps JSX children:
  `<ProtectedRoute>{someElement}</ProtectedRoute>`.
- `interface ProtectedRouteProps { children: ReactNode }` — `ReactNode` per this
  batch's stated preference, not `JSX.Element`, since nothing about this component
  requires narrowing to element-only children.
- The component's existing implicit-`undefined` fallthrough (when neither
  `isLoading` nor `isAuthenticated` is true — the redirect-in-progress frame) is left
  exactly as-is. No explicit function return-type annotation is added, so TypeScript
  infers the union of `JSX.Element | ReactNode | undefined` from the existing branches
  — `strict` mode does not require exhaustive returns (`noImplicitReturns` is a
  separate, non-strict flag this repo does not enable), so this is not a new type
  error, and behavior is byte-identical to the `.jsx` version.

## 1b. Unplanned wrinkle found during verification: `Button.jsx`'s untyped custom props

`bun run typecheck` initially failed in `Pagination.tsx` and `ConfirmDelete.tsx`, not
because of anything wrong with their own prop types, but because both pass `size`/
`variation` to `Button` (`src/ui/Button.jsx`) — a plain, untyped `styled.button` whose
`size`/`variation` behavior exists only via runtime `styled-components` prop
interpolation (`${(props) => sizes[props.size]}`, `${(props) => variations[props.variation]}`),
never declared anywhere. Since `Button.jsx` stays `.jsx` (out of scope — only the 5
named files convert), TypeScript infers its export as a plain HTML `<button>` with no
knowledge of `size`/`variation`, so passing them from a fully type-checked `.tsx` file
is a real type error for the first time (`.jsx` callers were never type-checked at all).

Fix, scoped to only the two `.tsx` files that call `Button` with these props — **not**
to `Button.jsx` itself:

```ts
import UntypedButton from "./Button";
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "small" | "medium" | "large";
  variation?: "primary" | "secondary" | "danger";
};
const Button = UntypedButton as ComponentType<ButtonProps>;
```

This is a type-level cast only — zero runtime change, same imported component, same
`Button.jsx` file, untouched. The `size`/`variation` literal unions were taken directly
from `Button.jsx`'s own `sizes`/`variations` object keys, not guessed. This is recorded
here because it will recur for any future `.tsx` file that calls `Button` with these
props, until `Button.jsx` itself is eventually converted (out of scope for this batch).

## 2. What's deliberately not done

- No shared `src/types/` file is introduced for `BreadcrumbItem` or any other
  interface — each type lives next to its one component, per this batch's "do not
  introduce generic abstractions yet" constraint. If a second component needs
  `BreadcrumbItem`'s shape later, that's the trigger to extract it, not this change.
- `Button`, `Heading`, and `SpinnerFullPage` (imported by `Pagination`,
  `ConfirmDelete`, and `ProtectedRoute` respectively) are not converted or typed. They
  stay `.jsx`, imported as before; `allowJs: true` lets the new `.tsx` files import
  them without a compiler error, exactly as `openspec-ts-migration-foundation` and
  `typescript-tooling-foundation` both anticipated.
- No new ESLint or `tsconfig.json` change. `convert-first-ui-component-to-ts`
  established (by direct experiment) that `eslint-plugin-react`'s `prop-types` rule
  already recognizes a locally-declared TS interface on a destructured parameter with
  no config change — this batch relies on that same, already-verified behavior five
  more times rather than re-testing it.

## 3. Verification plan

Baseline going in: **303 problems (299 errors, 4 warnings)**, per
`convert-first-ui-component-to-ts`. Per-file `react/prop-types` counts confirmed via
`bun run lint` immediately before conversion: `SearchBar.jsx` 3, `Pagination.jsx` 4,
`Breadcrumbs.jsx` 1, `ConfirmDelete.jsx` 4, `ProtectedRoute.jsx` 1 — **13 total**.

- [ ] `bun run typecheck` — passes, no errors in any of the 5 new `.tsx` files.
- [ ] `bun run build` — passes; no change to any `dist/` bundle beyond the expected
      module-name/hash changes from the file renames.
- [ ] `bun run lint` — total drops from 303 to exactly **290** (299 → 286 errors, 4
      warnings unchanged) — the 13 `react/prop-types` errors listed above disappear,
      nothing else changes. If the actual count differs, investigate before reporting
      success.
- [ ] `git status`/`git diff --stat` — changed-file set is exactly the 5
      `src/ui/*.jsx` deletions, the 5 `src/ui/*.tsx` additions, and
      `openspec/changes/convert-simple-ui-components-to-ts/**`. No other `src/` file,
      no `eslint.config.js`/`tsconfig.json`/`package.json` change.
