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

- [x] In `WorkerDocumentsView.jsx`, replaced the raw visible `<input type="file">` for each document type with a visually-hidden `HiddenFileInput` (`display: none`, real and fully functional, unchanged `onChange`/`accept`/`disabled` wiring) plus a styled "Seleccionar archivo" trigger — the existing `Button` component with `variation="secondary"` `size="small"`, reused as-is rather than introducing new button styling. Triggered via a per-document-type ref map (`fileInputRefs`, a `useRef({})` keyed by `documentType.id`) and `.click()`, the same ref-plus-click technique `CreateEditWorkerForm.jsx` already uses for `profile_picture` (decisions.md #1) — no new dependency, no second file-picker pattern introduced.
- [x] Shows the selected file's name next to the trigger once chosen (`selectedFile.name`); shows **"Ningún archivo seleccionado"** when nothing is selected yet (previously showed nothing in that state — new, explicit copy per the request's UX requirements).
- [x] Preserved existing accept/type/size validation behavior unchanged (`ACCEPTED_DOCUMENT_TYPES`, existing size/format checks in `apiWorkerDocuments.js` — not touched). The existing `fileInputVersions`-keyed remount trick (used to reset the native input's uncontrolled value after a successful upload/replace) composes unchanged with the now-hidden input.
- [x] No layout rewrite: the existing two-column `UploadArea` grid (file controls | action button) is unchanged; only the file-input control inside it was replaced. Ver/Descargar/Reemplazar/Eliminar action positions and labels are all unchanged from Phase 4.
- [x] **Local verification, live** (Playwright, scratch-directory-only, against a freshly-reset local DB and Vite dev server), full checklist:
  1. Selected a file for a pending document — confirmed the selected file's name appeared next to the trigger.
  2. Uploaded the pending single-file document — succeeded, hint reverted to "Ningún archivo seleccionado" afterward.
  3. Selected a new file and replaced the now-uploaded single-file document — succeeded, new filename shown.
  4. Added two evidence files to a multi-file ("Evidencias") type via the same styled picker — both listed.
  5. Confirmed Ver (opened a new tab), Descargar, and Eliminar (with confirmation) all still work — deleting one evidence file left the other intact.
  6. Confirmed no raw "Choose File"/"No file chosen" text appears anywhere on the page (checked via full page text content).
  7. Confirmed both `/my-documents` (worker) and `/workers/:id/documents` (admin) render the styled picker correctly, with the same "Seleccionar archivo" triggers present on the admin route too.
  - Screenshots captured for the file-selected state, the post-upload state, and the post-replace state — all show styled "SELECCIONAR ARCHIVO" buttons with "Ningún archivo seleccionado"/filename text, no native file-input chrome anywhere.
- [x] `bun run build` passes; `bun run lint` introduces no new errors in any touched file (304-problem baseline unchanged).

## Phase 4: Delete UI wiring

- [x] Add an "Eliminar" action (`DangerFileLink`, a small red-colored extension of the existing `FileLink` styled-component, with `HiTrash`, following the existing Ver/Descargar action styling/placement) for:
  - Single-file document types that currently have a file.
  - Each individual file listed under a multi-file ("Evidencias") document type.
- [x] Wire "Eliminar" through `Modal.Open`/`Modal.Window` + the existing `ConfirmDelete.jsx` (decisions.md #4), naming the specific document's `file_name` as `resourceName` (e.g. "Eliminar test-doc.pdf") — one `Modal.Open`/`Modal.Window` pair per document/file, keyed by `delete-worker-document-${document.id}`, all sharing a single `<Modal>` provider now wrapping the view's outer `<Row>`.
- [x] On confirm, calls `useDeleteWorkerDocument`'s mutation with the correct `documentId` for that row/file (the mutation/service function resolves `storage_path` itself — see Phase 1).
- [x] The confirm/cancel buttons in `ConfirmDelete` are disabled while the delete mutation is pending (existing `disabled` prop on that component), and the "Eliminar" trigger itself is also disabled while `isDeleting` — no double-submission.
- [x] After a successful single-file delete, the row visually reverts to "Pendiente" with the existing (still-unstyled, Phase 3 not done in this pass) raw file input showing again, without a full page reload — this falls out of the existing reactive rendering (`uploaded = existingDocuments.length > 0`, derived from the same React Query cache Phase 2's `invalidateWorkerDocumentQueries` refreshes) with no extra code needed.
- [x] Multi-file behavior needed no special-case code either, for the same reason: deleting one evidence file simply removes it from the invalidated/refetched list, leaving the others untouched; deleting the last one drops `existingDocuments.length` to zero, which already renders the pre-existing "Sin archivo cargado" empty state (decisions.md #8) with the upload control unconditionally still present.
- [x] **Local verification, live** (Playwright, scratch-directory-only, against a freshly-reset local DB and Vite dev server), full checklist:
  1. Uploaded a single-file document ("Acta de nacimiento") as a linked worker at `/my-documents`.
  2. Deleted it via Eliminar → confirm modal ("Eliminar test-doc.pdf") → success toast.
  3. Row reverted to "Pendiente".
  4. Uploaded two evidence files to a multi-file ("Evidencias") type.
  5. Deleted one evidence file.
  6. Confirmed the other evidence file remained listed, still viewable/downloadable.
  7. Deleted the last remaining evidence file.
  8. Confirmed the type showed the plain empty/pending state ("Sin archivo cargado") with the upload control still present — no special "all deleted" state.
  9. Confirmed the worker could delete their own documents throughout (steps 1–8, all as the linked worker session).
  10. Logged in as the seeded local admin, opened `/workers/1/documents`, uploaded and then successfully deleted a document belonging to that worker — confirmed staff/admin deletion still works.
  - Screenshots captured for the confirm modal, the two-evidence-file state, and the reverted-to-empty state.

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
