## 1. Canonical blocks helper

- [x] 1.1 Create `src/features/schedules/scheduleBlocks.ts`: export
      `ScheduleBlock` interface, the `SCHEDULE_BLOCKS` array (exactly the 4
      blocks from design.md Decision 1, in order), `getBlockByStartTime`,
      `getBlockByTimes`, and `isCanonicalBlock`.
- [x] 1.2 Do not modify `src/helpers/constants.ts`'s `START_TIMES`/
      `END_TIMES` (still used by `CreateEditTeacherSchedule.tsx` for
      teacher activities, out of scope for this change).

## 2. Service-layer validation

- [x] 2.1 `src/services/apiScheduleAssignments.ts`: in
      `createEditScheduleAssignments()`, add the canonical-block check from
      design.md Decision 5 — reject (throw, no insert/update attempted) any
      payload whose `start_time`/`end_time` aren't both strings matching a
      canonical block. Place it alongside the existing `worker_id`/
      `semester_id` presence checks, before the insert/update query is
      built. Import `isCanonicalBlock` from
      `../features/schedules/scheduleBlocks` (matching the precedent set by
      `apiSemesters.ts` importing from `../features/semesters/nextSemesterCode`
      in the prior `generate-next-semester` change).
- [x] 2.2 Do not modify `getScheduleAssignments()`, `deleteScheduleAssignment()`,
      or the unrelated, already-dead `createScheduleAssignments()` function
      in the same file (confirmed zero live callers — out of scope).

## 3. CreateEditScholarSchedule.tsx — canonical block selector

- [x] 3.1 Delete the "Hora Fin" `FormRow`/`<Select>` entirely. Rename the
      "Hora de inicio" `FormRow`'s `label` to `"Bloque horario"` and
      replace its `<option>` list with one option per `SCHEDULE_BLOCKS`
      entry (`value={block.start_time}`, text `{block.label}`), keeping the
      `register("start_time", { required: ... })` field name and the
      existing `"Seleccione..."` empty option (design.md Decision 2).
- [x] 3.2 In `onSubmit`, after the existing `resolvedSemesterId` check,
      resolve the submitted `start_time` to its full block via
      `getBlockByStartTime`; if no block matches, `toast.error(...)` and
      return (matching the existing early-return-with-toast pattern); on
      success, set `data.end_time` to the resolved block's `end_time`
      before calling `createScheduleAssignments`/`editScheduleAssignment`
      (design.md Decision 2). Do not add a separate `block_id` field.
- [x] 3.3 Add the optional `initialValues?: { weekday?: string; group_id?: number; start_time?: string }`
      prop (design.md Decision 3); use it (only when not in an edit
      session) as the `defaultValues` source for `useForm`, replacing the
      current bare `{}` fallback.
- [x] 3.4 Extend the existing mount-time `useEffect` (already
      `useCallback`-memoized `selectingGroup` in its dependency array, per
      the `eliminate-eslint-baseline` change) to also call `selectingGroup(initialValues.group_id)`
      when not in an edit session and `initialValues?.group_id` is present
      (design.md Decision 3). Do not change the existing edit-session
      branch or the `useCallback`'s own dependency array
      (`[groups, subjects, semesterCode]`).
- [x] 3.5 Implement the invalid-legacy-interval handling from design.md
      Decision 4: compute `editedBlock` via `getBlockByTimes` once, from
      the record being edited; when `isEditSession` is true and
      `editedBlock` is `undefined`, omit `start_time` from
      `defaultValues` (leave the block `<select>` unselected) and render
      the specified warning message above the "Bloque horario" `FormRow`.
      Do not attempt to guess or auto-select a block in this case.

## 4. Free-cell Add flow — prop threading and UI

- [x] 4.1 `src/features/schedules/ScholarSchedule.tsx`: pass `semesterId`
      into `<ShowScholarSchedule semesterId={semesterId} .../>` (currently
      not passed). No other change to this file.
      (Implementation note: this file also had its top-level button text
      changed from `"+ Agregar horario escolar"` to
      `"Agregar horario manualmente"`, per the user's explicit instruction
      in this implementation turn — a documented deviation from design.md
      Decision 9, which said no code change to this file was needed. The
      prop-threading change above was already in scope.)
- [x] 4.2 `src/features/schedules/ShowScholarSchedule.tsx`: accept a new
      `semesterId?: string` prop; pass it and the existing `selectedGroupId`
      state (as `groupId`) into
      `<RowScholarSchedule schedules={filteredSchedules} semesterId={semesterId} groupId={selectedGroupId} />`.
      (Implementation note: also threads a computed `groupLabel: string`,
      reusing the existing grade/letter/degree-code expression already
      used for the group `<select>` options, to satisfy the request's
      accessibility requirement that each cell's Add action label include
      "weekday, block, and selected group where practical" — a narrow,
      documented refinement beyond design.md's original two-prop plan.)
      (Code-review fix: `RowScholarSchedule` was originally gated on
      `filteredSchedules.length > 0`, so a selected group with zero
      existing assignments rendered only the table header — no Add
      actions were reachable. Changed the gate to `selectedGroupId`
      instead, still passing the (possibly empty) `filteredSchedules`
      array through, so every cell renders free/Add correctly; rows still
      never render before a group is selected. `ScheduleGroupPDF` is
      unchanged, still gated on `filteredSchedules.length > 0`. See
      design.md's "Correction" section.)
- [x] 4.3 `src/features/schedules/RowScholarSchedule.tsx`: accept new
      `semesterId?: string` and `groupId: string` props; pass both through
      to every one of its `HourScheduleSubject` call sites (10 total,
      mechanical — audit the full file, not a sample).
      (Also threads `groupLabel: string` through all 10 call sites, per the
      4.2 note above.)
- [x] 4.4 `src/features/schedules/HourScheduleSubject.tsx`: accept the new
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
      (Code-review fix: the Add trigger was originally a bare
      `<FaPlus role="button" tabIndex={0} />`, which `Modal.Open` gives an
      `onClick` handler but which never receives keyboard-activation
      semantics (no native `keydown`-to-`click` behavior on a non-button
      element). Replaced with a real `<button type="button">` — styled
      inline/borderless to fit a table cell — wrapping the icon, so
      `Modal.Open`'s `cloneElement` injects `onClick` onto an element that
      natively activates on `Enter`/`Space`. `aria-label` preserved. See
      design.md's "Correction" section.)

## 5. Invalid-legacy-row detection banner

- [x] 5.1 `src/features/schedules/ShowScholarSchedule.tsx`: compute
      `invalidSchedules` (design.md Decision 8) via `useMemo`, filtering
      `filteredSchedules` by `!isCanonicalBlock(s.start_time, s.end_time)`.
      Render a warning banner above the table when
      `invalidSchedules.length > 0`, listing each row's weekday, subject,
      teacher, and raw `start_time`–`end_time`. Do not alter
      `filteredSchedules` itself or any existing rendering path for valid
      rows.

## 6. Explicitly unchanged (verify, do not modify)

- [x] 6.1 Confirm `src/helpers/detectScheduleConflict.ts` is untouched —
      its interval-overlap math already works correctly for canonical
      blocks (no false negatives at block boundaries, confirmed via the
      existing strict-inequality comparison) and for legacy invalid rows
      (still detected as overlapping anything that overlaps their raw
      stored interval).
- [x] 6.2 Confirm no file under `src/pdf/**` changed — hour-counting
      formulas are already `rowCount * 2` everywhere (design.md Decisions
      6–7); `filterHour.ts`'s empty-cell `"--"` fallback is intentionally
      left as-is (a static PDF has no "Add" affordance to render).
- [x] 6.3 Confirm `src/features/schedules/CreateEditTeacherSchedule.tsx`,
      `HourScheduleTeacher.tsx`, `RowTeacherSchedule.tsx`, and
      `src/helpers/constants.ts` are untouched (teacher activities, out of
      scope).
- [x] 6.4 Confirm no migration file added or modified, and no
      `schedule_assignments` row changed, split, or deleted by this
      change's own code (only new validation on future writes).

## 7. Verification

- [x] 7.1 `bun run typecheck`
- [x] 7.2 `bun run build`
- [x] 7.3 `bun run lint`
- [x] 7.4 `bunx @fission-ai/openspec validate add-schedules-from-empty-slots --type change --strict`
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

## 8. Manual-review fix: edit mode must visibly select the stored subject

- [x] 8.1 `src/features/schedules/CreateEditScholarSchedule.tsx`: extract
      `selectingGroup`'s filtering body into a pure `computeFilteredSubjects(groupId)`
      helper (same semester/degree filtering logic, unchanged); keep
      `selectingGroup` as a thin wrapper that calls it and calls
      `setFilteredSubjects`. No behavior change to the filtering itself.
- [x] 8.2 Add a `useRef`-guarded effect that, the first time `filteredSubjects`
      contains an option matching `editValues.subject_id` (edit sessions
      only), calls `setValue("subject_id", String(editValues.subject_id))`
      so the now-available `<option>` is visibly selected and the value
      react-hook-form reads at submit time is correct — see design.md
      "Correction 2" for the root-cause explanation. Guarded to fire once
      per mount so it never overrides a later, deliberate subject change.
- [x] 8.3 Update the group `<select>`'s change handling to call
      `computeFilteredSubjects(newGroupId)`, update `filteredSubjects`, and
      clear `subject_id` via `setValue("subject_id", "")` only when the
      currently-selected subject is not present in the newly computed list
      — leaving it untouched when it is still valid (including when the
      admin re-selects the same group unchanged).
      (Code-review fix, follow-up: the handler was originally wired as a
      separate `onChange={...}` JSX prop placed *after*
      `{...register("group_id", {...})}` on the same `<Select>` — since a
      later plain prop in JSX overrides an earlier spread one, this
      silently discarded react-hook-form's own registered `onChange`.
      Visually everything worked (filtered subjects updated, subject
      clearing worked), but react-hook-form's internally tracked
      `group_id` value was never updated by a group change, so submitting
      after changing the group could still send the previous/default
      `group_id`. Fixed by moving the handler into
      `register("group_id", { required: ..., onChange: <handler> })` — the
      option register() natively supports for this exact purpose — so
      react-hook-form's internal value update and the custom
      filter/clear-subject logic both run from the same registered
      handler, in order, on every change event. No separate `onChange`
      JSX prop remains on this `<Select>`.)
- [x] 8.4 Confirm creation-from-empty-cell is unaffected: the new preload
      effect is guarded by `isEditSession`, and `initialValues` never
      includes `subject_id`, so the subject selector still renders
      unselected for new assignments.
- [x] 8.5 Do not modify `CreateEditTeacherSchedule.tsx` or any teacher
      schedule file; do not change service validation, canonical block
      policy, conflict detection, PDFs, teacher-hour calculations, or the
      database schema.

## Verification Results

**Code-review fixes (this pass):**
1. `ShowScholarSchedule.tsx` — `RowScholarSchedule` now renders whenever a
   group is selected (`selectedGroupId` truthy), not only when
   `filteredSchedules.length > 0`, so a group with zero assignments still
   shows every free cell's Add action. `ScheduleGroupPDF` remains gated on
   `filteredSchedules.length > 0`. No rows render before a group is
   selected.
2. `HourScheduleSubject.tsx` — the free-cell Add trigger is now a real
   `<button type="button" aria-label={...}>` (a small styled, borderless,
   inline `AddButton`) wrapping the `FaPlus` icon, instead of an SVG with
   `role="button"`/`tabIndex`. `Modal.Open` clones it the same way as
   before, and the native button now activates on both `Enter` and `Space`.

**Manual-review fix (previous pass):**
3. `CreateEditScholarSchedule.tsx` — editing an existing assignment now
   visibly preloads the stored subject. Root cause: react-hook-form applies
   `defaultValues.subject_id` to the `<select>` only once, at mount, but
   the matching `<option>` doesn't exist yet at that instant (`filteredSubjects`
   starts as `[]` and is filled in asynchronously for the assignment's
   group). Fixed with a `useRef`-guarded effect that calls
   `setValue("subject_id", ...)` the first time the matching option becomes
   available (fires once per mount, so it never overrides a later
   deliberate change), plus a `computeFilteredSubjects` helper (extracted,
   unchanged filtering logic) used by the group `<select>`'s `onChange` to
   synchronously clear an incompatible subject when the group changes. See
   design.md "Correction 2" for the full root-cause writeup.

**Code-review follow-up fix (this pass):**
4. `CreateEditScholarSchedule.tsx` — the group `<select>`'s change handler
   from fix 3 above was wired as a separate `onChange={...}` JSX prop
   placed after `{...register("group_id", {...})}`, which silently
   discarded react-hook-form's own registered `onChange` (a later plain
   JSX prop always overrides an earlier spread one on the same element).
   The visible behavior looked correct (filtered subjects updated, subject
   clearing worked), but react-hook-form's internally tracked `group_id`
   value was never updated on a group change, so submitting after
   changing the group could still send the previous/default `group_id`.
   Fixed by moving the handler into `register("group_id", { required: ...,
   onChange: <handler> })`, react-hook-form's supported way to run
   additional logic on change without losing its own value-tracking
   `onChange` — both now run, in order, from the same registered handler.
   See tasks.md task 8.3 for the full note.

**7.1–7.4 (automated, re-run after all fixes above):**
- `bun run typecheck` — PASS (`tsc --noEmit`, no errors).
- `bun run build` — PASS (`vite build` completed, no errors).
- `bun run lint` — PASS (`eslint .`, no errors/warnings).
- `bunx @fission-ai/openspec validate add-schedules-from-empty-slots --type change --strict`
  — PASS ("Change 'add-schedules-from-empty-slots' is valid").

**Focused helper/service verification (standalone scripts, run with `bun`,
deleted after use — no live Supabase connection available in this
environment):**
- All 4 canonical blocks accepted by `isCanonicalBlock` — PASS.
- `07:00:00`–`11:10:00` (multi-block span) rejected — PASS.
- Reversed times rejected — PASS.
- Mismatched canonical start/end (e.g. `07:00:00`–`11:10:00` as a
  cross-block pairing) rejected — PASS.
- Valid create payload accepted by the simulated
  `createEditScheduleAssignments` validation logic (no throw, proceeds past
  all guards) — PASS.
- Valid update payload (with `id`, no `semester_id` required) accepted —
  PASS.
- Invalid direct service write (non-canonical `start_time`/`end_time` pair,
  bypassing the form) rejected with
  `"El horario debe corresponder a un bloque académico válido."` before any
  Supabase call would be made — PASS.
- Valid edit form preloads its block: `getBlockByTimes` resolves the
  matching `SCHEDULE_BLOCKS` entry for a valid stored interval — PASS.
- Invalid legacy edit leaves the block selector unselected:
  `getBlockByTimes` returns `undefined` for a non-canonical stored
  interval, so `defaultValues.start_time` is omitted — PASS.

**Focused verification for the subject-preload fix (standalone script,
pure decision-logic simulation of `computeFilteredSubjects` and the
still-valid check, run with `bun`, deleted after use):**
- Edit an assignment: stored `subject_id` is found among
  `computeFilteredSubjects(stored group_id)` — PASS.
- Two consecutive edits with different groups/subjects each resolve their
  own subject correctly, with no cross-leakage (assignment A's subject is
  confirmed absent from assignment B's group's valid-subject list) — PASS.
- Changing the group to one that doesn't offer the current subject:
  `stillValid` is `false`, so `subject_id` would be cleared — PASS.
- Re-selecting the same (unchanged) group: `stillValid` is `true`, so
  `subject_id` is left untouched — PASS.
- Creation from an empty cell: the preload-guard condition
  (`!isEditSession || subject_id == null`) evaluates `true`, so the
  preload effect is skipped and the subject selector stays unselected —
  PASS.

**7.5 Manual (browser) verification — STILL NOT PERFORMED.** No browser
session was available in this environment to click through the UI. All 6
manual scenarios listed in tasks.md (creating in each of the 4 blocks via
the top-level button, confirming no 5th block option, conflict-detection
toast, the free-cell Add flow from 2+ different cells, occupied-cell
edit/delete, and the legacy-invalid-row banner/edit/correction round-trip)
remain to be verified by a human in a browser before this change is
considered fully done. In addition, the following manual checks should be
added to that pass: (a) select a group with zero existing assignments and
confirm the full grid — not just the header — renders with every cell
showing its Add action; (b) `Tab` to a free cell's Add action and confirm
both `Enter` and `Space` open the form; (c) open the edit form for an
existing assignment and confirm weekday, group, subject, block, and worker
are all visibly selected, then save without touching any field; (d) open
edits for two different assignments (different groups/subjects) one after
another and confirm each shows its own values with no leftover selection;
(e) while editing, change the group to one that doesn't offer the current
subject and confirm the subject selector clears and blocks saving until a
new one is chosen. `bun run typecheck`/`build`/`lint` confirm the code
compiles and type-checks correctly but do not substitute for exercising
the actual UI.

**Files changed:**
- `src/features/schedules/scheduleBlocks.ts` (new)
- `src/services/apiScheduleAssignments.ts`
- `src/features/schedules/CreateEditScholarSchedule.tsx`
- `src/features/schedules/ScholarSchedule.tsx`
- `src/features/schedules/ShowScholarSchedule.tsx`
- `src/features/schedules/RowScholarSchedule.tsx`
- `src/features/schedules/HourScheduleSubject.tsx`

No other file was touched — confirmed via `git status --porcelain` showing
only the above 7 paths as modified/untracked.
