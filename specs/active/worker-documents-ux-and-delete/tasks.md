# Tasks - worker-documents-ux-and-delete

Status: Phase 1 and Phase 2 implemented and locally verified (service-level only — no UI wiring yet, out of scope for this pass). Phases 3–7 remain not started.

## Phase 1: Data access — delete function

- [x] Add `deleteWorkerDocument(documentId)` to `src/services/apiWorkerDocuments.js` (decisions.md #2, #3 — resolved). Exact sequence implemented:
  1. Fetch the `worker_documents` row by `id` first (new private helper `getWorkerDocumentForDelete`), to read its `storage_path` (RLS-gated, same as every other read on this table) — never accepts a caller-supplied `storagePath`.
  2. Delete the `worker_documents` row (`.delete().eq("id", documentId)`).
  3. Only if step 2 succeeds, remove the storage object via the existing internal `removeWorkerDocumentFiles([storagePath])` helper.
- [x] Row-fetch failure (step 1): throws a clear error (`"El documento no pudo cargarse"`) before any delete is attempted.
- [x] Row-delete failure (step 2): throws immediately (`"El documento no pudo eliminarse"`), **does not attempt the storage delete at all**, storage untouched, existing document stays fully intact.
- [x] Storage-delete failure (step 3, after a successful row delete): **does not reinsert the DB row.** Instead of throwing, returns `{ documentId, workerId, storageCleanupFailed: true }` so the caller (the hook) can distinguish this from both a plain success and a plain failure (decisions.md #3). Logs the error via `console.error`.
- [x] No `service_role`, no Supabase Admin API, no RLS bypass anywhere in this function — plain anon-key client under normal RLS, same as every other function in this file (confirmed by inspection and by live verification below).
- [x] **Local verification, live, service-level (REST/storage calls mirroring exactly what this function issues)**, against a freshly-reset local DB:
  - Owner (a real linked worker session) fetches, deletes the DB row, then removes the storage object for their own document — full success, confirmed both the row and the storage object are gone afterward.
  - A different worker (non-owner) cannot fetch the row (RLS returns zero rows — the exact condition that makes step 1 throw), cannot delete the row directly (zero rows affected, row confirmed still present afterward), and cannot remove the storage object directly (storage RLS returns `403 Access denied`) — all three independent layers hold.
  - Staff/admin (the seeded local admin) can fetch, delete the row, and remove the storage object for a **different** worker's document — full success.
  - Reproduced the genuine partial-failure case: deleted a `worker_documents` row whose storage object didn't actually exist (simulating "already gone") — confirmed Supabase Storage's `remove` call returns a real `404 Object not found` error in this situation (not a silent no-op), which is exactly the condition `deleteWorkerDocument`'s `try`/`catch` around `removeWorkerDocumentFiles` is built to catch and turn into `storageCleanupFailed: true` rather than a thrown error or a row reinsert.

## Phase 2: `useDeleteWorkerDocument` hook

- [x] Create `src/features/workers/documents/useDeleteWorkerDocument.js`, mirroring `useReplaceWorkerDocument.js`: `useMutation` wrapping `deleteWorkerDocument`, `invalidateWorkerDocumentQueries(queryClient, result.workerId)` from the existing `workerDocumentKeys.js` helper on success.
- [x] Success toast (full success, `storageCleanupFailed` falsy): `"El documento se eliminó con éxito"`.
- [x] Warning/error toast (`storageCleanupFailed: true`): a distinct message (`"El documento se eliminó del expediente, pero el archivo podría necesitar limpieza adicional; contacta a soporte si esto se repite"`), shown via `toast.error` — this codebase has no separate "warning" toast variant anywhere (checked), so `toast.error` is the closest existing convention that's still visibly distinct from the plain success toast.
- [x] Error toast (`onError`, e.g. fetch or row-delete failure): relays the thrown `Error`'s message, not a generic fallback.
- [x] Exported from `src/features/workers/documents/index.js`, alongside the other document hooks.

## Phase 3: Styled file picker

- [ ] In `WorkerDocumentsView.jsx`, replace the raw `<input type="file">` for each pending document with the `HiddenInput`-plus-styled-trigger pattern already established in `CreateEditWorkerForm.jsx` (decisions.md #1) — no new dependency.
- [ ] Show the selected file's name next to the trigger once chosen, before the upload action runs.
- [ ] Preserve existing accept/type/size validation behavior unchanged (`ACCEPTED_DOCUMENT_TYPES`, existing size/format checks in `apiWorkerDocuments.js` — not touched by this phase).

## Phase 4: Delete UI wiring

- [ ] Add an "Eliminar" action (icon + `ButtonIcon`/`Button`, following the existing Ver/Descargar/Reemplazar action styling) for:
  - Single-file document types that currently have a file.
  - Each individual file listed under a multi-file ("Evidencias") document type.
- [ ] Wire "Eliminar" through `Modal.Open`/`Modal.Window` + the existing `ConfirmDelete.jsx` (decisions.md #4), passing the specific document type's label (and, for multi-file, the specific file name) as `resourceName`.
- [ ] On confirm, call `useDeleteWorkerDocument`'s mutation with the correct `documentId` for that row/file (the mutation/service function resolves `storage_path` itself — see Phase 1).
- [ ] Disable the confirm/cancel buttons in `ConfirmDelete` while the delete mutation is pending (existing `disabled` prop on that component already supports this).
- [ ] After a successful single-file delete, confirm the row visually reverts to "Pendiente" with the styled file picker showing again (Phase 3), without a full page reload (React Query cache invalidation from Phase 2 should already produce this).

## Phase 5: Cross-route consistency check

- [ ] Manually confirm every behavior from Phases 3–4 at both `/workers/:id/documents` (staff/admin) and `/my-documents` (worker), since both render the same `WorkerDocumentsView.jsx` — no route-specific branching should be needed or added.
- [ ] Confirm the existing report-download (`generateWorkerDocumentReportPdf`) and semester-selector behavior is unaffected by the changes in this phase (regression check, not a new feature).
- [ ] Confirm deleting the last file of a multi-file ("Evidencias") type leaves it showing the exact same empty/pending presentation as a type that never had a file, with the upload control still present (decisions.md #8, resolved) — at both routes.

## Phase 6: Documentation update

**`docs/ai/architecture.md`** (confirmed stale — see `decisions.md` #7) — add/refresh, at minimum:

- [ ] **Routing**: the full current route list, including `/my-documents`, `/pending-access`, `/set-password`, `/workers/:id/documents`, and the `RoleGate`/`WorkerAppLayout` split between staff and worker layouts — not just the pre-`worker-self-service-documents` staff-only route list currently there.
- [ ] **Worker self-service**: a short summary of the `/my-documents` flow and how `workerId` is resolved from the session, not the URL.
- [ ] **Profiles/roles model**: the `profiles` table, the `admin`/`staff`/`worker`/no-row states, and the deny-by-default principle (cross-reference `worker-self-service-documents/decisions.md` #7 rather than duplicating its full reasoning).
- [ ] **Staff/admin/worker routing**: how `RoleGate` and the two layout components (`AppLayout` vs. `WorkerAppLayout`) split staff/admin from worker sessions.
- [ ] **Edge Functions**: both `create-worker-account` and `resend-worker-access-link` — one paragraph each, what they do and why they're separate (cross-reference `worker-self-service-documents/decisions.md` #21, #30).
- [ ] **Email templates**: `supabase/templates/invite.html`/`recovery.html` and that they're configured via `supabase/config.toml`'s `[auth.email.template.*]`.
- [ ] **Document module**: `WorkerDocumentsView.jsx` as the shared component behind both document routes, and — new in this feature — the upload/replace/delete behavior, including the delete-ordering rule from `decisions.md` #3.
- [ ] **RLS as enforcement boundary**: an explicit statement that RLS (not UI hiding) is what actually enforces who can read/write/delete what, across `workers`, `profiles`, and `worker_documents`/storage — stated plainly, not just implied by scattered examples.
- [ ] Fix the existing stale note at the bottom of `architecture.md` about `VITE_SUPABASE_ANON_KEY` vs `VITE_SUPABASE_KEY` while in the area, if still inaccurate at implementation time (unrelated pre-existing inconsistency, cheap to fix while updating this file — confirm first rather than assuming).

**`README.md`** — add a short, product-level addition (decisions.md #7), matching the existing bullet style/depth, with **no implementation details** (no table/column/file names, no RLS, no Edge Function names):

- [ ] A short mention that workers can log in and manage their own document expediente (self-service access).
- [ ] A short mention of worker document upload/replace/delete.
- [ ] A short mention of admin account provisioning by invitation.

**`AGENTS.md`** — conditional only:

- [ ] Leave unchanged unless implementation reveals a currently-listed instruction, command, or architecture statement that is now factually wrong — if so, fix only that specific stale statement, and note what was fixed and why in this file's own history (commit message), not by expanding `AGENTS.md`'s scope.

## Phase 7: Verification

See `verification-plan.md` for the full script.

- [ ] `bun run lint` — zero new issues in touched files.
- [ ] `bun run build` — passes.
- [ ] Manual verification at both routes, all three mutations (upload, replace, delete), both document shapes (single-file, multi-file).
- [ ] Confirm no `service_role`/Admin API usage introduced in `src/`.
- [ ] Confirm no RLS/migration change was made (or, if one was, that it's documented in `database-plan.md` with the specific gap found).
- [ ] Confirm `docs/ai/architecture.md` and `README.md` were both updated per Phase 6, and `AGENTS.md` was left untouched (or, if touched, that the change is limited to a specific now-incorrect statement, with the reason noted).
