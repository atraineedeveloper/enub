## MODIFIED Requirements

### Requirement: Every active Docencia document type permits multiple files and remains semester-scoped

Every currently-active `Docencia` document type SHALL permit multiple
uploaded files per worker per semester, and SHALL remain scoped to the
semester-scoped `Docencia` category. This includes `Evidencias
bimestrales` (which already had this behavior before
`20260721010000_docencia_active_types_allow_multiple.sql`) and the 6
Docencia types that migration flips: `Planeación semestral`, `Rúbricas`,
`Listas de cotejo`, `Listas de asistencia`, `Actas de evaluación`, and
`Concentrado de calificaciones finales`. The 2 retired Docencia types
(`Plan de trabajo semestral`, `Planeaciones semanales`) are unaffected and
remain `allows_multiple = false`. No document type outside `Docencia` is
affected.

#### Scenario: Multiple files remain permitted for Evidencias bimestrales
- **WHEN** a worker or administrator uploads more than one file under
  `Evidencias bimestrales` for the same worker and semester
- **THEN** every uploaded file is retained, with no replacement or
  rejection

#### Scenario: Every other active Docencia type also permits multiple files
- **WHEN** a worker or administrator uploads a second and third file under
  any of `Planeación semestral`, `Rúbricas`, `Listas de cotejo`,
  `Listas de asistencia`, `Actas de evaluación`, or
  `Concentrado de calificaciones finales`, for the same worker and
  semester
- **THEN** every uploaded file is retained, with no replacement or
  rejection

#### Scenario: The 2 retired Docencia types are unaffected
- **WHEN** the migration has been applied
- **THEN** `Plan de trabajo semestral` and `Planeaciones semanales` still
  have `allows_multiple = false`

#### Scenario: No document type outside Docencia is affected
- **WHEN** the migration has been applied
- **THEN** every `Datos personales`, `Tutoría`, `Asesoría`, and
  `Investigación` document type's `allows_multiple` value is unchanged
  from what it was before the migration

#### Scenario: Semester scoping is unchanged
- **WHEN** a document is uploaded under any active Docencia document type
- **THEN** the upload requires a semester, exactly as before

#### Scenario: The replacement RPC continues to reject any newly-multi Docencia type
- **WHEN** `replace_worker_document_metadata` is called against one of the
  6 Docencia document types this migration flips to
  `allows_multiple = true`
- **THEN** the call is rejected with the RPC's existing, unmodified
  `allows_multiple` guard
- **THEN** `worker_documents` is left completely unchanged by the rejected
  call

## ADDED Requirements

### Requirement: The Docencia active-types migration fails safely on catalog drift, and is not designed to be re-run

The migration that sets `allows_multiple = true` for every active Docencia
document type SHALL explicitly verify, before making any change, that the
set of currently-active Docencia document type names matches exactly the
expected set of 7 names. If any expected name is missing, or any
unexpected name is present (a type renamed, added, retired, or
reactivated since the last verified catalog snapshot), the migration
SHALL fail with a controlled diagnostic naming the discrepancy, rather
than silently updating the wrong set of rows. After the update, the
migration SHALL verify that exactly 6 rows were changed by that same
statement and that neither retired Docencia type was touched, failing
safely if either check does not hold. This exact-count postcondition is a
deliberate guarantee that a specific state transition occurred, once — it
is NOT an idempotency guarantee, and the migration is explicitly not
designed to be safely re-run against an already-migrated catalog (see the
drift-scenario below): a second run against a catalog where all 7 active
Docencia types already have `allows_multiple = true` updates zero rows,
which fails the "exactly 6" postcondition and aborts with a controlled
exception, rather than completing as a silent no-op.

#### Scenario: A normal application against the expected catalog succeeds
- **WHEN** the migration runs against a catalog where the 7 active
  Docencia types exactly match the expected set
- **THEN** the migration completes, updating exactly the 6 types that were
  still `allows_multiple = false`

#### Scenario: A missing expected type fails safely
- **WHEN** the migration runs against a catalog where one of the 7
  expected active Docencia type names does not exist as an active type
- **THEN** the migration fails with a controlled diagnostic naming the
  missing type, and does not modify any row

#### Scenario: An unexpected active Docencia type fails safely
- **WHEN** the migration runs against a catalog containing an active
  Docencia document type not in the expected set of 7 (for example, a
  reactivated retired type, or a newly-added type)
- **THEN** the migration fails with a controlled diagnostic naming the
  unexpected type, and does not modify any row

#### Scenario: Re-running the migration against an already-migrated catalog fails closed, by design
- **WHEN** the migration runs again after having already succeeded once
  (every one of the 7 expected active Docencia types already has
  `allows_multiple = true`)
- **THEN** its `UPDATE ... WHERE allows_multiple = false` matches zero
  rows
- **THEN** the exact-row-count postcondition (expects exactly 6) fails,
  and the migration aborts with a controlled exception rather than
  completing as a no-op — this migration is not designed to be re-run
  against already-migrated state, and does not need to be, since Supabase
  migrations are each applied at most once per environment

#### Scenario: The migration cannot affect any category other than Docencia
- **WHEN** the migration runs
- **THEN** its `UPDATE` is scoped exclusively to the `category_id`
  resolved from the unique `Docencia` category name, making it
  structurally impossible for any other category's rows to be affected

### Requirement: Multi-file uploads are independent per-file operations, never a single cross-file transaction

Uploading multiple files to one document type in a single user action
SHALL be performed as N independent single-file operations (Storage
upload + metadata insert per file, reusing the existing single-file
upload function unchanged), executed sequentially, never as a single
cross-file database transaction and never via a batch RPC. A batch MAY
end in any mix of per-file outcomes — full success, full failure, or a
partial mix — and this outcome SHALL be reported to the user accurately,
never as a false claim of total success or total failure for a partial
result. A file that fails SHALL NOT prevent the remaining files in the
same batch from being attempted. The client SHALL refresh the worker's
document list exactly once after the whole batch settles, not once per
file.

#### Scenario: A batch where every file succeeds
- **WHEN** every file in a multi-file upload batch succeeds
- **THEN** the user sees a single success summary reflecting all files
- **THEN** the document list is refreshed exactly once

#### Scenario: A batch where every file fails
- **WHEN** every file in a multi-file upload batch fails
- **THEN** the user sees a single failure summary reflecting all files
- **THEN** no successful uploads are falsely implied

#### Scenario: A batch with a mixed outcome is never reported as a full success or full failure
- **WHEN** some files in a multi-file upload batch succeed and others fail
- **THEN** the summary explicitly states both the succeeded and failed
  counts
- **THEN** the summary is never phrased as if every file succeeded or as
  if every file failed

#### Scenario: A failed file does not stop the rest of the batch
- **WHEN** a file in the middle of a multi-file upload batch fails
- **THEN** every file after it in the batch is still attempted

#### Scenario: A double-submit while a batch is in flight is ignored
- **WHEN** the user triggers another upload for the same document type
  while a batch for that same document type is still in flight
- **THEN** the second trigger has no effect until the first batch settles

#### Scenario: An in-flight upload in the open requirement's drawer does not disable another requirement's row
- **WHEN** a multi-file upload batch is in flight in the currently open
  requirement's drawer
- **THEN** every other requirement row's action button on the same page
  remains enabled, since only one drawer can ever be open at a time and
  every other row's control is independent of the open drawer's state
