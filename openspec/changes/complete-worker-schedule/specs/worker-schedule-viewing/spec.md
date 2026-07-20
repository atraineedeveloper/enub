## MODIFIED Requirements

### Requirement: Desktop presentation shares the administrator schedule's real structural components, differing only in available actions

On viewports wider than the application's existing mobile breakpoint, the schedule SHALL render using the identical structural presentation components the administrator schedule uses for its own "Horario del Maestro" (per-worker, class-and-activity) view — the same table container, day header, block row, recess row, divider row, and cell-content components, imported from the same shared module by both surfaces. The grid SHALL render exactly the desktop-placeable entries. The view SHALL include a semester selector above the grid. Every entry's kind (class vs. activity) SHALL be conveyed as visible text integrated into that shared content presentation, never solely by a background color or a separate legend. The worker's rendered tree MUST NOT import or render any edit, assignment, delete, drag-and-drop, or other administrative control, form, or interactive element of any kind — not merely hide one with styling; the administrative components (`Modal`, `ActionButton`, `ConfirmDelete`, create/edit forms) MUST NOT appear anywhere in the worker's component tree or its rendered output.

#### Scenario: Grid renders class and activity entries using the shared content component
- **WHEN** the worker has both class assignments and teacher activities for the selected semester that are desktop-placeable
- **THEN** both appear in their corresponding weekday/time cells, each rendered through the same content-presentation component the administrator schedule uses, with the entry's kind ("Clase"/"Actividad") integrated into the visible text

#### Scenario: No administrative controls present, anywhere in the tree
- **WHEN** the desktop schedule grid is rendered
- **THEN** no add, edit, delete, or drag-and-drop control of any kind is present anywhere on the page, and no module implementing one (`Modal`, `ActionButton`, `ConfirmDelete`, a create/edit form) is imported by the worker's rendered component tree

#### Scenario: Multiple entries in one cell are all shown
- **WHEN** two schedule entries occupy the same weekday/time cell
- **THEN** both are visible within that cell, not merged or one hidden behind the other

#### Scenario: Administrator schedule retains every existing action
- **WHEN** the administrator "Horario Escolar" or "Horario del Maestro" schedule is rendered, now consuming the same shared structural/content components as the worker view
- **THEN** every create, edit, delete, and institutional rule (the fixed Monday "Homenaje/Tutoría" reservation, conflict-blocked cells) continues to behave exactly as before this change — the shared components changed only how the table's shape and cell text render, never the administrator's mutations, hooks, or institutional rules

### Requirement: Desktop renders full-width recess rows within the existing row sequence

The desktop grid's row sequence SHALL interleave the school's canonical teachable time blocks with both fixed recess periods, in chronological order, using the identical plain presentation (no distinct background, weight, or letter-spacing) the administrator schedule already uses for its own recess row. Each recess row SHALL show its time range in the row header and a single cell spanning every weekday column with the exact text `"RECESO"`, centered. A recess row MUST NOT contain per-weekday cells, class/activity entries, or any edit/add/delete control.

#### Scenario: Recess rows render in chronological position, in the administrator's plain presentation
- **WHEN** the desktop grid renders
- **THEN** its row sequence interleaves 8:50–9:20 (RECESO) and 13:00–13:10 (RECESO) chronologically among the teachable blocks, with the identical plain text treatment (no distinct background) the administrator schedule's own recess row uses

#### Scenario: Recess cell spans all weekday columns
- **WHEN** a recess row renders
- **THEN** its single cell has a column span equal to the number of weekday columns, and no separate per-weekday cell exists for that row

#### Scenario: No schedule entry renders inside a recess row
- **WHEN** the grid renders, regardless of which entries are present in the normalized array
- **THEN** a recess row's cell always shows exactly the text `"RECESO"` and nothing else — no subject, group, or activity content ever appears there

## ADDED Requirements

### Requirement: The extracurricular (17:00–19:00) block is conditional, matching the administrator schedule's own rule

The desktop grid's row sequence SHALL include the 17:00–19:00 teachable block, preceded by a full-width "HORARIO EXTRACURRICULAR" divider row, only when at least one of the worker's normalized entries for the selected semester has a start time of exactly `17:00:00` — the identical condition the administrator "Horario del Maestro" row already applies. When no such entry exists, neither the divider nor the 17:00–19:00 row SHALL appear. This condition MUST NOT cause any valid entry to be discarded: an entry that does trigger the block is still placed in it normally.

#### Scenario: Extracurricular block and divider appear together when triggered
- **WHEN** at least one class or activity entry for the selected semester has `startTime` exactly `"17:00:00"`
- **THEN** the "HORARIO EXTRACURRICULAR" divider row and the 17:00–19:00 block row both appear, in that order, after the 13:10–15:00 block, and the triggering entry (and any other entry placeable in that block) renders inside it

#### Scenario: Extracurricular block and divider are both absent when nothing triggers them
- **WHEN** no entry for the selected semester has `startTime` exactly `"17:00:00"`
- **THEN** neither the divider row nor the 17:00–19:00 block row appears in the grid's row sequence

#### Scenario: The condition never discards a valid entry
- **WHEN** an entry with `startTime` exactly `"17:00:00"` exists for the selected semester
- **THEN** it is desktop-placeable and appears inside the 17:00–19:00 row exactly as any other canonical-block entry would, never dropped or redirected to "Horario no especificado" because of this condition

### Requirement: Mobile agenda is exempt from structural parity with the administrator schedule

The mobile agenda (at or below the application's existing mobile breakpoint) SHALL NOT be required to share structural presentation components with the administrator schedule, because the administrator schedule has no usable mobile-width alternative to align with (its table has no responsive breakpoint of its own). The mobile agenda's existing presentation, data source, and behavior SHALL remain unchanged by this requirement set.

#### Scenario: Mobile agenda is unaffected by desktop structural parity work
- **WHEN** the schedule is viewed at or below the mobile breakpoint
- **THEN** it renders via `WorkerScheduleAgenda`'s own existing presentation, unchanged, consuming the identical normalized array the desktop grid uses
