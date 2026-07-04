# Proposal: Convert Admin Catalog Features to TS

## Status

Draft — Phase 1 (degrees, subjects) implemented in this pass. Phase 2 (groups,
semesters) and Phase 3 (studyPrograms, roles) not started.

## Why

`convert-remaining-shared-ui-to-ts` finished every shared `src/ui/` component. This
change moves one level up: the first real **feature modules** (data fetching +
list/row UI, not just shared presentational components), split into 3 phases inside
one OpenSpec change so each can be reviewed independently — per explicit instruction,
only Phase 1 is implemented now.

Phase 1 targets `src/features/degrees/*` and `src/features/subjects/*`: the two
simplest catalog features in the app — read-only listings (no create/edit form exists
for either today), one feed each from a single or lightly-joined Supabase query.
Chosen first for the same reason `ErrorMessage` was chosen first for UI components:
lowest blast radius, proves the feature-module conversion pattern (service → hook →
row → table) before tackling anything with mutations.

## What changes (Phase 1)

- `src/features/degrees/DegreeRow.jsx` → `.tsx`: `DegreeRowProps` (`degree: Degree`).
- `src/features/degrees/DegreeTable.jsx` → `.tsx`: no props (root feature component);
  `handleSearch` typed via `ChangeEventHandler<HTMLInputElement>`.
- `src/features/degrees/useDegrees.js` → `.ts`: exports `Degree` (type alias for
  `Database["public"]["Tables"]["degrees"]["Row"]`, reusing the already-generated
  Supabase schema type from `src/types/supabase.ts` rather than hand-rolling a
  parallel interface), and types the hook's `useQuery` call with it.
- `src/features/subjects/SubjectRow.jsx` → `.tsx`: `SubjectRowProps`
  (`subject: Subject`).
- `src/features/subjects/SubjectTable.jsx` → `.tsx`: same shape as `DegreeTable.tsx`.
- `src/features/subjects/useSubjects.js` → `.ts`: exports `Subject` (the generated
  `subjects` Row type, intersected with the two nested relations the query actually
  embeds: nullable singular `study_programs` and `degrees` rows, matching the real
  `.select("*, study_programs(*), degrees(*))")` call in `apiSubjects.js` and the
  nullable FK columns in `src/types/supabase.ts`).

## What does not change

- `src/services/apiDegrees.js`, `src/services/apiSubjects.js`, and
  `src/services/supabase.js` are **not** converted or modified — see `design.md`
  Section 1 for why these are treated as out of Phase 1 scope even though they're the
  data source for these two features.
- `src/hooks/usePagination.js` is not converted — outside `src/features/degrees|subjects/`,
  and not required for a clean typecheck (see `design.md` Section 4 for the one
  accepted, documented typing gap this leaves).
- No other feature module converted. `src/features/groups/*`, `semesters/*`
  (Phase 2), `studyPrograms/*`, `roles/*` (Phase 3) are explicitly deferred.
- No schedules, workers, PDF, page, or out-of-scope service file touched — including
  the several `.jsx` files elsewhere (`CreateGroupForm.jsx`,
  `CreateEditScholarSchedule.jsx`, `EditScholarSchedule.jsx`, `Dashboard.jsx`,
  `ScheduleDashboard.jsx`) that import `useDegrees`/`useSubjects` for dropdown data —
  all import extension-less already, so none need a change, and none are
  type-checked anyway (still `.jsx`).
- No React Query key, `staleTime`, or invalidation behavior changed — `["degrees"]`/
  `["subjects"]` query keys and `staleTime` values are byte-identical.
- No Supabase call changed — `apiDegrees.js`/`apiSubjects.js`'s `select("*")` and
  `select("*, study_programs(*), degrees(*))")` calls are untouched.
- No dependency added; `eslint.config.js`/`tsconfig.json`/`package.json` untouched.

## Impact

- **Affected code:** 6 files renamed (4 `.jsx` → `.tsx`, 2 `.js` → `.ts`). No other
  file (see `design.md` for the explicit-extension-import grep result).
- **Affected lint baseline:** `react/prop-types` errors disappear for `DegreeRow` (4)
  and `SubjectRow` (12) — 16 total. `DegreeTable`/`SubjectTable` had 0 to begin with
  (no props). `useDegrees`/`useSubjects` had 0 (not React components).
