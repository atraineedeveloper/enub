## 1. Teacher canonical blocks helper

- [x] 1.1 Create `src/features/schedules/teacherScheduleBlocks.ts`: import
      `SCHEDULE_BLOCKS`/`ScheduleBlock` from `./scheduleBlocks` (do not
      duplicate the 4 shared intervals); export `TEACHER_SCHEDULE_BLOCKS`
      (the 4 imported blocks plus the 17:00:00–19:00:00 teacher-only 5th
      block, in order, per design.md Decision 1), `getTeacherBlockByStartTime`,
      `getTeacherBlockByTimes`, and `isCanonicalTeacherBlock`.
- [x] 1.2 Do not modify `src/features/schedules/scheduleBlocks.ts` — the
      dependency is one-directional (teacher module reads from the scholar
      module); scholar behavior must be provably unaffected.
- [x] 1.3 Do not modify `src/helpers/constants.ts`'s `WEEKDAYS`/
      `START_TIMES`/`END_TIMES`. `WEEKDAYS` stays in active use by
      `CreateEditTeacherSchedule.tsx`'s weekday selector (unchanged by this
      proposal); `START_TIMES`/`END_TIMES` become unused by that file as a
      result of this change but are left in place — an explicitly
      out-of-scope cleanup, not silently dropped.

## 2. Service-layer validation

- [x] 2.1 `src/services/apiScheduleTeachers.ts`: in
      `createEditScheduleTeachers()`, add the canonical-block check from
      design.md Decision 8 — reject (throw, no insert/update attempted) any
      payload whose `start_time`/`end_time` aren't both strings matching a
      canonical teacher block. Place it immediately after the existing
      payload-shape guard (`if (!newScheduleTeachers || typeof ... !== "object")`),
      before the insert/update query is built. Import
      `isCanonicalTeacherBlock` from `../features/schedules/teacherScheduleBlocks`.
      Do not add `worker_id`/`weekday` presence validation this function
      doesn't already have — out of scope (design.md Decision 8).
- [x] 2.2 Do not modify `getScheduleTeachers()` or `deleteScheduleTeachers()`
      in the same file.

## 3. CreateEditTeacherSchedule.tsx — canonical block selector

- [x] 3.1 Delete the "Hora Fin" `FormRow`/`<Select>` entirely. Rename the
      "Hora Inicio" `FormRow`'s `label` to `"Bloque horario"` and replace
      its `<option>` list with one option per `TEACHER_SCHEDULE_BLOCKS`
      entry (`value={block.start_time}`, text `{block.label}`), keeping the
      `register("start_time", { required: ... })` field name and the
      existing `"Seleccione..."` empty option (design.md Decision 3).
- [x] 3.2 In `onSubmit`, before the existing `hasWorkerConflict` check,
      resolve the submitted `start_time` to its full teacher block via
      `getTeacherBlockByStartTime`; if no block matches, `toast.error(...)`
      and return (matching the scholar form's early-return-with-toast
      pattern); on success, set `data.end_time` to the resolved block's
      `end_time` before the conflict check and before calling
      `createScheduleTeacher`/`editScheduleTeacher` (design.md Decision 3).
      Do not add a separate `block_id` field.
- [x] 3.3 Add the optional
      `initialValues?: { weekday?: string; worker_id?: number; start_time?: string }`
      prop (design.md Decision 5); use it (only when not in an edit
      session) as the `defaultValues` source for `useForm`, replacing the
      current bare `{}` fallback. Unlike the scholar form, `worker_id` IS
      part of `initialValues` here (the teacher-schedule view is already
      scoped to one selected teacher) — only `activity` is left blank.
- [x] 3.4 Implement the invalid-legacy-interval handling from design.md
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

- [x] 4.1 `src/features/schedules/ShowTeacherSchedule.tsx`: compute a
      `workerId: string` (from `selectedWorkerId`, `""` when `null`) and a
      `workerLabel: string` (via `capitalizeName(selectedWorker.name)`,
      reusing the same expression already used for the worker `<option>`
      labels); pass both, plus the already-passed `semesterId`, into
      `<RowTeacherSchedule ... workerId={workerId} workerLabel={workerLabel} />`.
      The existing `workers` (full list) prop passed into `RowTeacherSchedule`
      is unchanged.
      (Code-review fix: also passes two new props,
      `allScheduleTeachers={scheduleTeachers}` and
      `allScheduleAssignments={scheduleAssignments}` — this component's own
      unfiltered, semester-level props, distinct from the
      selected-teacher-filtered `filteredSchedulesTeacher`/
      `filteredSchedulesAssignments` already used for the grid's display —
      so every modal entry point downstream has correct conflict-detection
      data. See design.md's "Correction" section and task 4.3's note.)
- [x] 4.2 `src/features/schedules/RowTeacherSchedule.tsx`: accept new
      `workerId: string`/`workerLabel: string` props; thread both through
      `TimeSlotRow`'s existing `shared` object (alongside `workers`/
      `semesterId`) so every `TimeSlotRow` call site (including the
      conditional 17:00–19:00 one) and, inside it, every `DayCell` and
      `HourScheduleSubjectTeacher` instance receives them — mechanical but
      must be complete; audit the full file, not a sample.
      (Code-review fix: also threads `allScheduleTeachers`/
      `allScheduleAssignments` through the same `shared` object and the
      same call sites, for the reason above.)
- [x] 4.3 `src/features/schedules/HourScheduleTeacher.tsx`
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
      (Code-review fix: this call site, and the existing occupied-cell
      edit call site in the same file, originally omitted
      `scheduleTeachers`/`scheduleAssignments` entirely, so
      `CreateEditTeacherSchedule`'s conflict check silently ran against its
      own `= []` defaults from every table-cell entry path — no overlap
      could ever be detected except via the top-level manual Add button,
      which already passed the right props. Fixed by threading two new
      props, `allScheduleTeachers`/`allScheduleAssignments`
      — `ShowTeacherSchedule.tsx`'s own unfiltered `scheduleTeachers`/
      `scheduleAssignments`, not the selected-teacher-filtered display
      arrays — down the same `workerId`/`workerLabel` chain
      (`ShowTeacherSchedule` → `RowTeacherSchedule`'s `shared` object →
      `HourScheduleSubjectTeacher`), and passing them as
      `scheduleTeachers`/`scheduleAssignments` into *both*
      `CreateEditTeacherSchedule` call sites in this file. See design.md's
      "Correction" section.)
- [x] 4.4 Confirm `HourScheduleSubjectGroup.tsx` (the scholar-assignment
      half of each teacher-grid cell) is untouched — this change adds an
      Add action only to the teacher-activity half of the cell.

## 5. Zero-activity teacher renders the full grid

- [x] 5.1 `src/features/schedules/ShowTeacherSchedule.tsx`: per design.md
      Decision 10, render `RowTeacherSchedule` whenever a teacher is
      selected (`selectedWorkerId !== null`), not only when `recordExist`
      is true, so a teacher with zero activities and zero scholar
      assignments still sees the full grid and every cell's Add action.
      Keep `ScheduleTeacherPDF` gated on the existing `recordExist`
      condition, unchanged (matching the `pdf-exporter-safety` capability's
      button-visibility requirement). Do not render the grid before any
      teacher is selected.

## 6. Invalid-legacy-row detection banner

- [x] 6.1 `src/features/schedules/ShowTeacherSchedule.tsx`: compute
      `invalidActivities` (design.md Decision 7) via `useMemo`, filtering
      `filteredSchedulesTeacher` by
      `!isCanonicalTeacherBlock(s.start_time, s.end_time)`. Render a
      warning banner above the table when `invalidActivities.length > 0`,
      listing each row's weekday, activity text, and raw
      `start_time`–`end_time`. Do not alter `filteredSchedulesTeacher`
      itself or any existing rendering path for valid rows.

## 7. Explicitly unchanged (verify, do not modify)

- [x] 7.1 Confirm `src/helpers/detectScheduleConflict.ts` is untouched —
      `hasWorkerConflict` already works correctly across the combined
      `[...scheduleTeachers, ...scheduleAssignments]` array for canonical
      teacher blocks and for legacy invalid rows alike (design.md
      Decision 9).
- [x] 7.2 Confirm no file under `src/pdf/**` changed — hour-counting
      formulas already group by activity text and multiply
      `quantity * 2`, agnostic of `start_time`, so the 17:00–19:00 block
      is already counted correctly (design.md Decisions 2 and 12's
      inspection result, satisfying request item 28).
- [x] 7.3 Confirm `src/features/schedules/CreateEditScholarSchedule.tsx`,
      `HourScheduleSubject.tsx`, `RowScholarSchedule.tsx`,
      `ShowScholarSchedule.tsx`, `ScholarSchedule.tsx`, and
      `src/features/schedules/scheduleBlocks.ts` are untouched (scholar
      schedule, out of scope).
- [x] 7.4 Confirm `src/features/schedules/TeacherSchedule.tsx` is
      untouched — the top-level "+ Agregar horario de actividades" button
      keeps its current label and placement (design.md Decision 11).
- [x] 7.5 Confirm no migration file added or modified, and no
      `schedule_teachers` row changed, split, or deleted by this change's
      own code (only new validation on future writes).

## 8. Verification

- [x] 8.1 `bun run typecheck`
- [x] 8.2 `bun run build`
- [x] 8.3 `bun run lint`
- [x] 8.4 `bunx @fission-ai/openspec validate add-teacher-activities-from-empty-slots --type change --strict`
- [x] 8.5 Focused helper/service verification (standalone script, mirroring
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

## 9. Manual-review fix: cell availability must consider scholar assignments; visible action-button styling

- [x] 9.1 `src/features/schedules/RowTeacherSchedule.tsx`: `DayCell` now
      also passes its already-in-scope `schedulesScholar` (the
      selected-worker-filtered scholar assignments it already forwards to
      `HourScheduleSubjectGroup`) into `HourScheduleSubjectTeacher` as a
      new `scholarAssignments` prop. No other new prop-threading hop is
      needed — this data was already available at `DayCell`.
- [x] 9.2 `src/features/schedules/HourScheduleTeacher.tsx`: add a local,
      UI-only `overlapsBlock()` helper using the same strict-inequality
      overlap semantics as `hasWorkerConflict`/`hasGroupConflict` (not
      exact `start_time` equality). Compute
      `isBlockedByTeacherActivity`/`isBlockedByScholarAssignment` against
      `schedules`/`scholarAssignments` respectively for the cell's own
      canonical block interval; when either is true, render nothing
      extra (`<p></p>`) instead of the Add button — `HourScheduleSubjectGroup`
      remains the sole renderer of scholar-assignment content and
      controls; no continuation rendering of the blocking row's own
      content into cells it merely overlaps. `hasWorkerConflict` in
      `CreateEditTeacherSchedule.tsx` remains the sole authoritative
      check at submission time and is unchanged (design.md's "Correction
      2").
- [x] 9.3 `src/features/schedules/HourScheduleTeacher.tsx`: introduce a
      shared `ActionButton` styled-component (bordered, compact, hover/
      active states, a `$variation="danger"` prop for Delete using
      existing `--color-red-*` tokens) used for all three controls. Wrap
      Edit and Delete in real `<button type="button">`s for the first
      time (previously bare `<FaPencilAlt>`/`<FaTrash>` icons with only
      inline `style`, not focusable); add `aria-label` and `title`
      ("Editar actividad" / "Eliminar actividad") to each; add
      `title="Agregar actividad"` to the existing Add button (its
      `aria-label` was already descriptive). Rely on the app-wide
      `button:focus` rule in `GlobalStyles.ts` for the visible
      keyboard-focus indicator — no new focus CSS needed. Preserve every
      existing modal window name, `ConfirmDelete`'s props, and the
      multi-activity `.map()` rendering unchanged.
- [x] 9.4 Do not modify `src/helpers/detectScheduleConflict.ts`,
      canonical-block validation, service validation, hour calculations,
      PDFs, legacy-warning logic, or the database schema. Do not filter
      `allScheduleTeachers`/`allScheduleAssignments` (the arrays passed
      into `CreateEditTeacherSchedule`) by selected teacher — they remain
      full, semester-level arrays per the previous correction.

## 10. Follow-up fix: Monday 07:00–08:50 Homenaje / Tutoría reservation; action-button design reaches the group timetable

- [x] 10.1 `src/features/schedules/RowTeacherSchedule.tsx`: compute
      `isHomenajeTutoriaReserved = totalHours === 40` (the same
      already-computed `totalHours`, unchanged); render `null` for the
      Monday 07:00–08:50 cell's extra content when `false` (no more `--`),
      or a new `ReservedSlotBadge` ("Homenaje / Tutoría", correct accent,
      dashed-border muted styling) when `true`. Thread a new
      `mondayAddDisabled` prop into the first `TimeSlotRow` call only, and
      only apply it to weekday index 0 (Monday) as `isReservedSlot` on
      `DayCell`/`HourScheduleSubjectTeacher` — every other cell is
      unaffected (design.md "Correction 3").
- [x] 10.2 `src/features/schedules/HourScheduleTeacher.tsx`: accept the new
      `isReservedSlot?: boolean` prop (default `false`); when true, the
      free-cell branch renders `<p></p>` instead of the Add button —
      alongside, not replacing, the existing overlap-based blocking
      checks.
- [x] 10.3 `src/features/schedules/CreateEditTeacherSchedule.tsx`: add a
      local `calculateWorkerTotalHours(workerId, scheduleAssignments,
      scheduleTeachers)`, replicating `ShowTeacherSchedule.tsx`'s
      `totalHours` formula exactly, parameterized by worker. In
      `onSubmit`, immediately after block resolution, when
      `data.weekday === "Lunes" && data.start_time === "07:00:00"`,
      compute this for `Number(data.worker_id)` (the *submitted* worker,
      correctly reflecting a worker switched inside the form) against the
      already-full semester-level `scheduleAssignments`/`scheduleTeachers`
      props, and reject with a toast if it equals 40 — before the existing
      `hasWorkerConflict` check, applying uniformly to every entry path
      (free-cell Add, occupied-cell edit, top-level manual form) since
      they all share this one `onSubmit`. Confirmed (design.md
      "Correction 3" inspection): no new prop-threading was needed beyond
      Correction 1's existing full-array threading. Not extracted into a
      shared helper, matching this codebase area's established
      duplicate-small-computations-per-file precedent.
- [x] 10.4 Create `src/features/schedules/ScheduleActionButton.tsx`
      exporting `ScheduleActionButton`/`ScheduleActionsRow`, extracted
      from the identical styled-components task 9.3 introduced in
      `HourScheduleTeacher.tsx` — genuine duplication once the same
      treatment reaches `HourScheduleSubject.tsx` too. Update
      `HourScheduleTeacher.tsx` to import from this module instead of
      defining its own copy (pure relocation).
- [x] 10.5 `src/features/schedules/HourScheduleSubject.tsx`: adopt
      `ScheduleActionButton`/`ScheduleActionsRow`. Add keeps its existing
      `aria-label` and gains `title="Agregar horario"`. Edit and Delete
      are wrapped in real `<button type="button">`s for the first time
      (previously bare `<FaEdit>`/`<FaTrash>`), each with a
      weekday+subject `aria-label` and a `title` ("Editar horario" /
      "Eliminar horario"); Delete uses the `danger` variant. The
      `&nbsp; &nbsp; &nbsp;` spacing between Edit and Delete is replaced
      by `ScheduleActionsRow`'s `gap`. Modal window names, create/edit/
      delete functionality, free-cell defaults, and canonical-block
      behavior are unchanged.
- [x] 10.6 Confirm `RowScholarSchedule.tsx`'s own unconditional, always-on
      "Homenaje / Tutoria" label (a different, unrelated mechanism from
      the `scholar-schedule-canonical-blocks` capability — no `totalHours`
      involved) is untouched, along with `TeacherAssignment.tsx`'s summary
      row and the PDF exporters' matching strings — out of scope for this
      correction (design.md "Correction 3" scope note).
- [x] 10.7 `src/features/schedules/HourScheduleSubjectGroup.tsx` (the
      read-only scholar-assignment half of each teacher-grid cell): adopt
      `ScheduleActionButton`/`ScheduleActionsRow` (reused, not
      duplicated). Edit/Delete become real `<button type="button">`s with
      `aria-label`/`title` exactly `"Editar horario"` / `"Eliminar
      horario"`; Delete uses the `danger` variant. Keep the existing
      per-`schedule.id` modal-name suffixes (already required — this
      component can render multiple assignments per cell). Do not add an
      Add action here. Already covered by the "Add, Edit, and Delete
      controls share a consistent, accessible design across both
      timetables" scenario from Correction 3 — no new spec requirement
      needed (design.md "Correction 4").

## Verification Results

**Code-review fix (previous pass): conflict detection ran against empty
arrays from every table-cell entry path.** `HourScheduleSubjectTeacher.tsx`
opened both the occupied-cell edit form and the new free-cell Add form
without passing `scheduleTeachers`/`scheduleAssignments` into
`CreateEditTeacherSchedule`, which defaults both to `[]` — so
`hasWorkerConflict` silently checked against nothing from those two entry
paths (only the top-level manual "+ Agregar horario de actividades"
button already passed the real, semester-wide arrays and was unaffected).
Fixed by threading two new props end-to-end —
`allScheduleTeachers`/`allScheduleAssignments`, `ShowTeacherSchedule.tsx`'s
own unfiltered `scheduleTeachers`/`scheduleAssignments` props, kept
deliberately distinct from the selected-teacher-filtered
`filteredSchedulesTeacher`/`filteredSchedulesAssignments` used only for
the grid's display — through `RowTeacherSchedule.tsx`'s `shared` object
(reaching every `TimeSlotRow`, including the conditional 17:00–19:00 one)
into `HourScheduleSubjectTeacher.tsx`, which now passes them as
`scheduleTeachers`/`scheduleAssignments` into both of its
`CreateEditTeacherSchedule` call sites. `editId` exclusion, the top-level
manual path, and the (unlocked) teacher selector are all unaffected. See
design.md's "Correction" section and the new
"Every form entry point supplies full semester-level data for conflict
detection" scenario in the `teacher-schedule-canonical-blocks` spec delta.

**Focused verification for this fix (standalone script using the real,
unmodified `hasWorkerConflict`):**
- Free-cell Add (teacher unchanged) detects a conflict against another
  `schedule_teachers` row for that worker — PASS.
- Free-cell Add (teacher unchanged) detects a conflict against a
  `schedule_assignments` row for that worker — PASS.
- Changing the preselected teacher inside the form before saving still
  detects a conflict against the newly-selected worker's own
  `schedule_teachers` row — PASS.
- Same, against the newly-selected worker's own `schedule_assignments`
  row — PASS.
- `editId` exclusion still allows re-saving a row unchanged (no
  self-conflict) — PASS.
- A genuinely free slot correctly reports no conflict — PASS.
- Regression check: confirmed the same call against `[]` (the old, broken
  default) reports no conflict — demonstrating this was a real, silent
  gap prior to the fix — PASS.

**Manual-review fix (this pass): cell availability ignored scholar
assignments, and Add/Edit/Delete lacked a visible button surface.**
`HourScheduleSubjectTeacher.tsx` decided Add-button visibility using only
its own `schedule_teachers` data (exact `start_time` match); it never saw
the selected worker's `schedule_assignments` rows, which render in the
same cell via the sibling `HourScheduleSubjectGroup` component. A cell
already showing a scholar class could still offer the teacher Add button.
Separately, Edit and Delete were bare icons with inline `style` only, not
wrapped in real buttons, so they were not keyboard-focusable, and Add had
no visible surface beyond the plus icon itself. Fixed by (1) threading the
already-in-scope, worker-filtered `schedulesScholar` from `DayCell` into
`HourScheduleSubjectTeacher` as a new `scholarAssignments` prop, and
computing cell availability with a local, UI-only overlap check (the same
strict-inequality semantics `hasWorkerConflict` uses, not exact
`start_time` equality) against both `schedules` and `scholarAssignments`
— so a legacy row spanning multiple blocks also blocks Add in every block
it overlaps, not only its own literal `start_time`; and (2) introducing a
shared, bordered `ActionButton` styled-component with hover/active states
used by all three controls, wrapping Edit/Delete in real
`<button type="button">`s for the first time and adding `title`/
`aria-label` text to all three. See design.md's "Correction 2" for the
full writeup.

**Focused verification for this fix (standalone script, mirroring the
real `overlapsBlock()`/`getTeacherBlockByStartTime` logic):**
- A cell exactly occupied by a scholar assignment blocks Add — PASS.
- A cell with neither entity remains addable — PASS.
- A legacy, invalid, multi-block teacher activity (`07:00`–`13:00`) blocks
  Add in its own start cell and in every other block it overlaps
  (`09:20`, `11:10`), but not in a block outside its range (`13:10`) —
  PASS.
- A legacy, invalid, multi-block scholar assignment (`09:20`–`15:00`)
  blocks Add in every block it overlaps (`11:10`, `13:10`), but not
  outside its range (`07:00`) — PASS.
- The 17:00–19:00 block participates in the same rule for both entity
  types — PASS.
- A different weekday never blocks — PASS.

**Follow-up fix (previous pass): Monday 07:00–08:50 Homenaje / Tutoría
reservation, and action-button design extended to the group timetable.**
`RowTeacherSchedule.tsx` previously injected either
`<b>Homenaje / Tutoria</b>` (missing its accent) or `<b>--</b>` into the
Monday 07:00–08:50 cell unconditionally, as content rendered *alongside*
`HourScheduleSubjectTeacher`'s own independent Add-button logic — which
had no awareness of that text at all, so the free-cell Add button still
rendered underneath it, and neither the top-level manual form nor edit
had any awareness of the slot. Fixed by (1) suppressing the `--`
entirely when `totalHours !== 40`, rendering a styled `ReservedSlotBadge`
("Homenaje / Tutoría", correct accent) when `totalHours === 40`, and
threading a `mondayAddDisabled`/`isReservedSlot` flag (Monday-only) down
to suppress that one cell's Add button; and (2) adding an authoritative
`onSubmit` guard in `CreateEditTeacherSchedule.tsx` that computes the
*submitted* `worker_id`'s total hours (via a new local
`calculateWorkerTotalHours`, replicating `ShowTeacherSchedule.tsx`'s
formula) and rejects Monday-07:00 submissions when that worker is at 40
hours — covering the top-level manual form and edit-into-this-slot, and
correctly re-evaluating if the admin switches worker inside the form.
Confirmed no new prop-threading was needed: `CreateEditTeacherSchedule.tsx`
already receives the full, semester-level `scheduleAssignments`/
`scheduleTeachers` arrays from every entry path, a direct consequence of
the earlier conflict-detection fix. Separately, the Correction 2
action-button treatment was extracted into a new shared
`ScheduleActionButton.tsx` module and adopted by `HourScheduleSubject.tsx`
(the scholar/group timetable), which previously still had a bare-icon Add
button and unwrapped, `&nbsp;`-separated Edit/Delete icons. See design.md
"Correction 3" for the full writeup.

**Focused verification for this fix (standalone script):**
- `calculateWorkerTotalHours`-equivalent computation correctly yields 40
  for a worker with 19 distinct scholar subjects (base 2 + 19×2) and 12
  for a lighter worker (base 2 + 5×2) — PASS.
- A 40-hour worker submitting Monday 07:00 is blocked — PASS.
- A non-40-hour worker submitting the same slot is not blocked — PASS.
- A 40-hour worker submitting a different block, or a different weekday,
  is not blocked by this rule — PASS.
- Switching `worker_id` inside the form before submitting is evaluated
  against the newly-selected worker's own hours, not the original: the
  same Monday-07:00 payload is blocked when submitted as the 40-hour
  worker and not blocked when submitted as the lighter worker — PASS.

**Follow-up fix (this pass): scholar assignments inside the teacher
timetable still had loose Edit/Delete icons.**
`HourScheduleSubjectGroup.tsx` — the read-only scholar-assignment half of
each teacher-grid cell — was the one remaining schedule control still
rendering bare `<FaEdit>`/`<FaTrash>` icons with `&nbsp;` spacing, after
both `HourScheduleSubject.tsx` and `HourScheduleTeacher.tsx` had already
adopted the shared button treatment. Fixed by importing and reusing the
existing `ScheduleActionButton`/`ScheduleActionsRow` (no new styles
introduced); Edit and Delete are now real `<button type="button">`s with
`aria-label`/`title` `"Editar horario"` / `"Eliminar horario"`, Delete
using the `danger` variant. No Add action was added (scholar assignments
are never created from the teacher timetable); the existing
per-`schedule.id` modal-name suffixes, conflict logic, schedule data, and
the scholar creation flow are all unchanged. Already covered by
Correction 3's "both timetables" scenario, so no new spec requirement was
added — see design.md "Correction 4".

**8.1–8.4 (automated, re-run after this fix):**
- `bun run lint` — PASS (`eslint .`, no errors/warnings).
- `bun run typecheck` — PASS (`tsc --noEmit`, no errors).
- `bun run build` — PASS (`vite build` completed, no errors).
- `bunx @fission-ai/openspec validate add-teacher-activities-from-empty-slots --type change --strict`
  — PASS ("Change 'add-teacher-activities-from-empty-slots' is valid").

**8.5 Focused helper/service verification (standalone script, run with
`bun`, deleted after use — no live Supabase connection available in this
environment):**
- All 5 canonical teacher blocks (07:00–08:50 through 17:00–19:00) accepted
  by the simulated `createEditScheduleTeachers` validation logic — PASS.
- A 17:00–19:00 activity counts as exactly 2 hours through the existing
  `quantity * 2` grouping-by-activity-text formula (unchanged code, same
  formula every other block already uses) — PASS.
- `07:00:00`–`11:10:00` (multi-block span) rejected — PASS.
- Mismatched canonical start/end (`13:10:00`–`19:00:00`) rejected — PASS.
- Reversed times (`19:00:00`–`17:00:00`) rejected — PASS.
- Missing `end_time` rejected before any Supabase call would be made —
  PASS.
- Valid create payload (no `id`) accepted (no throw, proceeds past all
  guards) — PASS.
- Valid update payload (with `id`) accepted — PASS.
- Valid edit form preloads its block: `getTeacherBlockByTimes` resolves
  the matching `TEACHER_SCHEDULE_BLOCKS` entry for a valid stored interval
  — PASS.
- Invalid legacy edit leaves the block selector unselected:
  `getTeacherBlockByTimes` returns `undefined` for a non-canonical stored
  interval — PASS.
- Worker conflicts remain blocked against both another `schedule_teachers`
  row and a `schedule_assignments` row for the same worker, using the
  real, unmodified `hasWorkerConflict` from `detectScheduleConflict.ts`
  against a combined `[...scheduleTeachers, ...scheduleAssignments]`
  array; a genuinely free slot correctly reports no conflict — PASS.

**Verified by code inspection (not a standalone script — these are
render/UI behaviors):**
- Zero-activity teacher renders the full grid: `ShowTeacherSchedule.tsx`
  gates `RowTeacherSchedule` on `selectedWorkerId !== null` (not
  `recordExist`), so a teacher with zero `schedule_teachers` and zero
  `schedule_assignments` rows still renders every row/cell; `recordExist`
  still gates `ScheduleTeacherPDF`, unchanged; nothing renders before
  `selectedWorkerId` is set.
- Free-cell Add defaults: `HourScheduleSubjectTeacher`'s free-cell branch
  passes `initialValues={{ weekday, worker_id: Number(workerId), start_time: startTime }}`
  and `semesterId` separately into `CreateEditTeacherSchedule`, so worker,
  weekday, semester, and block are all preselected.
- Activity remains empty: `initialValues` has no `activity` key, and
  `CreateEditTeacherSchedule` never sets a `scheduleToEdit` for the
  free-cell case, so the `Textarea`'s `defaultValues.activity` is
  `undefined` — renders empty.
- Valid edit preloads all fields: `weekday`, `worker_id`, and `activity`
  come from `{ ...editValues, ... }` (static option lists, no async gap
  per design.md Decision 6); `start_time` comes from
  `editedBlock?.start_time` when `editedBlock` is defined.

**8.6 Manual (browser) verification — NOT PERFORMED.** No browser session
was available in this environment to click through the UI. All items
listed in tasks.md 8.6 (creating in each of the 5 blocks via the
top-level button, confirming no 6th block option, conflict-detection
toasts against both entities, the free-cell Add flow from 2+ different
cells, the zero-activity-teacher grid render, keyboard activation,
occupied-cell edit/delete including multi-activity cells, and the
legacy-invalid-row banner/edit/correction round-trip) remain to be
verified by a human in a browser before this change is considered fully
done. In addition, following the corrections applied so far, these manual
checks should be added: (a) select a teacher and confirm a cell already
showing a scholar assignment does NOT also show the teacher Add button;
(b) confirm Add, Edit, and Delete all render as visible bordered buttons
(not bare icons), show a native tooltip on hover, and show a visible
focus outline when tabbed to, in BOTH the teacher and the scholar/group
timetables; (c) confirm Edit/Delete are reachable and activatable via
`Tab` + `Enter`/`Space`, not only by mouse, in both timetables; (d) select
a teacher whose totalHours is not 40 and confirm the Monday 07:00–08:50
cell shows no placeholder and still offers Add; (e) select or construct a
teacher at exactly 40 total hours and confirm that cell shows the
"Homenaje / Tutoría" badge with no Add action; (f) attempt to submit
Monday 07:00–08:50 for that 40-hour worker via the top-level manual form,
via editing an existing activity into that slot, and by switching the
selected worker inside an open form, and confirm each is rejected with a
clear toast and no row is created/updated; (g) select a teacher with at
least one scholar assignment showing in their timetable and confirm its
Edit/Delete controls now render as visible bordered buttons (matching the
rest of the timetable), are keyboard-reachable, and show the
"Editar horario"/"Eliminar horario" tooltip, with no Add button rendered
for that scholar-assignment cell. `bun run lint`/`typecheck`/`build`
confirm the code compiles and type-checks correctly but do not substitute
for exercising the actual UI.

**Files changed:**
- `src/features/schedules/teacherScheduleBlocks.ts` (new)
- `src/features/schedules/ScheduleActionButton.tsx` (new)
- `src/services/apiScheduleTeachers.ts`
- `src/features/schedules/CreateEditTeacherSchedule.tsx`
- `src/features/schedules/ShowTeacherSchedule.tsx`
- `src/features/schedules/RowTeacherSchedule.tsx`
- `src/features/schedules/HourScheduleTeacher.tsx`
- `src/features/schedules/HourScheduleSubject.tsx`
- `src/features/schedules/HourScheduleSubjectGroup.tsx`

No other file was touched — confirmed via `git status --porcelain`. In
particular, `src/features/schedules/scheduleBlocks.ts`,
`CreateEditScholarSchedule.tsx`, `RowScholarSchedule.tsx`,
`ShowScholarSchedule.tsx`, and `ScholarSchedule.tsx` (the rest of the
scholar-schedule feature — everything except the deliberate,
narrowly-scoped `HourScheduleSubject.tsx` button-styling change in this
pass's task 10.5) remain unchanged, as do `src/helpers/constants.ts`,
`src/helpers/detectScheduleConflict.ts`,
`src/features/schedules/TeacherSchedule.tsx`, and every file under
`src/pdf/**`.
