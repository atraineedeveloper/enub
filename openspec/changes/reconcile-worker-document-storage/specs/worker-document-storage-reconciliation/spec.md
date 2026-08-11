# Worker document Storage reconciliation

## Requirement: metadata deletion creates a durable cleanup obligation

Whenever a `worker_documents` row is successfully deleted, the system MUST enqueue its previous `storage_path` for reconciliation in the same database transaction.

### Scenario: standalone metadata delete commits

- GIVEN a worker document row with a Storage path
- WHEN the row deletion commits
- THEN one unresolved cleanup entry exists for that path.

### Scenario: replacement transaction rolls back

- GIVEN replacement deletes old metadata and then fails before commit
- WHEN PostgreSQL rolls the replacement transaction back
- THEN the old metadata remains
- AND no committed cleanup obligation exists for that rolled-back deletion.

## Requirement: the cleanup queue is not a client data surface

The cleanup queue MUST have RLS enabled and MUST NOT grant direct table access to `anon` or `authenticated`.

Only server-side service-role processing may read or mutate queue entries directly.

## Requirement: reconciliation never deletes a referenced object

Before a queued object is deleted from Storage, the reconciler MUST verify that no current `worker_documents` row references that exact path.

### Scenario: path became referenced

- GIVEN an unresolved queued path
- AND a current metadata row references the same path
- WHEN reconciliation runs
- THEN the Storage object is not deleted
- AND the queue entry remains unresolved with a controlled conflict code.

## Requirement: privileged deletion authority comes only from the queue

The Edge Function MUST require an authenticated request and MUST accept only a worker identifier from the client, never a Storage path or bucket name.

A worker MAY reconcile only the queue belonging to their own `current_worker_id()`. Staff and admin MAY reconcile the requested worker. The function MUST load deletion candidates from unresolved server-only queue entries after authorization.

## Requirement: Storage deletion uses the Storage API

The reconciler MUST use Supabase Storage APIs to check/delete objects and MUST NOT delete rows from `storage.objects` directly.

### Scenario: object already absent

- GIVEN an authorized unresolved queue entry
- AND no current metadata references its path
- AND Storage reports the object does not exist
- WHEN reconciliation runs
- THEN the queue entry is marked resolved without an object deletion attempt.

### Scenario: object exists and removal succeeds

- GIVEN an authorized unresolved queue entry
- AND no current metadata references its path
- AND Storage reports the object exists
- WHEN Storage removal succeeds
- THEN the queue entry is marked resolved.

### Scenario: Storage removal fails

- GIVEN an authorized unresolved queue entry
- AND no current metadata references its path
- WHEN Storage removal fails
- THEN the queue entry remains unresolved
- AND retry metadata is updated with a controlled error code.

## Requirement: current UX remains backward compatible

The frontend MUST preserve its current immediate Storage cleanup attempt after delete/replace. Reconciliation is an additional durable retry/acknowledgement layer.

If immediate cleanup succeeds, a reconciliation service failure MUST NOT turn the completed user operation into a cleanup warning.

If immediate cleanup fails, the warning MAY be cleared only when the server reconciliation result proves that a non-empty finite pending batch was completed with zero failures and zero reference conflicts. Otherwise the existing non-fatal cleanup warning MUST remain.