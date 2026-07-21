## ADDED Requirements

### Requirement: Asesoría's `Informes` and Tutoría's `Relación de estudiantes tutorados` are retired

`Asesoría / Informes` and `Tutoría / Relación de estudiantes tutorados`
SHALL be marked `is_active = false` (never deleted), exactly like
Docencia's own retired types (`Plan de trabajo semestral`, `Planeaciones
semanales`, see this capability's existing retirement requirement). Every
`worker_documents` row already referencing either type, and the type rows
themselves, SHALL remain intact and queryable.

#### Scenario: Both retired types are inactive, never deleted
- **WHEN** the migration has been applied
- **THEN** `Asesoría / Informes` and `Tutoría / Relación de estudiantes
  tutorados` both exist with `is_active = false`

#### Scenario: A historical document under a retired type is never orphaned
- **WHEN** a `worker_documents` row already references a now-retired type
- **THEN** that row remains a valid, joinable, non-orphaned reference
  after retirement

#### Scenario: New uploads against a retired type are still rejected
- **WHEN** a new document is uploaded against `Informes` or `Relación de
  estudiantes tutorados` after retirement
- **THEN** the upload is rejected by the existing, unmodified
  `enforce_active_worker_document_type` trigger (error code `WDT01`)

### Requirement: Asesoría's `Control de asesorías` and `Documentos de titulación` carry editorial descriptions

`Asesoría / Control de asesorías` SHALL have `description = 'Bitácoras'`
and `Asesoría / Documentos de titulación` SHALL have `description =
'Dictamen'`. Neither type's `is_active` or `allows_multiple` value SHALL
change.

#### Scenario: Both descriptions are set exactly as specified
- **WHEN** the migration has been applied
- **THEN** `Control de asesorías` has `description = 'Bitácoras'` and
  `Documentos de titulación` has `description = 'Dictamen'`

#### Scenario: Neither type's active/single-file status changes
- **WHEN** the migration has been applied
- **THEN** both types remain `is_active = true` and `allows_multiple =
  false`, exactly as before

### Requirement: Tutoría's `Plan de Trabajo` is a new, active, single-file requirement sorted first

`Tutoría / Plan de Trabajo` SHALL exist, `is_active = true`,
`allows_multiple = false`, scoped to the semester-scoped `Tutoría`
category. Its `sort_order` SHALL be strictly less than every other active
or inactive Tutoría document type's `sort_order`, so it is always the
first requirement shown for that category, with no sort-order ties
anywhere in the category as a result of adding it.

#### Scenario: Plan de Trabajo exists with the expected shape
- **WHEN** the migration has been applied
- **THEN** `Tutoría / Plan de Trabajo` exists, is active, and does not
  allow multiple files

#### Scenario: Plan de Trabajo sorts first, with no ties
- **WHEN** the migration has been applied
- **THEN** its `sort_order` is strictly less than every other Tutoría
  document type's `sort_order`, and no two Tutoría document types share a
  `sort_order`

### Requirement: The advising/tutoring catalog migration fails safely on catalog drift, and is not designed to be re-run

The migration that retires `Informes`/`Relación de estudiantes
tutorados`, sets the two Asesoría descriptions, and inserts `Plan de
Trabajo` SHALL verify, before making any change, that every row it
touches is in exactly the state expected before this migration has ever
run: the two types to retire must currently be active; the two types to
describe must currently have a `NULL` description; `Plan de Trabajo` must
not already exist. Any drift SHALL fail the migration closed with a
controlled diagnostic naming the discrepancy. This migration is explicitly
NOT designed to be safely re-run against an already-migrated catalog — a
second run fails at the first precondition that no longer holds, not as a
silent no-op.

#### Scenario: A normal application against the expected catalog succeeds
- **WHEN** the migration runs against a catalog matching every expected
  precondition
- **THEN** it completes, applying exactly the retirements, descriptions,
  and insertion described above

#### Scenario: Any missing or already-modified row fails safely
- **WHEN** the migration runs against a catalog where any expected type is
  missing, already retired, already has a description, or `Plan de
  Trabajo` already exists
- **THEN** the migration fails with a controlled diagnostic naming the
  discrepancy, and does not modify any row

#### Scenario: Re-running the migration against an already-migrated catalog fails closed, by design
- **WHEN** the migration runs again after having already succeeded once
- **THEN** it fails at the FIRST precondition actually reached in the
  migration's own program order — `Asesoría / Informes` no longer being
  active (checked before either description precondition) — with the
  corresponding diagnostic, not a later precondition and not a silent
  no-op; every row the migration would have touched (both retired types,
  both descriptions, `Plan de Trabajo`) remains byte-for-byte unchanged

#### Scenario: The migration cannot affect any category other than Asesoría/Tutoría
- **WHEN** the migration runs
- **THEN** every `UPDATE`/`INSERT` is scoped exclusively to ids resolved
  earlier in the same migration, making it structurally impossible for any
  other category's rows to be affected

### Requirement: Worker document types carry an optional editorial description

`worker_document_types` SHALL carry an optional `description` column
(`text NULL`). Wherever a requirement's name is shown to a worker or
administrator (the dashboard's compact row, and the detail drawer), its
`description`, when present, SHALL be shown as secondary text near the
name/title. It SHALL never be hardcoded by document-type name in the
client — only read from the type's own `description` field. When
`description` is `null` or an empty string, no placeholder, empty element,
or generic fallback phrase SHALL be rendered in its place. In the detail
drawer, this editorial description is distinct from, and SHALL coexist
with (never replace), the existing functional single-vs-multiple-file
hint text.

#### Scenario: A present description is shown near the requirement's name
- **WHEN** a document type has a non-empty `description`
- **THEN** it is shown as secondary text under its name in the compact
  row, and under its title in the detail drawer

#### Scenario: A null or empty description renders nothing extra
- **WHEN** a document type's `description` is `null` or `""`
- **THEN** no placeholder, empty element, or generic fallback text is
  rendered in either location

#### Scenario: The editorial description and the single/multiple-file hint coexist in the drawer
- **WHEN** a document type has both a non-empty `description` and is
  shown in the detail drawer
- **THEN** both the description and the existing "Se admite un
  archivo."/"Puedes adjuntar varios archivos." hint are shown, neither
  replacing the other

### Requirement: The dashboard's selected category persists by id across a semester change

The document dashboard's selected category tab SHALL be preserved by id
across a semester (academic period) change. The first category SHALL be
selected automatically only when there is no current selection, or when
the previously selected category no longer exists in the current catalog.
Changing the semester, a new reference for the catalog array, a refetch
starting or finishing, or the set of documents for the active category
changing SHALL NOT, by themselves, reset the selected category. A
semester change while the detail drawer is open SHALL be routed through
the existing close/navigate-away funnel (blocked during an active upload;
requires confirmation with a discardable pending selection; otherwise
proceeds and closes the drawer), after which the previously selected
category remains selected. The active status filter SHALL also persist
across a semester change (unaffected either way). This same persisted
selection SHALL be reflected identically by both the desktop category
tabs and the mobile category `<select>`, since both are driven by the
same underlying selection.

#### Scenario: Changing semester preserves the selected category
- **WHEN** a category is selected and the academic period changes
- **THEN** the same category remains selected once the new period's data
  is available

#### Scenario: A refetch with previously-cached data does not reset the selection
- **WHEN** the semester-scoped document query refetches for a period that
  already has cached data
- **THEN** the dashboard is not unmounted, and the selected category is
  unaffected

#### Scenario: The first category is selected only when there is truly nothing valid to keep
- **WHEN** no category has ever been explicitly selected, or the
  previously selected category no longer exists in the current catalog
- **THEN** the first category in the catalog is selected

#### Scenario: An open drawer with a pending selection blocks an immediate semester change
- **WHEN** the detail drawer is open with a discardable pending file
  selection and the semester is changed
- **THEN** the discard-confirmation dialog is shown instead of changing
  the semester immediately; confirming discard then changes the semester,
  closes the drawer, and preserves the selected category

#### Scenario: The status filter persists across a semester change
- **WHEN** a status filter (e.g. "Con archivos") is active and the
  semester changes
- **THEN** the same filter remains active afterward

#### Scenario: Desktop tabs and the mobile select agree
- **WHEN** the selected category is preserved across a semester change
- **THEN** both the desktop category tabs and the mobile category
  `<select>` reflect the same selected category

### Requirement: The dashboard is read-only while a semester change's data is still resolving

`placeholderData: keepPreviousData` means the dashboard keeps showing the
PREVIOUS semester's documents on screen while a new semester's request is
in flight, since react-query has no real data yet for the new query key
(`isPlaceholderData` is `true` for that exact window). This is NOT
presented as if it were the new period's real, actionable result: for the
entire duration that the displayed dataset may belong to the wrong
semester, the dashboard SHALL remain mounted (never replaced by a
full-page spinner, and never unmounted) but SHALL become fully read-only.
Specifically, while this window is active: no `DocumentDetailDrawer` SHALL
be opened; no upload, replace, or delete mutation SHALL be executed; no
new semester change SHALL be started until the current one resolves;
"Descargar reporte" SHALL be disabled; a visible "Actualizando periodo…"
indicator SHALL be shown; the dashboard's root element SHALL carry
`aria-busy="true"`. Rows remain visible as context (dimmed, not hidden)
but are not interactive. The selected category, active filter, and overall
page structure remain exactly as they were throughout. Once the new
period's real data arrives, every one of these restrictions is lifted in
the same update.

#### Scenario: The dashboard stays mounted and read-only while the new period's data is in flight
- **WHEN** the semester changes and the new period's document query has
  not yet resolved
- **THEN** the dashboard remains mounted, showing the previous period's
  documents as context, with `aria-busy="true"` and a visible "Actualizando
  periodo…" indicator

#### Scenario: No drawer can be opened during this window
- **WHEN** a row's action is triggered while the dashboard is in this
  read-only state
- **THEN** no `DocumentDetailDrawer` opens

#### Scenario: No mutation can be executed during this window
- **WHEN** the dashboard is in this read-only state
- **THEN** no upload, replace, or delete request is ever sent, since the
  drawer that would trigger one cannot be opened, and every other mutating
  control ("Descargar reporte", a new semester change) is disabled

#### Scenario: Every restriction lifts together once real data arrives
- **WHEN** the new period's document query resolves
- **THEN** the "Actualizando periodo…" indicator disappears,
  `aria-busy` becomes `"false"`, rows and "Descargar reporte" become
  interactive again, and the dashboard shows exactly the new period's
  documents (plus permanent-category documents), never a mix with the
  previous period's

### Requirement: The document progress summary reports only objective counts, never a percentage

The dashboard's document progress summary SHALL report only objective
counts: the total number of active requirements, how many have at least
one file, and how many are pending. It SHALL NOT compute or display a
completion percentage, a progress bar, or any equivalent expression (e.g.
"67% completado") — document requirements do not necessarily carry equal
weight, and no formal compliance rule exists for what a single percentage
would represent.

#### Scenario: The summary shows only the three objective counts
- **WHEN** at least one active requirement exists
- **THEN** the summary shows the total active, with-files, and pending
  counts, and nothing resembling a percentage or progress bar

#### Scenario: Zero active requirements shows a human message, never a percentage or 0/0
- **WHEN** there are zero active requirements configured
- **THEN** the summary shows "No hay requisitos activos configurados."
  and nothing else
