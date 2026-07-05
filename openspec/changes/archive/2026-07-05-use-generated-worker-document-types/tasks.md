# Tasks — use-generated-worker-document-types

Status: **Done — typecheck/build/lint verified.**

## Pre-conversion checks

- [x] Read `AGENTS.md`, `docs/ai/architecture.md`,
      `openspec/changes/convert-workers-documents-to-ts/design.md`,
      `openspec/changes/regenerate-supabase-types/design.md`, `tsconfig.json`,
      `eslint.config.js`, `package.json`, `src/types/supabase.ts`, and every
      file in `src/features/workers/documents/`.
- [x] Compared the hand-rolled interfaces field-by-field against the
      regenerated `Row` types — found exactly one divergence
      (`worker_document_categories.scope`: hand-rolled `"permanent" | "semester"`
      vs. generated bare `string`), everything else identical (`design.md`
      Section 1).
- [x] Ran `bun run lint` — baseline unchanged at 206 problems, neither target
      file present in the output.

## Conversion

- [x] `src/features/workers/documents/useWorkerDocumentCatalog.ts` —
      `WorkerDocumentType` is now `Database["public"]["Tables"]["worker_document_types"]["Row"]`;
      `WorkerDocumentCategory` is now
      `Database["public"]["Tables"]["worker_document_categories"]["Row"] & { document_types: WorkerDocumentType[] }`
      (a type-alias intersection, not `interface extends` — `design.md`
      Section 3 explains why the latter doesn't compile against an
      indexed-access type).
- [x] `src/features/workers/documents/useWorkerDocuments.ts` — `WorkerDocument`
      is now `Database["public"]["Tables"]["worker_documents"]["Row"]`.
- [x] Confirmed no other file needed a direct edit:
      `useWorkerDocumentsBySemester.ts`, `useUploadWorkerDocument.ts`,
      `useReplaceWorkerDocument.ts`, `useWorkerDocumentReportData.ts`,
      `generateWorkerDocumentReportPdf.ts`, `WorkerDocumentsView.tsx` all import
      the same exported names and needed zero changes (`design.md` Sections 4
      and 6).
- [x] Preserved exported type names exactly (`WorkerDocumentType`,
      `WorkerDocumentCategory`, `WorkerDocument`) — every importer keeps
      working unmodified.
- [x] Kept `WorkerDocumentReportWorker`/`WorkerDocumentReportDocumentType`/
      `WorkerDocumentReportCategory`/`WorkerDocumentReportData`
      (`useWorkerDocumentReportData.ts`) as local derived/report types, not
      table rows — no change made to any of them.
- [x] No other file modified; `src/types/supabase.ts`,
      `src/services/apiWorkerDocuments.js`, Supabase migrations/RLS policies,
      `eslint.config.js`, `tsconfig.json`, `package.json` all untouched.

## Verification — results

- [x] `bun run typecheck` — failed once against a real issue (`design.md`
      Section 3), fixed with a type-alias intersection; the 9 cascading
      errors this caused in two consumer files disappeared with the same fix,
      no edits needed in either consumer. Final run: clean, no errors.
- [x] `bun run build` — clean pass, `✓ built in 4.74s`, no diagnostics.
- [x] `bun run lint` — total: **206 problems (202 errors, 4 warnings)** —
      unchanged from baseline.
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 2
      converted files and this change's own `proposal.md`/`design.md`/
      `tasks.md`. No other file.

## Not in scope for this change

- [ ] Fixing the `scope` type-precision gap (bare `string` vs.
      `"permanent" | "semester"`) at the schema/codegen level — would require a
      CHECK-constraint-aware codegen step Supabase doesn't provide; documented
      as an accepted trade-off, not a defect (`proposal.md`).
- [ ] Any Supabase migration, RLS policy, or `src/types/supabase.ts` change.
- [ ] Any Supabase query, storage bucket/path, React Query key/staleTime/
      invalidation, or hook return shape change.
- [ ] Converting any other file outside
      `src/features/workers/documents/useWorkerDocumentCatalog.ts`/
      `useWorkerDocuments.ts`.
