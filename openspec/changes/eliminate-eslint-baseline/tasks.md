## 1. Category 3 — Fast Refresh module separation (do first: other files depend on the new import paths)

- [ ] 1.1 Create `src/context/useDarkMode.ts`: move the `DarkModeContext`
      object, the `DarkModeContextValue` interface, and the `useDarkMode`
      hook out of `src/context/DarkModeContext.tsx`, unchanged in behavior.
- [ ] 1.2 `src/context/DarkModeContext.tsx`: keep only `DarkModeProvider`;
      import `DarkModeContext` from `./useDarkMode`; keep
      `export { DarkModeProvider };` (named export, unchanged shape for
      `App.tsx`).
- [ ] 1.3 `src/ui/DarkModeToggle.tsx`: update the `useDarkMode` import path
      from `"../context/DarkModeContext"` to `"../context/useDarkMode"`.
- [ ] 1.4 Create `src/pages/SemesterContext.ts`: move the `SemesterContext`
      object and the `SemesterContextValue` interface out of
      `src/pages/ScheduleDashboard.tsx`, unchanged in behavior.
- [ ] 1.5 `src/pages/ScheduleDashboard.tsx`: import `SemesterContext` from
      `./SemesterContext`; remove the now-unused `createContext` import if
      nothing else in the file needs it; keep `export default ScheduleDashboard;`
      unchanged.
- [ ] 1.6 Update the `SemesterContext` import path in all 7 consumers, from
      `"../../pages/ScheduleDashboard"` to `"../../pages/SemesterContext"`:
      `src/features/schedules/CreateEditScholarSchedule.tsx`,
      `src/features/schedules/HourScheduleSubjectGroup.tsx`,
      `src/features/schedules/ShowScholarSchedule.tsx`,
      `src/features/schedules/TeacherAssignment.tsx`,
      `src/pdf/Schedules/ScheduleGroupPDF.tsx`,
      `src/pdf/Schedules/ScheduleTeacherPDF.tsx`,
      `src/pdf/Schedules/TeacherAssignmentPDF.tsx`.
- [ ] 1.7 `bun run typecheck` — confirms every updated import path resolves
      before proceeding to the remaining categories.

## 2. Category 4 — Hook dependency corrections (behavioral care required)

- [ ] 2.1 `src/features/schedules/CreateEditScholarSchedule.tsx`: wrap
      `selectingGroup` in `useCallback` with deps `[groups, subjects, semesterCode]`
      (design.md Category 4); add `selectingGroup` to the mount-time
      `useEffect`'s dependency array alongside the existing
      `isEditSession`, `editValues.group_id`. Do NOT add the raw,
      unmemoized function — that is the specific mistake this task exists
      to avoid.
- [ ] 2.2 `src/features/schedules/ShowTeacherSchedule.tsx`: wrap
      `selectingWorker` in `useCallback` with deps
      `[scheduleTeachers, scheduleAssignments]`; change the `useEffect`'s
      dependency array to `[selectedWorkerId, selectingWorker]` (dropping
      the now-redundant direct `scheduleTeachers`/`scheduleAssignments`
      entries, since they're covered via `selectingWorker`'s own deps).
- [ ] 2.3 `bun run lint` — confirm both `react-hooks/exhaustive-deps`
      warnings are gone with no new warning introduced by the
      `useCallback` wrapping itself.

## 3. Category 1 — Mechanical removal (dead imports/variables/parameters)

- [ ] 3.1 `src/features/authentication/useLogin.ts`: drop the unused `err`
      parameter from `onError`.
- [ ] 3.2 `src/features/otherData/CreateEditOtherForm.tsx`: drop the unused
      `data` parameter from the inner `onSuccess`.
- [ ] 3.3 `src/features/stateRoles/CreateEditStateRoleForm.tsx`: drop the
      unused `data` parameter from the inner `onSuccess`.
- [ ] 3.4 `src/features/schedules/CreateEditTeacherSchedule.tsx`: drop the
      unused `Input` import; drop `semesters`/`workers: workerData` from
      the `scheduleToEdit` destructuring (design.md's confirmation that
      this is behaviorally inert — react-hook-form ignores unregistered
      `defaultValues` keys either way).
- [ ] 3.5 `src/features/schedules/CreateEditScholarSchedule.tsx`: drop the
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
- [ ] 3.6 `src/features/schedules/HourScheduleSubject.tsx`: remove the
      `editModal`/`deleteModal` `useState` calls and the
      `onCloseModal={() => setEditModal(false)}` /
      `onCloseModal={() => setDeleteModal(false)}` props that referenced
      them (design.md Category 4 — proven dead via `Modal.Window`'s
      `cloneElement` override). Reduce the `react` import to
      `import { type ComponentType } from "react";` (only remaining need).
- [ ] 3.7 `src/features/schedules/HourScheduleSubjectGroup.tsx`: same
      `editModal`/`deleteModal` + prop removal as 3.6, plus drop the
      unused `Row` import. Reduce the `react` import to
      `import { useContext, type ComponentType } from "react";`.
- [ ] 3.8 `src/features/schedules/HourScheduleTeacher.tsx`: remove the
      `editModal` `useState` call and its
      `onCloseModal={() => setEditModal(false)}` prop (this file has no
      `deleteModal` — its `ConfirmDelete` usage never passed
      `onCloseModal` to begin with). Remove the now-fully-unused
      `import { useState } from "react";` line entirely.
- [ ] 3.9 `src/helpers/calculateSemesterGroup.ts`: delete the unused
      `currentYear`/`currentMonth`/`currentDay` lines (and their
      now-orphaned comments) from `calculateSemesterGroup`. Do not touch
      `calculateSemesterGroupForSemester` or any other part of the file.
- [ ] 3.10 `src/pdf/Schedules/ScheduleGroupPDF.tsx`: drop the unused `data`
      parameter from `willDrawPage`. Do not touch `didDrawPage`'s `data`
      parameter (it's used).
- [ ] 3.11 `src/pdf/Schedules/ScheduleTeacherPDF.tsx`: same `willDrawPage`
      `data` fix as 3.10.
- [ ] 3.12 `src/pdf/Schedules/TeacherAssignmentPDF.tsx`: drop the unused
      `Spinner` import. Drop `isLoading: isLoadingRoles` from the
      `useRoles()` destructure, keeping `roles`. Drop the
      `isLoading: isLoadingStateRoles, stateRoles` destructure from
      `useStateRoles()` but **keep the bare call**
      (`useStateRoles();`) — design.md's explicit reasoning: removing the
      call entirely would stop this component from issuing that query at
      all, a real behavior change, not just a lint fix. Drop the unused
      `data` parameter from this file's own `willDrawPage`.
- [ ] 3.13 `src/ui/MainNav.tsx`: drop the unused destructured `isActive`
      from the `style={({ isActive }) => ({ textDecoration: "none" })}`
      function only — the separate `children` render-prop function one
      line below, which also destructures `isActive` and uses it, is
      unchanged.

## 4. Category 2 — JSX rendering cleanup (unescaped quotation marks)

- [ ] 4.1 `src/features/schedules/CreateEditScholarSchedule.tsx`: replace
      the two raw `"` characters around `{group.letter}` in the group
      `<option>` label with `&quot;` entities. No visible text change.
- [ ] 4.2 `src/features/schedules/ShowScholarSchedule.tsx`: same fix, same
      pattern, in the group dropdown label.
- [ ] 4.3 `src/features/schedules/HourScheduleSubjectGroup.tsx`: same fix
      in the schedule-cell group label (`° "..."` around
      `{schedule?.groups?.letter}`).
- [ ] 4.4 `src/features/schedules/TeacherAssignment.tsx`: same fix in the
      grouped-subject row label (`° "..."` around
      `{...groups!.letter}`, followed by `")`).

## 5. Verification

- [ ] 5.1 `bun run lint` — must report 0 problems (0 errors, 0 warnings).
- [ ] 5.2 `bun run typecheck`
- [ ] 5.3 `bun run build`
- [ ] 5.4 `bunx @fission-ai/openspec validate eliminate-eslint-baseline --type change --strict`
- [ ] 5.5 Manual verification per design.md's Manual Verification Plan (10
      items: login failure behavior; other-data and state-role forms;
      group and teacher schedule selection; schedule editing; schedule
      modals; teacher assignments; schedule PDF exports; dark-mode
      switching; navigation active states; route-based semester dashboard
      behavior).
- [ ] 5.6 Record pass/fail for each 5.5 item, plus the 5.1–5.4 command
      output, in this file's Verification Results section before
      considering this change complete.

## Verification Results

(To be filled in during implementation; do not pre-fill.)
