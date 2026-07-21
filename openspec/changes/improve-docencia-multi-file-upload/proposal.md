## Why

Docencia's evidence-gathering document types (`Evidencias bimestrales`) have
allowed multiple files since the original MVP, but the other 6 active
Docencia document types (`Planeación semestral`, `Rúbricas`, `Listas de
cotejo`, `Listas de asistencia`, `Actas de evaluación`, `Concentrado de
calificaciones finales`) still allow only one file per worker/semester —
the original, narrow product decision recorded in
`specs/active/worker-document-uploads/decisions.md` #7. Separately, the
upload experience for every document type (not just Docencia) is a single
hidden `<input type="file">` behind a "Seleccionar archivo" button — no
multi-select, no drag-and-drop, and a layout bug where "Permite múltiples
archivos" renders flush against the document type name because the two
texts share an unstyled `<div>` with no line-break between them. The
4-column table (`Documento`/`Estado`/`Archivo`/`Acciones`) also forces
every row to lock-step column heights even though only the `Archivo`
column ever grows with more files.

`update-docencia-document-requirements` (archived 2026-07-16) renamed
`Evidencias` → `Evidencias bimestrales` as a deliberate label-only change,
explicitly stating that entity remains "identical in structure to today's
`Evidencias`" — that non-goal was about the rename itself, not a promise
that the other 6 Docencia types would stay single-file. This change
revisits that scope specifically for Docencia's multi-file behavior.

## What Changes

- **Guarded catalog migration**
  (`20260721010000_docencia_active_types_allow_multiple.sql`): flips
  `allows_multiple = true` for the 6 active Docencia document types that
  still have it `false`. Scoped to `category_id` resolved from the unique
  `Docencia` category name (structurally impossible to touch another
  category), preconditioned on the exact expected set of 7 active Docencia
  type names (fails closed on any drift since the previous
  retirement/rename migration), postconditioned on the exact update count
  (6) and on the 2 retired Docencia types staying untouched. No trigger or
  RPC change: `enforce_single_worker_document_file` is already conditional
  on `allows_multiple`, and `replace_worker_document_metadata` already
  refuses any `allows_multiple = true` type.
- **New batch upload hook** (`useUploadWorkerDocuments.ts`): accepts
  `File[]`, calls the existing single-file `uploadWorkerDocument` service
  function once per file, sequentially — no new batch RPC, no cross-file
  transaction. Cache invalidation fires once per batch, not once per file.
  Its core queue/summary logic is extracted into pure, directly
  unit-tested functions (`runUploadQueue`, `buildBatchSummary`,
  `canStartUpload`, ...), mirroring this codebase's established
  pure-resolver/thin-hook split.
- **Dashboard + drawer redesign** of `WorkerDocumentsView.tsx` (via a new
  `WorkerDocumentsDashboard.tsx`, with `WorkerDocumentsView.tsx` reduced to
  its pre-existing data-fetching/loading/error shell, unchanged in that
  role): the 4-column table is replaced by a progress summary, category
  tabs/select, status/search filters, and one compact list row per
  document type (`DocumentSummary`, `DocumentCategoryTabs`,
  `DocumentFilters`, `DocumentRequirementList`/`DocumentRequirementRow`).
  Opening a row's action ("Subir archivo(s)"/"Agregar archivos"/
  "Reemplazar archivo"/"Ver archivos") opens a single lateral drawer
  (`DocumentDetailDrawer`, full-screen on mobile) showing that one document
  type's existing files (`UploadedFileList`/`UploadedFileRow`), its upload
  control (`UploadDropzone`, shared by single- and multi-file types), and
  its pending-selection queue (`PendingUploadList` for multi-file,
  `PendingFileRow` for single-file) with a shared `UploadFooter`. Every
  close/navigate-away trigger (X, Escape, overlay, switching requirement,
  switching category, changing semester) is funneled through one pure
  decision (`decideDrawerTransition`): an in-flight upload blocks it
  outright, an unconfirmed local selection requires an explicit discard
  confirmation, otherwise it proceeds immediately. Single-file types keep
  their exact existing upload-or-replace behavior and mutation hooks,
  unchanged; each open drawer instantiates its own hooks, so an in-flight
  upload for one document type never disables another's controls.
- **Real dialog accessibility for `ui/Modal.tsx`**: `Modal.Window` now
  renders `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`
  pointing at an optional visually-hidden title (falling back to
  `aria-label` from the window's own `name` when no title is given), moves
  initial focus inside itself on open, traps Tab/Shift+Tab, closes on
  Escape, and restores focus to whatever opened it on close (skipped if
  that element is no longer in the DOM) — all additive to its pre-existing
  outside-click dismissal, with no change to `Modal`/`Modal.Open`/
  `Modal.Window`'s public props. `useModal` moved to its own module
  (`ui/useModal.ts`, backed by `ui/ModalContext.ts`) so it is no longer
  co-exported from the same file as the `Modal` component.
- **Shared upload-limits module**
  (`src/services/workerDocumentUploadLimits.ts`): extensions, MIME map,
  10 MB size limit, and the new 10-files-per-batch ceiling, previously
  duplicated by hand between `apiWorkerDocuments.ts` and the view. Shown
  proactively next to the dropzone, not only after a rejected upload.
- Client-side file-selection dedup (name + size + lastModified) and
  extension/size validation happen before a file ever reaches the queue
  (`resolveFileSelection.ts`), independent of the queue itself.

## Non-goals

- No new backend batch/transactional endpoint — Storage and Postgres
  remain two separate systems even for a single file, let alone a batch;
  a batch of N files can legitimately end in any mix of
  completado/error, never rolled back against each other.
- No change to Datos personales, Tutoría, Asesoría, or Investigación
  document-type behavior — their `allows_multiple` values are untouched
  by the migration, and their single-file upload/replace logic is
  unchanged (only re-skinned into the new dashboard/drawer layout).
- No change to the PDF report's row-building logic
  (`buildReportRows` already iterates every document per type, not just
  the first) — a regression test pins this down instead.
- The pre-existing open `SELECT` RLS policy on
  `worker_document_categories`/`worker_document_types` (catalog metadata
  readable by any authenticated/anon session) is a known, separate
  finding, intentionally **not** addressed here — same discipline as the
  earlier `complete-worker-profile` change's own explicit scope
  boundaries. Documented as a follow-up candidate.

## Capabilities

### Modified Capabilities

- `worker-document-catalog-lifecycle`: broadens the existing
  "Evidencias bimestrales retains its multi-file behavior" requirement to
  cover all 7 active Docencia types, and adds requirements for the guarded
  migration's drift-safety and the multi-file upload flow's no-false-
  atomicity guarantee. See
  `specs/worker-document-catalog-lifecycle/spec.md` for the full delta.

## Deployment order

1. **Auditoría** — review the migration and updated pgTAP suites once
   more before proceeding.
2. Apply the migration locally (`supabase db reset`) and confirm
   `supabase test db --local` passes in full.
3. Push the frontend branch; Vercel preview confirms `/workers/:id/documents`
   and `/my-documents` both render the new dashboard/drawer layout without
   errors.
4. **Verificación manual** (see tasks.md — requires a real worker session
   with existing Docencia documents; not available in this environment).
5. Merge — only after 1–4 are confirmed. The migration is data-only (no
   RLS/security surface), so unlike `complete-worker-profile`'s RLS
   migration this does not require a separate remote dry-run/apply step
   ahead of the frontend deploy — either order is safe, since the UI
   already branches on `allows_multiple` generically and degrades to
   today's single-file behavior for any type the migration hasn't reached
   yet.

## Impact

- Base de datos: nueva migración
  `20260721010000_docencia_active_types_allow_multiple.sql`; 3 suites
  pgTAP actualizadas (`worker_documents_seed`, `worker_documents_triggers`,
  `worker_document_replacement_rpc`), más `worker_documents_ownership_rls`
  y `worker_documents_storage_rls` con aserciones herméticas (ver
  "Idempotencia" y "Hermeticidad" más abajo).
- Código: `src/services/apiWorkerDocuments.ts`,
  `src/services/workerDocumentUploadLimits.ts` (nuevo),
  `src/features/workers/documents/WorkerDocumentsView.tsx` (reducido a
  shell de datos), `WorkerDocumentsDashboard.tsx` (nuevo),
  `documentRequirementSummary.ts` (nuevo, núcleo puro de la dashboard),
  `workerDocumentTypeVisibility.ts` (nuevo), `workerDocumentDisplay.ts`
  (nuevo), `useUploadWorkerDocuments.ts` (nuevo), `resolveFileSelection.ts`
  (nuevo), `generateWorkerDocumentReportPdf.ts` (export only),
  `components/` (`DocumentSummary`, `DocumentCategoryTabs`,
  `DocumentFilters`, `DocumentRequirementList`, `DocumentRequirementRow`,
  `DocumentDetailDrawer`, `UploadDropzone`, `PendingUploadList`,
  `UploadFooter`, `UploadedFileList`, `UploadedFileRow`, `FileTypeIcon`),
  `ui/Modal.tsx` (accesibilidad real), `ui/ModalContext.ts` (nuevo),
  `ui/useModal.ts` (nuevo, extraído de `Modal.tsx`).
- Pruebas: suites unitarias del núcleo puro
  (`documentRequirementSummary.test.ts`, `useUploadWorkerDocuments.test.ts`,
  `resolveFileSelection.test.ts`, `workerDocumentDisplay.test.ts`,
  `workerDocumentTypeVisibility.test.ts`,
  `generateWorkerDocumentReportPdf.test.ts`,
  `workerDocumentUploadLimits.test.ts`), suites de render estático
  (`WorkerDocumentsView.test.tsx`, `WorkerDocumentsDashboard.test.tsx`,
  `DocumentDetailDrawer.test.tsx`), y dos suites DOM reales nuevas sobre
  `happy-dom` (`ui/Modal.test.tsx`,
  `WorkerDocumentsDashboard.dom.test.tsx`) que ejercitan eventos genuinos
  (click, keydown, focus, selección de archivos) contra los hooks/lógica
  reales, mockeando únicamente el límite de red
  (`services/apiWorkerDocuments.ts`); 3 suites pgTAP actualizadas más 2
  suites RLS hechas herméticas.
- Nueva devDependency: `happy-dom` + `@happy-dom/global-registrator`
  (aprobada explícitamente), usada solo por los archivos de prueba que la
  importan explícitamente (`src/testUtils/domTestSetup.ts`), nunca
  precargada globalmente — el resto de la suite de pruebas sigue sin DOM,
  sin cambios.
- Riesgo: bajo — migración de catálogo (no RLS), guardada por
  precondición/postcondición, sin cambios de trigger/RPC, y explícitamente
  NO diseñada para re-ejecutarse sobre un catálogo ya migrado (ver
  "Idempotencia" abajo); el rediseño de UI reutiliza sin cambios la lógica
  single-file existente para toda categoría fuera de Docencia.
