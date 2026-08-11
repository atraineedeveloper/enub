# Design: durable worker document Storage reconciliation

## Current invariant

`worker_documents.storage_path` is the application reference to an object in the private `worker_documents` bucket. The current service layer deliberately deletes metadata first and then removes the object. Replacement deletes superseded metadata transactionally inside `replace_worker_document_metadata`, then removes old objects after commit.

This order is correct for user-visible consistency but cleanup is currently best-effort.

## Decision 1: transactional cleanup queue

Create `public.worker_document_storage_cleanup_queue` as an operational table with RLS enabled and no `anon`/`authenticated` policies or grants. Only `service_role` receives direct table access.

Each entry records the unique technical `storage_path`, `worker_id`, source document id, enqueue timestamp, retry count, controlled error code and resolution timestamp. No file contents or user-visible file names are copied into the queue.

## Decision 2: enqueue from an AFTER DELETE trigger

An `AFTER DELETE` trigger on `public.worker_documents` inserts the old path into the queue in the same transaction as the metadata deletion.

The trigger function is `SECURITY DEFINER` only because ordinary application roles have no direct queue privileges. It lives in a non-exposed `private` schema, has an empty `search_path`, and has EXECUTE revoked from `PUBLIC`, `anon` and `authenticated`.

This also covers replacement automatically: the existing replacement RPC deletes old rows inside its transaction. If the replacement insert later fails and the transaction rolls back, the queue insert rolls back too.

## Decision 3: keep immediate cleanup during rollout

The browser continues to call the Storage API directly after successful metadata deletion/replacement. This preserves current behavior if application deployment, Edge Function deployment and database migration do not occur simultaneously.

After that attempt, the client invokes the reconciliation Edge Function for the worker:

- if immediate cleanup already succeeded, the Edge Function observes that queued objects are absent and resolves their queue records;
- if immediate cleanup failed, the Edge Function retries server-side;
- if the Edge Function is unavailable after an already-successful immediate deletion, the user operation still counts as a clean success;
- if both immediate cleanup and reconciliation fail, the current non-fatal cleanup warning remains.

## Decision 4: privileged reconciliation is queue-driven

`reconcile-worker-document-storage` accepts only `{ workerId }`. The browser never supplies a Storage path or bucket name.

Authorization:

- `worker`: requested `workerId` must equal `current_worker_id()`;
- `staff`/`admin`: may reconcile the requested worker;
- any other/no role: denied.

After authorization, the service-role client loads only unresolved queue entries for that worker, oldest first, in a bounded batch. Privileged deletion authority therefore comes from a path already committed by the database trigger, never from arbitrary client input.

## Decision 5: re-check reference before deletion

For every queued entry, the Edge Function checks `worker_documents` again using service-role database access. If any current row references the path, the function MUST NOT delete the object. It records `path_still_referenced` and leaves the entry unresolved.

If the path is unreferenced:

1. call Storage `exists(path)`;
2. if absent, mark the queue entry resolved;
3. if present, call Storage `remove([path])`;
4. mark resolved only after a successful removal.

Storage objects are never deleted with SQL.

## Decision 6: controlled operational errors

Queue `last_error` stores stable codes such as `reference_check_failed`, `path_still_referenced`, `storage_exists_check_failed`, `storage_remove_failed` and `queue_update_failed`.

It does not persist raw provider error messages or file data. The API response returns counts only and never returns queued Storage paths.

## Decision 7: conservative user feedback

When browser cleanup failed, the UI removes its warning only if reconciliation reports a non-empty, finite pending batch with zero failures and zero reference conflicts. If the result is empty, failed, conflicting, or may be truncated at the batch limit, the warning remains.

When browser cleanup already succeeded, reconciliation is best-effort maintenance only; a reconciliation endpoint failure must not turn a completed deletion/replacement into a user-visible error.

## Decision 8: no whole-bucket destructive scan

A global `storage.objects` minus `worker_documents` comparison is useful as a read-only audit, but it is not an automatic deletion authority. This iteration does not mass-delete unreferenced objects because uploads can have transient states and historical objects may require investigation.

## Deployment order

1. Apply the database migration that creates the queue/trigger.
2. Deploy `reconcile-worker-document-storage` with JWT verification enabled.
3. Deploy the frontend integration.
4. Verify queue/trigger/security advisors and perform a controlled delete/replace test.

The retained immediate browser cleanup keeps intermediate deployment states backward compatible.

## Verification

- pgTAP catalog/security checks for queue RLS/grants, private trigger function and trigger attachment;
- frontend tests for reconciliation client/outcome handling;
- Deno/Edge Function validation where available;
- local Supabase lint/tests before production migration;
- after approved production rollout, security advisors and read-only Storage/reference counts.