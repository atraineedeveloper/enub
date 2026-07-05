# Proposal: Convert App Shell to TS

## Status

Draft

## Why

`convert-core-ui-components-to-ts` converted the foundational leaf components
(`Button`, `Heading`, spinners) that the rest of the app depends on. This change moves
one level up: the app shell and navigation layer that renders on every authenticated
page — `App.jsx` (routes/providers root), `ErrorBoundary.jsx` (class component),
`Header.jsx`, `Sidebar.jsx`, `MainNav.jsx`. These are higher-traffic than the previous
two batches but still bounded: no data fetching, no forms, no Supabase calls — purely
routing/layout/navigation.

## What changes

- `src/App.jsx` → `.tsx`: no props (root component). Typing is essentially free here —
  the value is `App.tsx` now being part of `bun run typecheck`'s coverage, including
  its `lazy()` page imports and route tree.
- `src/ui/ErrorBoundary.jsx` → `.tsx`: `ErrorBoundaryProps`
  (`children: ReactNode`, `fallback?: ReactNode`) and `ErrorBoundaryState`
  (`hasError: boolean`, `error: Error | null`), applied to
  `Component<ErrorBoundaryProps, ErrorBoundaryState>`. Same class structure
  (constructor, bound `handleReset`, `getDerivedStateFromError`,
  `componentDidCatch`, `render`) — nothing redesigned.
- `src/ui/Header.jsx` → `.tsx`: `HeaderProps` (`onToggleSidebar?: () => void`) —
  optional because `WorkerAppLayout.jsx` renders `<Header />` with no props at all.
- `src/ui/Sidebar.jsx` → `.tsx`: `SidebarProps`
  (`isOpen: boolean`, `onClose: () => void`, `onNavigate?: () => void`), plus a typed
  generic on the `$isOpen` transient prop used by `StyledSidebar`.
- `src/ui/MainNav.jsx` → `.tsx`: `MainNavProps` (`onNavigate?: () => void`), matching
  the existing `onNavigate = () => {}` default.
- `src/main.jsx`: update its two explicit-extension imports,
  `"./App.jsx"` → `"./App.tsx"` and `"./ui/ErrorBoundary.jsx"` → `"./ui/ErrorBoundary.tsx"`.
  Required by the rename — `main.jsx` is the only importer anywhere in `src/` that uses
  an explicit extension for either file (confirmed by grep before converting).

## What does not change

- No other component is converted. `Table.jsx`, `Modal.jsx`, `Menus.jsx`, `FormRow.jsx`,
  every feature component, every PDF component, and every Supabase/`services` file are
  explicitly out of scope.
- No route, lazy import, provider, protected-route/role-gate wrapping, or toast config
  changes in `App.tsx` — same `<Routes>` tree, same providers, same order.
- No change to `ErrorBoundary`'s error-handling logic — same lifecycle methods, same
  fallback behavior, same `console.error` call.
- No change to navigation/active-state/responsive/layout behavior in `Header`,
  `Sidebar`, or `MainNav` — same CSS, same conditional rendering, same `NavLink`
  active-state mechanics.
- `RoleGate.jsx`, `AppLayout.jsx`, `WorkerAppLayout.jsx` (all import one or more of
  these 5 files) are not converted or otherwise modified — they already import
  extension-less, so nothing in them needs to change.
- One pre-existing, unrelated lint defect in `MainNav.jsx` (an unused destructured
  `isActive` in a `style` callback, flagged today as `no-unused-vars`) is carried over
  verbatim, not fixed — see `design.md` Section 3.
- No dependency added; `eslint.config.js`/`tsconfig.json`/`package.json` untouched.

## Impact

- **Affected code:** 5 files renamed `.jsx` → `.tsx`; `src/main.jsx` has 2 import
  extensions updated. No other file.
- **Affected lint baseline:** `react/prop-types` errors disappear for the 4 files that
  had any (`ErrorBoundary` 3, `Header` 1, `Sidebar` 3, `MainNav` 1 — `App.jsx` had 0).
  `MainNav`'s 1 pre-existing `no-unused-vars` error carries over unchanged (renamed to
  `@typescript-eslint/no-unused-vars` by the file-extension switch, not fixed, not a
  net change in count). See `design.md` Section 4 for the exact predicted total.
