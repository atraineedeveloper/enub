## 1. Services — scope reads by semester_id

- [x] 1.1 `src/services/apiScheduleAssignments.ts`: change
      `getScheduleAssignments()` to `getScheduleAssignments(semesterId: number)`
      and add `.eq("semester_id", semesterId)` to its existing `select(...)`
      call — no internal `Number(...)` coercion needed, `semesterId` arrives
      already parsed (design.md Decision 2). Do not change the selected
      columns/embedded relations or the create/edit/delete functions in this
      file.
- [x] 1.2 `src/services/apiScheduleTeachers.ts`: change
      `getScheduleTeachers()` to `getScheduleTeachers(semesterId: number)`
      and add `.eq("semester_id", semesterId)` to its existing `select(...)`
      call — no internal `Number(...)` coercion needed. Do not change the
      selected columns/embedded relations or the create/edit/delete functions
      in this file.

## 2. Hooks — accept a parsed numeric semesterId, scope queryKey, guard on validity

- [x] 2.1 `src/features/schedules/useScheduleAssignments.ts`: accept a
      `semesterId: number | undefined` parameter, pass it to
      `getScheduleAssignments`, change `queryKey` to the plain array
      `["scheduleAssignments", semesterId]` (element `[0]` must stay exactly
      `"scheduleAssignments"` — required for task 2.3's prefix-match
      assumption to hold, design.md Decision 4), and add
      `enabled: typeof semesterId === "number" && Number.isFinite(semesterId)`
      (design.md Decision 3 — not `Boolean(semesterId)`).
- [x] 2.2 `src/features/schedules/useScheduleTeachers.ts`: accept a
      `semesterId: number | undefined` parameter, pass it to
      `getScheduleTeachers`, change `queryKey` to the plain array
      `["scheduleTeachers", semesterId]`, and add
      `enabled: typeof semesterId === "number" && Number.isFinite(semesterId)`.
- [x] 2.3 Do NOT modify `useCreateScheduleAssignments.ts`,
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

- [x] 3.1 `src/pages/ScheduleDashboard.tsx`: parse the route param once —
      `const semesterId = id !== undefined ? Number(id) : undefined;` —
      immediately after `const { id } = useParams();`, and call
      `useScheduleAssignments(semesterId)` / `useScheduleTeachers(semesterId)`
      with the parsed value (design.md Decision 2). Do not pass the raw
      string `id` into either hook.
- [x] 3.2 Remove the now-redundant
      `scheduleAssignments!.filter((s) => s.semester_id === +id!)` and
      `scheduleTeachers!.filter((s) => s.semester_id === +id!)` lines;
      use the hooks' already-scoped `scheduleAssignments`/`scheduleTeachers`
      directly wherever `scheduleAssignmentsBySemester`/
      `scheduleTeachersBySemester` were previously used (`SemesterContext`
      value, `WorkerSheetSemester` props, `ScholarSchedule`/`TeacherSchedule`
      props).
- [x] 3.3 Leave `currentSemester = semesters!.find((s) => s.id === +id!)`
      and every other line in this file unchanged.

## 4. Verification

- [x] 4.1 `bun run typecheck`
- [x] 4.2 `bun run build`
- [x] 4.3 `bun run lint`
- [x] 4.4 `bunx @fission-ai/openspec validate optimize-schedule-semester-scoped-queries --type change --strict`
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
      - Force a schedules query error (e.g. temporarily revoke read access
        to `schedule_assignments`/`schedule_teachers`, or simulate a network
        failure) and confirm `<ErrorMessage message={anyError.message} />`
        renders — not an infinite `<Spinner />` — verifying the post-review
        fix that moved the `anyError` check ahead of the missing-data guard.
- [ ] 4.6 Record pass/fail for each 4.5 item, plus the 4.1–4.4 command
      output, in this file's Verification Results section before considering
      this change complete.

## 5. Non-blocking follow-up (not part of this change's scope)

- [x] 5.1 Confirmed by inspection (design.md Decision 6): neither
      `schedule_assignments.semester_id` nor `schedule_teachers.semester_id`
      has a database index today. No migration is added in this change. If a
      follow-up is desired, a separate OpenSpec change should add one,
      reusing the pattern already established in
      `supabase/migrations/20260702145831_worker_document_indexes.sql`. No
      action required here beyond recording this in Verification Results.

## Verification Results

- Tasks 1.1–1.2, 2.1–2.2, 3.1–3.3 implemented as specified. Task 2.3 (no
  mutation hook changes) held — no mutation hook files were touched.
- `bunx @fission-ai/openspec validate optimize-schedule-semester-scoped-queries --type change --strict`
  → valid.
- `bun run typecheck` → clean, zero errors.
- `bun run build` → succeeds.
- `bun run lint` → 43 problems (39 errors, 4 warnings) — unchanged from the
  pre-existing baseline (matches the `finish-js-to-ts-migration` change's
  final recorded count). Zero new lint issues in any of the 5 files touched
  by this change; the one warning under `ScheduleDashboard.tsx`
  (`react-refresh/only-export-components`, on the `SemesterContext` export)
  pre-dates this change and is unrelated to it.

**Implementation correction found during 3.1 (not explicitly anticipated by
design.md Decision 3), applied and documented here rather than deferred:**
`ScheduleDashboard.tsx`'s pre-existing loading gate was
`isLoadingWorkers || ... || isLoadingScheduleAssignments || isLoadingScheduleTeachers || ...`.
design.md Decision 3 assumed a disabled TanStack Query v5 query reports
`isLoading: true` while it has no data — that assumption is incorrect for
this codebase's installed version (`@tanstack/react-query ^5.51.23`). In v5,
`isLoading` is derived as `isPending && isFetching`; a disabled query never
fetches, so `isFetching` is `false` and `isLoading` is `false` even though
`data` stays `undefined` indefinitely. Left as originally drafted, the
malformed/`NaN`-`semesterId` edge case (Decision 3's own target case) would
have let the loading gate return `false`, allowing the component to render
past it with `scheduleAssignments`/`scheduleTeachers` still `undefined` —
crashing at the `SemesterContext` value and every downstream prop that
expects an array (a regression the original unfiltered-fetch code never had,
since it always fetched unconditionally and only ever produced `[]`, never
`undefined`, from the old client-side filter).

Fix applied: added `!scheduleAssignments || !scheduleTeachers` to the same
loading-gate condition (`src/pages/ScheduleDashboard.tsx`). This keeps the
`<Spinner />` showing for as long as either scoped query has no data yet —
covering both the normal in-flight-fetch case (already covered by
`isLoading*`) and the disabled/invalid-`semesterId` case (not covered by
`isLoading*` alone) — which is what Decision 3 described as the intended
observable behavior, just achieved by a condition that actually holds in
this codebase's TanStack Query version. No other line in the loading gate,
and no other file, changed as a result. `design.md` Decision 3's specific
claim about `isLoading` being `true` for a disabled query should be
corrected in a follow-up edit to reflect this; not done here since the
scope of this task was implementation, not further spec editing.
- Task 4.5 (manual smoke test) and 4.6 (recording its results): **not
  performed** — no browser/dev-server session was available in this
  implementation pass. Still required before this change is considered
  fully complete, per `tasks.md`'s own instructions.
- Task 2.4 (conditional mutation-hook fallback): not evaluated — depends on
  4.5's outcome, not yet run.

**Second correction (post-implementation review, this pass):** the missing-data
guard added in the correction above (`!scheduleAssignments || !scheduleTeachers`)
was itself checked before the existing `anyError` check, so it also matched
the error state (a failed query also leaves `data` `undefined`) and made
`if (anyError) return <ErrorMessage message={anyError.message} />;`
unreachable — a real `getScheduleAssignments`/`getScheduleTeachers` failure
(or any of the other 4 hooks' failures) would render an infinite
`<Spinner />` instead of the error message. Fixed in
`src/pages/ScheduleDashboard.tsx` by moving the `anyError` computation above
the loading/missing-data `if` and gating that `if` on `!anyError`:

```ts
const anyError = errorWorkers || errorSubjects || errorGroups || errorAssignments || errorTeachers || errorSemesters;

if (
  !anyError && (
    isLoadingWorkers || isLoadingSubjects || isLoadingGroups ||
    isLoadingScheduleAssignments || isLoadingScheduleTeachers || isLoadingSemesters ||
    !scheduleAssignments || !scheduleTeachers
  )
) return <Spinner />;

if (anyError) return <ErrorMessage message={anyError.message} />;
```

This also required adding `!` non-null assertions at the 4 usage sites where
`scheduleAssignments`/`scheduleTeachers` are consumed after the guards
(`SemesterContext` value, `ScholarSchedule` prop, `TeacherSchedule`'s two
props) — `tsc` can no longer narrow those to non-`undefined` automatically
once the guard condition became `!anyError && (...)` instead of a flat `||`
chain (it did narrow correctly before this fix). This matches the file's
pre-existing convention of using `!` for other hook results
(`groups!`, `workers!`, `subjects!`, `semesters!`) once the loading/error
gates have already returned.

Re-ran after this fix:
- `bun run typecheck` → clean, zero errors.
- `bun run build` → succeeds.
- `bun run lint` → 43 problems (39 errors, 4 warnings), unchanged from
  baseline; no new issues from the added `!` assertions.
- `bunx @fission-ai/openspec validate optimize-schedule-semester-scoped-queries --type change --strict`
  → valid.

Task 4.5/4.6 (manual smoke test) remain **not performed** — this fix
specifically restores the error-message path, so 4.5's checklist should
also include manually forcing a schedules query error (e.g. temporarily
revoking read access, or simulating a network failure) and confirming
`<ErrorMessage />` renders instead of an infinite spinner, in addition to
the scenarios already listed there.
