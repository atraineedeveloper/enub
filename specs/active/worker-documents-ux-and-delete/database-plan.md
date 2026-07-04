# Database Plan - worker-documents-ux-and-delete

## Summary

**No migration is planned for this feature.** This document exists to record the verification that led to that conclusion, so it's checked and documented rather than assumed.

## 1. `public.worker_documents` already permits DELETE for both roles

Verified directly against the local database (`bunx supabase start`, then a direct query — read-only, no data changed):

```sql
select policyname, cmd, qual
from pg_policies
where tablename = 'worker_documents' and schemaname = 'public';
```

Result:

| policyname | cmd | qual |
|---|---|---|
| Staff and admin manage all worker documents | ALL | `current_app_role() = ANY (ARRAY['staff','admin'])` |
| Workers manage own worker documents | ALL | `worker_id = current_worker_id()` |

`cmd = ALL` means each policy covers `SELECT`, `INSERT`, `UPDATE`, and `DELETE` — not just the three operations this table currently uses from the frontend. A `DELETE ... WHERE id = :documentId` issued by:

- a `staff`/`admin` session — allowed, any worker's row (first policy).
- a `worker` session — allowed only where `worker_id = current_worker_id()` (second policy) — i.e. only their own documents, exactly matching the existing SELECT/INSERT behavior for that role.
- an unauthenticated or no-role session — denied, same as every other operation on this table (no policy matches).

This already matches this feature's exact requirement ("worker can delete only own documents," "staff/admin can delete any worker document") with zero new SQL.

## 2. `storage.objects` (bucket `worker_documents`) already permits DELETE for both roles

Verified the same way:

```sql
select policyname, cmd, qual
from pg_policies
where tablename = 'objects' and schemaname = 'storage';
```

Result (filtered to the two policies scoped to `bucket_id = 'worker_documents'`):

| policyname | cmd | qual |
|---|---|---|
| Staff and admin access worker documents bucket | ALL | `bucket_id = 'worker_documents' AND current_app_role() = ANY (ARRAY['staff','admin'])` |
| Workers access own worker documents bucket path | ALL | `bucket_id = 'worker_documents' AND (storage.foldername(name))[1] = current_worker_id()::text` |

Again `cmd = ALL` — `storage.objects` DELETE (i.e. `supabase.storage.from('worker_documents').remove([path])`) is already permitted under the same two conditions as every other storage operation on this bucket. The path-prefix check (`(storage.foldername(name))[1] = current_worker_id()`) is the same ownership mechanism already relied on for reads and uploads (see `worker-self-service-documents` decisions.md #14 — "storage bucket ownership via path prefix, not new metadata"); it applies unchanged to DELETE.

## 3. No new column, table, index, or function is needed

Deleting a document requires only data every existing read already returns: `worker_documents.id` (for the row delete) and `worker_documents.storage_path` (for the storage delete). Both are already selected by `getWorkerDocuments()`/`getWorkerDocumentsBySemester()` (`WORKER_DOCUMENT_SELECT = "*, ..."`). No new query, index, or RPC is required to support delete at the data layer — it is a pure frontend/service-layer addition (see `spec.md`'s Technical plan and `decisions.md` #2).

## 4. If verification during implementation finds a real gap

The above was confirmed against the current local schema and policy set at spec-writing time. If implementation-time verification (`verification-plan.md`) finds any of the above no longer holds — e.g. a policy was narrowed since this was written, or an edge case in `current_worker_id()`/`current_app_role()` behaves unexpectedly for DELETE specifically — that must be treated as a **real access issue** per the request's own instruction ("Do not modify RLS policies unless a real access issue appears"), documented here with the specific failure observed, and only then addressed with a minimal, targeted migration (never a broadened policy beyond what's needed, never a service-role bypass in the frontend).
