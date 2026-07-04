# Proposal: Convert Simple UI Components to TS (batch)

## Status

Draft

## Why

`convert-first-ui-component-to-ts` proved the single-file conversion workflow
end-to-end (`ErrorMessage.jsx` → `.tsx`) with zero tooling changes needed. This change
extends the same, now-proven pattern to a small batch of five more `src/ui/*`
components that fit `openspec-ts-migration-foundation`'s Phase 2 criteria
(presentational/leaf, small-to-moderate prop surfaces, no complex render-prop or
generic-data patterns): `SearchBar`, `Pagination`, `Breadcrumbs`, `ConfirmDelete`,
`ProtectedRoute`.

## What changes

- `src/ui/SearchBar.jsx` → `.tsx`: `SearchBarProps` (`value: string`,
  `onChange: ChangeEventHandler<HTMLInputElement>`, `placeholder?: string`).
- `src/ui/Pagination.jsx` → `.tsx`: `PaginationProps` (`currentPage: number`,
  `totalPages: number`, `totalCount: number`, `onPageChange: (page: number) => void`).
- `src/ui/Breadcrumbs.jsx` → `.tsx`: `BreadcrumbItem` (`label: string`, `to?: string`)
  and `BreadcrumbsProps` (`items?: BreadcrumbItem[]`).
- `src/ui/ConfirmDelete.jsx` → `.tsx`: `ConfirmDeleteProps` (`resourceName: string`,
  `onConfirm?: () => void`, `disabled?: boolean`, `onCloseModal?: () => void`).
- `src/ui/ProtectedRoute.jsx` → `.tsx`: `ProtectedRouteProps` (`children: ReactNode`).

## What does not change

- No other component is converted or modified — including components these five
  import (`Button.jsx`, `Heading.jsx`, `SpinnerFullPage.jsx`) or components that import
  these five (all listed call sites in `design.md`).
- No rendered output, prop name, default value, or styling changes for any of the five.
- No import statement changes anywhere — every call site imports each of these five
  without a file extension, so the bundler resolves `.tsx` the same way it resolved
  `.jsx`.
- No dependency added.
- `eslint.config.js`, `tsconfig.json`, and `package.json` are not touched —
  `convert-first-ui-component-to-ts` already established that `eslint-plugin-react`'s
  `react/prop-types` recognizes real TS prop types without any config change; this
  batch is the same mechanism applied five more times, not a new mechanism.
- No other pre-existing lint error is fixed.

## Impact

- **Affected code:** 5 files renamed `src/ui/*.jsx` → `src/ui/*.tsx`. No other file.
- **Affected lint baseline:** the `react/prop-types` errors previously reported for
  these five files disappear (13 total across the five: 3 + 4 + 1 + 4 + 1 — see
  `design.md` for the per-file breakdown and verified before/after count); nothing else
  changes.
