## ADDED Requirements

### Requirement: Worker document types carry an explicit lifecycle flag
`worker_document_types` SHALL have a column `is_active boolean NOT NULL DEFAULT true`. Every pre-existing row, across every category, SHALL become `is_active = true` when the column is added, with no manual backfill required.

#### Scenario: Column default applies to all pre-existing rows
- **WHEN** the `is_active` column is added to `worker_document_types`
- **THEN** every row that existed before the column was added has `is_active = true`

#### Scenario: New document types default to active
- **WHEN** a new row is inserted into `worker_document_types` without specifying `is_active`
- **THEN** the row's `is_active` value is `true`

### Requirement: Docencia's `Plan de trabajo semestral` and `Planeaciones semanales` are retired
The `Docencia` category's `Plan de trabajo semestral` and `Planeaciones semanales` document types SHALL be marked `is_active = false`. No other document type, in any category, SHALL be affected by this retirement.

#### Scenario: Both named Docencia types become inactive
- **WHEN** the retirement migration has been applied
- **THEN** `Docencia / Plan de trabajo semestral` has `is_active = false`
- **THEN** `Docencia / Planeaciones semanales` has `is_active = false`

#### Scenario: Identically-named types in other categories are unaffected
- **WHEN** the retirement migration has been applied
- **THEN** every document type outside `Docencia` remains `is_active = true`, including any type whose name happens to match a retired or renamed Docencia type

### Requirement: Docencia's `Evidencias` is renamed to `Evidencias bimestrales` in place, with its exact row identity preserved
The `Docencia` category's `Evidencias` document type SHALL be renamed to `Evidencias bimestrales`. Its row `id`, `allows_multiple` value, `sort_order` value, and `category_id` SHALL be unchanged by the rename. This is a label and requirement-name change only — no bimonthly-period entity, per-bimester upload slot, deadline, or reporting concept is introduced. Identity preservation SHALL be proven by capturing the row's own primary key value and comparing it before and after the rename — never inferred from its category, sort order, or `allows_multiple` value alone, since any of those could coincidentally match a different row, and never asserted against a hard-coded literal id, since the identity-generating sequence's assigned values are specific to a given database's own history and are not guaranteed to be the same across environments.

#### Scenario: Rename preserves row identity and configuration
- **WHEN** the rename migration has been applied
- **THEN** the row previously named `Docencia / Evidencias` now has `name = 'Evidencias bimestrales'`
- **THEN** that row's `id` is identical to the `id` captured for that same row before the rename was applied (a live before/after comparison, never a hard-coded literal, and never re-derived from category, sort order, or `allows_multiple`)
- **THEN** that row's `allows_multiple` value is still `true`
- **THEN** that row's `sort_order` value is unchanged

#### Scenario: Identically-named Evidencias-style types in other categories are unaffected
- **WHEN** the rename migration has been applied
- **THEN** `Asesoría / Evidencias` still has `name = 'Evidencias'`
- **THEN** `Tutoría / Evidencias de actividades` still has `name = 'Evidencias de actividades'`

### Requirement: Existing worker documents and storage objects are never deleted or orphaned by a catalog change
Retiring or renaming a `worker_document_types` row SHALL NOT delete, modify, or invalidate any `worker_documents` row or storage object that references it. Every `worker_documents.document_type_id` foreign key that was valid before a catalog change SHALL remain valid after it.

#### Scenario: Historical documents under a retired type remain intact
- **WHEN** a document type is marked inactive
- **THEN** every `worker_documents` row referencing that type's `id` still exists, unchanged
- **THEN** every storage object those rows reference is still retrievable

#### Scenario: Historical documents under a renamed type remain intact
- **WHEN** a document type is renamed
- **THEN** every `worker_documents` row referencing that type's `id` still exists, unchanged, still referencing the same `id`

### Requirement: The service layer verifies a document type is active before any storage upload
Both the upload and the replacement flows SHALL load the target document type and verify `is_active = true` before uploading any new storage object. If the type is inactive, the operation SHALL fail immediately with a controlled, user-facing error, SHALL NOT upload a new storage object, SHALL NOT insert new metadata, and SHALL NOT delete any existing metadata or storage object. This preflight is a fast, ordinary-path check; it does not replace the database-layer enforcement below, which remains the final authority for a genuine race between this check and the actual write.

#### Scenario: Upload against an inactive type fails before any storage mutation
- **WHEN** an upload is attempted against a document type whose `is_active` is `false`
- **THEN** the attempt fails immediately with a controlled error
- **THEN** no storage object is uploaded

#### Scenario: Replacement against an inactive type fails before any storage mutation
- **WHEN** a replacement is attempted against a document type whose `is_active` is `false`
- **THEN** the attempt fails immediately with a controlled error
- **THEN** no new storage object is uploaded
- **THEN** the existing document's metadata and storage object are untouched

#### Scenario: An ordinary upload retired between the preflight and the database write receives the same controlled message
- **WHEN** an upload's own preflight sees the type active, but the type is retired before the metadata insert reaches the database, and the database rejects the insert with the stable lifecycle error code
- **THEN** the newly uploaded storage object is cleaned up
- **THEN** the caller receives the documented controlled Spanish message, not a generic "could not be saved" message and never the raw database error

### Requirement: A failed replacement never loses the previous document's metadata or file
The replacement operation MAY delete the previous metadata row before inserting the replacement row, but only as one step inside a single atomic database transaction (see the atomic transactional replacement requirement below). If the replacement is rejected for any reason — including when a document type is retired in the narrow window between the service-layer preflight and the RPC's own transaction, an insert failure, or a row-level-security rejection — the entire transaction, including any deletion already performed inside it, SHALL roll back automatically, leaving the previous metadata row and its storage object exactly as they were. The newly-uploaded storage object (if any) SHALL be cleaned up by the client. No partial replacement — a state where neither the old nor the new metadata is durably present — SHALL ever occur or be reported as a success.

#### Scenario: Retirement between preflight and replacement leaves the old document intact
- **WHEN** a document type is retired after a replacement's own preflight check passes but before its database transaction begins
- **THEN** the newly-uploaded storage object is removed by the client
- **THEN** the previous metadata row still exists, unchanged, because the transaction that would have replaced it never committed
- **THEN** the previous storage object still exists, unchanged
- **THEN** the operation is reported as a failure, never a partial success

#### Scenario: A successful replacement removes the old storage object only after the new metadata is committed
- **WHEN** a replacement against an active document type succeeds
- **THEN** the new metadata row exists and references the new storage object
- **THEN** the previous storage object is removed only after the new metadata is durably committed, not before

### Requirement: Document replacement is performed atomically inside one database transaction
The replacement operation SHALL be implemented as a single database RPC that, inside one transaction: validates its input; loads and locks the target document type; verifies it is active; loads and locks the existing metadata row(s) for the target worker/type/semester; verifies the type does not allow multiple files; deletes the superseded metadata row(s); and inserts the replacement metadata row. If the type does not exist, is inactive, the insert is rejected by the existing single-file integrity trigger, the insert is rejected by row-level security, or any other database error occurs at any step, the entire transaction SHALL roll back, restoring the superseded metadata row(s) exactly as they existed before the call. The RPC SHALL NOT disable, bypass, or weaken the existing single-file integrity trigger under any circumstance.

#### Scenario: A successful replacement deletes superseded metadata and inserts replacement metadata in one transaction
- **WHEN** a replacement against an active, single-file document type succeeds
- **THEN** the superseded metadata row no longer exists
- **THEN** the replacement metadata row exists, referencing the new storage object
- **THEN** exactly one metadata row exists for that worker, document type, and semester

#### Scenario: An insert failure rolls back an already-performed delete
- **WHEN** the replacement RPC's insert step fails for any reason after it has already deleted the superseded metadata row within the same call
- **THEN** the entire transaction rolls back
- **THEN** the superseded metadata row exists exactly as it did before the call
- **THEN** no replacement metadata row is created

#### Scenario: An inactive-type rejection rolls back an already-performed delete
- **WHEN** the replacement RPC detects that the target document type is inactive after it has already deleted the superseded metadata row within the same call
- **THEN** the entire transaction rolls back
- **THEN** the superseded metadata row exists exactly as it did before the call

#### Scenario: A row-level-security rejection rolls back an already-performed delete
- **WHEN** the replacement RPC's insert step is rejected by row-level security after it has already deleted the superseded metadata row within the same call
- **THEN** the entire transaction rolls back
- **THEN** the superseded metadata row exists exactly as it did before the call

#### Scenario: The existing single-file integrity trigger remains enabled throughout
- **WHEN** the replacement RPC executes
- **THEN** the existing single-file integrity trigger on `worker_documents` is neither disabled, bypassed, nor session-suppressed at any point during the call

### Requirement: Storage objects follow the replacement transaction's outcome
The client replacement flow SHALL upload the new storage object before calling the replacement RPC, and SHALL remove old storage object(s) — using the RPC's own returned old storage paths — only after the RPC's transaction has committed successfully. If the RPC call fails for any reason, the client SHALL remove only the newly uploaded storage object, leaving the previous metadata and previous storage object completely untouched. If removing the old storage object(s) fails after a successful replacement commit, the client SHALL NOT roll back or delete the new metadata; it SHALL surface a distinguishable, non-fatal `storageCleanupFailed` signal on its result (matching this codebase's existing `deleteWorkerDocument` convention) — a plain `console.error` alone is not sufficient, since it gives the caller and the UI no way to distinguish a fully-clean success from one needing manual follow-up.

#### Scenario: A failed RPC call removes only the newly uploaded object
- **WHEN** the replacement RPC call fails for any reason
- **THEN** only the newly uploaded storage object is removed
- **THEN** the previous metadata row and previous storage object remain untouched

#### Scenario: Old storage cleanup happens only after a successful commit
- **WHEN** the replacement RPC call succeeds
- **THEN** the client removes the old storage object(s) using the RPC's returned old storage paths, only after the RPC call has returned successfully

#### Scenario: A post-commit storage cleanup failure does not undo a successful replacement, and is surfaced as a distinguishable warning
- **WHEN** the replacement RPC call succeeds but removing the old storage object(s) afterward fails
- **THEN** the new metadata and new storage object are not rolled back or deleted
- **THEN** the result carries `storageCleanupFailed: true`
- **THEN** the UI shows a distinguishable, non-fatal warning rather than the plain success message
- **THEN** the successful replacement stands, with orphan storage cleanup treated as a separate concern

### Requirement: The replacement RPC's own return value is authoritative; no separate post-commit fetch determines success
`replace_worker_document_metadata` SHALL return the complete newly inserted metadata row (every column the client needs) via `INSERT ... RETURNING`, in the same call that performs the insert. The client SHALL build its result directly from this returned row and SHALL NOT perform a separate fetch of the new row to determine whether the replacement succeeded. A failure that occurs only after the database transaction has already committed (for example, while removing the old storage object) SHALL NOT be reported as an ordinary replacement failure, SHALL NOT imply that the previous metadata was preserved, and SHALL be distinguished from a genuine pre-commit replacement failure.

#### Scenario: A successful call requires no separate fetch to know what was inserted
- **WHEN** the replacement RPC call succeeds
- **THEN** the client already has the complete new metadata row from the RPC's own return value
- **THEN** no additional read of `worker_documents` is performed to learn the new row's data

#### Scenario: A post-commit failure is never reported as an ordinary replacement failure
- **WHEN** the replacement RPC call succeeds but a step after commit (such as old-storage cleanup) fails
- **THEN** the caller does not receive a generic "replacement failed" result
- **THEN** the committed replacement is treated as authoritative and successful
- **THEN** the previous metadata is never implied to still be the current metadata

### Requirement: A concurrent retirement racing a replacement is handled safely
If a document type is retired by a separate, already-committed transaction after a client's own preflight check passed but before the replacement RPC's own transaction begins, the replacement RPC SHALL detect the now-inactive type and fail, its transaction SHALL leave the previous metadata completely untouched, and the client SHALL remove only the newly uploaded storage object while the previous metadata and previous storage object remain usable.

#### Scenario: Retirement committed before the replacement RPC begins is detected and rejected safely
- **WHEN** the client's preflight sees the type active, the client uploads the new storage object, a separate transaction retires the type and commits, and only then does the client call the replacement RPC
- **THEN** the replacement RPC detects the inactive type and fails
- **THEN** the replacement RPC's transaction leaves the previous metadata row completely untouched
- **THEN** the client removes only the newly uploaded storage object
- **THEN** the previous metadata row and previous storage object remain usable

### Requirement: A single shared advisory-lock namespace serializes retirement against replacement and upload
Retirement (the retirement/rename migration), the lifecycle trigger, and the replacement RPC SHALL all acquire one transaction-level advisory lock, keyed identically by document type id, before reading or writing that type's `is_active` value. Whichever side acquires the lock first for a given document type SHALL complete before the other side's conflicting read or write proceeds. This lock SHALL be transaction-scoped (released automatically at commit or rollback), never session-scoped, and SHALL grant no authorization and imply no row lock — it exists solely to serialize operations against each other.

#### Scenario: Replacement or upload wins the lock
- **WHEN** a replacement or upload transaction acquires the lifecycle lock for a document type before a concurrent retirement transaction does
- **THEN** the replacement or upload proceeds and may complete using the still-active type
- **THEN** the retirement transaction's own conflicting write waits until the replacement or upload transaction ends
- **THEN** the retirement is applied only after the document mutation has already been serialized ahead of it

#### Scenario: Retirement wins the lock
- **WHEN** a retirement transaction acquires the lifecycle lock for a document type before a concurrent replacement or upload transaction does
- **THEN** the replacement or upload waits until the retirement transaction commits
- **THEN** the replacement or upload then reads the now-committed `is_active = false` value and fails with the documented stable error
- **THEN** no previous metadata is lost, and the client removes only its own newly uploaded storage object

#### Scenario: Real cross-connection blocking is demonstrated, not merely assumed
- **WHEN** two independent database connections attempt a retirement and a replacement against the same document type at overlapping times
- **THEN** one connection's operation measurably waits (blocks) for the other to finish, with the wait duration consistent with the lock actually being held, not merely a coincidental ordering

### Requirement: Replacement preserves existing row-level security, with rollback applied uniformly regardless of rejection cause
The replacement RPC SHALL run under the calling client's own privileges, never elevated, so that administrator/staff replacement, a worker's replacement of their own document, and rejection of another worker's replacement attempt are all governed by the existing ownership-aware row-level security policies, unchanged. A transaction rolled back because of a row-level-security rejection SHALL restore the previous metadata exactly as it was, identically to a rollback caused by any other rejection.

#### Scenario: Administrator or staff replacement continues to succeed
- **WHEN** an administrator or staff session calls the replacement RPC for any worker's document
- **THEN** the replacement succeeds, governed by the existing staff/admin row-level security policy

#### Scenario: A worker can replace only their own document
- **WHEN** a worker session calls the replacement RPC for a document belonging to their own `worker_id`
- **THEN** the replacement succeeds, governed by the existing worker-ownership row-level security policy

#### Scenario: A worker cannot replace another worker's document
- **WHEN** a worker session calls the replacement RPC targeting a different worker's `worker_id`
- **THEN** the call is rejected
- **THEN** the target worker's previous metadata row remains completely unchanged

### Requirement: Deletion of superseded data is scoped precisely to a successful, committed replacement
Catalog retirement and rename migrations SHALL NOT delete any document type, worker-document metadata row, or storage object. A failed replacement attempt SHALL NOT delete previous metadata or the previous storage object; it MAY remove only the newly uploaded, uncommitted replacement storage object. A successful replacement MAY intentionally delete the superseded metadata row(s) as part of its own committed transaction, and MAY remove the superseded storage object(s) after that commit succeeds. These three cases SHALL be distinguished explicitly and SHALL NOT be collapsed into a single blanket "nothing is ever deleted" claim.

#### Scenario: Catalog migration never deletes
- **WHEN** the retirement/rename migration is applied
- **THEN** no document type, `worker_documents` row, or storage object is deleted

#### Scenario: A failed replacement never deletes previous data
- **WHEN** a replacement attempt fails
- **THEN** the previous metadata row and previous storage object are not deleted
- **THEN** at most the newly uploaded, uncommitted replacement storage object is removed

#### Scenario: A successful replacement intentionally deletes superseded data
- **WHEN** a replacement attempt succeeds
- **THEN** the superseded metadata row is deleted as part of the committed transaction
- **THEN** the superseded storage object is removed only after that commit succeeds

### Requirement: The database rejects new documents against an inactive type, without blocking unrelated edits to existing historical rows
The database SHALL reject any `INSERT` into `worker_documents` whose `document_type_id` refers to a document type with `is_active = false`, regardless of what the requesting client believes the catalog looks like. The database SHALL reject an `UPDATE` only when it changes `document_type_id` to a value whose `is_active` is `false`. The database SHALL NOT reject an `UPDATE` that leaves `document_type_id` unchanged, even when the referenced type is inactive — such an update is an edit to an already-accepted historical document, not a new document being accepted against a retired type. This enforcement SHALL NOT depend on frontend or service-layer behavior alone.

#### Scenario: Direct insert against an inactive type is rejected
- **WHEN** an `INSERT` into `worker_documents` targets a `document_type_id` whose `is_active` is `false`
- **THEN** the database rejects the insert with the documented stable error
- **THEN** no `worker_documents` row is created

#### Scenario: An update that changes to an inactive type is rejected
- **WHEN** an `UPDATE` on an existing `worker_documents` row changes `document_type_id` to a value whose `is_active` is `false`
- **THEN** the database rejects the update with the documented stable error

#### Scenario: An unrelated update to a historical row under an inactive type is allowed
- **WHEN** an `UPDATE` on an existing `worker_documents` row leaves `document_type_id` unchanged, and that type's `is_active` is `false`
- **THEN** the update succeeds, subject to every other existing constraint and trigger

#### Scenario: A stale client's cached catalog cannot bypass enforcement
- **WHEN** a client that loaded the catalog before a type was retired attempts to upload against that type's `document_type_id`
- **THEN** the attempt is rejected at the database layer, independent of what the client's own cached state shows

#### Scenario: Insert against a nonexistent document type is still rejected
- **WHEN** an `INSERT` into `worker_documents` targets a `document_type_id` that does not exist in `worker_document_types`
- **THEN** the database rejects the insert with an explicit error

#### Scenario: Insert against an active document type still succeeds
- **WHEN** an `INSERT` into `worker_documents` targets a `document_type_id` whose `is_active` is `true`
- **THEN** the insert succeeds, subject to every other existing constraint and trigger

### Requirement: The lifecycle trigger is not an authorization boundary and does not weaken existing ownership-aware access control
`worker_documents` SHALL continue to be governed by its existing ownership-aware row-level security: staff and admin sessions may act on any row; a worker session may act only on rows matching its own `worker_id`. The lifecycle trigger added by this change SHALL NOT grant, restrict, or otherwise alter who may attempt an operation — it SHALL only determine whether a given document type currently accepts new documents. Historical `SELECT` and `DELETE` on a document whose type is now inactive SHALL remain governed solely by the existing ownership-aware policies, unaffected by the type's `is_active` value.

#### Scenario: Existing ownership authorization is unchanged for active types
- **WHEN** a worker session attempts to insert a `worker_documents` row for their own `worker_id` against an active type
- **THEN** the insert succeeds, exactly as it did before this change

#### Scenario: Historical SELECT and DELETE on an inactive-type document remain governed by existing RLS alone
- **WHEN** a worker session reads or deletes their own `worker_documents` row whose type is now inactive
- **THEN** the operation succeeds or fails according to the existing ownership-aware policy alone, with no additional restriction introduced by the lifecycle trigger

### Requirement: A stable, documented error contract for inactive-type mutation attempts
Rejection of a mutation against an inactive document type SHALL use a specific, documented, stable PostgreSQL error code distinct from every other trigger's own error code on `worker_documents`. The service layer SHALL map that code to a single controlled, Spanish, user-facing message, and SHALL NOT expose the underlying trigger name, function name, or raw SQL error detail to the browser under any circumstance.

#### Scenario: The stable code is used for the inactive-type rejection
- **WHEN** the database rejects a mutation because the referenced document type is inactive
- **THEN** the error carries the documented stable code, distinct from the codes raised by the pre-existing scope and single-file triggers

#### Scenario: The frontend maps the stable code to a controlled message
- **WHEN** the service layer receives the documented stable code from either the trigger directly or the replacement RPC
- **THEN** it surfaces a single controlled Spanish message to the caller
- **THEN** no internal trigger name, function name, or raw SQL detail reaches the browser

### Requirement: Upload interfaces include a document type for a given worker only when it is active, or that same worker already has documents under it
A document-type row SHALL be included in a given worker's document view if, and only if, that type is active, or that same worker has at least one `worker_documents` row referencing it. A worker's own historical documents under an inactive type SHALL NEVER cause that type to appear for any other worker. This rule applies identically to the administrator worker-document view, the worker self-service document view, and any PDF or report consumer that independently derives document-requirement status from the same catalog.

#### Scenario: Inactive type with no documents for this worker is hidden
- **WHEN** viewing a worker's documents and a Docencia document type is inactive and that worker has no documents under it
- **THEN** that document type's row does not appear in the view

#### Scenario: Inactive type with existing documents for this worker remains visible, upload disabled, never Pendiente
- **WHEN** viewing a worker's documents and a Docencia document type is inactive but that worker has at least one existing document under it
- **THEN** that document type's row appears, showing the existing document(s)
- **THEN** no upload or replace control is offered for that row
- **THEN** the row's status is never rendered as "Pendiente"
- **THEN** existing file actions (view, download, delete) behave exactly as current authorization already permits

#### Scenario: One worker's historical documents do not cause an inactive type to appear for a different worker
- **WHEN** Worker A has an existing document under an inactive type and Worker B has none under that same type
- **THEN** that document type's row appears when viewing Worker A's documents
- **THEN** that document type's row does not appear when viewing Worker B's documents

#### Scenario: Active type always appears
- **WHEN** viewing a worker's documents and a document type is active
- **THEN** that document type's row appears, with its upload or replace control available, regardless of whether the worker has existing documents under it

#### Scenario: Administrator and worker self-service views apply the same rule
- **WHEN** the same worker's documents are viewed by an administrator and by the worker themselves
- **THEN** both views apply the identical active/historical inclusion rule for every document type

#### Scenario: A report consumer applies the identical rule
- **WHEN** a document-requirement report is generated for a worker with historical documents under an inactive type
- **THEN** that type appears in the report reflecting its existing documents, never as "Pendiente"
- **WHEN** the same report is generated for a different worker with no documents under that inactive type
- **THEN** that type does not appear in that worker's report at all

### Requirement: Evidencias bimestrales retains its existing multi-file and semester-scoped behavior
`Evidencias bimestrales` SHALL continue to permit multiple uploaded files per worker per semester, and SHALL remain scoped to the semester-scoped `Docencia` category, exactly as `Evidencias` did before the rename.

#### Scenario: Multiple files remain permitted
- **WHEN** a worker or administrator uploads more than one file under `Evidencias bimestrales` for the same worker and semester
- **THEN** every uploaded file is retained, with no replacement or rejection

#### Scenario: Semester scoping is unchanged
- **WHEN** a document is uploaded under `Evidencias bimestrales`
- **THEN** the upload requires a semester, exactly as any other `Docencia` document type does

### Requirement: The retirement/rename migration fails safely on an inconsistent catalog state
The migration that retires `Plan de trabajo semestral`/`Planeaciones semanales` and renames `Evidencias` SHALL explicitly inspect the catalog's actual name state under Docencia *before* attempting the rename, rather than relying on an incidental constraint-violation error to catch an ambiguous state. It SHALL require exactly one valid final row for each intended target, and SHALL fail with a controlled diagnostic rather than silently succeeding when the catalog is not in an expected state. It SHALL NEVER silently create a replacement `Evidencias`-named row, and SHALL NEVER mutate any document type outside `Docencia`. The final renamed row SHALL be verified to have `is_active = true`, `allows_multiple = true`, and its expected sort order, in addition to being the sole such row.

#### Scenario: First application succeeds
- **WHEN** the migration runs against a catalog where only `Evidencias` exists under Docencia
- **THEN** the migration completes, leaving exactly one `Evidencias bimestrales` row and zero `Evidencias` rows under Docencia
- **THEN** that row has `is_active = true`, `allows_multiple = true`, and its expected sort order

#### Scenario: Idempotent re-run succeeds
- **WHEN** the migration runs again against a catalog where only `Evidencias bimestrales` already exists under Docencia
- **THEN** the migration completes without error, leaving the catalog unchanged

#### Scenario: Neither name existing fails safely
- **WHEN** the migration runs against a catalog where neither `Evidencias` nor `Evidencias bimestrales` exists under Docencia
- **THEN** the migration fails with a controlled diagnostic, raised by the migration's own explicit preflight inspection, and does not silently succeed

#### Scenario: Both names existing simultaneously fails safely with a controlled diagnostic
- **WHEN** the migration runs against a catalog where both `Evidencias` and `Evidencias bimestrales` already exist under Docencia
- **THEN** the migration's own explicit preflight inspection detects both names before attempting any `UPDATE`
- **THEN** the migration fails with a controlled, actionable diagnostic naming both conflicting rows, rather than surfacing an incidental unique-constraint-violation error

#### Scenario: A missing retired row fails safely
- **WHEN** either `Plan de trabajo semestral` or `Planeaciones semanales` does not exist under Docencia at all
- **THEN** the migration fails with a controlled diagnostic rather than silently succeeding having deactivated nothing

#### Scenario: Both retired rows exist exactly once and are confirmed inactive
- **WHEN** the migration has been applied
- **THEN** `Plan de trabajo semestral` and `Planeaciones semanales` each exist exactly once under Docencia and are confirmed `is_active = false`

### Requirement: Migrations are applied only through the standard, ordered CLI workflow, never as isolated historical files
The already-applied seed migration SHALL NOT be edited. Migrations SHALL be applied only through the project's standard tooling (`supabase db reset`, `supabase migration up`, `supabase db push`), which always applies every migration file in full timestamp order. Manually re-executing a single historical migration file's SQL in isolation against an already-migrated database is unsupported and is documented as such, since the seed migration's `ON CONFLICT (category_id, name)` insert would not match a since-renamed row and would insert a duplicate, active `Evidencias`-named row instead of updating the existing one. A normal, full reset SHALL always end in the single intended final catalog state.

#### Scenario: A normal full reset always ends in the intended final state
- **WHEN** the full migration history is applied in order, from scratch (a normal `supabase db reset`)
- **THEN** exactly one `Docencia` row exists named `Evidencias bimestrales`, and no row is named `Evidencias` under Docencia

### Requirement: The existing-data preflight query reports every expected type, whether it exists or not
The read-only preflight query SHALL return exactly one row for each of `Plan de trabajo semestral`, `Planeaciones semanales`, `Evidencias`, and `Evidencias bimestrales`, regardless of whether that type currently exists, including an existence indicator, its row ID when it exists, its active state when it exists, its current document count, its category, its `allows_multiple` value, and its `sort_order`. It SHALL NOT omit a missing expected type silently.

#### Scenario: A missing expected type still produces a row
- **WHEN** the preflight query runs against a catalog where one of the four expected type names does not yet exist
- **THEN** the query still returns a row for that name, with its existence indicator showing false and its other fields null

#### Scenario: An existing expected type reports its full state
- **WHEN** the preflight query runs against a catalog where an expected type name exists
- **THEN** the query returns that type's ID, active state, document count, category, `allows_multiple`, and `sort_order`

### Requirement: Storage object keys use a conservative, portable filename segment, independent of the user-visible file name
Uploading or replacing a worker document SHALL derive its Storage object key from a sanitized filename segment that contains only ASCII letters, digits, hyphens, underscores, and a single normalized extension separator — accented or otherwise non-ASCII Unicode characters SHALL be normalized and stripped (or, where that is not possible, removed) rather than passed through to the Storage key. `worker_documents.file_name` SHALL continue to store the original, unmodified file name the user supplied, independent of the sanitized Storage key. A file name that sanitizes to an empty segment SHALL fall back to a fixed default basename rather than producing an invalid or empty key segment.

#### Scenario: An accented file name produces a valid Storage key instead of an InvalidKey error
- **WHEN** a worker or administrator uploads a file whose name contains accented Unicode characters (for example, `Curso de Maestría en Comunicación.pdf`)
- **THEN** the resulting Storage object key contains only ASCII letters, digits, hyphens, underscores, and one extension separator
- **THEN** the upload succeeds rather than being rejected by Storage with an `InvalidKey` error

#### Scenario: The database file name is never altered by Storage-key sanitization
- **WHEN** a worker document is uploaded or replaced, regardless of what its Storage key sanitizes to
- **THEN** `worker_documents.file_name` exactly matches the original file name the user selected
- **THEN** the sanitized form is used only to build the Storage object key, never stored as `file_name` and never used for MIME-type detection

#### Scenario: Directory traversal and path-hierarchy characters cannot influence the Storage key's folder structure
- **WHEN** a file name contains `..`, `/`, or `\` sequences
- **THEN** the resulting Storage object key's folder structure is determined solely by the worker id, document type id, and semester scope — never by any character from the file name

#### Scenario: A file name that sanitizes to nothing still produces a valid key
- **WHEN** a file name consists only of characters that are not ASCII letters, digits, hyphens, or underscores
- **THEN** the sanitized segment falls back to a fixed default basename rather than an empty or invalid Storage key segment
