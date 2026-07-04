# Tasks - worker-documents-ux-and-delete

Status: spec-only. No code has been written yet — every item below is unchecked.

## Phase 1: Data access — delete function

- [ ] Add `deleteWorkerDocument(documentId)` to `src/services/apiWorkerDocuments.js` (decisions.md #2, #3 — resolved). Exact required sequence:
  1. Fetch the `worker_documents` row by `id` first, to read its `storage_path` (RLS-gated, same as every other read on this table) — never accept a caller-supplied `storagePath`.
  2. Delete the `worker_documents` row (`.delete().eq("id", documentId)`).
  3. Only if step 2 succeeds, remove the storage object via the existing internal `removeWorkerDocumentFiles([storagePath])` helper.
- [ ] Row-delete failure (step 2): throw immediately, **do not attempt the storage delete at all**, storage untouched, existing document stays fully intact in the UI.
- [ ] Storage-delete failure (step 3, after a successful row delete): **do not reinsert the DB row.** Do not throw the same error a full failure would — the document is already correctly gone from the user's perspective and that stays true. Log the error (`console.error`) and let the caller show a distinct warning/error toast noting the file may still need cleanup (decisions.md #3).
- [ ] No `service_role`, no Supabase Admin API, no RLS bypass anywhere in this function — plain anon-key client under normal RLS, same as every other function in this file.

## Phase 2: `useDeleteWorkerDocument` hook

- [ ] Create `src/features/workers/documents/useDeleteWorkerDocument.js`, mirroring `useReplaceWorkerDocument.js`: `useMutation` wrapping `deleteWorkerDocument`, `react-hot-toast` success/error, `invalidateWorkerDocumentQueries(queryClient, workerId)` from the existing `workerDocumentKeys.js` helper on success.
- [ ] Success toast: confirms deletion in clear Spanish (e.g. "El documento se eliminó con éxito").
- [ ] Error toast: relays the thrown `Error`'s message, not a generic fallback.

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
