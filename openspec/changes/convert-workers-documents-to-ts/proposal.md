# Proposal: Convert Workers/Documents to TS

## Status

Draft — Phase 1 (workers core list/table/hooks) implemented in this pass. Phase 2
(worker create/edit/account forms), Phase 3 (worker documents), and Phase 4
(related-page import fixes) not started.

## Why

This is the largest single domain left in the TS migration — the `workers` feature
has more files, more auth-adjacent hooks, and (in Phase 3) a whole documents
sub-module, so it's split into 4 phases inside one OpenSpec change, same rationale as
`convert-admin-catalog-features-to-ts`. Per explicit instruction, only Phase 1 is
implemented now.

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
  to-one embeds typed in every prior phase). **Not modeled in `Worker` this phase**:
  neither `WorkerRow.jsx` nor `WorkerTable.jsx` reads either field — only
  `CreateEditWorkerForm.jsx` (Phase 2) does, for its plaza/admission-date editing UI.
  Modeling them now would be typing data no Phase 1 consumer touches; deferred to
  Phase 2, where they're actually read.
- `src/services/apiWorkers.js`, `apiProfiles.js` not converted — out of scope, same
  reasoning as every prior phase's service files.
- `src/features/authentication/useProfile.js`, `useCreateWorkerAccount.js`,
  `useResendWorkerAccessLink.js` not converted — a different feature domain,
  consumed via `allowJs` interop exactly as before.
- `useWorker.js`, `useCreateWorker.js`, `useEditWorker.js`,
  `CreateEditWorkerForm.jsx`, `LinkWorkerAccountForm.jsx` not converted — Phase 2/3,
  per the scoping decision above.
- No Supabase call, React Query key/`staleTime`/invalidation, auth/role-gate logic,
  worker-account-creation flow, or document behavior changed anywhere.
- No dependency added; `eslint.config.js`/`tsconfig.json`/`package.json` untouched.

## Impact

- **Affected code:** 4 files renamed (2 `.jsx` → `.tsx`, 2 `.js` → `.ts`). No other
  file (see `design.md` for the explicit-extension-import grep result — none found).
- **Affected lint baseline:** all 4 files currently produce **0** `react/prop-types`
  errors — `WorkerRow.jsx` because of its existing disable comment, the other 3
  because they're either prop-less or not components — so no lint-count change is
  expected from this phase specifically; see `design.md` for the exact verified
  before/after.
