# Proposal: Convert Pages to TS

## Status

Done — all 17 route/page components converted, verified.

## Why

`src/pages/*` and `src/pages/Records/*` are the last untyped layer of
`App.tsx`'s route tree — every one of them is lazy-imported directly by
`App.tsx` (already `.tsx`). Converting them closes out the top-level route
surface of the TS migration, leaving only `src/pdf/*` (explicitly deferred —
needs separate manual PDF-output verification) and
`src/features/schedules/**` (explicitly out of scope) as untyped.

## Target scope

All 17 files in `src/pages/*` and `src/pages/Records/*`:

- `Dashboard.jsx`, `Login.jsx`, `MyDocuments.jsx`, `PageNotFound.jsx`,
  `PendingAccess.jsx`, `ScheduleDashboard.jsx`, `Semesters.jsx`,
  `SetPassword.jsx`
- `Records/Degrees.jsx`, `Records/Groups.jsx`, `Records/Others.jsx`,
  `Records/Roles.jsx`, `Records/StateRoles.jsx`, `Records/StudyPrograms.jsx`,
  `Records/Subjects.jsx`, `Records/WorkerDocuments.jsx`, `Records/Workers.jsx`

All 17 render real JSX and convert to `.tsx` (none are plain non-component
modules).

## What changes

- All 17 files renamed `.jsx` → `.tsx`, typed where each page actually has
  props, state, or context:
  - **`ScheduleDashboard.tsx`** — the only page with real typing work:
    `SemesterContextValue` interface for its own `createContext(null)` call
    (previously untyped `Context<null>`, which would reject the real object
    literal `Provider` value); non-null assertions at existing
    `groups`/`workers`/`semesters`/`scheduleAssignments`/`scheduleTeachers`
    dereference sites (all come from `useQuery`-backed hooks returning
    `T[] | undefined`); a local `ComponentType` cast for the still-untyped,
    out-of-scope `WorkerSheetSemester` (`src/pdf/`, see "Unplanned discovery"
    below).
  - **`Dashboard.tsx`** — `styled.div<{ $theme: string }>` /
    `styled.div<{ $accent: string }>` on the two components that read a
    transient prop (`iconThemes`/`tabAccents`-style lookup), matching the
    established pattern for every other transient-prop styled-component in
    this migration.
  - **`SetPassword.tsx`** — `handleSubmit(e: FormEvent<HTMLFormElement>)`.
  - Every other page — no props, no local state beyond simple `useState`
    calls TS already infers correctly; conversion is a type-check pass with
    no new annotations needed.

## Unplanned discovery: `WorkerSheetSemester`'s untyped defaults break once its caller is checked

`ScheduleDashboard.jsx` renders `<WorkerSheetSemester scheduleAssignments={...} scheduleTeachers={...} />`.
`WorkerSheetSemester.jsx` (`src/pdf/`, explicitly out of scope — PDF exporters
are deferred to their own change) destructures
`scheduleAssignments = []`/`scheduleTeachers = []` with no other type
evidence, so TS's `allowJs` inference narrows both to `never[]` — the same
"destructured-default-narrows-the-type" issue seen repeatedly in prior
migration phases (Phase 2's `createEditWorkers`, Phase 3's
`uploadWorkerDocument`). Once `ScheduleDashboard.jsx` became `.tsx`, passing
real arrays into these props failed to compile. Fixed with a local
`ComponentType` cast at the one call site in `ScheduleDashboard.tsx` — the
same pattern already used in `WorkerRow.tsx`/`WorkerTable.tsx` for
`CreateEditWorkerForm` before that file was converted — not by touching
`WorkerSheetSemester.jsx` itself (`design.md` Section 3).

## Unplanned discovery: `FormRowVertical.tsx`'s single-child constraint, already fixed once for its sibling `FormRow.tsx`

`SetPassword.tsx`'s last `<FormRowVertical>` wraps two children (a `<Button>`
and a conditional error `<p>`) — valid at runtime (this was already happening
in the untyped `.jsx`), but `FormRowVertical.tsx`'s
`children: ReactElement<{ id?: string }>` prop type only accepts a single
element. `fix-ts-migration-blockers` fixed this exact issue for
`FormRow.tsx` (`children: ReactNode` + `isValidElement` for the `htmlFor`
lookup) but missed this sibling component. Applied the identical, already-
established fix to `FormRowVertical.tsx` (`design.md` Section 4) — a blocker
fix in an already-`.tsx` shared UI component, not new feature-internal
migration work.

## What does not change

- No route path, `element`, lazy-import call, or `Suspense`/`ProtectedRoute`/
  `RoleGate` wrapping in `App.tsx` changed — `App.tsx` was already `.tsx` and
  already imports every page extension-less; none needed a path update.
- No auth/role-gate behavior, redirect logic, or layout changed anywhere.
- `src/pdf/*`, `src/features/schedules/**` not converted — both explicitly
  out of scope for this change.
- No dependency added; `eslint.config.js`/`tsconfig.json`/`package.json`
  untouched (`FormRowVertical.tsx` is the one exception, a blocker fix, not a
  tooling change).

## Impact

- **Affected code:** 17 pages renamed `.jsx` → `.tsx`; 1 shared UI component
  (`FormRowVertical.tsx`) patched to fix a real, pre-existing type gap that
  blocked `SetPassword.tsx` from compiling. No other file.
- **Affected lint baseline:** 206 → **205** problems. None of the 17 pages
  had any `react/prop-types`/`no-undef`/other error in the pre-conversion
  baseline (confirmed via per-file `bun run lint` before converting anything)
  — the 1-point improvement is incidental, not a page-specific fix.
