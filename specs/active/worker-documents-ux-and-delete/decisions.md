# Decisions - worker-documents-ux-and-delete

## 1. Reuse the existing hidden-input-plus-styled-trigger pattern, no new dependency

`src/features/workers/CreateEditWorkerForm.jsx` already solves "replace the raw file input" for `profile_picture`: a visually-hidden `<input type="file">` (`const HiddenInput = styled.input\`display: none;\`;`) paired with a styled, clickable trigger (a `<label htmlFor="...">` or button that forwards the click to the hidden input via a ref), plus local state for the selected file's name shown next to the trigger.

`WorkerDocumentsView.jsx` adopts the identical pattern for each document type's file input, rather than adding a file-picker library (e.g. `react-dropzone`, `react-uploady`). Reason: the project already has a working, accessible, dependency-free solution for exactly this problem one file away; introducing a library for the same outcome would violate `AGENTS.md`'s "do not add dependencies without explicit approval" for no real benefit, and would produce two different file-picker implementations in the same codebase.

## 2. Delete is a new, additive function — not a repurposed "replace"

`replaceWorkerDocument()` already deletes the old file as a side effect of uploading a new one. Delete-without-replacing is a distinct user intent (the worker/admin does not have — or does not want to provide — a new file right now) and needs its own function, `deleteWorkerDocument(documentId)`, rather than calling `replaceWorkerDocument` with no file (which the function doesn't support and shouldn't be bent to support — its whole signature assumes a `file`). The function takes only `documentId` — see decision #3 for why it fetches the row itself rather than accepting a caller-supplied `storagePath`.

Reason this shape specifically: mirrors `replaceWorkerDocument`'s existing internal call to `removeWorkerDocumentFiles([storagePath])` for the storage side, and a plain `.delete().eq("id", documentId)` for the row side — both mechanisms already exist and are already exercised by the replace path; nothing new is invented at the Supabase-call level, only a new exported entry point that calls them in the right order for a standalone delete (see decision #3 for the order).

## 3. RESOLVED: delete order is DB-row-first, then storage — with an explicit fetch step and no reinsert on failure

**Previously an open question; now decided.** Unlike `replaceWorkerDocument` (which uploads the *new* file first, so a failure leaves the old file intact and nothing is lost), a standalone delete has no "new file" to protect — the only question was which of the two deletes (row, storage object) happens first, and what happens if the second one fails.

**Decision: delete the `worker_documents` row first, then remove the storage object.**

Exact required shape of `deleteWorkerDocument(documentId)`:

1. **Fetch the document row first**, by `id`, to read its `storage_path` (and confirm it exists / the caller can see it under RLS) — the function takes only `documentId`, it does not trust a caller-supplied `storagePath`, so there is one less thing calling code can get wrong or fake.
2. **Delete the `worker_documents` row** (`.delete().eq("id", documentId)`), under the same RLS as every other write to this table (decision #5) — no `service_role`, no bypass.
3. **If the row delete fails** (RLS rejects it, network error, row already gone): stop immediately. Do **not** attempt the storage delete. Surface the error as-is. Nothing was lost — the document is still fully intact and visible exactly as before the attempt.
4. **If the row delete succeeds**, attempt to remove the storage object using the `storage_path` fetched in step 1.
5. **If the storage delete then fails**: the row is already gone (so the UI correctly reverts to "Pendiente"/no file — this already happened and is not undone). **Do not reinsert the DB row** to "compensate" — that would itself risk a second write conflicting with whatever else may have changed, and the row is supposed to be gone from the user's perspective at this point. Instead, log the error (`console.error`) and show a distinct warning/error toast telling the user the document was removed from the expediente but the file may still need cleanup (e.g. "El documento se quitó del expediente, pero el archivo podría necesitar limpieza adicional; contacta a soporte si esto se repite") — not a silent success, and not the same message as a clean success.

Reasoning for this order (kept from the original analysis): an orphaned **storage** object left behind after step 5's failure is invisible to every normal user of the app (nothing queries storage directly without a `worker_documents` row pointing at it) and costs a few KB of unused bucket space. An orphaned **database row** pointing at an already-deleted file (the rejected alternative below) would instead show a document as "Cargado" that immediately 404s on view/download — a visible, confusing broken state. Between "harmless invisible leftover" and "visible broken state," DB-first picks the harmless one.

Rejected alternative: storage-first, then row. Rejected because a failed row-delete after the storage object is already gone leaves a `worker_documents` row pointing at a file that no longer exists — exactly the confusing, user-visible broken state (a document that shows as uploaded but 404s) the chosen order avoids.

This exact sequence, including the "fetch first," "stop on row-delete failure," and "never reinsert on storage-delete failure" rules, is tracked as explicit verification steps in `verification-plan.md`.

## 4. Confirmation modal reuses `src/ui/ConfirmDelete.jsx` as-is

This component already exists, already implements "name the resource, Cancel/Delete buttons, `disabled` while pending" exactly as this feature needs, and is already wired through the same `Modal.Open`/`Modal.Window` compound pattern used elsewhere in this app (e.g. `WorkerRow.jsx`). No new confirmation component is created. `resourceName` is passed as the specific document type's label (and, for multi-file types, the specific file's name) so the confirmation text is concrete ("Eliminar Acta de nacimiento", not a generic "Eliminar documento").

## 5. No RLS or migration change — confirmed, not assumed

Both relevant RLS policy sets already use `cmd = ALL` (which includes DELETE), confirmed directly against the local database before writing this spec:

- `public.worker_documents`: `"Staff and admin manage all worker documents"` (`current_app_role() = ANY (ARRAY['staff','admin'])`) and `"Workers manage own worker documents"` (`worker_id = current_worker_id()`) — both `cmd = ALL`.
- `storage.objects` (bucket `worker_documents`): `"Staff and admin access worker documents bucket"` and `"Workers access own worker documents bucket path"` — both `cmd = ALL`.

Since `ALL` already includes `DELETE`, no new policy and no migration is needed for this feature — the "small API addition" mentioned in the request is purely a new frontend/service-layer function, not a database change. See `database-plan.md` for the full confirmation and the exact queries used to verify this.

## 6. UI does not attempt its own authorization logic beyond what's already there

The new "Eliminar" action is shown to whichever user can already see the row it's attached to — a worker only ever sees their own `WorkerDocumentsView` (via `/my-documents`, `workerId` resolved from their own session per `worker-self-service-documents` decisions), and staff/admin already see any worker's view via `/workers/:id/documents`. No new role check is added in the UI for this feature specifically, because the existing routing/RLS boundary already guarantees a user can only ever be looking at documents they're allowed to delete. This mirrors decisions already made in `worker-self-service-documents` (UI hiding is convenience, RLS is the boundary) rather than introducing a parallel check.

## 7. RESOLVED: documentation update targets `docs/ai/architecture.md` **and** `README.md`, each with a different job — not the `worker-self-service-documents` spec files, not `AGENTS.md`

**Previously scoped to `architecture.md` only; now extended to `README.md` too, with each file's job kept distinct.**

- **`docs/ai/architecture.md`** — the technical architecture summary for future agents/developers. Confirmed stale today (predates the entire `worker-self-service-documents` feature — no mention of `/my-documents`, `RoleGate`, `profiles`, either Edge Function, or the document module at all). Must be updated to add/refresh, at minimum:
  - `/my-documents`, `/set-password`, `/pending-access` routes (and the existing staff routes, kept accurate).
  - The `profiles` role model (`admin`/`staff`/`worker`/no-row, deny-by-default).
  - The staff/admin vs. worker routing split (`RoleGate`, `WorkerAppLayout` vs. `AppLayout`).
  - The `create-worker-account` Edge Function.
  - The `resend-worker-access-link` Edge Function.
  - The local email templates (`supabase/templates/invite.html`/`recovery.html`, configured via `supabase/config.toml`'s `[auth.email.template.*]`).
  - Worker document upload/replace/**delete** behavior (the capability this feature itself adds).
  - RLS as the actual enforcement boundary (UI hiding is convenience only) — stated explicitly, not just implied.
- **`README.md`** — the product-level, user-facing feature overview (already lists things like "Dashboard Interactivo", "Gestión Académica Completa" as short bullets). Gets a short, feature-level addition, matching that existing bullet style and depth — **no implementation details** (no table names, no RLS, no Edge Function names, no file paths):
  - Worker self-service access (workers can log in and manage their own document expediente).
  - Worker document upload/replace/delete.
  - Admin account provisioning by invitation.
- **`AGENTS.md`** — explicitly **not** updated by this feature unless implementation reveals that one of its existing instructions is now factually wrong (e.g. a listed command stops working, a stated architecture pattern is contradicted). It is a rules/process file, not a place to log new features.
- **`specs/active/worker-self-service-documents/*.md`** — left untouched, same reasoning as before: those files are a point-in-time design log for that feature, not living documentation.

## 8. RESOLVED: deleting the last file of a multi-file type shows the plain pending/empty state — no special "all evidence deleted" state

**Previously an open question; now decided.** A multi-file ("Evidencias") document type's `documents` array reaching zero length after a delete is treated exactly the same as that type never having had any files uploaded — the same "no files uploaded"/pending empty state, not a distinct "you deleted everything" message.

Reasoning: the *document type* itself is a fixed row in the catalog (`worker_document_types`) that always exists regardless of how many files are currently uploaded against it — deleting files doesn't remove or disable the type, it just changes how many uploaded files are attached to it, same as it going from 0 to 1 to N via ordinary uploads. Zero is zero, whether it's "never uploaded" or "uploaded then all deleted" — no extra state is needed to distinguish those for MVP, since the required next action for the user is identical either way ("select a file and upload it").

Required behavior:

- Deleting one evidence file removes only that specific file — the rest of that type's files, and every other document type, are unaffected.
- When zero files remain for that type, the UI shows the same empty/pending presentation used before any evidence was ever uploaded for it (per decisions.md #1's styled file picker) — not a different copy string, not a "0 files" counter, not a disabled state.
- The add/upload control for that type remains visible and functional at zero files, exactly as it was before the first upload.
