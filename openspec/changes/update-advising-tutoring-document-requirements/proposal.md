## Why

Asesoría and Tutoría's document-type catalogs need three independent
corrections: `Asesoría / Informes` and `Tutoría / Relación de estudiantes
tutorados` are no longer requested going forward and should be retired
(never deleted — both may already have historical files); `Asesoría /
Control de asesorías` and `Asesoría / Documentos de titulación` need a
short editorial description ("Bitácoras" / "Dictamen" respectively) so
workers understand what's actually expected under each, since their names
alone are ambiguous; and Tutoría needs a new, active, single-file `Plan de
Trabajo` requirement, sorted first in that category.

Separately, and unrelated to the catalog content itself, the dashboard has
a real bug: changing the selected academic period silently resets whatever
category tab was selected back to the first one. Root cause (verified by
reading the code, not assumed): `WorkerDocumentsView`'s `isLoading` gate
includes `isLoadingSemesterDocuments` from `useWorkerDocumentsBySemester`,
which — with no `placeholderData` configured — flips back to `true` on
every semester change (a genuinely new query key with no cached data yet),
swapping the whole subtree to `<Spinner/>` and unmounting
`WorkerDocumentsDashboard`, destroying its local `selectedCategoryId`
state. The fix is two-layered: `placeholderData: keepPreviousData` at the
query level (the actual root-cause fix, preventing the unmount) plus a
defensive, render-derived `resolveActiveCategoryId` at the dashboard level
(so the selection survives by id even if some future change reintroduces
an unmount or a new catalog array reference).

`placeholderData` on its own has a real consequence that a first pass at
this fix under-addressed: while the new period's request is in flight, the
dashboard is showing the *previous* period's documents, not the new
period's. That window must be treated as fully read-only, not merely as
"slightly stale but fine to interact with" — opening the drawer or
starting a mutation against it would act on the wrong semester's data.
`useWorkerDocumentsBySemester` now returns `isPlaceholderData`/`isFetching`
explicitly, `WorkerDocumentsView` derives `isUpdatingSemesterData` from
`isPlaceholderData` (deliberately not from `isFetching` alone, which would
also fire for unrelated same-period refetches), and
`WorkerDocumentsDashboard` becomes read-only for that entire window —
mounted and visible throughout, never hidden behind a spinner.

Finally, `DocumentSummary`'s percentage/progress bar is removed: document
requirements don't necessarily carry equal weight, and there is no formal
rule for what "percentage compliant" means — a computed number would
communicate a precision the system does not actually have. Only the three
objective counts (total active, with files, pending) are shown going
forward.

This change is independent of, and does not modify or depend on,
`improve-docencia-multi-file-upload` (the dashboard/drawer redesign this
change builds directly on top of, already implemented on this branch).

## What Changes

- **Two guarded migrations, in order**:
  1. `20260721020000_add_worker_document_type_description.sql` — adds
     `worker_document_types.description text NULL`. Schema-only, no data
     change, mirrors the existing precedent of splitting a schema addition
     (`20260716013828_add_worker_document_type_is_active.sql`) from the
     data/catalog change that uses it.
  2. `20260721030000_update_advising_tutoring_document_requirements.sql` —
     a single guarded `DO $$ ... $$` block: retires `Asesoría / Informes`
     and `Tutoría / Relación de estudiantes tutorados` (`is_active =
     false`, using the same shared lifecycle advisory lock as the existing
     retirement migration and `enforce_active_worker_document_type`); sets
     `description` on `Asesoría / Control de asesorías` ("Bitácoras") and
     `Asesoría / Documentos de titulación` ("Dictamen"); inserts `Tutoría /
     Plan de Trabajo` (active, single-file, semester-scoped via its
     category, `sort_order` computed as 5 below Tutoría's current minimum
     so it sorts first with no ties, no other Tutoría row renumbered).
     Explicitly **not** designed to be re-run — see design.md Decision 1.
- **Editorial description surfaced in the UI** (never hardcoded by name in
  React): `DocumentRequirementRow` shows it as a line under the
  requirement's name; `DocumentDetailDrawer` shows it under the title,
  alongside (never instead of) the existing "Se admite un
  archivo."/"Puedes adjuntar varios archivos." functional hint — two
  distinct concepts, kept as two distinct elements. Rendered only when
  non-empty; `null`/`""` render nothing, never a placeholder or generic
  fallback phrase.
- **`selectedCategoryId` persists by id across a semester change**:
  `useWorkerDocumentsBySemester` gains `placeholderData: keepPreviousData`
  (the actual fix — the dashboard no longer unmounts on a period refetch
  that already has usable data); `documentRequirementSummary.ts` gains
  `resolveActiveCategoryId` (pure, unit-tested), used by
  `WorkerDocumentsDashboard` to derive the *displayed* category at render
  time from the raw selection, without ever writing the fallback back into
  state via an effect.
- **The dashboard is read-only while a semester change's data is still
  resolving**: `useWorkerDocumentsBySemester` returns `isPlaceholderData`/
  `isFetching` explicitly; `WorkerDocumentsView` derives
  `isUpdatingSemesterData` and passes it to `WorkerDocumentsDashboard`,
  which shows a visible "Actualizando periodo…" indicator (inside
  `DocumentSummary`, which also dims its counts rather than presenting
  them as the new period's real result), sets `aria-busy="true"` on its
  root element, disables every row's action buttons
  (`DocumentRequirementList`/`DocumentRequirementRow`, dimmed but still
  visible, never hidden), disables the semester `<select>` itself and
  "Descargar reporte". `openRequirement`/`handleSemesterChange` also guard
  on `isUpdatingSemesterData` directly, so no drawer can open and no new
  semester change can start until the current one resolves — and since
  every mutation in this feature is only ever triggered from inside the
  drawer, this makes "no mutation can execute against placeholder data"
  true structurally, not just as a UI affordance.
- **`DocumentSummary` shows only objective counts**: "N requisitos · N con
  archivos · N pendientes", no percentage, no progress bar.
  `computeDocumentProgressSummary`'s `percentage` field is removed
  entirely from `DocumentProgressSummary` (no remaining consumer).

## Non-goals

- No changes to `Docencia`, `Investigación`, or `Datos personales` — the
  migration's `UPDATE`/`INSERT` statements are scoped by ids resolved
  earlier in the same block, making this structurally impossible, not
  merely unintended.
- No changes to `allows_multiple` on any existing document type.
- No deletion of any catalog row or any `worker_documents` row — retired
  types keep every historical file, forever queryable.
- No RLS policy changes.
- No changes to the PDF report (`generateWorkerDocumentReportPdf.ts`): it
  does not print a requirement's description today, and none was added —
  the PDF is a compliance-status report, not an editorial catalog view.
- No changes to, or reliance on, `improve-docencia-multi-file-upload`
  (a separate, independent, already-implemented change on this branch).
- No redesign of the migration to make it idempotent — see design.md
  Decision 1 for why, and what actually happens on a second run.

## Capabilities

### Modified Capabilities

- `worker-document-catalog-lifecycle`: adds the Asesoría/Tutoría
  retirement + description + new-type requirements (parallel in shape to
  the existing Docencia retirement/rename requirements already in this
  capability), the migration's own drift-safety requirement, and the
  dashboard's category-selection-persistence contract. See
  `specs/worker-document-catalog-lifecycle/spec.md` for the full delta.

## Deployment order

1. **Auditoría** — review both migrations and the updated/new pgTAP
   suites once more before proceeding.
2. Apply the migrations locally (`supabase db reset`) and confirm
   `supabase test db --local` passes in full.
3. Push the frontend branch; Vercel preview confirms `/workers/:id/documents`
   renders the updated Asesoría/Tutoría rows (descriptions, retired types
   without upload controls, Plan de Trabajo first in Tutoría) and that
   switching academic period no longer resets the selected category tab.
4. **Verificación manual** (see tasks.md — requires a real worker session
   with historical Asesoría/Tutoría documents to visually confirm the
   retired-type-with-history row; not available in this environment, where
   the local database has zero historical documents under any of the 9
   Asesoría/Tutoría types).
5. Merge — only after 1–4 are confirmed. Both migrations are data-only (no
   RLS/security surface), so, like `improve-docencia-multi-file-upload`'s
   own migration, this does not require a separate remote dry-run/apply
   step ahead of the frontend deploy.

## Impact

- Base de datos: 2 migraciones nuevas
  (`20260721020000_add_worker_document_type_description.sql`,
  `20260721030000_update_advising_tutoring_document_requirements.sql` —
  ahora también con `LOCK TABLE ... IN SHARE ROW EXCLUSIVE MODE`);
  `worker_document_type_lifecycle.test.sql` y `worker_documents_seed.test.sql`
  actualizadas (conteos globales de tipos inactivos/totales); suite
  `update_advising_tutoring_document_requirements.test.sql` (25
  aserciones) con una reproducción de frontera dedicada sobre un tipo
  aislado (nunca los reales) y una prueba de segunda ejecución que
  reproduce fielmente, en orden, todas las precondiciones de la migración
  real contra el catálogo ya migrado — confirmando que falla exactamente
  en la primera que de verdad se alcanza (`Asesoría / Informes` ya
  inactivo, no la descripción de `Control de asesorías`), con el
  diagnóstico exacto, y que ninguna de las 5 filas relevantes (Informes,
  Relación de estudiantes tutorados, Control de asesorías, Documentos de
  titulación, Plan de Trabajo) cambió.
- Código: `src/types/supabase.ts` (regenerado, añade `description`),
  `documentRequirementSummary.ts` (`resolveActiveCategoryId`, quita
  `percentage`), `useWorkerDocumentsBySemester.ts` (`placeholderData`,
  `isPlaceholderData`/`isFetching`), `WorkerDocumentsView.tsx`
  (`isUpdatingSemesterData`), `WorkerDocumentsDashboard.tsx` (usa
  `resolveActiveCategoryId`; nueva prop `isUpdatingSemesterData`;
  `aria-busy`; deshabilita select de periodo/reporte/filas; guarda
  `openRequirement` con `canOpenDocumentRequirement` y
  `handleSemesterChange` con `isUpdatingSemesterData` directo),
  `components/DocumentRequirementRow.tsx`
  y `components/DocumentRequirementList.tsx` (`disabled`, `trim()` de
  `description`), `components/DocumentDetailDrawer.tsx` (`trim()` de
  `description`), `components/DocumentSummary.tsx` (pluralización,
  indicador de actualización).
- Pruebas: unitarias (`documentRequirementSummary.test.ts`), de render
  estático (`WorkerDocumentsDashboard.test.tsx`,
  `DocumentDetailDrawer.test.tsx` — descripción con `trim()`,
  pluralización), y DOM reales (`WorkerDocumentsView.dom.test.tsx`,
  incluida una suite dedicada al intervalo `isPlaceholderData` con la
  segunda consulta controlada manualmente; adiciones a
  `WorkerDocumentsDashboard.dom.test.tsx`).
- Riesgo: bajo — migraciones de catálogo guardadas por
  precondición/postcondición (no RLS, sin cambios de trigger/RPC) y ahora
  además protegidas por tres familias de lock con responsabilidades
  distintas (design.md Decisión 10): un `LOCK TABLE ... IN SHARE ROW
  EXCLUSIVE MODE` sobre `worker_document_categories`/`worker_document_types`
  (orden fijo, categorías antes que tipos) es lo que realmente excluye
  `INSERT`/`UPDATE`/`DELETE` concurrentes sobre el catálogo durante toda la
  validación y mutación, sin bloquear lecturas ordinarias; el advisory
  transaction lock es únicamente cooperativo (solo serializa contra otra
  ejecución concurrente de esta misma migración, nunca contra un escritor
  cualquiera); los advisory locks de ciclo de vida por tipo coordinan el
  retiro con subidas/reemplazos concurrentes sobre ese mismo tipo, un
  protocolo aparte y preexistente. El fix de persistencia de categoría
  añade una prop nueva y requerida (`isUpdatingSemesterData`) a
  `WorkerDocumentsDashboardProps` — un cambio de contrato deliberado, no
  accidental, que fuerza a cualquier consumidor a decidir explícitamente
  ese valor; el guard interno de apertura del drawer
  (`canOpenDocumentRequirement`) es ahora una función pura nombrada y
  probada por separado del atributo `disabled` del DOM.
