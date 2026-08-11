# Proposal: reconcile worker document storage

## Why

Worker-document deletion intentionally removes database metadata before deleting the Storage object. That avoids a visible broken database row if Storage cleanup fails, but a failed cleanup can leave an invisible orphaned object. Single-file replacement has the same best-effort cleanup risk for superseded objects.

A read-only production check on 11 August 2026 found the current bucket healthy: 54 Storage objects, 54 `worker_documents` rows, zero unreferenced objects and zero rows pointing to missing objects. This change is preventive: it makes future cleanup failures durable and recoverable instead of relying only on logs/toasts.

## What changes

- add a service-role-only cleanup queue that records a Storage path whenever `worker_documents` metadata is deleted;
- enqueue paths transactionally through an `AFTER DELETE` trigger, so replacement RPC rollbacks also roll back queue entries;
- preserve the existing immediate client-side Storage deletion for backward-compatible rollout and fast cleanup;
- add an authenticated Edge Function that retries only queued paths the caller is authorized to reconcile;
- verify each queued path is no longer referenced before any privileged Storage deletion;
- mark queue entries resolved when the object is already absent or removal succeeds;
- keep failed/conflicting entries durable for later retries without returning Storage paths to the UI;
- add regression coverage for queue access controls and trigger installation.

## Out of scope

- scanning the whole bucket and deleting every unreferenced object;
- deleting Storage metadata directly with SQL;
- automatic cleanup of untracked upload objects created before metadata insertion;
- retention-policy decisions or archival deletion schedules;
- scheduled Cron execution in this iteration.

## Impact

The normal worker/staff document UX remains unchanged. Successful immediate cleanup behaves as today. If cleanup fails, the system retains a server-side retry record and can reconcile it safely later. No existing document rows or Storage objects need to be changed by the migration itself.