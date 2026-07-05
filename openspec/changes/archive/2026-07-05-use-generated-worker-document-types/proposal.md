# Proposal: Use Generated Worker Document Types

## Status

Done — hand-rolled interfaces replaced, verified.

## Why

`convert-workers-documents-to-ts` (Phase 3) hand-rolled `WorkerDocumentType`,
`WorkerDocumentCategory` (`useWorkerDocumentCatalog.ts`) and `WorkerDocument`
(`useWorkerDocuments.ts`) because `worker_document_categories`,
`worker_document_types`, `worker_documents` were missing from
`src/types/supabase.ts` at the time. `regenerate-supabase-types` has since
regenerated that file and confirmed (via diff) that all three tables' generated
`Row` shapes are column-for-column identical to what was hand-rolled. Per the
project's standing rule to reuse `src/types/supabase.ts` `Database` types
wherever a table is actually present in it, the hand-rolled interfaces are now
replaced with generated `Row` aliases.

## What changes

- `src/features/workers/documents/useWorkerDocumentCatalog.ts`:
  - `WorkerDocumentType` — now `Database["public"]["Tables"]["worker_document_types"]["Row"]`
    (a direct type alias, replacing the 6-field hand-rolled interface).
  - `WorkerDocumentCategory` — now
    `Database["public"]["Tables"]["worker_document_categories"]["Row"] & { document_types: WorkerDocumentType[] }`
    (an intersection, not a plain alias, since `document_types` is an
    application-computed grouping with no corresponding DB column — see
    `design.md` for why this couldn't be an `interface extends`).
- `src/features/workers/documents/useWorkerDocuments.ts`:
  - `WorkerDocument` — now `Database["public"]["Tables"]["worker_documents"]["Row"]`.
- No other file needed a direct edit: `useWorkerDocumentsBySemester.ts`,
  `useUploadWorkerDocument.ts`, `useReplaceWorkerDocument.ts`,
  `useWorkerDocumentReportData.ts`, `generateWorkerDocumentReportPdf.ts`,
  `WorkerDocumentsView.tsx` all import `WorkerDocumentType`/
  `WorkerDocumentCategory`/`WorkerDocument` by name from these two files and
  needed zero changes once the underlying alias source changed — the exported
  names, and every field these consumers actually read, are unchanged.

## Type-precision trade-off (documented, not fixed)

The generated `worker_document_categories.scope` column types as bare `string`
(Supabase codegen has no way to see the table's `CHECK (scope = ANY (ARRAY[...]))`
constraint), whereas the hand-rolled interface declared it as the literal union
`"permanent" | "semester"`. Every current use of `category.scope` is an equality
comparison against one of those two literals (`WorkerDocumentsView.tsx`), which
still type-checks fine against `string` — no narrowing or exhaustiveness check
anywhere depends on the union. Accepted as the correct trade-off of reusing the
generated type rather than re-declaring a hand-picked literal union that the
database schema doesn't itself expose to codegen.

## What does not change

- No Supabase query, storage bucket/path, React Query key/staleTime/
  invalidation, or hook return shape changed.
- No upload/replace/delete/view/download/report-generation/selected-file-state/
  pending-status/metadata behavior changed — every hook's queryFn/mutationFn
  and return shape is byte-for-byte the same; only the type each field is
  checked against changed.
- `src/types/supabase.ts` not modified.
- No Supabase migration or RLS policy touched.
- `WorkerDocumentReportWorker`, `WorkerDocumentReportDocumentType`,
  `WorkerDocumentReportCategory`, `WorkerDocumentReportData`
  (`useWorkerDocumentReportData.ts`) are **not** table rows — they're derived,
  report-shaped types (computed `status`/`uploaded_at`/`documents` fields, a
  `Pick`-projected worker, a nullable `semester`) and are kept exactly as they
  were, composed on top of the now-generated-backed `WorkerDocumentType`/
  `WorkerDocumentCategory`.
- No dependency added; `eslint.config.js`/`tsconfig.json`/`package.json`
  untouched.

## Impact

- **Affected code:** 2 files (`useWorkerDocumentCatalog.ts`,
  `useWorkerDocuments.ts`). No other file needed a change.
- **Affected lint baseline:** unchanged (206 problems before and after).
