# Verification Plan - worker-documents-ux-and-delete

This project has no automated test runner yet (per `AGENTS.md`), so every check below is manual except lint/build.

## Automated

- [ ] `bun run lint` — zero new issues in any touched file.
- [ ] `bun run build` — passes.

## Manual setup (local)

1. `bunx supabase start` (or confirm already running).
2. Log in as the seeded local admin (`admin.local@enub.test`).
3. Pick or create one worker with at least one uploaded single-file document and one uploaded multi-file ("Evidencias") document with 2+ files, so both delete shapes can be exercised.

## Styled file picker (both routes)

- [ ] At `/workers/:id/documents`, a pending document type shows a styled trigger, not the raw browser file input.
- [ ] Selecting a file shows its name before clicking "Subir archivo".
- [ ] Uploading succeeds exactly as before (regression check) — file appears, status flips to "Cargado", success toast shown.
- [ ] Repeat at `/my-documents` logged in as a worker with a linked account — identical behavior.

## Delete — single-file document type

- [ ] "Eliminar" is visible next to Ver/Descargar/Reemplazar for an uploaded single-file document.
- [ ] Clicking it opens the confirmation modal (`ConfirmDelete`), naming the specific document type.
- [ ] Cancel closes the modal with no change — confirm via a page refresh that the document is still there.
- [ ] Confirm deletes: storage object removed (spot-check via Supabase Studio's Storage browser or a signed-URL fetch now failing) and the `worker_documents` row removed (spot-check via Studio's table editor or a direct query), row reverts to "Pendiente" in the UI without a manual page reload, success toast shown.
- [ ] Repeat at `/my-documents` as the owning worker.
- [ ] As a different worker (or via the browser console using that worker's own session), attempt to delete a document belonging to a different `worker_id` directly via the Supabase client — confirm RLS denies it (zero rows affected / error), not just that the UI doesn't offer the button.

## Delete order and partial-failure handling (decisions.md #3, resolved)

- [ ] Confirm via network inspection (browser devtools) or Supabase logs that, on a normal delete, the `worker_documents` DELETE request happens and completes **before** the storage `remove` request is issued — not concurrently, not storage-first.
- [ ] Confirm `deleteWorkerDocument` fetches the document row (for `storage_path`) before issuing either delete — inspect the network calls or add a temporary log during implementation-time testing.
- [ ] **Row-delete failure simulation**: temporarily break the row delete (e.g. call it for an `id` that doesn't exist, or as a session that shouldn't have access to that row) and confirm: the storage object is never touched (no storage `remove` request fires at all), a clear error toast appears, and the document remains fully visible/unchanged in the UI.
- [ ] **Storage-delete failure simulation**: temporarily make the storage removal fail (e.g. delete the storage object out-of-band first via Studio, then trigger the app's delete on the now-row-only document, or temporarily rename/break the bucket path during a local test) and confirm: the `worker_documents` row is still deleted (document disappears from the UI, reverts to "Pendiente"), the row is **not** reinserted, a distinct warning/error toast appears (different from the plain success toast and different from a full failure toast), and the failure is logged to the console.
- [ ] Confirm no code path reinserts a `worker_documents` row after a storage-delete failure — read the implementation, don't just rely on observed UI behavior for this one.

## Delete — multi-file ("Evidencias") document type

- [ ] Each file in a multi-file document type shows its own "Eliminar".
- [ ] Deleting one file removes only that file; the remaining files are still listed, still viewable/downloadable.
- [ ] Deleting the last remaining file leaves the type showing the **exact same empty/pending presentation** as a document type that has never had a file uploaded — same copy, same layout, no "0 files" counter, no distinct "all evidence deleted" message (decisions.md #8, resolved) — and the upload control is still visible and functional.
- [ ] Repeat at both routes.

## Loading and error states

- [ ] While a delete is in flight, the confirm/cancel buttons in the modal are disabled (no double-submit).
- [ ] While an upload/replace is in flight, its own control shows a pending state and cannot be triggered twice concurrently for the same row.
- [ ] Force a delete error (e.g. temporarily revoke the worker's session mid-flow, or attempt to delete an already-deleted document ID via the console) and confirm a clear error toast appears — no raw stack trace, no silent failure, no crash.

## Regression checks (existing functionality, unaffected by this feature)

- [ ] Upload to a fresh pending document still works end-to-end.
- [ ] Replace on an existing single-file document still works end-to-end, still removes the old storage object.
- [ ] The semester selector and Docencia/Tutoría/Asesoría/Investigación category tables still render and scope correctly.
- [ ] "Descargar reporte" (PDF report generation) still works and reflects only the current worker's data, including correctly showing "Pendiente" for any document deleted during this verification pass.
- [ ] Staff/admin's full document access at `/workers/:id/documents` for any worker is unaffected.
- [ ] A worker's access remains scoped to `/my-documents` only (no new route, no new way to reach another worker's documents was introduced).

## Security/scope confirmation

- [ ] `grep -rn "service_role\|SERVICE_ROLE\|auth\.admin" src/` returns nothing new (baseline unchanged from prior phases).
- [ ] `git diff` confirms no changes to `supabase/migrations/`, `supabase/tests/`, or either Edge Function's `index.ts`.
- [ ] `git diff` confirms `docs/ai/architecture.md` was updated (Phase 6 of `tasks.md`) and now mentions: routes including `/my-documents`/`/pending-access`/`/set-password`, the profiles/roles model, staff/admin/worker routing, both Edge Functions, email templates, the document module's upload/replace/delete behavior, and RLS as the enforcement boundary.
- [ ] `git diff` confirms `README.md` was updated with a short, product-level mention of worker self-service access, document upload/replace/delete, and admin account provisioning by invitation — and contains no implementation details (no table/column names, no RLS wording, no Edge Function names, no file paths).
- [ ] `git diff` confirms `AGENTS.md` is unchanged — or, if changed, that the diff is limited to correcting one specific statement that implementation proved factually wrong, with the reason recorded in the commit message.

## Cleanup

- [ ] Any test documents uploaded/deleted purely for this verification pass are removed or clearly marked as test data, not left as ambiguous production-looking rows for the seeded local workers.
