# Tasks — convert-simple-ui-components-to-ts

Status: implemented — typecheck/lint verified; build needs a local rerun because the
reviewer rerun timed out without Vite diagnostics.

## Phase 1: Change artifacts

- [x] Write `proposal.md`.
- [x] Write `design.md`.
- [x] Write `tasks.md` (this file).

## Phase 2: Pre-conversion checks

- [x] Grep every call site for each of the 5 target components; confirm every import
      is extension-less (no import statement needs to change after the rename).
- [x] Record each file's exact current prop shape and every call site's actual
      argument types/optionality (see `design.md` Section 1) — not guessed from the
      component body alone.
- [x] Run `bun run lint` and record the exact `react/prop-types` count per target file
      before converting anything: `SearchBar.jsx` 3, `Pagination.jsx` 4,
      `Breadcrumbs.jsx` 1, `ConfirmDelete.jsx` 4, `ProtectedRoute.jsx` 1 (13 total).

## Phase 3: Conversion

- [x] `src/ui/SearchBar.tsx` — `SearchBarProps` (`value: string`,
      `onChange: ChangeEventHandler<HTMLInputElement>`, `placeholder?: string`);
      deleted `SearchBar.jsx`.
- [x] `src/ui/Pagination.tsx` — `PaginationProps` (`currentPage`, `totalPages`,
      `totalCount: number`, `onPageChange: (page: number) => void`); deleted
      `Pagination.jsx`.
- [x] `src/ui/Breadcrumbs.tsx` — `BreadcrumbItem` (`label: string`, `to?: string`),
      `BreadcrumbsProps` (`items?: BreadcrumbItem[]`); deleted `Breadcrumbs.jsx`.
- [x] `src/ui/ConfirmDelete.tsx` — `ConfirmDeleteProps` (`resourceName: string`,
      `onConfirm?: () => void`, `disabled?: boolean`, `onCloseModal?: () => void`);
      deleted `ConfirmDelete.jsx`.
- [x] `src/ui/ProtectedRoute.tsx` — `ProtectedRouteProps` (`children: ReactNode`);
      deleted `ProtectedRoute.jsx`.
- [x] No import statement changed anywhere for the *call sites* of these 5 components
      (confirmed unnecessary in Phase 2). Within `Pagination.tsx` and
      `ConfirmDelete.tsx` themselves, the `Button` import gained a type-only cast — see
      `design.md` Section 1b (unplanned, found via `bun run typecheck`, not part of the
      original plan).
- [x] No other file modified; `Button.jsx` itself, `eslint.config.js`,
      `tsconfig.json`, and `package.json` are all untouched.

## Phase 4: Verification — results

- [x] `bun run typecheck` — passes, no errors.
- [ ] `bun run build` — another agent reported this passing, but reviewer rerun with
      `timeout 180s bun run build` timed out after printing only `$ vite build` and no
      Vite diagnostics. Rerun locally before commit; do not fix unrelated build/runtime
      behavior in this TS conversion batch.
- [x] `bun run lint` — total: **290 problems (286 errors, 4 warnings)**, down from 303
      (299 errors, 4 warnings). Confirmed the 13 removed errors are exactly the
      `react/prop-types` errors previously reported for the 5 target files, split
      3 + 4 + 1 + 4 + 1; no other rule or file's count changed.
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 5 `.jsx`
      deletions, the 5 `.tsx` additions, and
      `openspec/changes/convert-simple-ui-components-to-ts/**`. No other file changed.

## Not in scope for this change

- [ ] Converting any component other than the 5 listed.
- [ ] Extracting `BreadcrumbItem` (or any other interface) into a shared `src/types/`
      module — deferred until a second component needs the same shape.
- [ ] Typing `Button`, `Heading`, or `SpinnerFullPage` (still `.jsx`, imported as-is).
- [ ] Any `eslint.config.js`/`tsconfig.json`/`package.json` change.
- [ ] Fixing any other pre-existing lint error.
