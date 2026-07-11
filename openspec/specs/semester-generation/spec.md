# semester-generation Specification

## Purpose
TBD - created by archiving change generate-next-semester. Update Purpose after archive.
## Requirements
### Requirement: The next semester SHALL be computed automatically from the latest existing semester

When at least one existing `semester` value can be parsed, the system
SHALL compute the next semester's code as the exact chronological
successor of the latest parseable existing semester, and SHALL NOT let the
admin freely select an arbitrary `semester` code for normal creation.

#### Scenario: Next semester follows the latest existing one

- WHEN the latest existing, parseable semester is `24A`
- THEN the system SHALL compute the next semester as `24B`

#### Scenario: Next semester chains correctly across all academic terms

- WHEN the latest existing, parseable semester is `24B`, `25A`, `25B`, or
  `26A`
- THEN the system SHALL compute the next semester as `25A`, `25B`, `26A`,
  or `26B` respectively

#### Scenario: Unparseable semester values are excluded from latest-semester determination

- WHEN one or more existing `semester` values do not match the supported
  `YYA`/`YYB` or `YYYY-A`/`YYYY-B` formats
- THEN the system SHALL exclude those values when determining the latest
  semester (logging a warning for each excluded value) rather than using
  them to compute an incorrect next semester

### Requirement: school_year SHALL be derived automatically from the semester code

The system SHALL compute `school_year` from a `semester` code using the
stated academic-term rule (`YYA` belongs to `20(YY-1) - 20YY`; `YYB`
belongs to `20YY - 20(YY+1)`) and SHALL NOT present `school_year` as an
independently-selectable field in the semester creation form, in either the
normal or initial-semester path. This derivation SHALL be authoritative at
the service layer, not only performed in the UI: `createSemester()` SHALL
compute `school_year` itself from the parsed `semester` code and SHALL
insert that computed value, regardless of what `school_year` value a
caller submits alongside it.

#### Scenario: school_year is derived correctly for every academic term

- WHEN the semester code is `24A`, `24B`, `25A`, `25B`, `26A`, or `26B`
- THEN the computed `school_year` SHALL be `2023 - 2024`, `2024 - 2025`,
  `2024 - 2025`, `2025 - 2026`, `2025 - 2026`, or `2026 - 2027`
  respectively

#### Scenario: school_year is never independently chosen

- WHEN an admin creates a semester, in either the normal (auto-computed) or
  initial (code-only picker) path
- THEN the submitted `school_year` SHALL always be the value computed from
  the submitted `semester` code, never a value selected independently of it

#### Scenario: A mismatched submitted school_year cannot reach the database

- WHEN a creation request submits a structurally valid, correctly-sequenced
  `semester` code together with a `school_year` value that does not match
  the value that code derives (e.g. via a direct API call, a stale form
  session, or a manipulated payload — not through the normal UI, which
  never lets an admin choose `school_year` independently)
- THEN the system SHALL ignore the submitted `school_year` and insert the
  value computed from the parsed `semester` code instead — the persisted
  `school_year` SHALL always be internally consistent with the persisted
  `semester`

### Requirement: An initial-semester path SHALL exist when no semester exists yet

When zero existing `semester` values parse successfully (including an
empty `semesters` table), the system SHALL offer a minimal path to create
a first semester by choosing only a starting `semester` code — `school_year`
SHALL still be derived automatically from that choice, not independently
selected.

#### Scenario: Bootstrapping the first semester

- WHEN the `semesters` table is empty (or every existing value is
  unparseable)
- THEN the system SHALL present a `semester`-code-only selection, and SHALL
  compute and submit the corresponding `school_year` automatically once a
  code is chosen

### Requirement: A candidate semester code SHALL be validated for format before any other check

The system SHALL parse and validate the candidate `semester` code's format
before performing the duplicate check or the sequential-order check, and
SHALL reject an unparseable code in every path — including the
initial-semester (bootstrap) path, where there is no existing "latest"
semester to compare against. Format validation SHALL NOT be conditional on
whether an existing semester happens to parse successfully.

#### Scenario: A malformed candidate is rejected in the bootstrap path

- WHEN the `semesters` table is empty (or every existing value is
  unparseable), and a creation request submits a `semester` value that does
  not match the `YYA`/`YYB` or `YYYY-A`/`YYYY-B` format
- THEN the system SHALL reject the request with a clear error and SHALL NOT
  insert a new row, even though there is no latest semester to compute a
  successor from

#### Scenario: A malformed candidate is rejected even when a latest semester exists

- WHEN at least one existing semester parses successfully, and a creation
  request submits a `semester` value that does not match the supported
  format
- THEN the system SHALL reject the request for its invalid format — this
  check SHALL run before, and independently of, the sequential-order check

### Requirement: Duplicate and out-of-sequence semester codes SHALL be rejected at creation time

The system SHALL reject, at the service layer (not only in the UI), any
attempt to create a `semester` value that already exists, and — whenever at
least one existing semester parses successfully — any `semester` value
that is not exactly the computed next semester (per the automatic
computation requirement above). This validation SHALL apply regardless of
which UI path or caller submits the creation request. This SHALL include
rejecting an intentional historical backfill (a semester that should have
existed between two already-created ones) through this creation path —
such a correction, if ever needed, is out of scope for this requirement and
is handled outside normal semester creation (a direct database change, or a
future, separately-scoped capability that deliberately carves out an
exception).

#### Scenario: A duplicate semester code is rejected

- WHEN a creation request submits a `semester` value that already exists in
  the `semesters` table, compared by parsed canonical identity when the
  existing value parses successfully (e.g. `26A` and `2026-A` are the same
  semester and MUST both be treated as duplicates of each other), falling
  back to a case-insensitive, trimmed raw-string comparison only for an
  existing row whose value does not parse
- THEN the system SHALL reject the request with a clear error and SHALL NOT
  insert a new row

#### Scenario: A semantic duplicate across formats is rejected

- WHEN an existing semester's `semester` value is `2026-A` (legacy format)
  and a creation request submits `26A` (going-forward format) — the same
  calendar term written differently
- THEN the system SHALL reject the request as a duplicate, exactly as if
  the two values had been written identically

#### Scenario: A skipped-ahead semester code is rejected

- WHEN at least one existing semester parses successfully, and a creation
  request submits a `semester` value other than that latest semester's
  exact computed successor
- THEN the system SHALL reject the request with a clear error and SHALL NOT
  insert a new row

#### Scenario: The first semester is not subject to the sequential-order check

- WHEN zero existing semesters parse successfully
- THEN the system SHALL accept any well-formatted candidate `semester` code
  as the initial semester, without a "must match the next computed code"
  check (there being no latest semester to compute a successor from)

### Requirement: Schedules, groups, workers, and existing schedule assignment data SHALL be unaffected

This change SHALL NOT alter any file under `src/features/schedules/**`,
`src/pdf/**`, `src/features/groups/**`, `src/features/workers/**`, or any
`schedule_assignments`/`schedule_teachers` row, and SHALL NOT modify or
depend on `src/helpers/calculateSemesterGroup.ts`.

#### Scenario: Existing schedules module behavior is unchanged

- WHEN an admin views an existing semester's schedules at `/semesters/:id`
  after this change is implemented
- THEN `ScheduleDashboard.tsx` and every schedules-module component SHALL
  behave exactly as before this change, for the same underlying data

