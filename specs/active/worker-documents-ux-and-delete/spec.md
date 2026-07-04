# Feature Spec: worker-documents-ux-and-delete

## Status

Draft — spec only, no code implemented yet.

## User request

Improve the UI/UX of the worker document upload/replace/view/download flow (currently a raw native file input and large per-row buttons), and add safe deletion of an uploaded document, which does not exist today.

## Problem

The document module built by `worker-document-uploads` and made self-service by `worker-self-service-documents` works, but:

- Every document row shows a raw browser "Choose File" input plus separate "Subir archivo"/"Reemplazar" buttons — no visual polish, no selected-filename feedback before upload, inconsistent affordance between "pending" and "uploaded" states.
- There is no way to delete an uploaded document. The only way to replace a single-file document is the existing "Reemplazar"/upload-over flow; there is no way to remove one file from a multi-file ("Evidencias") document type, or to clear a single-file type back to "Pendiente" without immediately uploading a replacement.
- This gap exists in both places that render this UI: `/workers/:id/documents` (staff/admin) and `/my-documents` (worker self-service), since both reuse the same `WorkerDocumentsView.jsx`.

## Scope

- Redesign the upload/replace/view/download controls in `WorkerDocumentsView.jsx` for both pending and uploaded states, using existing UI primitives (`Button`, `ButtonIcon`, `Modal`, styled-components) — no new dependency.
- Replace the raw native file input's default appearance with a styled trigger (label/button) over a visually-hidden `<input type="file">`, following the exact pattern already used for `profile_picture` in `CreateEditWorkerForm.jsx` (`HiddenInput` + a styled clickable trigger). Show the selected file's name before the upload/replace action runs.
- Add a "Delete" action per uploaded document:
  - Single-file document type: removes the one document; the row reverts to "Pendiente".
  - Multi-file ("Evidencias"/`allows_multiple`) document type: removes only the selected file; the rest remain.
- Add a confirmation step before deletion, reusing the existing `src/ui/ConfirmDelete.jsx` component and the existing `Modal` compound pattern already used elsewhere in this app (e.g. `WorkerRow.jsx`'s `Modal.Open`/`Modal.Window`).
- Add/confirm loading states for upload, replace, and delete (disable the relevant control and show a spinner state while its own mutation is pending — mirroring the existing `isUploading`/`isReplacing` pattern).
- Add/confirm success and error toasts for delete, matching the existing `react-hot-toast` pattern already used for upload/replace.
- A small, additive API/data-access change: a new `deleteWorkerDocument(documentId)` function in `src/services/apiWorkerDocuments.js` (fetches the row for its `storage_path`, deletes the DB row first, then removes the storage object — see decisions.md #3 for the exact required order and partial-failure handling) and a matching `useDeleteWorkerDocument.js` hook — no schema change (see `database-plan.md`, RLS already permits this).
- Update `docs/ai/architecture.md` (currently stale — predates the entire `worker-self-service-documents` feature: no mention of `/my-documents`, `/pending-access`, `/set-password`, `RoleGate`, the `profiles` role model, the two Edge Functions, or the document module) to describe, at minimum: app routes, the worker self-service flow, the profiles/roles model, both Edge Functions, the document module (including the new delete capability), account provisioning, the local email templates, and RLS as the actual enforcement boundary. See `decisions.md` #7 and `tasks.md`'s documentation phase for the exact section list.
- Update `README.md` with a short, product-level (not implementation-level) mention of worker self-service access, worker document upload/replace/delete, and admin account provisioning by invitation — matching the existing bullet style/depth already used there for other features. See `decisions.md` #7.

## Out of scope

- Any change to `worker_documents`/`worker_document_types`/`worker_document_categories` schema, or to `link_worker_account`/`grant_staff_role`/`unlink_worker_account`, or to either Edge Function (`create-worker-account`, `resend-worker-access-link`).
- Any change to RLS policies — confirmed unnecessary; see `database-plan.md`.
- Bulk/multi-select delete, drag-and-drop upload, upload progress percentage, client-side image compression, or any other upload-experience feature beyond what's listed in Scope.
- Soft-delete / recycle bin / undo for deleted documents — deletion is immediate and permanent, matching the existing "replace" flow's behavior (which already permanently deletes the old file).
- Changing who can delete what — access stays exactly what RLS already allows today (own documents for a worker, any worker's documents for staff/admin).
- Adding a package/dependency for file-picker UI (e.g. `react-dropzone`) — the existing hidden-input-plus-styled-label pattern already used in `CreateEditWorkerForm.jsx` is reused instead.

## Current behavior

- `WorkerDocumentsView.jsx` renders one table per document category. Each row is a document type with: status ("Pendiente"/"Cargado"), a raw `<input type="file">` (browser-default "Choose File" button, no styling, no filename shown outside the browser's own input chrom), and a "Subir archivo"/"Reemplazar archivo" button (label differs by whether a document already exists) that calls `useUploadWorkerDocument`/`useReplaceWorkerDocument`.
- Multi-file ("Evidencias") types render every uploaded file with view/download actions but no per-file delete.
- There is no delete action anywhere in this view, for any document type.
- `apiWorkerDocuments.js` has an internal (non-exported) `removeWorkerDocumentFiles(storagePaths)` helper already used by `replaceWorkerDocument()` to clean up the old storage object after a successful replace — the storage-deletion mechanics already exist and are reused, not reinvented, for the new delete function.

## Desired behavior

- Pending document (no file yet): a styled "Seleccionar archivo" trigger, the chosen file's name shown once selected, then an "Subir archivo" action — same two-step shape as today (select, then confirm-upload), just visually improved.
- Uploaded document (single-file type): "Ver"/"Descargar" (existing), "Reemplazar" (existing, restyled), and a new "Eliminar" action. Confirming delete removes the file and row; the type reverts to "Pendiente".
- Uploaded document (multi-file type): each listed file gets its own "Ver"/"Descargar"/"Eliminar" — deleting one file leaves the others in place. If the last file for that type is deleted, the type shows the exact same empty/pending state used before any file was ever uploaded for it — no special "all evidence deleted" message — and the add/upload control remains visible and functional (decisions.md #8, resolved).
- All three mutating actions (upload, replace, delete) show a clear loading state on their own control (not a page-wide spinner) and a specific, clear success or error toast.
- Deleting always requires an explicit confirm step (modal), naming the document being deleted.
- Behavior is identical whether reached via `/workers/:id/documents` (staff/admin) or `/my-documents` (the worker's own documents) — both render the same `WorkerDocumentsView.jsx`, parametrized only by `workerId` (see `worker-self-service-documents` decisions.md #10).

## UX/UI requirements

- Affected routes: `/workers/:id/documents`, `/my-documents` (same component, `WorkerDocumentsView.jsx`).
- Components: `WorkerDocumentsView.jsx` (modified), a new small presentational piece for the styled file-picker trigger (likely inline in the same file, following the `HiddenInput` pattern — no new file unless the component grows large enough to warrant extraction), `ConfirmDelete.jsx` (reused as-is via `Modal.Open`/`Modal.Window`), `ButtonIcon.jsx`/`Button.jsx` (reused as-is).
- Empty states: unchanged — "Pendiente"/"Sin archivo cargado" copy stays as today.
- Loading states: per-row/per-file button-level pending state (disable + spinner), not a full-page spinner, for upload/replace/delete alike.
- Error states: `react-hot-toast` error toast with the thrown `Error`'s message (existing convention); no raw stack traces, no silent failures.
- Responsive behavior: must not regress the existing table's `@media (max-width: 700px)` stacking behavior already in `PageHeader`/related styled-components.
- Dark mode behavior: must use existing CSS custom properties (`--color-grey-*`, `--color-brand-*`, `--color-red-*` for the delete/danger action) — no hardcoded colors, consistent with the rest of the file.

## Data requirements

- Supabase tables: `worker_documents` only (no schema change). Reads/writes already fully described in `worker-self-service-documents`/`worker-document-uploads`'s specs; this feature adds one new write path (DELETE) using an access pattern (`.eq("id", ...)` under RLS) that mirrors the existing DELETE already used inside `replaceWorkerDocument()`.
- Fields: no new fields. Delete needs `id` (to delete the row) and `storage_path` (to delete the storage object). `deleteWorkerDocument(documentId)` takes only the `id` and fetches the row itself to read `storage_path` — it does not accept a caller-supplied `storagePath` (decisions.md #3).
- Reads: **new, small** — one row fetch by `id` at the start of `deleteWorkerDocument`, to get `storage_path` before deleting anything.
- Inserts: none.
- Updates: none.
- Deletes: **new**, in this exact order (decisions.md #3): `public.worker_documents` (one row, via `supabase.from('worker_documents').delete().eq('id', documentId)`) **first**; then, only if that succeeds, `storage.objects` (one object, via `supabase.storage.from('worker_documents').remove([storagePath])`, reusing the existing internal `removeWorkerDocumentFiles()` helper). If the row delete fails, the storage delete is never attempted. If the storage delete fails after a successful row delete, the row is not reinserted.
- Required validations: confirm the row being deleted actually belongs to the resolved `workerId` context before calling delete (defense-in-depth in the UI layer; RLS is still the real boundary — see `database-plan.md`). Confirm-before-delete is mandatory in the UI (no delete without the confirmation modal).

## Technical plan

- Files to create:
  - `src/features/workers/documents/useDeleteWorkerDocument.js` — mutation hook, mirrors `useReplaceWorkerDocument.js`.
- Files to modify:
  - `src/services/apiWorkerDocuments.js` — add exported `deleteWorkerDocument(documentId)` (fetch row → delete row → delete storage object, in that order, per decisions.md #3), reusing the existing internal `removeWorkerDocumentFiles()` helper for the storage side.
  - `src/features/workers/documents/WorkerDocumentsView.jsx` — styled file-picker trigger + selected-filename display; new "Eliminar" action per document (single-file and per-file for multi-file types), wired through `Modal.Open`/`Modal.Window` + `ConfirmDelete.jsx`; loading-state wiring for the new mutation; plain empty/pending state when a multi-file type reaches zero files (decisions.md #8).
  - `docs/ai/architecture.md` — documentation update (see `decisions.md` #7 and `tasks.md`'s dedicated phase for the exact section list).
  - `README.md` — short product-level feature mention (see `decisions.md` #7).
- Existing patterns to follow:
  - `HiddenInput` (visually-hidden native file input + styled trigger) from `CreateEditWorkerForm.jsx`.
  - `useReplaceWorkerDocument.js` / `workerDocumentKeys.js`'s `invalidateWorkerDocumentQueries()` for the new hook's query invalidation.
  - `ConfirmDelete.jsx` + `Modal.Open`/`Modal.Window` for the confirmation step (already used for other destructive actions in this app).
  - `react-hot-toast` success/error convention already used by every other mutation hook in this feature area.

## Acceptance criteria

- [ ] The file input for a pending document is a styled trigger, not the browser's raw default control.
- [ ] The selected file's name is visible before the upload action runs.
- [ ] An uploaded single-file document shows Ver/Descargar/Reemplazar/Eliminar; confirming Eliminar removes the file and reverts the type to "Pendiente".
- [ ] An uploaded multi-file ("Evidencias") document shows Ver/Descargar/Eliminar per file; deleting one file leaves the others untouched.
- [ ] Deleting the last remaining file of a multi-file type shows the exact same empty/pending state as before any file was uploaded, with the upload control still visible — no special "all deleted" message (decisions.md #8).
- [ ] Deleting always requires confirmation via `ConfirmDelete.jsx` naming the specific document/file.
- [ ] `deleteWorkerDocument(documentId)` fetches the row first, deletes the DB row before the storage object, never attempts the storage delete if the row delete failed, and never reinserts the row if the storage delete fails afterward — instead showing a distinct warning/error toast (decisions.md #3).
- [ ] Upload, replace, and delete each show their own loading state and their own success/error toast.
- [ ] A worker can delete only their own documents; a staff/admin can delete any worker's documents — both enforced by existing RLS, not new UI logic (UI hiding, if any, is convenience only).
- [ ] Behavior is identical at `/workers/:id/documents` and `/my-documents`.
- [ ] No RLS policy is modified. No migration is added unless a real gap is found during implementation (none expected — see `database-plan.md`).
- [ ] No `service_role` key and no Supabase Admin API call appear anywhere in `src/`.
- [ ] `docs/ai/architecture.md` is updated to reflect current routes (`/my-documents`, `/set-password`, `/pending-access`), the profiles/roles model, staff/admin/worker routing, both Edge Functions, email templates, the document module (incl. delete), and RLS as the enforcement boundary.
- [ ] `README.md` is updated with a short, product-level mention of worker self-service access, document upload/replace/delete, and admin account provisioning by invitation — no implementation details.
- [ ] `AGENTS.md` is left unchanged unless implementation reveals one of its existing instructions is now factually incorrect.

## Verification plan

See `verification-plan.md` for the full manual verification script (this project has no automated test runner yet — every check here is manual, per `AGENTS.md`).

- [ ] Run lint.
- [ ] Run build.
- [ ] Manually verify `/workers/:id/documents` (staff/admin) — full delete/upload/replace loop.
- [ ] Manually verify `/my-documents` (worker) — full delete/upload/replace loop, confirm a worker cannot delete another worker's document via a direct console call.
- [ ] Verify loading/error/empty states for all three mutations.
- [ ] Verify Supabase behavior: `worker_documents` row deleted before the storage object; storage object actually removed on a normal successful delete; if the row delete is made to fail, confirm the storage object is untouched and nothing was attempted against it; if the storage delete is made to fail after a successful row delete, confirm the row is not reinserted and a distinct warning/error toast appears (decisions.md #3, the resolved ordering decision).

## Risks

- Auth/RLS: none expected — deletion reuses the same `cmd = ALL` policies already governing every other operation on `worker_documents` and the `worker_documents` storage bucket (confirmed in `database-plan.md`); if verification finds a real gap, it must be documented and fixed via a proper migration, not worked around in the UI.
- Data consistency: a delete that removes the storage object but fails to remove the DB row (or vice versa) would leave an inconsistent state. `decisions.md` fixes the exact order and what happens on partial failure.
- UI regression: touching `WorkerDocumentsView.jsx` risks the existing upload/replace/report-download flows, which are already implemented and verified in `worker-self-service-documents`. Verification must re-check those flows, not just the new delete action.
- PWA/offline: none expected — no new caching/offline behavior introduced; storage/API calls behave the same online-only way they already do.
