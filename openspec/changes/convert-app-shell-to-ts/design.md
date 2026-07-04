# Design: Convert App Shell to TS

## 1. Pre-conversion baseline (confirmed via `bun run lint`, per file)

| File | `react/prop-types` | Other | 
|---|---:|---|
| `App.jsx` | 0 | — (no props; root component) |
| `ErrorBoundary.jsx` | 3 (`fallback` ×2, `children` ×1) | — |
| `Header.jsx` | 1 (`onToggleSidebar`) | — |
| `Sidebar.jsx` | 3 (`isOpen`, `onClose`, `onNavigate`) | — |
| `MainNav.jsx` | 1 (`onNavigate`) | 1 `no-unused-vars`: unused destructured `isActive` in the `style={({isActive}) => ...}` callback at (then) line 148 — a genuine pre-existing defect, unrelated to typing, already present before this change |

Total `react/prop-types` to remove: 3 + 1 + 3 + 1 = **8**. The `no-unused-vars` hit is
explicitly **not** fixed — carried over verbatim, per "do not fix unrelated lint
errors" — see Section 3.

## 2. Per-file typing

### `App.tsx`

No props (root component) — nothing to type beyond the file extension. The value is
purely that `App.tsx`'s route tree, `lazy()` imports, and provider nesting are now
covered by `bun run typecheck`. Routes, lazy imports, providers, `ProtectedRoute`/
`RoleGate` wrapping, and `Toaster` config are byte-identical to the `.jsx` version.

### `ErrorBoundary.tsx`

- `interface ErrorBoundaryProps { children: ReactNode; fallback?: ReactNode }` —
  `fallback` optional because no real call site (`main.jsx`, `AppLayout.jsx`,
  `WorkerAppLayout.jsx` — the only 3 usages in `src/`) ever passes it; the component's
  own `if (this.props.fallback)` branch already treats it as optional.
- `interface ErrorBoundaryState { hasError: boolean; error: Error | null }`.
- `class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState>` —
  same constructor (including the manual `this.handleReset = this.handleReset.bind(this)`
  pattern — not converted to a class property or hook), same
  `static getDerivedStateFromError`, same `componentDidCatch(error: Error, info: ErrorInfo)`
  signature (`ErrorInfo` from `react`), same `render()` logic. No lifecycle method
  redesigned, renamed, or reordered.

### `Header.tsx`

- `interface HeaderProps { onToggleSidebar?: () => void }` — optional because
  `WorkerAppLayout.jsx` (confirmed by reading it) renders `<Header />` with **no**
  props at all; the existing `onToggleSidebar ? <MenuButton .../> : <span />`
  conditional already depends on that being possibly absent.

### `Sidebar.tsx`

- `interface SidebarProps { isOpen: boolean; onClose: () => void; onNavigate?: () => void }`
  — `onNavigate` optional because it's forwarded as-is to `MainNav`, whose own prop is
  optional (default `() => {}`); `isOpen`/`onClose` are always passed together by
  `Sidebar`'s sole caller, `AppLayout.jsx`.
- `StyledSidebar` is `styled.aside<{ $isOpen: boolean }>` — required generic so the
  `$isOpen` transient prop (already prefixed with `$` per `styled-components`
  convention to avoid forwarding to the DOM) typechecks in the CSS interpolations
  (`width`, `padding`, `opacity`, `pointer-events`, `transform`).

### `MainNav.tsx`

- `interface MainNavProps { onNavigate?: () => void }`, matching the existing
  `onNavigate = () => {}` default exactly.
- The pre-existing unused `{ isActive }` destructure in the `<NavLink style={...}>`
  callback (Section 1) is preserved **exactly as written** — not removed, not
  underscore-prefixed, not suppressed with a disable comment. Converting this file to
  `.tsx` moves it from being flagged by core `no-unused-vars` to
  `@typescript-eslint/no-unused-vars` (the `.ts`/`.tsx` ESLint block's replacement for
  the same rule, per `typescript-tooling-foundation`), but it is the same defect,
  still an error, still present — a rule-name change from the file extension switch,
  not a fix and not a new issue.

## 3. `main.jsx`'s two explicit-extension imports

`src/main.jsx` is the **only** importer anywhere in `src/` (confirmed by grep before
converting) that references `App` or `ErrorBoundary` with an explicit extension:

```diff
- import App from "./App.jsx";
- import ErrorBoundary from "./ui/ErrorBoundary.jsx";
+ import App from "./App.tsx";
+ import ErrorBoundary from "./ui/ErrorBoundary.tsx";
```

No other line in `main.jsx` changed. `AppLayout.jsx`/`WorkerAppLayout.jsx` (both
import `ErrorBoundary`, `Header`; `Sidebar` additionally in `AppLayout.jsx`) already
import extension-less, so neither needed any change — confirmed by grep, not assumed.
This is the same class of fix `convert-core-ui-components-to-ts` hit with `Button`/
`Spinner` in `src/pdf/**`; checking for it up front here (Section 5) avoided a repeat
build failure.

## 4. Verification plan — results

Baseline going in: **290 problems (286 errors, 4 warnings)**.

- [x] `bun run typecheck` — passes, no errors.
- [ ] `bun run build` — another agent reported this passing cleanly (no failure, no
      hang), but reviewer rerun with `timeout 180s bun run build` timed out after
      printing only `$ vite build` and no Vite diagnostics. Rerun locally before
      commit.
- [x] `bun run lint` — total: **282 problems (278 errors, 4 warnings)**, down from 290
      by exactly the predicted 8 `react/prop-types` errors (Section 1). The one
      `no-unused-vars`/`@typescript-eslint/no-unused-vars` `MainNav` entry remains
      present, unchanged in substance, confirmed by direct inspection of the post-lint
      output.
- [x] `git status`/`git diff --stat` — changed-file set is exactly: 5
      `.jsx` → `.tsx` renames, `src/main.jsx` (2 import extensions only), and
      `openspec/changes/convert-app-shell-to-ts/**`. No other file.
