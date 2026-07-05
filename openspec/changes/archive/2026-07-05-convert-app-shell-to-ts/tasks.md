# Tasks — convert-app-shell-to-ts

Status: implemented — typecheck/lint verified; build needs a local rerun because the
reviewer rerun timed out without Vite diagnostics.

## Phase 1: Change artifacts

- [x] Write `proposal.md`.
- [x] Write `design.md`.
- [x] Write `tasks.md` (this file).

## Phase 2: Pre-conversion checks

- [x] Ran `bun run lint` and recorded the exact per-file baseline for all 5 target
      files before converting anything (see `design.md` Section 1): `App.jsx` 0,
      `ErrorBoundary.jsx` 3, `Header.jsx` 1, `Sidebar.jsx` 3, `MainNav.jsx` 1
      `react/prop-types` + 1 pre-existing `no-unused-vars`.
- [x] Grepped every real caller of `Header`/`Sidebar`/`MainNav`/`ErrorBoundary`/`App`
      to confirm prop optionality (`WorkerAppLayout.jsx` renders `<Header />` with no
      props; no call site ever passes `ErrorBoundary`'s `fallback`).
- [x] Grepped for explicit-extension imports of any of the 5 target files across all
      of `src/` — found only `src/main.jsx` (`./App.jsx`, `./ui/ErrorBoundary.jsx`).
      Confirmed `AppLayout.jsx`/`WorkerAppLayout.jsx` already import extension-less.

## Phase 3: Conversion

- [x] `src/App.tsx` — no props; same route tree, lazy imports, providers, `Toaster`
      config as the original. Deleted `App.jsx`.
- [x] `src/ui/ErrorBoundary.tsx` — `ErrorBoundaryProps`
      (`children: ReactNode`, `fallback?: ReactNode`), `ErrorBoundaryState`
      (`hasError: boolean`, `error: Error | null`); same class structure, same
      lifecycle methods, same bound-constructor pattern. Deleted `ErrorBoundary.jsx`.
- [x] `src/ui/Header.tsx` — `HeaderProps` (`onToggleSidebar?: () => void`). Deleted
      `Header.jsx`.
- [x] `src/ui/Sidebar.tsx` — `SidebarProps`
      (`isOpen: boolean`, `onClose: () => void`, `onNavigate?: () => void`) plus a
      typed `$isOpen` generic on `StyledSidebar`. Deleted `Sidebar.jsx`.
- [x] `src/ui/MainNav.tsx` — `MainNavProps` (`onNavigate?: () => void`); pre-existing
      unused `isActive` destructure preserved verbatim (not fixed — see `design.md`
      Section 2). Deleted `MainNav.jsx`.
- [x] `src/main.jsx` — updated its two explicit-extension imports
      (`./App.jsx` → `./App.tsx`, `./ui/ErrorBoundary.jsx` → `./ui/ErrorBoundary.tsx`).
      No other line changed.
- [x] No other file modified; no `eslint.config.js`/`tsconfig.json`/`package.json`
      change.

## Phase 4: Verification — results

- [x] `bun run typecheck` — passes, no errors.
- [ ] `bun run build` — another agent reported this passing cleanly, but reviewer
      rerun with `timeout 180s bun run build` timed out after printing only
      `$ vite build` and no Vite diagnostics. Rerun locally before commit; do not fix
      unrelated build/runtime behavior in this TS conversion batch.
- [x] `bun run lint` — total: **282 problems (278 errors, 4 warnings)**, down from 290
      by exactly the predicted 8 `react/prop-types` errors. Confirmed the `MainNav`
      `no-unused-vars` → `@typescript-eslint/no-unused-vars` entry is still present
      (same defect, not fixed, not newly introduced).
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 5
      `.jsx` → `.tsx` renames, `src/main.jsx` (import-extension-only change), and
      `openspec/changes/convert-app-shell-to-ts/**`. No other file.

## Not in scope for this change

- [ ] Converting `Table.jsx`, `Modal.jsx`, `Menus.jsx`, `FormRow.jsx`, any feature
      component, any PDF component, or any Supabase/`services` file.
- [ ] Fixing `MainNav`'s pre-existing unused-`isActive` defect.
- [ ] Any change to `RoleGate.jsx`, `AppLayout.jsx`, or `WorkerAppLayout.jsx`.
- [ ] Any route, provider, or auth-behavior change in `App.tsx`.
