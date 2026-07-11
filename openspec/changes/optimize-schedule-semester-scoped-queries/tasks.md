## 1. Services — scope reads by semester_id

- [ ] 1.1 `src/services/apiScheduleAssignments.ts`: change
      `getScheduleAssignments()` to `getScheduleAssignments(semesterId: number)`
      and add `.eq("semester_id", semesterId)` to its existing `select(...)`
      call — no internal `Number(...)` coercion needed, `semesterId` arrives
      already parsed (design.md Decision 2). Do not change the selected
      columns/embedded relations or the create/edit/delete functions in this
      file.
- [ ] 1.2 `src/services/apiScheduleTeachers.ts`: change
      `getScheduleTeachers()` to `getScheduleTeachers(semesterId: number)`
      and add `.eq("semester_id", semesterId)` to its existing `select(...)`
      call — no internal `Number(...)` coercion needed. Do not change the
      selected columns/embedded relations or the create/edit/delete functions
      in this file.

## 2. Hooks — accept a parsed numeric semesterId, scope queryKey, guard on validity

- [ ] 2.1 `src/features/schedules/useScheduleAssignments.ts`: accept a
      `semesterId: number | undefined` parameter, pass it to
      `getScheduleAssignments`, change `queryKey` to the plain array
      `["scheduleAssignments", semesterId]` (element `[0]` must stay exactly
      `"scheduleAssignments"` — required for task 2.3's prefix-match
      assumption to hold, design.md Decision 4), and add
      `enabled: typeof semesterId === "number" && Number.isFinite(semesterId)`
      (design.md Decision 3 — not `Boolean(semesterId)`).
- [ ] 2.2 `src/features/schedules/useScheduleTeachers.ts`: accept a
      `semesterId: number | undefined` parameter, pass it to
      `getScheduleTeachers`, change `queryKey` to the plain array
      `["scheduleTeachers", semesterId]`, and add
      `enabled: typeof semesterId === "number" && Number.isFinite(semesterId)`.
- [ ] 2.3 Do NOT modify `useCreateScheduleAssignments.ts`,
      `useEditScheduleAssignments.ts`, `useDeleteScheduleAssignment.ts`,
      `useCreateScheduleTeacher.ts`, `useEditScheduleTeacher.ts`, or
      `useDeleteScheduleTeacher.ts` as a starting assumption — inspection
      (design.md Decision 4) confirms all 6 already call `invalidateQueries`
      with a plain-array key and no `exact` option, which TanStack Query v5's
      default prefix matching should still satisfy against the new
      semester-suffixed keys from 2.1/2.2. This is verified behaviorally in
      task 4.5, not left as an unchecked assumption.
- [ ] 2.4 **Conditional fallback** — only if task 4.5's manual verification
      finds that creating, editing, or deleting a scholar schedule assignment
      or teacher activity does *not* refresh the visible table without a
      manual reload: update the corresponding mutation hook(s)'
      `invalidateQueries` call to explicitly target the scoped key currently
      in view (e.g. `queryKey: ["scheduleAssignments", semesterId]`, sourced
      from the mutating component/hook's own `semesterId`), or switch to a
      predicate-based `invalidateQueries({ predicate: (query) => query.queryKey[0] === "scheduleAssignments" })`
      call. Do not perform this task speculatively — only if 4.5 demonstrates
      the prefix-matching assumption in Decision 4 does not hold.

## 3. Page — parse semesterId once, pass it into the hooks, drop redundant client filters

- [ ] 3.1 `src/pages/ScheduleDashboard.tsx`: parse the route param once —
      `const semesterId = id !== undefined ? Number(id) : undefined;` —
      immediately after `const { id } = useParams();`, and call
      `useScheduleAssignments(semesterId)` / `useScheduleTeachers(semesterId)`
      with the parsed value (design.md Decision 2). Do not pass the raw
      string `id` into either hook.
- [ ] 3.2 Remove the now-redundant
      `scheduleAssignments!.filter((s) => s.semester_id === +id!)` and
      `scheduleTeachers!.filter((s) => s.semester_id === +id!)` lines;
      use the hooks' already-scoped `scheduleAssignments`/`scheduleTeachers`
      directly wherever `scheduleAssignmentsBySemester`/
      `scheduleTeachersBySemester` were previously used (`SemesterContext`
      value, `WorkerSheetSemester` props, `ScholarSchedule`/`TeacherSchedule`
      props).
- [ ] 3.3 Leave `currentSemester = semesters!.find((s) => s.id === +id!)`
      and every other line in this file unchanged.

## 4. Verification

- [ ] 4.1 `bun run typecheck`
- [ ] 4.2 `bun run build`
- [ ] 4.3 `bun run lint`
- [ ] 4.4 `bunx @fission-ai/openspec validate optimize-schedule-semester-scoped-queries --type change --strict`
- [ ] 4.5 Manual smoke test on `/semesters/:id` (an existing semester with
      both scholar and teacher schedule data):
      - Scholar schedule tab renders the same rows/cells as before this
        change.
      - Teacher schedule tab renders the same rows/cells, including the
        extracurricular block when applicable.
      - Create, edit, and delete one scholar schedule assignment; confirm
        the table refreshes without a manual page reload (behaviorally
        confirms design.md Decision 4's prefix-matching invalidation holds
        for the new scoped keys — if it does not, do task 2.4) and conflict
        detection (`hasWorkerConflict`/`hasGroupConflict`) still blocks an
        overlapping submission.
      - Create, edit, and delete one teacher schedule activity; confirm the
        table refreshes without a manual page reload (same Decision 4 check
        for `["scheduleTeachers", semesterId]`) and cross-conflict detection
        against scholar assignments still works.
      - Navigate to a semester via a malformed/non-numeric route (or confirm
        by code inspection) that `semesterId` becomes `NaN` and both hooks'
        `enabled` guard keeps them from firing — page shows `<Spinner />`,
        matching pre-change behavior for this edge case (design.md
        Decision 3).
      - Open "Asignación horaria" (`TeacherAssignment`) for a worker with
        both scholar assignments and teacher activities; confirm hour totals
        match pre-change values.
      - Export the semester PDF (`WorkerSheetSemester`) and one schedule PDF
        (`ScheduleGroupPDF`/`ScheduleTeacherPDF`/`TeacherAssignmentPDF`);
        confirm contents are unchanged.
      - Switch between two different semesters (navigate to a different
        `:id`) and confirm each shows only its own data, with no
        stale/leftover rows from the previously-viewed semester.
- [ ] 4.6 Record pass/fail for each 4.5 item, plus the 4.1–4.4 command
      output, in this file's Verification Results section before considering
      this change complete.

## 5. Non-blocking follow-up (not part of this change's scope)

- [ ] 5.1 Confirmed by inspection (design.md Decision 6): neither
      `schedule_assignments.semester_id` nor `schedule_teachers.semester_id`
      has a database index today. No migration is added in this change. If a
      follow-up is desired, a separate OpenSpec change should add one,
      reusing the pattern already established in
      `supabase/migrations/20260702145831_worker_document_indexes.sql`. No
      action required here beyond recording this in Verification Results.

## Verification Results

(To be filled in during implementation; do not pre-fill.)
