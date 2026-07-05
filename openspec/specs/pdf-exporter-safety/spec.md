# pdf-exporter-safety Specification

## Purpose
TBD - created by archiving change stabilize-and-convert-pdf-exporters. Update Purpose after archive.
## Requirements
### Requirement: PDF export buttons remain available
The system SHALL continue to render every PDF export trigger it renders today
(`ScheduleGroupPDF`, `ScheduleTeacherPDF`, `TeacherAssignmentPDF`,
`WorkerSheetSemester`) at the same call sites, under the same visibility
conditions, with no export button added, removed, relocated, or hidden behind
a new condition.

#### Scenario: Scholar schedule export button visibility unchanged
- **WHEN** a user selects a group with at least one schedule assignment on the
  scholar schedule tab
- **THEN** the `ScheduleGroupPDF` export button renders exactly as it does
  today, gated on `filteredSchedules.length > 0`

#### Scenario: Teacher schedule export button visibility unchanged
- **WHEN** a user selects a teacher and semester with an existing schedule
  record
- **THEN** the `ScheduleTeacherPDF` export button renders exactly as it does
  today, gated on `recordExist`

### Requirement: PDF content and layout are preserved except for documented repairs
The system SHALL preserve existing PDF content, structure, and layout
(filenames, table order, column/row structure, labels, fonts, margins, and
date formatting) exactly, except where a documented pre-existing bug requires
a minimal, explicitly-approved repair.

#### Scenario: Unaffected PDF sections are byte-for-byte structurally identical
- **WHEN** a PDF is generated from data that does not trigger any documented
  bug (e.g., at least 2 rows exist in `roles` and `state_roles`)
- **THEN** the generated document's structure, labels, table layout, and
  filename are identical to the pre-change output

### Requirement: The reported ScheduleTeacherPDF role-index failure is diagnosed and repaired
The system SHALL repair the `Cannot read properties of undefined (reading
'role')` failure in `ScheduleTeacherPDF.jsx` (and the identical latent failure
in `ScheduleGroupPDF.jsx`) when the failure is caused by an invalid assumption
that `roles` and `state_roles` each contain at least two rows.

#### Scenario: Fewer than two roles exist
- **WHEN** the `roles` table contains fewer than two rows (as it does with the
  current seed data, which contains exactly one row)
- **THEN** `ScheduleTeacherPDF` and `ScheduleGroupPDF` generate their PDF
  without throwing, using a defined fallback value in place of the missing
  second role, instead of crashing

#### Scenario: Fewer than two state roles exist
- **WHEN** the `state_roles` table contains fewer than two rows
- **THEN** `ScheduleTeacherPDF` and `ScheduleGroupPDF` generate their PDF
  without throwing, using a defined fallback value in place of the missing
  state role entries

### Requirement: PDF repairs are minimal and data-shape explicit
Any repair to a PDF exporter's data access SHALL be minimal in scope, limited
to the specific unsafe access identified in `design.md`, and SHALL make the
assumed data shape explicit (via safe indexing, optional chaining, or an
explicit fallback) rather than introducing broad defensive rewrites of
unrelated code.

#### Scenario: Repair touches only the identified unsafe accesses
- **WHEN** a PDF exporter is repaired
- **THEN** the diff is limited to the specific `roles[n]`/`state_roles[n]`
  accesses (and their immediate consuming expressions) identified in
  `design.md`'s Current Failure Analysis, with no unrelated logic changed

### Requirement: TypeScript migration of PDF exporters does not alter visual output
Converting a PDF exporter file from `.jsx`/`.js` to `.tsx`/`.ts` SHALL NOT
change its visual layout, output filename, table order, labels, margins, or
date formatting.

#### Scenario: TypeScript conversion is behavior-preserving
- **WHEN** a PDF exporter file is converted to TypeScript
- **THEN** the generated PDF for the same input data is structurally
  identical to the pre-conversion output, aside from any change explicitly
  authorized as part of the failure repair

### Requirement: Schedule feature behavior outside PDF exporters is unchanged
This change SHALL NOT alter the behavior of `src/features/schedules/**` or
`src/pages/ScheduleDashboard.tsx` beyond what is strictly required to type a
PDF exporter's props at its existing call site (e.g., removing a
now-unnecessary local cast).

#### Scenario: Call sites keep identical props and rendering conditions
- **WHEN** a PDF exporter is converted to TypeScript
- **THEN** its call site continues to pass the same props under the same
  rendering conditions as before, with no new props, conditions, or removed
  functionality

### Requirement: Services and Supabase query shapes remain unchanged
This change SHALL NOT modify any `services/*` file or any Supabase `select`
string unless `design.md` explicitly proves an existing service's return shape
is incompatible with actual runtime data and the change receives explicit
approval before implementation.

#### Scenario: No service changes without proven necessity and approval
- **WHEN** implementation begins
- **THEN** no file under `src/services/` is modified unless `design.md`
  documents a proven shape mismatch and the user has explicitly approved that
  specific service change

### Requirement: Orphaned schedule files are only removed with explicit authorization
The system SHALL NOT delete the three orphaned files (`CreateScholarSchedule.jsx`,
`EditScholarSchedule.jsx`, `RowTeacherAssignment.jsx`) unless `design.md`
proves they have zero live importers and `tasks.md` explicitly authorizes
their deletion as a task in this change.

#### Scenario: No deletion without proof and explicit task authorization
- **WHEN** implementation begins
- **THEN** the three orphaned files remain in place unless both `design.md`
  documents zero live importers for a given file and `tasks.md` contains an
  explicit, checked-off deletion task for that file

### Requirement: Manual PDF verification is required before merge
This change SHALL require manual generation and visual comparison of every
affected PDF export against its pre-change output before the change is
considered complete.

#### Scenario: Manual smoke check precedes completion
- **WHEN** implementation of a phase that touches a PDF exporter is complete
- **THEN** that PDF is manually generated and visually compared against its
  pre-change output (or, for the repaired failure case, verified to no longer
  throw and to render a sensible fallback) before the phase is marked done

