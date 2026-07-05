# Tasks — convert-pages-to-ts

Status: **Done — typecheck/build/lint verified.**

## Pre-conversion checks

- [x] Read `AGENTS.md`, `docs/ai/architecture.md`,
      `openspec/changes/openspec-ts-migration-foundation/design.md`,
      `openspec/changes/typescript-tooling-foundation/design.md`,
      `convert-admin-catalog-features-to-ts`/`convert-workers-documents-to-ts`/
      `fix-ts-migration-blockers` design docs, `tsconfig.json`,
      `eslint.config.js`, `package.json`, `src/App.tsx`, and all 17 files in
      `src/pages/*`/`src/pages/Records/*`.
- [x] Confirmed all 17 files render real JSX (`design.md` Section 1).
- [x] Confirmed `App.tsx` already lazy-imports every page extension-less —
      no import-path fix anticipated there regardless of renames.
- [x] Ran `bun run lint` and recorded the exact per-file baseline: all 17
      files — 0 errors each (`ScheduleDashboard.jsx` has 1 pre-existing,
      unrelated `react-refresh/only-export-components` warning) (`design.md`
      Section 6).
- [x] Grepped for explicit `.jsx`/`.js`-extension imports of all 17 target
      files — none found.

## Conversion

- [x] `src/pages/PageNotFound.tsx`, `PendingAccess.tsx`, `Login.tsx`,
      `Semesters.tsx`, `Records/Degrees.tsx`, `Records/Others.tsx`,
      `Records/Roles.tsx`, `Records/StateRoles.tsx`,
      `Records/StudyPrograms.tsx`, `Records/Subjects.tsx`,
      `Records/Workers.tsx`, `Records/WorkerDocuments.tsx`,
      `Records/Groups.tsx` — no props/typing changes needed beyond the file
      extension; deleted each corresponding `.jsx`.
- [x] `src/pages/MyDocuments.tsx` — no typing changes needed (the untyped
      `useProfile()`'s `workerId` flows into `WorkerDocumentsView`'s typed
      `workerId: number` prop without friction). Deleted `MyDocuments.jsx`.
- [x] `src/pages/Dashboard.tsx` — `styled.div<{ $theme: string }>`/
      `styled.div<{ $accent: string }>` (`design.md` Section 2). Deleted
      `Dashboard.jsx`.
- [x] `src/pages/SetPassword.tsx` — `handleSubmit(e: FormEvent<HTMLFormElement>)`.
      Deleted `SetPassword.jsx`.
- [x] `src/pages/ScheduleDashboard.tsx` — `SemesterContextValue` for
      `createContext`; non-null assertions at existing
      `groups`/`workers`/`semesters`/`scheduleAssignments`/`scheduleTeachers`/
      `id` dereference sites; local `ComponentType` cast for the untyped,
      out-of-scope `WorkerSheetSemester` (`design.md` Sections 3–4). Deleted
      `ScheduleDashboard.jsx`.
- [x] `src/ui/FormRowVertical.tsx` — widened `children` to `ReactNode` +
      `isValidElement` for the `htmlFor` lookup, mirroring `FormRow.tsx`'s
      already-established fix (`design.md` Section 5) — needed to unblock
      `SetPassword.tsx`'s compile.
- [x] No other file modified; `App.tsx`, `src/pdf/**`,
      `src/features/schedules/**`, every other feature/service file,
      `eslint.config.js`, `tsconfig.json`, `package.json` all untouched.

## Verification — results

- [x] `bun run typecheck` — failed twice against distinct real issues
      (`design.md` Sections 4–5), each fixed with a local cast or a same-
      pattern sibling-component fix. Final run: clean, no errors.
- [x] `bun run build` — clean pass, `✓ built in 4.79s`, no diagnostics.
- [x] `bun run lint` — total: **205 problems (201 errors, 4 warnings)** —
      down 1 from the 206 baseline; confirmed no converted page (nor
      `FormRowVertical.tsx`) contributes any error in the output.
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 17
      renamed pages, `FormRowVertical.tsx`, and
      `openspec/changes/convert-pages-to-ts/**`. No other file.

## Not in scope for this change

- [ ] Converting `src/pdf/*` (any file) — PDF exporters are deferred to their
      own change; require separate manual data/output verification.
- [ ] Converting `src/features/schedules/**` (any component, hook, or
      service) — a separate feature domain, explicitly out of scope.
- [ ] Modeling `ScheduleAssignmentForPdf`/`ScheduleTeacherForPdf`-precision
      types for the `WorkerSheetSemester` cast in `ScheduleDashboard.tsx` —
      deliberately left as `unknown[]`; a full PDF-exporter conversion would
      supply the precise shape.
- [ ] Any route path, auth/role-gate, layout, or business-logic change.
