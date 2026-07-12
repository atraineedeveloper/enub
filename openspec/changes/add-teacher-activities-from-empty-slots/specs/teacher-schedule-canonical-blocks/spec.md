## ADDED Requirements

### Requirement: Every teacher activity SHALL occupy exactly one canonical teacher-activity block

The system SHALL define exactly 5 valid teacher-activity blocks
(`07:00:00`–`08:50:00`, `09:20:00`–`11:10:00`, `11:10:00`–`13:00:00`,
`13:10:00`–`15:00:00`, `17:00:00`–`19:00:00`) and SHALL require every
`schedule_teachers` row's `start_time`/`end_time` pair to exactly match
one of them. Multi-block activities and arbitrary `start_time`/`end_time`
combinations are not supported.

#### Scenario: The form exposes one block selector, not independent time fields

- WHEN an admin creates or edits a teacher activity
- THEN the form SHALL present exactly one selector labeled
  "Bloque horario" offering the 5 canonical teacher blocks, and SHALL NOT
  present independent start-time and end-time selectors

#### Scenario: The selected block determines both start_time and end_time

- WHEN a block is selected and the form is submitted
- THEN the submitted `start_time` and `end_time` SHALL be exactly that
  block's values, with `end_time` derived from the selection rather than
  independently entered

#### Scenario: A block counts as exactly 2 assigned academic hours, including 17:00–19:00

- WHEN any part of the system counts assigned hours for a teacher activity
  row, including one in the 17:00–19:00 block
- THEN each row SHALL count as exactly 2 hours, consistent with every
  canonical teacher block spanning exactly 2 hours

### Requirement: Invalid start_time/end_time combinations SHALL be rejected at the service layer

The system SHALL reject any attempt to create or update a
`schedule_teachers` row whose `start_time`/`end_time` pair does not
exactly match one of the 5 canonical teacher blocks, regardless of which
caller submits the request (the teacher-schedule form or a direct call to
`createEditScheduleTeachers`).

#### Scenario: A non-canonical interval is rejected regardless of caller

- WHEN a create or edit request submits a `start_time`/`end_time` pair that
  does not match any canonical teacher block (e.g. via a direct API call
  or a manipulated payload, since the form's own selector cannot produce
  one)
- THEN the system SHALL reject the request with a clear error and SHALL
  NOT insert or update the row

#### Scenario: Existing conflict detection remains authoritative

- WHEN a create or edit request's `start_time`/`end_time` pair does match a
  canonical teacher block
- THEN `hasWorkerConflict`, evaluated against the combined set of that
  worker's teacher activities and scholar assignments, SHALL continue to
  run exactly as it does today, unmodified, and SHALL continue to block an
  overlapping submission for the same worker — whether the conflicting row
  is another teacher activity or a scholar assignment

### Requirement: Every free teacher-schedule cell SHALL offer an Add action with cell-derived defaults

The system SHALL render an Add action in every teacher-schedule table cell
that has no existing activity for the currently-selected teacher,
replacing the current empty-cell placeholder. Activating it SHALL open the
teacher schedule form with the current semester, the currently-selected
teacher, the cell's weekday, and the cell's canonical block preselected,
leaving activity text for the admin to enter.

#### Scenario: A free cell's Add action preselects semester, teacher, weekday, and block

- WHEN an admin activates the Add action on a free teacher-schedule cell
- THEN the opened form SHALL have the current semester, the currently-
  selected teacher, that cell's weekday, and that cell's canonical block
  already selected, with activity text left empty

#### Scenario: The preselected block can be changed, but only to another canonical teacher block

- WHEN an admin changes the preselected "Bloque horario" value before
  submitting
- THEN only the 5 canonical teacher blocks SHALL be selectable — the same
  restriction that applies to the form in every other context

#### Scenario: Occupied cells are unaffected

- WHEN a teacher-schedule cell already has one or more activities for the
  currently-selected teacher
- THEN it SHALL continue to render its existing edit and delete controls
  for each activity exactly as before, with no Add action

#### Scenario: A selected teacher with zero existing records still renders every cell's Add action

- WHEN an admin selects a teacher who has no `schedule_teachers` rows and
  no `schedule_assignments` rows yet
- THEN the schedule grid SHALL still render (not just the table header),
  with every applicable cell showing its Add action, so the admin can
  build up that teacher's activity schedule entirely from empty cells
- AND no schedule rows SHALL render before any teacher is selected

#### Scenario: The Add action is operable by keyboard

- WHEN an admin navigates to a free cell's Add action using the keyboard
- THEN it SHALL be a real, focusable `button` element that activates on
  both `Enter` and `Space`, matching native button semantics, with an
  accessible label that includes the weekday, the block, and the selected
  teacher where practical

#### Scenario: The top-level manual Add button remains available

- WHEN an admin uses the top-level "+ Agregar horario de actividades"
  button instead of a cell's Add action
- THEN the same teacher schedule form SHALL open, using the same single
  canonical-block selector, with no cell-derived preselection (matching
  its existing fully-manual behavior)

### Requirement: Existing invalid legacy teacher-activity rows SHALL be preserved, detected, and surfaced for manual correction

The system SHALL NOT automatically modify, split, or reinterpret any
existing `schedule_teachers` row whose stored `start_time`/`end_time` does
not match a canonical teacher block. Such rows SHALL be detected and made
visible for manual correction through the existing edit flow.

#### Scenario: Editing an invalid legacy row does not guess a block

- WHEN an admin opens the edit form for a teacher activity whose stored
  `start_time`/`end_time` does not match any canonical teacher block
- THEN the "Bloque horario" selector SHALL render unselected (not
  defaulted to any block), a warning SHALL explain that the stored
  interval is invalid and must be corrected, and the existing required-
  field validation SHALL block saving until the admin explicitly selects
  one of the 5 canonical teacher blocks

#### Scenario: Invalid rows are visible without opening each one individually

- WHEN the currently-selected teacher has one or more `schedule_teachers`
  rows whose stored interval does not match a canonical teacher block
- THEN a warning listing those rows (weekday, activity text, and the raw
  stored interval) SHALL be visible on the teacher schedule view for that
  teacher

#### Scenario: No existing data is changed by this change's own deployment

- WHEN this change is deployed
- THEN no existing `schedule_teachers` row's `start_time`, `end_time`, or
  any other column SHALL be modified, split, or deleted as a result — only
  future create/edit requests are subject to the new validation
