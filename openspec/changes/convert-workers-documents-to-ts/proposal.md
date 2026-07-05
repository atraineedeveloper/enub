# Proposal: Convert Workers/Documents to TS

## Status

Draft — Phase 1 (workers core list/table/hooks), Phase 2 (worker create/edit/
account forms), and Phase 3 (worker documents) implemented. Phase 4's related-page
import-fix check is a no-op because both page imports are already extension-less;
the pages themselves remain unconverted.

## Why

This is the largest single domain left in the TS migration — the `workers` feature
has more files, more auth-adjacent hooks, and (in Phase 3) a whole documents
sub-module, so it's split into 4 phases inside one OpenSpec change, same rationale as
`convert-admin-catalog-features-to-ts`. Per explicit instruction, Phases 1–3 are
implemented now; related-page import fixes were checked and found unnecessary.

Phase 1 targets the **read/list side** of `src/features/workers/` — `WorkerRow.jsx`,
`WorkerTable.jsx`, `useWorkers.js`, plus `useLinkedWorkerAccounts.js` (a hook
`WorkerRow.jsx` directly depends on for its account-action menu items). This mirrors
the pattern used for every prior feature-module phase: convert the listing/table
layer before the create/edit forms.

## Scoping decision: which hooks belong to Phase 1

`src/features/workers/` has 7 non-documents files. Only 4 are Phase 1:

- `WorkerRow.jsx`, `WorkerTable.jsx` — the list/table UI.
- `useWorkers.js` — the list-fetching hook both of the above depend on.
- `useLinkedWorkerAccounts.js` — fetches which workers already have a linked
  self-service account, consumed directly by `WorkerRow.jsx` to decide which
  account-action menu items to show. Included because it's a direct dependency of a
  Phase 1 target file, not because it's independently in scope.

The other 3 are explicitly **not** Phase 1:

- `useCreateWorker.js`, `useEditWorker.js` — only consumed by
  `CreateEditWorkerForm.jsx` (Phase 2).
- `useWorker.js` (singular — fetch-by-id) — grepped every importer: its **only**
  consumer anywhere in `src/` is `src/features/workers/documents/WorkerDocumentsView.jsx`
  (Phase 3). Not touched here even though it lives in the same top-level directory as
  the Phase 1 files.

## What changes (Phase 1)

- `src/features/workers/useWorkers.ts` — exports `Worker` (generated `workers` Row —
  no embedded relations modeled; see "What does not change" for why),
  `useQuery<Worker[]>`.
- `src/features/workers/useLinkedWorkerAccounts.ts` — typed
  `useQuery<number[]>` for the linked-worker-id list; `linkedWorkerIds: Set<number>`
  return shape unchanged.
- `src/features/workers/WorkerRow.tsx` — `WorkerRowProps { worker: Worker }`. The
  file's existing `/* eslint-disable react/prop-types */` comment is removed — once
  `worker` has a real type, the rule it was suppressing no longer fires, so the
  comment is provably dead code, not a suppression of anything real anymore.
- `src/features/workers/WorkerTable.tsx` — no props; `handleSearch` typed; non-null
  assertion on `worker.name!.toLowerCase()` in the filter (existing no-guard
  behavior, preserved).

## What does not change

- `getWorkersFull()` (used whenever `useWorkers({ fullDetails: true })` is called,
  which `WorkerTable.tsx` always does) actually embeds `date_of_admissions(*)` and
  `sustenance_plazas(*)` — both real, to-many child relations (their own FK points
  *at* `workers`, so Supabase returns them as arrays, never `null`, unlike the
  to-one embeds typed in every prior phase). These embeds are now modeled separately
  as `WorkerWithDetails` for Phase 2's form usage, while the base `Worker` type
  remains a plain generated `workers` row because Phase 1 list/table rendering does
  not read either field.
- `src/services/apiWorkers.js`, `apiProfiles.js` not converted — out of scope, same
  reasoning as every prior phase's service files.
- `src/features/authentication/useProfile.js`, `useCreateWorkerAccount.js`,
  `useResendWorkerAccessLink.js` not converted — a different feature domain,
  consumed via `allowJs` interop exactly as before.
- `useWorker.js` (singular) is not converted — Phase 3, per the scoping decision
  above.
- No Supabase call, React Query key/`staleTime`/invalidation, auth/role-gate logic,
  worker-account-creation flow, or document behavior changed anywhere.
- No dependency added; `eslint.config.js`/`tsconfig.json`/`package.json` untouched.

## Impact (Phase 1)

- **Affected code:** 4 files renamed (2 `.jsx` → `.tsx`, 2 `.js` → `.ts`). No other
  file (see `design.md` for the explicit-extension-import grep result — none found).
- **Affected lint baseline:** all 4 files currently produce **0** `react/prop-types`
  errors — `WorkerRow.jsx` because of its existing disable comment, the other 3
  because they're either prop-less or not components — so no lint-count change is
  expected from this phase specifically; see `design.md` for the exact verified
  before/after.

## Why create/edit/account forms second

Phase 2 converts the most complex file in the entire TS migration so far —
`CreateEditWorkerForm.jsx` — a single form covering create *and* edit, with a
profile-picture upload/preview flow, and two `useFieldArray` field arrays
(`sustenance_plazas`, `date_of_admissions`) whose row shapes need to be modeled since
this is the first place in the migration that actually reads/writes them. It also
converts `LinkWorkerAccountForm.jsx` (a small, self-contained form) and the two
mutation hooks both create/edit forms depend on.

## What changes (Phase 2)

- `src/features/workers/useWorkers.ts` (Phase 1 file, extended, not rewritten) —
  adds two new exports: `DateOfAdmission`/`SustenancePlaza` (generated Row types for
  the two child tables) and `WorkerWithDetails = Worker & { date_of_admissions: DateOfAdmission[]; sustenance_plazas: SustenancePlaza[] }`
  — the array-cardinality embed Phase 1 deliberately deferred (see that phase's
  design.md Section 1). `useWorkers()`'s own signature/behavior is unchanged; this is
  purely an additive export for the one new consumer that needs it.
- `src/features/workers/useCreateWorker.ts`, `useEditWorker.ts` — local
  mutation-variables interfaces; **`isLoading` → `isPending`**, per explicit
  instruction (see "Behavior change" below) — reverts the same historical bug this
  migration already fixed once in `fix-ts-migration-blockers`, this time built
  correctly into the file's first-ever type-checked version rather than reproduced
  and re-flagged.
- `src/features/workers/CreateEditWorkerForm.tsx` —
  `CreateEditWorkerFormProps { workerToEdit?: Partial<WorkerWithDetails>; onCloseModal?: () => void }`.
  Same structure, same `useFieldArray` usage, same file-upload/preview logic, same
  submit-time `delete data.field` normalization — only typed.
- `src/features/workers/LinkWorkerAccountForm.tsx` —
  `LinkWorkerAccountFormProps { workerId: number; onCloseModal?: () => void }`. The
  file's existing `// eslint-disable-next-line react/prop-types` comment is removed
  — same "provably dead once real types exist" cleanup as `WorkerRow.jsx` in Phase 1.
- **Cleanup in Phase 1 files, now unnecessary**: the local
  `UntypedCreateEditWorkerForm as ComponentType<{...}>` /
  `UntypedLinkWorkerAccountForm as ComponentType<{...}>` casts added in
  `WorkerRow.tsx`/`WorkerTable.tsx` (Phase 1, to work around these two forms being
  untyped) are removed — both files now import the two forms directly, since they
  supply real types themselves.

## Behavior change (intentional, explicitly authorized): `isLoading` → `isPending`

`useCreateWorker.js`/`useEditWorker.js` had the exact same
`isLoading`-doesn't-exist-on-`UseMutationResult` bug already found and fixed
elsewhere in this migration (`fix-ts-migration-blockers`) — `isCreating`/`isEditing`
has always been `undefined`, so `disabled={isWorking}` (`isWorking = isEditing || isCreating`)
has never actually disabled any field in either the create or edit form during
submission. Per explicit instruction for this phase ("use TanStack Query v5 pending
state correctly... do not reintroduce `isLoading`"), this is fixed directly during
the first-ever type-checked version of these two files, rather than reproduced with
the historical cast-and-flag workaround. Fields in both forms will now actually
disable while their mutation is pending. Nothing else about either mutation changes
— same `mutationFn`, `onSuccess`, `onError`, query key/invalidation.

## What does not change (Phase 2, additional to Phase 1's list)

- `src/features/authentication/useLinkWorkerAccount.js` (used by
  `LinkWorkerAccountForm.jsx`) is **not** converted — a different feature domain,
  out of scope. Checked it directly: it already correctly uses `isPending: isLinking`
  (no historical bug here to begin with), so no behavior changes for this form's
  loading state.
- `useWorker.js` (singular) — still not touched; its only consumer remains
  `WorkerDocumentsView.jsx` (Phase 3).
- No Supabase call, React Query key/`staleTime`/invalidation (beyond the
  `isLoading`→`isPending` rename), auth/role-gate logic, or worker-account-creation
  flow changed.
- No UI copy, styling, layout, validation rule, default value, or reset/close-modal
  behavior changed.
- No dependency added; `eslint.config.js`/`tsconfig.json`/`package.json` untouched.

## Impact (Phase 2)

- **Affected code:** 4 files renamed (2 `.jsx` → `.tsx`, 2 `.js` → `.ts`); 2 Phase 1
  files (`WorkerRow.tsx`, `WorkerTable.tsx`) have their now-unnecessary local casts
  removed. No other file.
- **Affected lint baseline:** `react/prop-types` errors disappear for
  `CreateEditWorkerForm` (2). `LinkWorkerAccountForm`/`useCreateWorker`/
  `useEditWorker` had 0 to begin with (the first via its own disable comment, the
  other two because they're not components).

## Why worker documents third

Phase 3 converts the last remaining piece of `src/features/workers/` (excluding
Phase 4's related-page import fixes): the entire `documents/` sub-module (12 files)
plus `useWorker.js` (singular, fetch-by-id), whose only consumer anywhere in `src/`
is this sub-module's `WorkerDocumentsView.jsx`. This is the module shared by both
the staff/admin `/workers/:id/documents` route and the worker self-service
`/my-documents` route (see `docs/ai/architecture.md`'s "Worker documents module"
section) — upload, replace, delete, signed-url view/download, and PDF report
generation all live here.

## Unplanned discovery: `worker_document_categories`/`worker_document_types`/`worker_documents` are missing from `src/types/supabase.ts`

All three tables exist in the database (`supabase/migrations/20260702145810_worker_document_categories.sql`,
`20260702145829_worker_document_types.sql`, `20260702145830_worker_documents.sql`,
plus later RLS-policy migrations) and are actively used by `apiWorkerDocuments.js`,
but none appear anywhere in the generated `src/types/supabase.ts` — that file
predates these tables and was never regenerated afterward. Since regenerating
Supabase types (running codegen) is a separate concern from this migration and
touches a shared, out-of-scope generated file, this phase hand-rolls local
interfaces matching the migrations' actual columns instead (`WorkerDocumentType`,
`WorkerDocumentCategory` in `useWorkerDocumentCatalog.ts`; `WorkerDocument` in
`useWorkerDocuments.ts`) — see `design.md` for the full reasoning and column-by-
column mapping. This is flagged here because it's a real gap a future
types-regeneration change should close, not an oversight in this phase.

## What changes (Phase 3)

- `src/features/workers/useWorker.ts` — typed `useQuery<Worker>`, reusing the
  `Worker` type already exported by `useWorkers.ts` (Phase 1). Same return shape.
- `src/features/workers/documents/workerDocumentKeys.ts` — typed key-builder
  functions and `invalidateWorkerDocumentQueries(queryClient: QueryClient, workerId?: number | null)`.
- `src/features/workers/documents/useWorkerDocumentCatalog.ts` — exports the
  hand-rolled `WorkerDocumentType`/`WorkerDocumentCategory` interfaces (see above);
  `useQuery<WorkerDocumentCategory[]>`.
- `src/features/workers/documents/useWorkerDocuments.ts` — exports the hand-rolled
  `WorkerDocument` interface (base row only; see "What does not change"); typed
  `useQuery<WorkerDocument[]>`.
- `src/features/workers/documents/useWorkerDocumentsBySemester.ts` — same
  `WorkerDocument[]` typing, `semesterId: number | string` param.
- `src/features/workers/documents/useWorkerDocumentSignedUrl.ts` — `useQuery<string>`.
- `src/features/workers/documents/useUploadWorkerDocument.ts`,
  `useReplaceWorkerDocument.ts` — local mutation-variables interfaces; a local cast
  on the imported `uploadWorkerDocument`/`replaceWorkerDocument` service functions
  (same "untyped JS destructured-default narrows the param" friction as Phase 2's
  `createEditWorkers` cast).
- `src/features/workers/documents/useDeleteWorkerDocument.ts` — typed, no cast
  needed (the service function's single `documentId` param has no default, so TS
  infers it as `any`, and its return type is inferred correctly from the function's
  own two return statements).
- `src/features/workers/documents/useWorkerDocumentReportData.ts` — exports
  `WorkerDocumentReportData` (worker projection via `Pick<Worker, "id" | "name" | "RFC" | "type_worker" | "status">`,
  `semester: Semester | null`, `categories: WorkerDocumentReportCategory[]`); a local
  cast on `getWorkerDocumentReportData` (same default-parameter-narrowing friction).
- `src/features/workers/documents/generateWorkerDocumentReportPdf.ts` — typed
  against `WorkerDocumentReportData`; local cast for `jsPDF.autoTable` (the
  installed `jspdf-autotable` version's bundled types don't augment `jsPDF` with an
  instance method, only a standalone function — see `design.md`).
- `src/features/workers/documents/index.ts` — same barrel re-exports, typed.
- `src/features/workers/documents/WorkerDocumentsView.tsx` —
  `WorkerDocumentsViewProps { workerId: number }`. Same structure, same
  upload/replace/delete/view/download/report flows, same `useState`/`useRef`/
  `useEffect`/`useMemo` usage — only typed. The file's existing
  `// eslint-disable-next-line react/prop-types` comment is removed — same
  "provably dead once real types exist" cleanup as `WorkerRow.jsx`/
  `LinkWorkerAccountForm.jsx` in Phases 1–2.

## What does not change (Phase 3)

- `src/services/apiWorkerDocuments.js` not converted — out of scope, same
  reasoning as every other service file in this migration; every Supabase call,
  storage bucket/path, and RLS-dependent behavior it implements is preserved
  exactly, unread.
- `src/types/supabase.ts` not edited and no Supabase codegen run — the missing-
  tables gap above is documented, not fixed, in this phase.
- No Supabase call, storage bucket/path, React Query key/staleTime/invalidation,
  upload/replace/delete/view/download/report behavior, auth/role-gate, RLS
  assumption, or worker self-service permission changed anywhere.
- `src/pages/MyDocuments.jsx`, `src/pages/Records/WorkerDocuments.jsx` (both
  `WorkerDocumentsView`'s only call sites) not converted; no import-path edit was
  needed because both already import `WorkerDocumentsView` extension-less.
- No dependency added; `eslint.config.js`/`tsconfig.json`/`package.json` untouched.

## Impact (Phase 3)

- **Affected code:** 12 files in `src/features/workers/documents/` renamed (1
  `.jsx` → `.tsx`, 11 `.js` → `.ts`), plus `src/features/workers/useWorker.js` →
  `useWorker.ts`. No other file (confirmed via explicit-extension-import grep —
  none found).
- **Affected lint baseline:** all 13 files produced **0** `react/prop-types`
  errors before conversion (`WorkerDocumentsView.jsx` via its own disable comment,
  the rest because they're not components) — no lint-count change expected from
  this phase specifically; see `design.md` for the exact verified before/after.
