## 1. Category 3 — Fast Refresh module separation (do first: other files depend on the new import paths)

- [x] 1.1 Create `src/context/useDarkMode.ts`: move the `DarkModeContext`
      object, the `DarkModeContextValue` interface, and the `useDarkMode`
      hook out of `src/context/DarkModeContext.tsx`, unchanged in behavior.
- [x] 1.2 `src/context/DarkModeContext.tsx`: keep only `DarkModeProvider`;
      import `DarkModeContext` from `./useDarkMode`; keep
      `export { DarkModeProvider };` (named export, unchanged shape for
      `App.tsx`).
- [x] 1.3 `src/ui/DarkModeToggle.tsx`: update the `useDarkMode` import path
      from `"../context/DarkModeContext"` to `"../context/useDarkMode"`.
- [x] 1.4 Create `src/pages/SemesterContext.ts`: move the `SemesterContext`
      object and the `SemesterContextValue` interface out of
      `src/pages/ScheduleDashboard.tsx`, unchanged in behavior.
- [x] 1.5 `src/pages/ScheduleDashboard.tsx`: import `SemesterContext` from
      `./SemesterContext`; remove the now-unused `createContext` import if
      nothing else in the file needs it; keep `export default ScheduleDashboard;`
      unchanged.
- [x] 1.6 Update the `SemesterContext` import path in all 7 consumers, from
      `"../../pages/ScheduleDashboard"` to `"../../pages/SemesterContext"`:
      `src/features/schedules/CreateEditScholarSchedule.tsx`,
      `src/features/schedules/HourScheduleSubjectGroup.tsx`,
      `src/features/schedules/ShowScholarSchedule.tsx`,
      `src/features/schedules/TeacherAssignment.tsx`,
      `src/pdf/Schedules/ScheduleGroupPDF.tsx`,
      `src/pdf/Schedules/ScheduleTeacherPDF.tsx`,
      `src/pdf/Schedules/TeacherAssignmentPDF.tsx`.
- [x] 1.7 `bun run typecheck` — confirms every updated import path resolves
      before proceeding to the remaining categories.

## 2. Category 4 — Hook dependency corrections (behavioral care required)

- [x] 2.1 `src/features/schedules/CreateEditScholarSchedule.tsx`: wrap
      `selectingGroup` in `useCallback` with deps `[groups, subjects, semesterCode]`
      (design.md Category 4); add `selectingGroup` to the mount-time
      `useEffect`'s dependency array alongside the existing
      `isEditSession`, `editValues.group_id`. Do NOT add the raw,
      unmemoized function — that is the specific mistake this task exists
      to avoid.
- [x] 2.2 `src/features/schedules/ShowTeacherSchedule.tsx`: wrap
      `selectingWorker` in `useCallback` with deps
      `[scheduleTeachers, scheduleAssignments]`; change the `useEffect`'s
      dependency array to `[selectedWorkerId, selectingWorker]` (dropping
      the now-redundant direct `scheduleTeachers`/`scheduleAssignments`
      entries, since they're covered via `selectingWorker`'s own deps).
- [x] 2.3 `bun run lint` — confirm both `react-hooks/exhaustive-deps`
      warnings are gone with no new warning introduced by the
      `useCallback` wrapping itself.

## 3. Category 1 — Mechanical removal (dead imports/variables/parameters)

- [x] 3.1 `src/features/authentication/useLogin.ts`: drop the unused `err`
      parameter from `onError`.
- [x] 3.2 `src/features/otherData/CreateEditOtherForm.tsx`: drop the unused
      `data` parameter from the inner `onSuccess`.
- [x] 3.3 `src/features/stateRoles/CreateEditStateRoleForm.tsx`: drop the
      unused `data` parameter from the inner `onSuccess`.
- [x] 3.4 `src/features/schedules/CreateEditTeacherSchedule.tsx`: drop the
      unused `Input` import; drop `semesters`/`workers: workerData` from
      the `scheduleToEdit` destructuring (design.md's confirmation that
      this is behaviorally inert — react-hook-form ignores unregistered
      `defaultValues` keys either way).
- [x] 3.5 `src/features/schedules/CreateEditScholarSchedule.tsx`: drop the
      unused `useMutation`/`useQueryClient` import, the unused
      `createScheduleAssignments` service import (shadowed by the
      identically-named value from `useCreateScheduleAssignments()`, which
      is what's actually called), the unused `useWorkers`/`useSubjects`/
      `useGroups` imports (data comes from `SemesterContext` instead), and
      the unused `Spinner` import. Drop the dead `isWorking` line **and**
      drop `isCreating` from the `useCreateScheduleAssignments()`
      destructure (design.md's cascading-case — `isCreating`'s only other
      reference was the now-deleted `isWorking` computation; keep
      `createScheduleAssignments`, which is called in `onSubmit`).
- [x] 3.6 `src/features/schedules/HourScheduleSubject.tsx`: remove the
      `editModal`/`deleteModal` `useState` calls and the
      `onCloseModal={() => setEditModal(false)}` /
      `onCloseModal={() => setDeleteModal(false)}` props that referenced
      them (design.md Category 4 — proven dead via `Modal.Window`'s
      `cloneElement` override). Reduce the `react` import to
      `import { type ComponentType } from "react";` (only remaining need).
- [x] 3.7 `src/features/schedules/HourScheduleSubjectGroup.tsx`: same
      `editModal`/`deleteModal` + prop removal as 3.6, plus drop the
      unused `Row` import. Reduce the `react` import to
      `import { useContext, type ComponentType } from "react";`.
- [x] 3.8 `src/features/schedules/HourScheduleTeacher.tsx`: remove the
      `editModal` `useState` call and its
      `onCloseModal={() => setEditModal(false)}` prop (this file has no
      `deleteModal` — its `ConfirmDelete` usage never passed
      `onCloseModal` to begin with). Remove the now-fully-unused
      `import { useState } from "react";` line entirely.
- [x] 3.9 `src/helpers/calculateSemesterGroup.ts`: delete the unused
      `currentYear`/`currentMonth`/`currentDay` lines (and their
      now-orphaned comments) from `calculateSemesterGroup`. Do not touch
      `calculateSemesterGroupForSemester` or any other part of the file.
- [x] 3.10 `src/pdf/Schedules/ScheduleGroupPDF.tsx`: drop the unused `data`
      parameter from `willDrawPage`. Do not touch `didDrawPage`'s `data`
      parameter (it's used).
- [x] 3.11 `src/pdf/Schedules/ScheduleTeacherPDF.tsx`: same `willDrawPage`
      `data` fix as 3.10.
- [x] 3.12 `src/pdf/Schedules/TeacherAssignmentPDF.tsx`: drop the unused
      `Spinner` import. Drop `isLoading: isLoadingRoles` from the
      `useRoles()` destructure, keeping `roles`. Drop the
      `isLoading: isLoadingStateRoles, stateRoles` destructure from
      `useStateRoles()` but **keep the bare call**
      (`useStateRoles();`) — design.md's explicit reasoning: removing the
      call entirely would stop this component from issuing that query at
      all, a real behavior change, not just a lint fix. Drop the unused
      `data` parameter from this file's own `willDrawPage`.
- [x] 3.13 `src/ui/MainNav.tsx`: drop the unused destructured `isActive`
      from the `style={({ isActive }) => ({ textDecoration: "none" })}`
      function only — the separate `children` render-prop function one
      line below, which also destructures `isActive` and uses it, is
      unchanged.

## 4. Category 2 — JSX rendering cleanup (unescaped quotation marks)

- [x] 4.1 `src/features/schedules/CreateEditScholarSchedule.tsx`: replace
      the two raw `"` characters around `{group.letter}` in the group
      `<option>` label with `&quot;` entities. No visible text change.
- [x] 4.2 `src/features/schedules/ShowScholarSchedule.tsx`: same fix, same
      pattern, in the group dropdown label.
- [x] 4.3 `src/features/schedules/HourScheduleSubjectGroup.tsx`: same fix
      in the schedule-cell group label (`° "..."` around
      `{schedule?.groups?.letter}`).
- [x] 4.4 `src/features/schedules/TeacherAssignment.tsx`: same fix in the
      grouped-subject row label (`° "..."` around
      `{...groups!.letter}`, followed by `")`).

## 5. Verification

- [x] 5.1 `bun run lint` — must report 0 problems (0 errors, 0 warnings).
- [x] 5.2 `bun run typecheck`
- [x] 5.3 `bun run build`
- [x] 5.4 `bunx @fission-ai/openspec validate eliminate-eslint-baseline --type change --strict`
- [x] 5.5 Manual verification per design.md's Manual Verification Plan (10
      items: login failure behavior; other-data and state-role forms;
      group and teacher schedule selection; schedule editing; schedule
      modals; teacher assignments; schedule PDF exports; dark-mode
      switching; navigation active states; route-based semester dashboard
      behavior).
- [x] 5.6 Record pass/fail for each 5.5 item, plus the 5.1–5.4 command
      output, in this file's Verification Results section before
      considering this change complete.

## Verification Results

- Tasks 1.1–1.7 (Category 3, Fast Refresh module separation): completed as
  specified. `src/context/useDarkMode.ts` and `src/pages/SemesterContext.ts`
  created, each with zero component exports. `DarkModeContext.tsx` exports
  only `DarkModeProvider`; `ScheduleDashboard.tsx` exports only its default
  component. All 7 `SemesterContext` consumers plus `DarkModeToggle.tsx`
  updated to the new import paths. `bun run typecheck` after this phase
  alone was clean, confirming every path resolved before proceeding.
  One additional cascading case, not explicitly called out in task 1.5's
  own wording but anticipated from design.md's cascading-case precedent:
  removing the `SemesterContextValue` interface from `ScheduleDashboard.tsx`
  left its `Group`/`Subject` type imports unused too (their only use was
  inside that now-moved interface) — both were dropped in the same edit as
  the `createContext` import removal, not left for a later pass.
- Tasks 2.1–2.3 (Category 4, hook dependency corrections): completed
  exactly as specified — see dependency arrays and loop-safety reasoning in
  the implementation summary. `bun run lint` immediately after this phase
  showed 0 warnings (both `react-hooks/exhaustive-deps` findings and both
  `react-refresh/only-export-components` findings gone), 29 errors
  remaining (matching the Category 1/2 findings not yet addressed at that
  point).
- Tasks 3.1–3.13 (Category 1, mechanical removal): completed exactly as
  specified, including the `isCreating`/`isWorking` cascading case in
  `CreateEditScholarSchedule.tsx` (task 3.5) and the bare `useStateRoles()`
  preservation in `TeacherAssignmentPDF.tsx` (task 3.12).
- Tasks 4.1–4.4 (Category 2, JSX unescaped entities): completed exactly as
  specified — all 8 raw `"` characters (2 per file × 4 files) replaced with
  `&quot;`, no other text changed.
- `bun run lint` → **0 problems (0 errors, 0 warnings), exit code 0** —
  the primary goal.
- `bun run typecheck` → clean, zero errors.
- `bun run build` → succeeds.
- `bunx @fission-ai/openspec validate eliminate-eslint-baseline --type change --strict`
  → valid.
- Scope discipline confirmed via `git status`/`git diff`: exactly the 18
  files with original lint findings + `src/ui/DarkModeToggle.tsx` (import
  path only) were modified, plus the 2 new files
  (`src/context/useDarkMode.ts`, `src/pages/SemesterContext.ts`) were
  added. `git diff --stat eslint.config.js` is empty (byte-for-byte
  unchanged). `git diff -- src | grep -i eslint-disable` returns nothing —
  zero disable comments introduced anywhere.
- Tasks 5.5–5.6 (manual verification): **completed, all pass.** Results
  per design.md's Manual Verification Plan:
  1. **Login failure behavior**: invalid login still shows the error toast
     and does not navigate.
  2. **Other-data and state-role forms**: edit flows still save, refresh,
     and close correctly.
  3. **Group and teacher schedule selection**: repeated group and teacher
     selection does not freeze or create runaway rendering — confirms the
     Category 4 `useCallback` fixes did not introduce a render loop.
  4. **Schedule editing**: scholar schedule editing still initializes,
     updates subjects after group changes, and saves.
  5. **Schedule modals**: edit/delete modal close and success paths still
     work in all three schedule-hour components — confirms the
     `editModal`/`deleteModal` dead-state removal had no observable effect.
  6. **Teacher assignments**: teacher assignment totals and PDF remain
     correct — confirms the bare `useStateRoles()` preservation in
     `TeacherAssignmentPDF.tsx` didn't change output.
  7. **Schedule PDF exports**: all schedule PDFs render correctly.
  8. **Dark-mode switching**: dark mode toggles and persists after reload —
     confirms the `useDarkMode`/`DarkModeContext` file split works
     end-to-end.
  9. **Navigation active states**: sidebar and schedule-route active
     styling remain correct — confirms the `isActive` parameter removal in
     `MainNav.tsx` didn't affect the still-used `isActive` usage nearby.
  10. **Route-based semester dashboard behavior**: existing semester routes
      and both schedule tabs load correctly with populated dropdowns —
      confirms the `SemesterContext` file split works end-to-end across all
      7 updated consumers.

  Command results (re-confirmed at sign-off): `bun run lint` → 0 errors, 0
  warnings. `bun run typecheck` → passed. `bun run build` → passed. `bunx
  @fission-ai/openspec validate eliminate-eslint-baseline --type change --strict`
  → passed.

  This change is complete: all 5 task groups implemented, all verification
  commands green, and all 10 manual verification items pass.
