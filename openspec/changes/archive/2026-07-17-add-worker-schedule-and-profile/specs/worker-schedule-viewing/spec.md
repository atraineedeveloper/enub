## ADDED Requirements

### Requirement: Worker schedule route access is gated by a shared, role-aware route gate
The route `/my-schedule` SHALL render the worker's own schedule only for an authenticated session with `role = 'worker'` and a valid linked `worker_id`. Every other case — `admin`, `staff`, an unrecognized role, a missing `profiles` row, or `role = 'worker'` with an invalid/missing `worker_id` — SHALL be denied: staff/admin redirected to the administrative dashboard, every other case redirected to the pending-access page.

#### Scenario: Worker with a valid link sees their schedule
- **WHEN** an authenticated `worker`-role session with a valid `worker_id` visits `/my-schedule`
- **THEN** their own schedule view renders

#### Scenario: Staff/admin redirected away
- **WHEN** an authenticated `staff`- or `admin`-role session visits `/my-schedule`
- **THEN** they are redirected to the administrative dashboard

#### Scenario: Unrecognized role denied
- **WHEN** an authenticated session's `profiles.role` is neither `admin`, `staff`, nor `worker`
- **THEN** the session is redirected to the pending-access page

#### Scenario: Missing profile denied
- **WHEN** an authenticated session has no `profiles` row
- **THEN** the session is redirected to the pending-access page

#### Scenario: Invalid or missing worker link denied
- **WHEN** an authenticated session has `role = 'worker'` but a null or invalid `worker_id`
- **THEN** the session is redirected to the pending-access page

### Requirement: Schedule data is fetched via worker-specific, narrowly-projected queries
The schedule view SHALL fetch the worker's own data using dedicated service functions with an explicit column projection scoped to exactly what the normalized schedule contract requires. It MUST NOT reuse the existing admin `getScheduleTeachers()`/`getScheduleAssignments()` functions, and MUST NOT embed the full `workers` row, RFC, address, administrative observations, timestamps, or any other worker-identifying or unrelated data in these queries. The selected semester MAY be passed as a filter but MUST NOT be treated as, or used as, an authorization mechanism — the database's row-level security remains the sole authority on which rows are returned.

#### Scenario: Worker-specific query used, not the admin query
- **WHEN** the schedule view fetches class assignments or teacher activities
- **THEN** it calls a worker-specific service function distinct from the admin `getScheduleAssignments`/`getScheduleTeachers`, and that function's query does not embed the full `workers` row

#### Scenario: Semester filter is not an authorization boundary
- **WHEN** the schedule view issues its query for a given semester id, including a semester id constructed or altered on the client
- **THEN** the rows returned are still limited to the requesting worker's own rows, because row-level security — not the semester filter — determines ownership

### Requirement: Schedule data is normalized into one explicit, stable contract
The system SHALL map both `schedule_assignments` and `schedule_teachers` rows into a single explicit `WorkerScheduleEntry` type before rendering, preserving which source table each entry came from, and every presentation (the desktop grid, the mobile agenda, and the "Horario no especificado" section) SHALL consume this same normalized array — never independently re-derived data shapes.

#### Scenario: Entry kind is preserved
- **WHEN** a class assignment and a teacher activity are both normalized
- **THEN** each resulting entry retains a `kind` field identifying its origin (`"class"` vs. `"activity"`), usable by every presentation

#### Scenario: Every authorized row is normalized, none are discarded
- **WHEN** any authorized schedule row is normalized, including one with a null start time, a null end time, malformed time, or a weekday outside the canonical list
- **THEN** it is still represented as a `WorkerScheduleEntry` in the normalized array — normalization never drops a row for any reason; only its eventual placement (grid, agenda, or "Horario no especificado") depends on which fields are valid

#### Scenario: Overlapping records are never merged
- **WHEN** two schedule rows occupy the same weekday and time block for the worker
- **THEN** both appear as separate entries in the normalized array; neither is dropped, combined, or overwritten by the other

#### Scenario: Malformed weekday normalizes to Otro internally and to an exact label when displayed
- **WHEN** a schedule row's `weekday` value does not exactly match the canonical weekday list
- **THEN** its normalized entry's `weekday` is the literal internal value `"Otro"`, and wherever that entry's weekday is rendered as text it shows exactly "Día no especificado" — never a guessed or incorrect real weekday, and never omitted from the array

#### Scenario: Malformed or missing time never throws and renders an exact label
- **WHEN** a schedule row has a null or unparseable `start_time` or `end_time`
- **THEN** normalization completes without throwing, producing `startTime`/`endTime: null` on that entry, and wherever that entry's time is rendered as text it shows exactly "Hora no especificada"

#### Scenario: Missing subject, group, or activity text has exact fallback text
- **WHEN** a class entry's joined subject or group data is missing, or an activity entry's `activity` text is missing
- **THEN** the entry's `subject`/`group`/`activity` field is set to its documented exact fallback text ("Materia no especificada", "Grupo no especificado", or "Actividad no especificada" respectively), never left blank or undefined

#### Scenario: A per-field fallback never blanks the rest of the entry
- **WHEN** an entry has one missing/malformed field (for example an unrecognized weekday) alongside other valid fields (for example a known subject and valid time)
- **THEN** only the missing/malformed field's fallback text is used; the entry's other, valid fields still display their real values

#### Scenario: No room field is ever present
- **WHEN** any normalized entry is constructed
- **THEN** it has no room field of any kind, since no room column exists in the underlying schema

### Requirement: Every normalized entry is placed into the grid, the agenda, or "Horario no especificado" by explicit, pure criteria
The system SHALL determine, via a pure partition function, which entries are placeable in the desktop grid, which are placeable in the mobile agenda, and which are placeable in neither. An entry is desktop-placeable only when its weekday is recognized, its start and end times are valid, and the time range matches a configured canonical block for its kind. An entry is mobile-placeable when its weekday is recognized and its start and end times are valid, regardless of canonical-block alignment. Every entry not mobile-placeable is unplaceable. Desktop-placeable entries are a subset of mobile-placeable entries.

#### Scenario: Canonical entry is placeable on both desktop and mobile
- **WHEN** an entry has a recognized weekday and a start/end time matching a configured canonical block for its kind
- **THEN** it is both desktop-placeable and mobile-placeable

#### Scenario: Valid but noncanonical time is mobile-placeable but not desktop-placeable
- **WHEN** an entry has a recognized weekday and a syntactically valid start/end time that does not match any configured canonical block for its kind
- **THEN** it is mobile-placeable but not desktop-placeable

#### Scenario: Malformed time or unrecognized weekday is unplaceable on both
- **WHEN** an entry has a null/malformed start or end time, or an unrecognized weekday
- **THEN** it is neither desktop-placeable nor mobile-placeable

#### Scenario: Desktop-placeable entries are always a subset of mobile-placeable entries
- **WHEN** the partition function evaluates any entry
- **THEN** every entry it classifies as desktop-placeable is also classified as mobile-placeable

### Requirement: Grid/agenda entries sort in a stable, fully deterministic order
Entries placed in the desktop grid or the mobile agenda SHALL be sorted by weekday (canonical order, with `"Otro"` last), then by start time ascending (entries with no start time last within their weekday), then by kind (`"class"` before `"activity"`), then by a stable per-entry identifier — such that no two entries can ever compare as equal, and the same input data always produces the same output order regardless of the order rows were originally returned in.

#### Scenario: Sort order is reproducible
- **WHEN** the same set of placeable entries is sorted twice, with the source rows supplied in a different order each time
- **THEN** the resulting sorted array is identical both times

#### Scenario: Ties are fully resolved
- **WHEN** two entries share the same weekday, start time, and kind
- **THEN** their relative order is still fully determined, using their stable per-entry identifier as the final tie-break

### Requirement: Desktop presentation is a read-only weekly timetable aligned with the administrator schedule's visual language
On viewports wider than the application's existing mobile breakpoint, the schedule SHALL render as a timetable/grid with weekday columns and time-block rows, using the same institutional color tokens the administrator schedule already associates with class vs. activity entries, plus a text label so meaning never depends on color alone. The grid SHALL render exactly the desktop-placeable entries. The view SHALL include a semester selector above the grid and a legend. It MUST NOT include any edit, assignment, delete, drag-and-drop, or other administrative control.

#### Scenario: Grid renders class and activity entries
- **WHEN** the worker has both class assignments and teacher activities for the selected semester that are desktop-placeable
- **THEN** both appear in their corresponding weekday/time cells, each carrying a text label identifying its kind in addition to any color styling

#### Scenario: No administrative controls present
- **WHEN** the desktop schedule grid is rendered
- **THEN** no add, edit, delete, or drag-and-drop control of any kind is present anywhere on the page

#### Scenario: Multiple entries in one cell are all shown
- **WHEN** two schedule entries occupy the same weekday/time cell
- **THEN** both are visible within that cell, not merged or one hidden behind the other

### Requirement: Mobile presentation is a day-grouped agenda of the same normalized data
At or below the application's existing mobile breakpoint, the schedule SHALL render as day-grouped sections listing entries chronologically, each showing explicit start/end time, a class/activity label, and subject/group or activity text, consuming the identical normalized array the desktop grid uses. The agenda SHALL render exactly the mobile-placeable entries. The schedule MUST NOT require horizontal page scrolling through a multi-column layout at this breakpoint.

#### Scenario: Mobile agenda uses the same data as desktop
- **WHEN** the same worker's schedule is viewed on both a desktop-width and a mobile-width viewport
- **THEN** every entry desktop-placeable also appears in the mobile agenda, in the same relative weekday/time order, differing only in visual layout — the mobile agenda may additionally include valid-but-noncanonical-time entries the desktop grid cannot place

#### Scenario: No horizontal page scroll on mobile
- **WHEN** the schedule is viewed at a mobile viewport width
- **THEN** no entry or section requires horizontal scrolling of the page to read

### Requirement: The grid-to-agenda transition happens at the existing mobile breakpoint, with defined overflow behavior above it
The presentation SHALL switch from the desktop grid to the mobile agenda at exactly the application's existing mobile breakpoint, not a newly introduced one. Above that breakpoint, if the grid's content is tight, overflow SHALL be contained within the grid's own scrollable area — never the page — and essential text (subject, group, activity) MUST remain readable, truncating with an accessible full-text affordance rather than clipping silently.

#### Scenario: Transition point matches the existing breakpoint
- **WHEN** the viewport width crosses the application's existing mobile breakpoint
- **THEN** the presentation switches between the grid and the agenda at that exact width, not a different or new threshold

#### Scenario: Tight desktop width scrolls within the grid, not the page
- **WHEN** the viewport is just above the mobile breakpoint and the grid's content does not comfortably fit
- **THEN** any resulting horizontal scrolling is contained to the grid's own container, the page itself does not scroll horizontally, and cell text is truncated with an accessible way to reveal the full value rather than being clipped with no indication

### Requirement: Default semester selection is deterministic and never positional
The schedule view SHALL default to the chronologically latest semester whose code parses successfully, determined by parsing every semester's code — never by array index, insertion order, or database row order. If every existing semester's code fails to parse, the default SHALL be the first semester in a deterministic (id-ordered) tie-break among the malformed rows, not a "no semesters" state. If no semesters exist at all, the distinct no-semesters state SHALL be shown instead.

#### Scenario: Latest valid semester selected by default
- **WHEN** the worker opens `/my-schedule` with multiple semesters existing, supplied to the page in an arbitrary order
- **THEN** the semester selector defaults to the chronologically latest semester whose code parses successfully, regardless of query/array order

#### Scenario: Semester list is fully and deterministically ordered
- **WHEN** the semester selector is rendered
- **THEN** semesters with parseable codes are listed newest-first, followed by any semesters with unparseable codes in a stable, deterministic order, never raw query order

#### Scenario: Equivalent parsed codes have a stable tie-break
- **WHEN** two semester rows parse to the identical year and term
- **THEN** their relative order is deterministic (by row id), not dependent on query return order

#### Scenario: All semesters malformed selects the first deterministic item, not an empty state
- **WHEN** every existing semester's code fails to parse
- **THEN** the selector defaults to one specific, deterministically-chosen semester rather than behaving as if no semesters exist

#### Scenario: Selected semester no longer exists
- **WHEN** the currently selected semester id is no longer present in the semesters list (e.g. after a refetch)
- **THEN** the selection re-resolves using the same default-selection rule against the current list, rather than remaining pointed at a nonexistent semester

### Requirement: Historical semesters remain inspectable
The worker SHALL be able to select any existing semester, including ones earlier than the current default, and view the schedule recorded for it.

#### Scenario: Selecting a historical semester
- **WHEN** the worker selects a semester earlier than the default latest semester
- **THEN** the schedule view updates to show that semester's own assignments and activities

### Requirement: Distinct states for loading, no semesters, and no schedule
The schedule view SHALL render visually and textually distinct states for: data loading, no semesters existing at all, and a selected semester with no schedule entries for this worker.

#### Scenario: Loading state
- **WHEN** semester or schedule data is still being fetched
- **THEN** a loading indicator is shown, with no schedule content or empty-state message yet

#### Scenario: No semesters exist at all
- **WHEN** no `semesters` rows exist in the system
- **THEN** a distinct Spanish message states that no semesters have been registered yet

#### Scenario: Semester exists but worker has no assignments
- **WHEN** the selected semester exists and its code parses (the normal case) or is the deterministically-selected malformed default, but the worker has zero normalized entries for it
- **THEN** a distinct Spanish message states the worker has no registered activities for that semester, not the "no semesters" message

### Requirement: Database or RLS errors are surfaced distinctly
A failure while loading semester or schedule data SHALL be shown as a distinct error state, separate from any empty state, with a clear Spanish message.

#### Scenario: Query error
- **WHEN** the semester, schedule-assignments, or schedule-teachers query fails
- **THEN** an error state is shown with a Spanish message, distinct from the "no schedule" empty state

### Requirement: A labeled "Horario no especificado" section shows every entry not placeable in the grid or agenda
Both the desktop and mobile presentations SHALL include a clearly labeled "Horario no especificado" section showing the actual authorized entries that could not be placed in the normal grid or agenda — never merely a count or a warning banner. On desktop, this section SHALL contain every entry that is not desktop-placeable (including valid-but-noncanonical-time entries and fully unplaceable entries). On mobile, this section SHALL contain exactly the unplaceable entries. Every normalized entry SHALL appear in exactly one visible region per viewport — either the grid/agenda or "Horario no especificado" — never in both and never in neither.

#### Scenario: Desktop shows every non-grid entry in Horario no especificado
- **WHEN** the worker has entries that are mobile-placeable but not desktop-placeable, or entries that are unplaceable altogether
- **THEN** all of them appear in the desktop "Horario no especificado" section, none are silently omitted, and none also appear in the grid

#### Scenario: Mobile shows exactly the unplaceable entries in Horario no especificado
- **WHEN** the worker has entries that are unplaceable (malformed/missing time, or an unrecognized weekday)
- **THEN** all of them appear in the mobile "Horario no especificado" section, and none of the mobile-placeable entries (including valid-but-noncanonical ones already shown in the agenda) are duplicated there

#### Scenario: No entry is ever lost
- **WHEN** the full set of authorized, normalized entries for a semester is rendered on either desktop or mobile
- **THEN** every single entry is visible somewhere on the page — in the grid/agenda, in "Horario no especificado", or both are checked and the entry is found in exactly one

#### Scenario: Entries show their actual content, not just a count
- **WHEN** the "Horario no especificado" section is rendered with one or more entries
- **THEN** each entry's real, available content (subject, group, activity, and any valid time/weekday it has) is shown individually, using exact fallback text (per the normalization requirement) only for the specific fields that are actually missing or malformed — the section never collapses its contents into a single summary count or generic warning

#### Scenario: Horario no especificado sorts deterministically
- **WHEN** the "Horario no especificado" section contains multiple entries
- **THEN** they are ordered by: entries with a recognized weekday before entries with an unrecognized weekday, then entries with a valid start time before entries with a missing/invalid start time, then by kind (`"class"` before `"activity"`), then by the entry's stable identifier — a total order with no possible ties, distinct from the grid/agenda's weekday-and-time-value sort

### Requirement: Schedule information is understandable without color
Weekday, time, and entry-kind information SHALL be exposed as readable text, not conveyed by color alone, in both presentations.

#### Scenario: Text labels present regardless of color perception
- **WHEN** the schedule is rendered, in either the desktop grid or the mobile agenda
- **THEN** every entry's weekday, start/end time, and kind (class vs. activity) are present as visible text, independent of any color styling applied

### Requirement: Fixed recess periods are presentation-only school-day blocks
The system SHALL present the school's two fixed recess periods (`08:50:00–09:20:00` and `13:00:00–13:10:00`, labeled `"RECESO"`) in both the desktop grid and the mobile agenda as static, presentation-only facts about the school day. Recess periods MUST NOT be persisted in any database table, MUST NOT be returned by any schedule query, MUST NOT become a `WorkerScheduleEntry`, and MUST NOT participate in row-level security, normalization, or partitioning.

#### Scenario: Recess periods are not database-backed
- **WHEN** the worker schedule is rendered
- **THEN** the two recess periods shown come from a fixed, in-application constant, not from any Supabase query result

#### Scenario: Recess periods are not normalized schedule entries
- **WHEN** the schedule's normalized entry array is produced for a semester
- **THEN** it contains only entries derived from authorized `schedule_assignments`/`schedule_teachers` rows — the recess periods are never present in that array, under any `kind`

### Requirement: Desktop renders full-width recess rows within the existing row sequence
The desktop grid's row sequence SHALL interleave the school's canonical teachable time blocks with both fixed recess periods, in chronological order. Each recess row SHALL show its time range in the row header and a single cell spanning every weekday column with the exact text `"RECESO"`, centered. A recess row MUST NOT contain per-weekday cells, class/activity entries, or any edit/add/delete control.

#### Scenario: Both recess rows render in chronological position
- **WHEN** the desktop grid renders
- **THEN** its row sequence is, in order: 7:00–8:50, 8:50–9:20 (RECESO), 9:20–11:10, 11:10–13:00, 13:00–13:10 (RECESO), 13:10–15:00, 17:00–19:00

#### Scenario: Recess cell spans all weekday columns
- **WHEN** a recess row renders
- **THEN** its single cell has a column span equal to the number of weekday columns, and no separate per-weekday cell exists for that row

#### Scenario: No schedule entry renders inside a recess row
- **WHEN** the grid renders, regardless of which entries are present in the normalized array
- **THEN** a recess row's cell always shows exactly the text `"RECESO"` and nothing else — no subject, group, or activity content ever appears there

### Requirement: Mobile renders recess as chronological separators only within already-displayed days
The mobile agenda SHALL show both fixed recess periods as static separators — never a class/activity card — positioned chronologically among a day's real entries by start time, within every day that already has at least one real entry to display. The agenda MUST NOT create a day section, nor duplicate a recess separator within a day, solely to show a recess period.

#### Scenario: Recess separators appear between real entries in chronological order
- **WHEN** a displayed day has entries both before and after a recess period
- **THEN** the recess separator appears between them in the day's rendered order, showing the exact label `"RECESO"` and its time range

#### Scenario: A day with no real entries shows no recess separator
- **WHEN** a weekday has zero mobile-placeable entries
- **THEN** no day section is rendered for it, and neither recess separator appears for that weekday

#### Scenario: Each displayed day shows each recess period exactly once
- **WHEN** a day section is rendered
- **THEN** each of the two fixed recess periods appears exactly once within it, never duplicated

### Requirement: Recess periods never affect empty-schedule detection
Whether a selected semester is considered to have an empty schedule SHALL depend exclusively on the count of normalized entries derived from authorized `schedule_assignments`/`schedule_teachers` rows. The fixed recess periods MUST NOT cause an otherwise-empty schedule to be treated as non-empty, and MUST NOT be counted as class or activity data.

#### Scenario: Zero authorized rows is still an empty schedule
- **WHEN** a worker has zero `schedule_assignments` and zero `schedule_teachers` rows for the selected semester
- **THEN** the distinct "no schedule for this semester" state is shown, unaffected by the recess periods always being part of the desktop grid's row sequence
