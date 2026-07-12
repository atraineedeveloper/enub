## 1. Canonical blocks helper

- [ ] 1.1 Create `src/features/schedules/scheduleBlocks.ts`: export
      `ScheduleBlock` interface, the `SCHEDULE_BLOCKS` array (exactly the 4
      blocks from design.md Decision 1, in order), `getBlockByStartTime`,
      `getBlockByTimes`, and `isCanonicalBlock`.
- [ ] 1.2 Do not modify `src/helpers/constants.ts`'s `START_TIMES`/
      `END_TIMES` (still used by `CreateEditTeacherSchedule.tsx` for
      teacher activities, out of scope for this change).

## 2. Service-layer validation

- [ ] 2.1 `src/services/apiScheduleAssignments.ts`: in
      `createEditScheduleAssignments()`, add the canonical-block check from
      design.md Decision 5 — reject (throw, no insert/update attempted) any
      payload whose `start_time`/`end_time` aren't both strings matching a
      canonical block. Place it alongside the existing `worker_id`/
      `semester_id` presence checks, before the insert/update query is
      built. Import `isCanonicalBlock` from
      `../features/schedules/scheduleBlocks` (matching the precedent set by
      `apiSemesters.ts` importing from `../features/semesters/nextSemesterCode`
      in the prior `generate-next-semester` change).
- [ ] 2.2 Do not modify `getScheduleAssignments()`, `deleteScheduleAssignment()`,
      or the unrelated, already-dead `createScheduleAssignments()` function
      in the same file (confirmed zero live callers — out of scope).

## 3. CreateEditScholarSchedule.tsx — canonical block selector

- [ ] 3.1 Delete the "Hora Fin" `FormRow`/`<Select>` entirely. Rename the
      "Hora de inicio" `FormRow`'s `label` to `"Bloque horario"` and
      replace its `<option>` list with one option per `SCHEDULE_BLOCKS`
      entry (`value={block.start_time}`, text `{block.label}`), keeping the
      `register("start_time", { required: ... })` field name and the
      existing `"Seleccione..."` empty option (design.md Decision 2).
- [ ] 3.2 In `onSubmit`, after the existing `resolvedSemesterId` check,
      resolve the submitted `start_time` to its full block via
      `getBlockByStartTime`; if no block matches, `toast.error(...)` and
      return (matching the existing early-return-with-toast pattern); on
      success, set `data.end_time` to the resolved block's `end_time`
      before calling `createScheduleAssignments`/`editScheduleAssignment`
      (design.md Decision 2). Do not add a separate `block_id` field.
- [ ] 3.3 Add the optional `initialValues?: { weekday?: string; group_id?: number; start_time?: string }`
      prop (design.md Decision 3); use it (only when not in an edit
      session) as the `defaultValues` source for `useForm`, replacing the
      current bare `{}` fallback.
- [ ] 3.4 Extend the existing mount-time `useEffect` (already
      `useCallback`-memoized `selectingGroup` in its dependency array, per
      the `eliminate-eslint-baseline` change) to also call `selectingGroup(initialValues.group_id)`
      when not in an edit session and `initialValues?.group_id` is present
      (design.md Decision 3). Do not change the existing edit-session
      branch or the `useCallback`'s own dependency array
      (`[groups, subjects, semesterCode]`).
- [ ] 3.5 Implement the invalid-legacy-interval handling from design.md
      Decision 4: compute `editedBlock` via `getBlockByTimes` once, from
      the record being edited; when `isEditSession` is true and
      `editedBlock` is `undefined`, omit `start_time` from
      `defaultValues` (leave the block `<select>` unselected) and render
      the specified warning message above the "Bloque horario" `FormRow`.
      Do not attempt to guess or auto-select a block in this case.

## 4. Free-cell Add flow — prop threading and UI

- [ ] 4.1 `src/features/schedules/ScholarSchedule.tsx`: pass `semesterId`
      into `<ShowScholarSchedule semesterId={semesterId} .../>` (currently
      not passed). No other change to this file.
- [ ] 4.2 `src/features/schedules/ShowScholarSchedule.tsx`: accept a new
      `semesterId?: string` prop; pass it and the existing `selectedGroupId`
      state (as `groupId`) into
      `<RowScholarSchedule schedules={filteredSchedules} semesterId={semesterId} groupId={selectedGroupId} />`.
- [ ] 4.3 `src/features/schedules/RowScholarSchedule.tsx`: accept new
      `semesterId?: string` and `groupId: string` props; pass both through
      to every one of its `HourScheduleSubject` call sites (10 total,
      mechanical — audit the full file, not a sample).
- [ ] 4.4 `src/features/schedules/HourScheduleSubject.tsx`: accept the new
      `semesterId?: string`/`groupId: string` props. When
      `subjectHour.length === 0` (the free-cell branch, currently
      `return <p>--</p>;`), render a `Modal`/`Modal.Open`/`Modal.Window`
      trio (a new, distinct window name, e.g.
      `"scholar-schedule-add-form"`, per the existing per-cell-instance
      `Modal` isolation pattern already used for edit/delete) with an
      add-icon trigger (e.g. `FaPlus`, matching the existing `FaEdit`/
      `FaTrash` icon-button style), opening `CreateEditScholarSchedule`
      with `semesterId`, and
      `initialValues={{ weekday, group_id: Number(groupId), start_time: startTime }}`.
      Subject and teacher are left unset (no `scheduleToEdit`, no
      preselection beyond what `initialValues` provides).

## 5. Invalid-legacy-row detection banner

- [ ] 5.1 `src/features/schedules/ShowScholarSchedule.tsx`: compute
      `invalidSchedules` (design.md Decision 8) via `useMemo`, filtering
      `filteredSchedules` by `!isCanonicalBlock(s.start_time, s.end_time)`.
      Render a warning banner above the table when
      `invalidSchedules.length > 0`, listing each row's weekday, subject,
      teacher, and raw `start_time`–`end_time`. Do not alter
      `filteredSchedules` itself or any existing rendering path for valid
      rows.

## 6. Explicitly unchanged (verify, do not modify)

- [ ] 6.1 Confirm `src/helpers/detectScheduleConflict.ts` is untouched —
      its interval-overlap math already works correctly for canonical
      blocks (no false negatives at block boundaries, confirmed via the
      existing strict-inequality comparison) and for legacy invalid rows
      (still detected as overlapping anything that overlaps their raw
      stored interval).
- [ ] 6.2 Confirm no file under `src/pdf/**` changed — hour-counting
      formulas are already `rowCount * 2` everywhere (design.md Decisions
      6–7); `filterHour.ts`'s empty-cell `"--"` fallback is intentionally
      left as-is (a static PDF has no "Add" affordance to render).
- [ ] 6.3 Confirm `src/features/schedules/CreateEditTeacherSchedule.tsx`,
      `HourScheduleTeacher.tsx`, `RowTeacherSchedule.tsx`, and
      `src/helpers/constants.ts` are untouched (teacher activities, out of
      scope).
- [ ] 6.4 Confirm no migration file added or modified, and no
      `schedule_assignments` row changed, split, or deleted by this
      change's own code (only new validation on future writes).

## 7. Verification

- [ ] 7.1 `bun run typecheck`
- [ ] 7.2 `bun run build`
- [ ] 7.3 `bun run lint`
- [ ] 7.4 `bunx @fission-ai/openspec validate add-schedules-from-empty-slots --type change --strict`
- [ ] 7.5 Manual verification (design.md Decision 10):
      - Create one assignment in each of the 4 canonical blocks via the
        top-level Add button; confirm each saves with the correct
        `start_time`/`end_time` pair.
      - Confirm the "Bloque horario" `<select>` never offers a 5th option
        and that submitting without a selection is blocked by the
        existing required-field validation.
      - Attempt a conflicting submission (same worker or same group,
        overlapping block) and confirm the existing conflict-detection
        toast still blocks it.
      - From at least 2 different free cells (different weekday/block
        combinations), use the new Add action; confirm semester, group,
        and block are preselected correctly and subject/teacher are empty
        for selection; save and confirm the new row appears in the
        correct cell.
      - Confirm occupied-cell edit and delete controls still work
        unchanged.
      - Insert a test row with a legacy-invalid interval (e.g.
        `07:00:00`–`11:10:00`) directly (test data, not production);
        confirm it renders in the grid, confirm the invalid-row warning
        banner lists it, open it for editing and confirm the block
        selector is unselected with the warning message shown, correct it
        by selecting a valid block and saving, and confirm the banner no
        longer lists it afterward.
      - Confirm teacher assignment hour totals and all 4 PDF exporters
        (`ScheduleGroupPDF`, `ScheduleTeacherPDF`, `TeacherAssignmentPDF`,
        `WorkerSheetSemester`) remain visually correct for valid data.
- [ ] 7.6 Record pass/fail for each 7.5 item, plus the 7.1–7.4 command
      output, in this file's Verification Results section before
      considering this change complete.

## Verification Results

(To be filled in during implementation; do not pre-fill.)
