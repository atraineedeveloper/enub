## 1. Teacher canonical blocks helper

- [ ] 1.1 Create `src/features/schedules/teacherScheduleBlocks.ts`: import
      `SCHEDULE_BLOCKS`/`ScheduleBlock` from `./scheduleBlocks` (do not
      duplicate the 4 shared intervals); export `TEACHER_SCHEDULE_BLOCKS`
      (the 4 imported blocks plus the 17:00:00–19:00:00 teacher-only 5th
      block, in order, per design.md Decision 1), `getTeacherBlockByStartTime`,
      `getTeacherBlockByTimes`, and `isCanonicalTeacherBlock`.
- [ ] 1.2 Do not modify `src/features/schedules/scheduleBlocks.ts` — the
      dependency is one-directional (teacher module reads from the scholar
      module); scholar behavior must be provably unaffected.
- [ ] 1.3 Do not modify `src/helpers/constants.ts`'s `WEEKDAYS`/
      `START_TIMES`/`END_TIMES`. `WEEKDAYS` stays in active use by
      `CreateEditTeacherSchedule.tsx`'s weekday selector (unchanged by this
      proposal); `START_TIMES`/`END_TIMES` become unused by that file as a
      result of this change but are left in place — an explicitly
      out-of-scope cleanup, not silently dropped.

## 2. Service-layer validation

- [ ] 2.1 `src/services/apiScheduleTeachers.ts`: in
      `createEditScheduleTeachers()`, add the canonical-block check from
      design.md Decision 8 — reject (throw, no insert/update attempted) any
      payload whose `start_time`/`end_time` aren't both strings matching a
      canonical teacher block. Place it immediately after the existing
      payload-shape guard (`if (!newScheduleTeachers || typeof ... !== "object")`),
      before the insert/update query is built. Import
      `isCanonicalTeacherBlock` from `../features/schedules/teacherScheduleBlocks`.
      Do not add `worker_id`/`weekday` presence validation this function
      doesn't already have — out of scope (design.md Decision 8).
- [ ] 2.2 Do not modify `getScheduleTeachers()` or `deleteScheduleTeachers()`
      in the same file.

## 3. CreateEditTeacherSchedule.tsx — canonical block selector

- [ ] 3.1 Delete the "Hora Fin" `FormRow`/`<Select>` entirely. Rename the
      "Hora Inicio" `FormRow`'s `label` to `"Bloque horario"` and replace
      its `<option>` list with one option per `TEACHER_SCHEDULE_BLOCKS`
      entry (`value={block.start_time}`, text `{block.label}`), keeping the
      `register("start_time", { required: ... })` field name and the
      existing `"Seleccione..."` empty option (design.md Decision 3).
- [ ] 3.2 In `onSubmit`, before the existing `hasWorkerConflict` check,
      resolve the submitted `start_time` to its full teacher block via
      `getTeacherBlockByStartTime`; if no block matches, `toast.error(...)`
      and return (matching the scholar form's early-return-with-toast
      pattern); on success, set `data.end_time` to the resolved block's
      `end_time` before the conflict check and before calling
      `createScheduleTeacher`/`editScheduleTeacher` (design.md Decision 3).
      Do not add a separate `block_id` field.
- [ ] 3.3 Add the optional
      `initialValues?: { weekday?: string; worker_id?: number; start_time?: string }`
      prop (design.md Decision 5); use it (only when not in an edit
      session) as the `defaultValues` source for `useForm`, replacing the
      current bare `{}` fallback. Unlike the scholar form, `worker_id` IS
      part of `initialValues` here (the teacher-schedule view is already
      scoped to one selected teacher) — only `activity` is left blank.
- [ ] 3.4 Implement the invalid-legacy-interval handling from design.md
      Decision 6: compute `editedBlock` via `getTeacherBlockByTimes` once,
      from the record being edited; when `isEditSession` is true and
      `editedBlock` is `undefined`, omit `start_time` from `defaultValues`
      (leave the block `<select>` unselected) and render the specified
      warning message above the "Bloque horario" `FormRow`. Do not attempt
      to guess or auto-select a block in this case. Confirm (do not add) —
      per design.md Decision 6 — that `weekday`/`worker_id`/`activity`
      need no equivalent of the scholar form's `setValue`/`useRef`
      subject-preload fix: their option lists are static and available at
      mount, so plain `defaultValues` already preloads them correctly.

## 4. Free-cell Add flow — prop threading and UI

- [ ] 4.1 `src/features/schedules/ShowTeacherSchedule.tsx`: compute a
      `workerId: string` (from `selectedWorkerId`, `""` when `null`) and a
      `workerLabel: string` (via `capitalizeName(selectedWorker.name)`,
      reusing the same expression already used for the worker `<option>`
      labels); pass both, plus the already-passed `semesterId`, into
      `<RowTeacherSchedule ... workerId={workerId} workerLabel={workerLabel} />`.
      The existing `workers` (full list) prop passed into `RowTeacherSchedule`
      is unchanged.
- [ ] 4.2 `src/features/schedules/RowTeacherSchedule.tsx`: accept new
      `workerId: string`/`workerLabel: string` props; thread both through
      `TimeSlotRow`'s existing `shared` object (alongside `workers`/
      `semesterId`) so every `TimeSlotRow` call site (including the
      conditional 17:00–19:00 one) and, inside it, every `DayCell` and
      `HourScheduleSubjectTeacher` instance receives them — mechanical but
      must be complete; audit the full file, not a sample.
- [ ] 4.3 `src/features/schedules/HourScheduleTeacher.tsx`
      (`HourScheduleSubjectTeacher`): accept the new `workerId: string`/
      `workerLabel: string` props (alongside the existing `workers`/
      `semesterId`). When `activitiesHour.length === 0` (the free-cell
      branch, currently `return <p></p>;`), render a real, focusable
      `<button type="button">` (styled inline/borderless, matching the
      scholar side's `AddButton` pattern from its own code-review fix —
      apply that lesson from the start rather than shipping the
      role="button"/tabIndex anti-pattern and fixing it later) wrapping an
      add icon (e.g. `FaPlus`), with an `aria-label` containing the
      weekday, block label, and `workerLabel` (per the request's
      accessibility requirement 16 and design.md Decision 4), inside a
      `Modal`/`Modal.Open`/`Modal.Window` trio (a new, distinct window
      name, e.g. `"activity-schedule-add-form-${weekday}-${startTime}"`,
      per the existing per-cell `Modal` isolation pattern already used for
      edit/delete), opening `CreateEditTeacherSchedule` with `semesterId`,
      `workers`, and
      `initialValues={{ weekday, worker_id: Number(workerId), start_time: startTime }}`.
      Activity text is left unset (no `scheduleToEdit`, no preselection
      beyond what `initialValues` provides).
- [ ] 4.4 Confirm `HourScheduleSubjectGroup.tsx` (the scholar-assignment
      half of each teacher-grid cell) is untouched — this change adds an
      Add action only to the teacher-activity half of the cell.

## 5. Zero-activity teacher renders the full grid

- [ ] 5.1 `src/features/schedules/ShowTeacherSchedule.tsx`: per design.md
      Decision 10, render `RowTeacherSchedule` whenever a teacher is
      selected (`selectedWorkerId !== null`), not only when `recordExist`
      is true, so a teacher with zero activities and zero scholar
      assignments still sees the full grid and every cell's Add action.
      Keep `ScheduleTeacherPDF` gated on the existing `recordExist`
      condition, unchanged (matching the `pdf-exporter-safety` capability's
      button-visibility requirement). Do not render the grid before any
      teacher is selected.

## 6. Invalid-legacy-row detection banner

- [ ] 6.1 `src/features/schedules/ShowTeacherSchedule.tsx`: compute
      `invalidActivities` (design.md Decision 7) via `useMemo`, filtering
      `filteredSchedulesTeacher` by
      `!isCanonicalTeacherBlock(s.start_time, s.end_time)`. Render a
      warning banner above the table when `invalidActivities.length > 0`,
      listing each row's weekday, activity text, and raw
      `start_time`–`end_time`. Do not alter `filteredSchedulesTeacher`
      itself or any existing rendering path for valid rows.

## 7. Explicitly unchanged (verify, do not modify)

- [ ] 7.1 Confirm `src/helpers/detectScheduleConflict.ts` is untouched —
      `hasWorkerConflict` already works correctly across the combined
      `[...scheduleTeachers, ...scheduleAssignments]` array for canonical
      teacher blocks and for legacy invalid rows alike (design.md
      Decision 9).
- [ ] 7.2 Confirm no file under `src/pdf/**` changed — hour-counting
      formulas already group by activity text and multiply
      `quantity * 2`, agnostic of `start_time`, so the 17:00–19:00 block
      is already counted correctly (design.md Decisions 2 and 12's
      inspection result, satisfying request item 28).
- [ ] 7.3 Confirm `src/features/schedules/CreateEditScholarSchedule.tsx`,
      `HourScheduleSubject.tsx`, `RowScholarSchedule.tsx`,
      `ShowScholarSchedule.tsx`, `ScholarSchedule.tsx`, and
      `src/features/schedules/scheduleBlocks.ts` are untouched (scholar
      schedule, out of scope).
- [ ] 7.4 Confirm `src/features/schedules/TeacherSchedule.tsx` is
      untouched — the top-level "+ Agregar horario de actividades" button
      keeps its current label and placement (design.md Decision 11).
- [ ] 7.5 Confirm no migration file added or modified, and no
      `schedule_teachers` row changed, split, or deleted by this change's
      own code (only new validation on future writes).

## 8. Verification

- [ ] 8.1 `bun run typecheck`
- [ ] 8.2 `bun run build`
- [ ] 8.3 `bun run lint`
- [ ] 8.4 `bunx @fission-ai/openspec validate add-teacher-activities-from-empty-slots --type change --strict`
- [ ] 8.5 Focused helper/service verification (standalone script, mirroring
      the scholar-side change's verification approach):
      - All 5 canonical teacher blocks (including 17:00–19:00) accepted by
        `isCanonicalTeacherBlock`.
      - A multi-block span (e.g. `07:00:00`–`13:00:00`) rejected.
      - Reversed times rejected.
      - Mismatched canonical start/end rejected.
      - Valid create payload accepted by the simulated
        `createEditScheduleTeachers` validation logic.
      - Valid update payload accepted.
      - Invalid direct service write rejected before Supabase.
      - Valid edit form preloads its block (`getTeacherBlockByTimes`
        resolves the matching entry).
      - Invalid legacy edit leaves the block selector unselected.
- [ ] 8.6 Manual verification (design.md Decision 12):
      - Create one activity in each of the 5 canonical blocks (including
        17:00–19:00) via the top-level Add button; confirm each saves with
        the correct `start_time`/`end_time` pair.
      - Confirm the "Bloque horario" `<select>` never offers a 6th option
        and that submitting without a selection is blocked by the
        existing required-field validation.
      - Attempt a conflicting submission against another teacher activity
        for the same worker, and separately against a scholar assignment
        for the same worker, and confirm the existing conflict-detection
        toast blocks both.
      - From at least 2 different free cells (different weekday/block
        combinations), use the new Add action; confirm semester, teacher,
        and block are preselected correctly and activity text is empty for
        entry; save and confirm the new row appears in the correct cell.
      - Select a teacher with zero existing activities and zero scholar
        assignments; confirm the full grid renders (not just the header)
        with every applicable cell's Add action, and that the
        `ScheduleTeacherPDF` button does not render (matching the
        unchanged `recordExist` gate).
      - `Tab` to a free cell's Add action and confirm both `Enter` and
        `Space` open the form.
      - Confirm occupied-cell edit and delete controls still work
        unchanged, including cells with more than one activity.
      - Insert a test row with a legacy-invalid interval (e.g.
        `07:00:00`–`13:00:00`) directly (test data, not production);
        confirm it renders in the grid, confirm the invalid-row warning
        banner lists it, open it for editing and confirm the block
        selector is unselected with the warning message shown, correct it
        by selecting a valid block and saving, and confirm the banner no
        longer lists it afterward.
      - Confirm teacher assignment hour totals (`TeacherAssignment.tsx`)
        and all relevant PDF exporters (`ScheduleTeacherPDF`,
        `TeacherAssignmentPDF`, `WorkerSheetSemester`) remain visually
        correct for valid data, including a teacher with a 17:00–19:00
        activity.
- [ ] 8.7 Record pass/fail for each 8.6 item, plus the 8.1–8.5 output, in
      this file's Verification Results section before considering this
      change complete.

## Verification Results

(To be filled in during implementation; do not pre-fill.)
