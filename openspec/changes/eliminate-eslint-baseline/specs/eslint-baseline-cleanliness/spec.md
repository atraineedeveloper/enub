## ADDED Requirements

### Requirement: bun run lint SHALL pass with zero errors and zero warnings

The system SHALL have zero ESLint findings (errors or warnings) under the
project's existing `eslint.config.js` rule set, achieved solely by fixing
the code each finding points at.

#### Scenario: Lint exits clean

- WHEN `bun run lint` is run against the repository
- THEN it SHALL exit with code 0 and report 0 problems (0 errors, 0
  warnings)

### Requirement: No ESLint rule SHALL be weakened, disabled, or suppressed to reach a clean lint run

The system SHALL NOT modify `eslint.config.js` to disable, downgrade, or
reconfigure any rule as part of reaching a clean `bun run lint`, and SHALL
NOT add a blanket (`/* eslint-disable */`) or per-line
(`// eslint-disable-next-line`) disable comment anywhere in the codebase
for this purpose.

#### Scenario: eslint.config.js is unchanged

- WHEN this change is complete
- THEN `eslint.config.js` SHALL be byte-for-byte identical to its state
  before this change

#### Scenario: No disable comments were introduced

- WHEN the full diff of this change is reviewed
- THEN it SHALL contain zero occurrences of `eslint-disable` in any form

### Requirement: Dead-code removal SHALL NOT change observable application behavior

Every unused import, variable, destructured property, or callback
parameter removed to satisfy `@typescript-eslint/no-unused-vars` SHALL be
confirmed, before removal, to have no remaining reader anywhere in its
file — and, for removals that touch a value another binding in the same
file depends on (e.g. one unused variable computed from another,
now-also-unused variable), SHALL account for that dependency in the same
change rather than leaving a new unused-variable finding behind.

#### Scenario: A cascading unused-variable dependency is fully resolved

- WHEN removing an unused variable exposes a second variable (one that was
  only "used" to compute the first) as newly unused
- THEN the system SHALL remove both in the same change, not just the
  originally-flagged one

#### Scenario: A data-fetching hook call with no used return value preserves its fetch

- WHEN a `useQuery`-based hook's destructured return values are all
  unused, but calling the hook still triggers a network request /
  query-cache entry
- THEN the system SHALL keep the hook call (dropping only the unused
  destructured bindings) rather than removing the call entirely, so the
  same request still fires

### Requirement: Fast Refresh module separation SHALL preserve every existing import's public shape at its original path where the exporting file itself is unaffected

When a `react-refresh/only-export-components` warning is resolved by
moving a non-component export out of a file that also exports a component,
the system SHALL preserve the component's own existing export path and
name unchanged, and SHALL update every consumer of the *moved* export to
import it from its new location — not attempt to preserve the old import
path for the moved export via a re-export, since a re-export does not
resolve the underlying warning.

#### Scenario: The component's own export path is unchanged

- WHEN `SemesterContext` is moved out of `src/pages/ScheduleDashboard.tsx`
  and `useDarkMode`/`DarkModeContext` are moved out of
  `src/context/DarkModeContext.tsx`
- THEN `src/pages/ScheduleDashboard.tsx` SHALL still be imported via
  `lazy(() => import("./pages/ScheduleDashboard"))` unchanged, and
  `src/context/DarkModeContext.tsx` SHALL still export `DarkModeProvider`
  as a named export unchanged

#### Scenario: Every consumer of a moved export is updated, not left pointing at a re-export

- WHEN a file's only non-component export is moved to a new file
- THEN every consumer of that export SHALL import it from the new file's
  path, and the original file SHALL NOT re-export it (a re-export would
  still mix a non-component export into the component file and leave the
  warning in place)

### Requirement: Hook-dependency corrections SHALL NOT introduce unstable effect dependencies

When resolving a `react-hooks/exhaustive-deps` warning for a `useEffect`
that calls a same-component handler function, the system SHALL NOT add
that handler directly to the effect's dependency array unless the handler
is already reference-stable across renders; where the handler is not
already stable, the system SHALL wrap it in `useCallback` with its actual
closure dependencies before adding it to the effect's dependency array.

#### Scenario: An unmemoized handler is wrapped before being added to a dependency array

- WHEN a `useEffect` calls a handler function defined in the same component
  body, and that handler is not wrapped in `useCallback`
- THEN the system SHALL wrap the handler in `useCallback` with its true
  dependencies before including it in the `useEffect`'s dependency array

#### Scenario: The fix does not introduce a render loop

- WHEN the `useCallback`-wrapped handler's own state updates are triggered
  by the effect
- THEN those state updates SHALL NOT change any value in the handler's
  `useCallback` dependency array, so the effect SHALL NOT re-fire as a
  direct result of its own execution

### Requirement: Schedules, PDFs, authentication, dark mode, and navigation behavior SHALL be unaffected

This change SHALL NOT alter the observable behavior of schedule creation/
editing/conflict-detection, PDF export contents, login/logout behavior,
dark-mode toggling/persistence, or navigation active-state styling. It
SHALL NOT modify any file under `src/services/**`, any Supabase query or
mutation, any route definition, or any database schema/migration.

#### Scenario: Every affected flow behaves identically after the change

- WHEN any flow touched by this change's file list is exercised (schedule
  create/edit, group/teacher selection, teacher assignment summaries, PDF
  generation, login, dark mode, sidebar navigation, or the semester
  dashboard route)
- THEN its observable behavior — rendered output, toasts, persisted data,
  and navigation — SHALL be identical to its behavior before this change
