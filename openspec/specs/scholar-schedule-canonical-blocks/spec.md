# scholar-schedule-canonical-blocks Specification

## Purpose
TBD - created by archiving change add-schedules-from-empty-slots. Update Purpose after archive.
## Requirements
### Requirement: Every scholar schedule assignment SHALL occupy exactly one canonical academic block

The system SHALL define exactly 4 valid academic blocks
(`07:00:00`–`08:50:00`, `09:20:00`–`11:10:00`, `11:10:00`–`13:00:00`,
`13:10:00`–`15:00:00`) and SHALL require every `schedule_assignments`
row's `start_time`/`end_time` pair to exactly match one of them. Multi-
block assignments and arbitrary `start_time`/`end_time` combinations are
not supported.

#### Scenario: The form exposes one block selector, not independent time fields

- WHEN an admin creates or edits a scholar schedule assignment
- THEN the form SHALL present exactly one selector labeled
  "Bloque horario" offering the 4 canonical blocks, and SHALL NOT present
  independent start-time and end-time selectors

#### Scenario: The selected block determines both start_time and end_time

- WHEN a block is selected and the form is submitted
- THEN the submitted `start_time` and `end_time` SHALL be exactly that
  block's values, with `end_time` derived from the selection rather than
  independently entered

#### Scenario: A block counts as exactly 2 assigned academic hours

- WHEN any part of the system counts assigned hours for a schedule
  assignment row
- THEN each row SHALL count as exactly 2 hours, consistent with every
  canonical block spanning exactly 2 hours

### Requirement: Invalid start_time/end_time combinations SHALL be rejected at the service layer

The system SHALL reject any attempt to create or update a
`schedule_assignments` row whose `start_time`/`end_time` pair does not
exactly match one of the 4 canonical blocks, regardless of which caller
submits the request (the scholar-schedule form or a direct call to
`createEditScheduleAssignments`).

#### Scenario: A non-canonical interval is rejected regardless of caller

- WHEN a create or edit request submits a `start_time`/`end_time` pair that
  does not match any canonical block (e.g. via a direct API call or a
  manipulated payload, since the form's own selector cannot produce one)
- THEN the system SHALL reject the request with a clear error and SHALL
  NOT insert or update the row

#### Scenario: Existing conflict detection remains authoritative

- WHEN a create or edit request's `start_time`/`end_time` pair does match a
  canonical block
- THEN `hasWorkerConflict`/`hasGroupConflict` SHALL continue to run exactly
  as they do today, unmodified, and SHALL continue to block an overlapping
  submission for the same worker or group

### Requirement: Every free scholar-schedule cell SHALL offer an Add action with cell-derived defaults

The system SHALL render an Add action in every scholar-schedule table cell
that has no existing assignment, replacing the current empty-cell
placeholder. Activating it SHALL open the scholar schedule form with the
current semester, the currently-selected group, the cell's weekday, and
the cell's canonical block preselected, leaving subject and teacher for
the admin to choose.

#### Scenario: A free cell's Add action preselects semester, group, weekday, and block

- WHEN an admin activates the Add action on a free scholar-schedule cell
- THEN the opened form SHALL have the current semester, the currently-
  selected group, that cell's weekday, and that cell's canonical block
  already selected, with subject and teacher left unselected

#### Scenario: The preselected block can be changed, but only to another canonical block

- WHEN an admin changes the preselected "Bloque horario" value before
  submitting
- THEN only the 4 canonical blocks SHALL be selectable — the same
  restriction that applies to the form in every other context

#### Scenario: Occupied cells are unaffected

- WHEN a scholar-schedule cell already has an assignment
- THEN it SHALL continue to render its existing edit and delete controls
  exactly as before, with no Add action and no continuation labels or
  multi-row rendering (assignments are strictly single-block)

#### Scenario: A selected group with zero existing assignments still renders every cell's Add action

- WHEN an admin selects a group that has no `schedule_assignments` rows yet
- THEN the schedule grid SHALL still render (not just the table header),
  with every applicable cell showing its Add action, so the admin can build
  up that group's schedule entirely from empty cells
- AND no schedule rows SHALL render before any group is selected

#### Scenario: The Add action is operable by keyboard

- WHEN an admin navigates to a free cell's Add action using the keyboard
- THEN it SHALL be a real, focusable `button` element that activates on
  both `Enter` and `Space`, matching native button semantics, with its
  accessible label preserved

#### Scenario: The top-level manual Add button remains available

- WHEN an admin uses the top-level "+ Agregar horario escolar" button
  instead of a cell's Add action
- THEN the same scholar schedule form SHALL open, using the same single
  canonical-block selector, with no cell-derived preselection (matching
  its existing fully-manual behavior)

### Requirement: Existing invalid legacy rows SHALL be preserved, detected, and surfaced for manual correction

The system SHALL NOT automatically modify, split, or reinterpret any
existing `schedule_assignments` row whose stored `start_time`/`end_time`
does not match a canonical block. Such rows SHALL be detected and made
visible for manual correction through the existing edit flow.

#### Scenario: Editing an invalid legacy row does not guess a block

- WHEN an admin opens the edit form for a row whose stored
  `start_time`/`end_time` does not match any canonical block
- THEN the "Bloque horario" selector SHALL render unselected (not
  defaulted to any block), a warning SHALL explain that the stored
  interval is invalid and must be corrected, and the existing required-
  field validation SHALL block saving until the admin explicitly selects
  one of the 4 canonical blocks

#### Scenario: Invalid rows are visible without opening each one individually

- WHEN the currently-selected group has one or more rows whose stored
  interval does not match a canonical block
- THEN a warning listing those rows (weekday, subject, teacher, and the
  raw stored interval) SHALL be visible on the scholar schedule view for
  that group

#### Scenario: No existing data is changed by this change's own deployment

- WHEN this change is deployed
- THEN no existing `schedule_assignments` row's `start_time`, `end_time`,
  or any other column SHALL be modified, split, or deleted as a result —
  only future create/edit requests are subject to the new validation

