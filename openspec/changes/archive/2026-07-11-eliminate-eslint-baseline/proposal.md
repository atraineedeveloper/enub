## Why

`bun run lint` currently fails with 43 problems (39 errors, 4 warnings)
across 18 files. This is the accumulated baseline left behind by several
prior OpenSpec changes (the JS→TS migration, the schedule semester-scoping
work, and the group-grade-relative-to-semester work), each of which
explicitly recorded this count and deliberately left it untouched as
out-of-scope for its own narrower goal. `AGENTS.md`'s own verification
checklist requires running lint before marking work complete, but a
pre-existing, permanently-red `bun run lint` makes that check meaningless —
every future change either has to ignore lint entirely or manually diff
counts to prove it didn't make things worse. `bun run lint` should pass
cleanly so it becomes a real, zero-tolerance gate again.

Every one of the 43 findings is either genuinely dead code (an unused
import, variable, or destructured value with zero remaining references), a
cosmetic JSX-rendering rule violation (a literal `"` that should be an
entity), a file-organization issue Fast Refresh warns about (a
non-component export sharing a file with a component), or a real
`react-hooks/exhaustive-deps` gap that needs care to close without
introducing a render loop. None of them require weakening a rule, adding a
disable comment, or changing what the app actually does.

## What Changes

- Remove every genuinely-unused import, variable, destructured property,
  and callback parameter flagged by `@typescript-eslint/no-unused-vars`
  (13 files) — including one cascading case
  (`CreateEditScholarSchedule.tsx`'s `isCreating`, only used today to
  compute the already-dead `isWorking`) and one cross-component case (the
  `editModal`/`deleteModal` state in three schedule-row components, proven
  dead by tracing how `Modal.Window` always overrides whatever
  `onCloseModal` prop a parent passes via `cloneElement`).
- Escape the 4 files' unescaped JSX quotation marks
  (`react/no-unescaped-entities`) using `&quot;` entities, with no change
  to rendered output.
- Split `SemesterContext` (currently defined and exported alongside the
  `ScheduleDashboard` component) and `useDarkMode`/`DarkModeContext`
  (currently defined and exported alongside the `DarkModeProvider`
  component) into dedicated, component-free files, resolving both
  `react-refresh/only-export-components` warnings. Update the 7 (Semester)
  + 1 (DarkMode) files that import these to the new locations.
- Fix the 2 `react-hooks/exhaustive-deps` warnings
  (`CreateEditScholarSchedule.tsx`'s `selectingGroup`,
  `ShowTeacherSchedule.tsx`'s `selectingWorker`) by wrapping each handler
  in `useCallback` with its true dependencies and adding the memoized
  callback to its `useEffect`'s dependency array — not by naively adding
  the raw function to the array, which would make the effect's dependency
  unstable on every render and risk a render loop (both handlers call
  `setState` that would otherwise re-trigger the effect on every
  re-render).
- No ESLint rule is disabled, weakened, or reconfigured. No blanket or
  per-line `eslint-disable` comment is added anywhere.

## Capabilities

**New Capabilities:**
- `eslint-baseline-cleanliness`: covers `bun run lint` passing with zero
  errors and zero warnings, without weakening rules, and without changing
  the observable behavior of schedules, PDFs, authentication, dark mode, or
  navigation.

**Modified Capabilities:**
(none — this change alters no requirement of any existing capability;
`schedule-typescript-safety`, `pdf-exporter-safety`,
`schedule-semester-scoped-queries`, and `semester-generation` all remain
exactly as true after this change as before it)

## Impact

- Affected code (18 files with lint findings, see `design.md` for the
  full per-file classification): `src/context/DarkModeContext.tsx`,
  `src/pages/ScheduleDashboard.tsx`,
  `src/features/schedules/CreateEditScholarSchedule.tsx`,
  `src/features/schedules/ShowTeacherSchedule.tsx`,
  `src/features/authentication/useLogin.ts`,
  `src/features/otherData/CreateEditOtherForm.tsx`,
  `src/features/schedules/CreateEditTeacherSchedule.tsx`,
  `src/features/schedules/HourScheduleSubject.tsx`,
  `src/features/schedules/HourScheduleSubjectGroup.tsx`,
  `src/features/schedules/HourScheduleTeacher.tsx`,
  `src/features/stateRoles/CreateEditStateRoleForm.tsx`,
  `src/helpers/calculateSemesterGroup.ts`,
  `src/pdf/Schedules/ScheduleGroupPDF.tsx`,
  `src/pdf/Schedules/ScheduleTeacherPDF.tsx`,
  `src/pdf/Schedules/TeacherAssignmentPDF.tsx`, `src/ui/MainNav.tsx`,
  `src/features/schedules/ShowScholarSchedule.tsx`,
  `src/features/schedules/TeacherAssignment.tsx`.
- New files: `src/pages/SemesterContext.ts` (the `SemesterContext` object
  and its value type, extracted out of `ScheduleDashboard.tsx`),
  `src/context/useDarkMode.ts` (the `DarkModeContext` object and the
  `useDarkMode` hook, extracted out of `DarkModeContext.tsx`).
- Import-path updates only (no behavior change): `HourScheduleSubjectGroup.tsx`,
  `TeacherAssignment.tsx`, `ShowScholarSchedule.tsx`,
  `CreateEditScholarSchedule.tsx`, `ScheduleGroupPDF.tsx`,
  `ScheduleTeacherPDF.tsx`, `TeacherAssignmentPDF.tsx` (all 7 update their
  `SemesterContext` import path); `src/ui/DarkModeToggle.tsx` (updates its
  `useDarkMode` import path).
- Not changed: any Supabase query/mutation, any route, any database schema
  or migration, `eslint.config.js` itself, any test/build tooling config,
  and every file not listed above.
- No new dependencies.
- Risk is concentrated in: (1) the two hook-dependency fixes, which touch
  the actual logic of when a form's filtered-options state recomputes —
  the highest-scrutiny part of this change; (2) the cross-component dead
  state removal (`editModal`/`deleteModal`), which required tracing
  `Modal.Window`'s `cloneElement` override behavior to confirm zero
  observable effect before deleting; (3) the two Fast Refresh
  module-splits, which touch import paths in 8 total consumer files — a
  missed import-path update would fail the build immediately (not silently
  regress), so `bun run typecheck`/`bun run build` are the safety net.
