# Tasks — convert-workers-documents-to-ts

Status: **Phase 1 (workers core list/table/hooks), Phase 2 (worker create/edit/
account forms), and Phase 3 (worker documents) done; typecheck/lint verified.**
Phase 4 import-fix check is complete as a no-op; page conversion is not started.

## Phase 1: workers core list/table/hooks

### Change artifacts

- [x] Write `proposal.md`.
- [x] Write `design.md`.
- [x] Write `tasks.md` (this file).

### Pre-conversion checks

- [x] Ran `bun run lint` and recorded the exact per-file baseline: `WorkerRow.jsx`,
      `WorkerTable.jsx`, `useWorkers.js`, `useLinkedWorkerAccounts.js` — 0
      `react/prop-types` errors each (`design.md` Section 6).
- [x] Grepped every file in `src/features/workers/` (excluding `documents/`) and
      traced each hook's real importers to decide the Phase 1/2/3 boundary
      (`design.md` Section 2): `useCreateWorker.js`/`useEditWorker.js` → Phase 2 only
      consumer is `CreateEditWorkerForm.jsx`; `useWorker.js` → Phase 3 only consumer
      is `WorkerDocumentsView.jsx`.
- [x] Read `src/types/supabase.ts`'s `workers`/`date_of_admissions`/
      `sustenance_plazas` `Row`/`Relationships` to confirm the to-many (array, never
      null) embed direction for `getWorkersFull()` (`design.md` Section 1).
- [x] Confirmed neither `WorkerRow.jsx` nor `WorkerTable.jsx` reads
      `date_of_admissions`/`sustenance_plazas` — deferred modeling those fields to
      Phase 2.
- [x] Grepped for explicit `.jsx`/`.js`-extension imports of all 4 target files, and
      for every out-of-scope consumer of `useWorkers` — found none needing a change
      (`design.md` Section 7).

### Conversion

- [x] `src/features/workers/useWorkers.ts` — exports `Worker` (base `workers` Row,
      no embeds — see `design.md` Section 1), `useQuery<Worker[]>`. Deleted
      `useWorkers.js`.
- [x] `src/features/workers/useLinkedWorkerAccounts.ts` — `useQuery<number[]>`;
      same `linkedWorkerIds`/`isLoading` return shape. Deleted
      `useLinkedWorkerAccounts.js`.
- [x] `src/features/workers/WorkerRow.tsx` — `WorkerRowProps { worker: Worker }`;
      removed the now-dead `/* eslint-disable react/prop-types */` comment
      (`design.md` Section 4). Deleted `WorkerRow.jsx`.
- [x] `src/features/workers/WorkerTable.tsx` — no props; `handleSearch` typed;
      non-null assertion on `worker.name!.toLowerCase()`; no `Row`/`usePagination`
      cast needed (both already properly typed from `fix-ts-migration-blockers`).
      Deleted `WorkerTable.jsx`.
- [x] Fixed the one unplanned issue found via `bun run typecheck`:
      `CreateEditWorkerForm.jsx`/`LinkWorkerAccountForm.jsx` (untyped, out of
      scope) have `onCloseModal` inferred as a *required* prop since neither
      destructures it with a default value; added a local
      `as ComponentType<{...}>` cast in both `WorkerRow.tsx` and `WorkerTable.tsx`
      — neither `.jsx` file itself touched (`design.md` Section 6b).
- [x] No import path updated anywhere (confirmed unnecessary in pre-conversion
      checks).
- [x] No other file modified; `apiWorkers.js`, `apiProfiles.js`,
      `authentication/useProfile.js`, `useCreateWorkerAccount.js`,
      `useResendWorkerAccessLink.js`, `useWorker.js`, `useCreateWorker.js`,
      `useEditWorker.js`, `CreateEditWorkerForm.jsx`, `LinkWorkerAccountForm.jsx`,
      `eslint.config.js`, `tsconfig.json`, `package.json` all untouched.

### Verification — results

- [x] `bun run typecheck` — failed once (`onCloseModal` inferred-required), fixed,
      then passes with no errors.
- [x] `bun run build` — implementer reported a clean pass. Independent review ran
      `timeout 180s bun run build`; it timed out after Vite printed `$ vite build`
      with no diagnostics. Treat as a local environment caveat and rerun before
      commit if a fresh build transcript is required.
- [x] `bun run lint` — total: **208 problems (204 errors, 4 warnings)** —
      unchanged from baseline, exactly as predicted (none of the 4 files
      contributed any `react/prop-types` errors).
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 4 renames
      and `openspec/changes/convert-workers-documents-to-ts/**`. No other file.

## Phase 2: worker create/edit/account forms

### Pre-conversion checks

- [x] Ran `bun run lint` and recorded the exact per-file baseline (`design.md`
      Section 15): `CreateEditWorkerForm.jsx` — 2 `react/prop-types` errors
      (`workerToEdit`, `onCloseModal`); `LinkWorkerAccountForm.jsx`,
      `useCreateWorker.js`, `useEditWorker.js` — 0 each.
- [x] Grepped for explicit `.jsx`/`.js`-extension imports of all 4 target files —
      none found; confirmed the only importers of the two form components are
      `WorkerRow.tsx`/`WorkerTable.tsx` (`design.md` Section 16).
- [x] Read `useLinkWorkerAccount.js` (out of scope, `authentication/`) — confirmed
      it already correctly uses `isPending: isLinking`, so no bug-fix needed there
      (`design.md` Section 10).
- [x] Confirmed `date_of_admissions`/`sustenance_plazas`' to-many/array cardinality
      against `src/types/supabase.ts` `Relationships` (`design.md` Section 9),
      consistent with Phase 1's Section 1 reasoning.

### Conversion

- [x] `src/features/workers/useWorkers.ts` — extended (not rewritten) with
      `DateOfAdmission`, `SustenancePlaza`, `WorkerWithDetails` type exports
      (`design.md` Section 9). `useWorkers()`'s own signature/return shape
      unchanged.
- [x] `src/features/workers/useCreateWorker.ts` — `isPending: isCreating` (bug fix,
      `design.md` Section 10); local cast on `createEditWorkers` for its
      narrowly-inferred `options` param (`design.md` Section 12). Deleted
      `useCreateWorker.js`.
- [x] `src/features/workers/useEditWorker.ts` — `isPending: isEditing` (same bug
      fix); same local cast pattern. Deleted `useEditWorker.js`.
- [x] `src/features/workers/LinkWorkerAccountForm.tsx` —
      `LinkWorkerAccountFormProps { workerId: number; onCloseModal?: () => void }`;
      `onSubmit(data: FieldValues)` (`design.md` Section 13). Deleted
      `LinkWorkerAccountForm.jsx`.
- [x] `src/features/workers/CreateEditWorkerForm.tsx` —
      `CreateEditWorkerFormProps { workerToEdit?: Partial<WorkerWithDetails>;
      onCloseModal?: () => void }`; `useForm<FieldValues>()` with a cast
      `defaultValues` (`design.md` Section 11); preserved `useFieldArray` for both
      `sustenance_plazas`/`date_of_admissions`, file-upload/preview flow,
      conditional `defaultValues` normalization, submit-time `delete`-based data
      cleanup, validation, `isWorking`-driven disabled state, reset/close-modal
      behavior exactly as in the original. Deleted `CreateEditWorkerForm.jsx`.
- [x] `src/features/workers/WorkerRow.tsx` / `WorkerTable.tsx` — removed the Phase
      1 `ComponentType<{...}>` casts, now import both form components directly
      (`design.md` Section 14).
- [x] No other file modified; `apiWorkers.js`, `apiProfiles.js`,
      `authentication/**` (including `useLinkWorkerAccount.js`), `useWorker.js`,
      `eslint.config.js`, `tsconfig.json`, `package.json` all untouched.

### Verification — results

- [x] `bun run typecheck` — failed 3 times against distinct real issues
      (`design.md` Sections 11–13), each fixed with a local, type-only
      cast/annotation. Final run: clean, no errors.
- [x] `bun run build` — implementer reported a clean pass, `✓ built in 5.47s`,
      no diagnostics. Independent review ran `timeout 180s bun run build`; it
      timed out after Vite printed `$ vite build` with no diagnostics. Treat as a
      local environment caveat and rerun before commit if a fresh build transcript
      is required.
- [x] `bun run lint` — total: **206 problems (202 errors, 4 warnings)** — a 2-error
      drop from the 208 baseline, exactly matching Section 15's prediction (both
      `react/prop-types` on `CreateEditWorkerForm.jsx`). Confirmed no Phase 2 file
      (nor `WorkerRow.tsx`/`WorkerTable.tsx`) appears in the lint output.
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 4 Phase 2
      renames, `WorkerRow.tsx`/`WorkerTable.tsx` (cast cleanup),
      `useWorkers.ts` (new type exports), and
      `openspec/changes/convert-workers-documents-to-ts/**`. No other file.

## Phase 3: worker documents

### Pre-conversion checks

- [x] Grepped `src/types/supabase.ts` for `worker_document` — zero matches;
      confirmed via `supabase/migrations/` that `worker_document_categories`,
      `worker_document_types`, `worker_documents` are real tables the generated
      types file was never regenerated to include (`design.md` Section 18).
- [x] Read every file in `src/features/workers/documents/` plus
      `src/services/apiWorkerDocuments.js` and `src/features/workers/useWorker.js`.
- [x] Grepped every importer of `useWorker.js` (singular) — confirmed the only
      one is `WorkerDocumentsView.jsx`, matching Phase 1/2's scoping decision.
- [x] Grepped for explicit `.jsx`/`.js`-extension imports of all 13 target files,
      and for the `documents"` barrel import — none found (`design.md` Section 25).
- [x] Ran `bun run lint` and recorded the exact per-file baseline: all 13 files —
      0 `react/prop-types` errors each (`design.md` Section 24).

### Conversion

- [x] `src/features/workers/useWorker.ts` — `useQuery<Worker>`, reusing `Worker`
      from `useWorkers.ts`. Deleted `useWorker.js`.
- [x] `src/features/workers/documents/workerDocumentKeys.ts` — typed key builders
      and `invalidateWorkerDocumentQueries`.
- [x] `src/features/workers/documents/useWorkerDocumentCatalog.ts` — hand-rolled
      `WorkerDocumentType`/`WorkerDocumentCategory` (no generated Database types
      exist for these tables — `design.md` Section 18); `useQuery<WorkerDocumentCategory[]>`.
- [x] `src/features/workers/documents/useWorkerDocuments.ts` — hand-rolled
      `WorkerDocument` (base row only — `design.md` Section 19);
      `useQuery<WorkerDocument[]>`.
- [x] `src/features/workers/documents/useWorkerDocumentsBySemester.ts` — same
      `WorkerDocument[]` typing.
- [x] `src/features/workers/documents/useWorkerDocumentSignedUrl.ts` —
      `useQuery<string>`.
- [x] `src/features/workers/documents/useUploadWorkerDocument.ts`,
      `useReplaceWorkerDocument.ts` — local casts on the imported service
      functions for their narrowly-inferred `semesterId` param (`design.md`
      Section 21).
- [x] `src/features/workers/documents/useDeleteWorkerDocument.ts` — typed, no
      cast needed (`design.md` Section 21).
- [x] `src/features/workers/documents/useWorkerDocumentReportData.ts` — exports
      `WorkerDocumentReportData`; worker projection via
      `Pick<Worker, "id" | "name" | "RFC" | "type_worker" | "status">`
      (`design.md` Section 20); local cast on `getWorkerDocumentReportData`.
- [x] `src/features/workers/documents/generateWorkerDocumentReportPdf.ts` —
      typed against `WorkerDocumentReportData`; local `JsPdfWithAutoTable` cast
      for `doc.autoTable(...)` (`design.md` Section 22).
- [x] `src/features/workers/documents/index.ts` — same barrel re-exports, typed.
- [x] `src/features/workers/documents/WorkerDocumentsView.tsx` —
      `WorkerDocumentsViewProps { workerId: number }`; preserved
      `selectedFiles`/`fileInputVersions`/`fileInputRefs` state exactly (including
      the un-deleted-on-null `selectedFiles` write), upload/replace/delete/
      view/download/report flows, and the `document`-shadowing parameter name
      (`design.md` Section 23). Removed the now-dead
      `// eslint-disable-next-line react/prop-types` comment. Deleted
      `WorkerDocumentsView.jsx`.
- [x] No other file modified; `apiWorkerDocuments.js`, `src/types/supabase.ts`,
      `src/pages/MyDocuments.jsx`, `src/pages/Records/WorkerDocuments.jsx`,
      `eslint.config.js`, `tsconfig.json`, `package.json` all untouched.

### Verification — results

- [x] `bun run typecheck` — failed twice against distinct real issues
      (`design.md` Sections 21–22), each fixed with a local, type-only cast.
      Final run: clean, no errors.
- [x] `bun run build` — implementer reported a clean pass, `✓ built in 5.30s`,
      no diagnostics. Independent review ran `timeout 180s bun run build`; it
      timed out after Vite printed `$ vite build` with no diagnostics. Treat as a
      local environment caveat and rerun before commit if a fresh build transcript
      is required.
- [x] `bun run lint` — total: **206 problems (202 errors, 4 warnings)** —
      unchanged from the 206 baseline, exactly matching Section 24's prediction.
      Confirmed no Phase 3 file appears in the lint output.
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 12
      `documents/` renames, `useWorker.ts`, and
      `openspec/changes/convert-workers-documents-to-ts/**`. No other file.

## Phase 4: related pages/import-path fixes — NO CODE CHANGES NEEDED

- [x] Verified `src/pages/MyDocuments.jsx` and
      `src/pages/Records/WorkerDocuments.jsx` already import
      `WorkerDocumentsView` extension-less, so the Phase 4 import-fix work is a
      no-op.
- [ ] Converting either page remains out of scope; do not begin without explicit
      instruction.

## Not in scope for this change (any phase)

- [ ] Converting `src/services/apiWorkerDocuments.js`, `apiWorkers.js`,
      `apiProfiles.js`, or any `src/features/authentication/**` file (including
      `useLinkWorkerAccount.js`, already confirmed bug-free).
- [ ] Running Supabase codegen / editing `src/types/supabase.ts` to add the
      missing `worker_document_categories`/`worker_document_types`/
      `worker_documents` table types (`design.md` Section 18) — flagged as a
      real gap, deliberately left for a separate change.
- [ ] Converting `src/pages/MyDocuments.jsx`, `src/pages/Records/WorkerDocuments.jsx`.
- [ ] Any Supabase query, storage bucket/path, React Query key, invalidation,
      auth/role-gate, RLS assumption, or worker-account-creation-flow change.
- [ ] Converting any schedules, pages, or other out-of-scope file that imports
      `useWorkers`.
