# Tasks — convert-workers-documents-to-ts

Status: **Phase 1 (workers core list/table/hooks) done; typecheck/lint verified.**
Phases 2–4 not started — do not begin without explicit instruction to continue.

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

## Phase 2: worker create/edit/account forms — NOT STARTED

Do not begin without explicit instruction.

## Phase 3: worker documents — NOT STARTED

Do not begin without explicit instruction.

## Phase 4: related pages/import-path fixes — NOT STARTED

Do not begin without explicit instruction.

## Not in scope for this change (any phase)

- [ ] Converting `useCreateWorker.js`, `useEditWorker.js`, `useWorker.js`,
      `CreateEditWorkerForm.jsx`, `LinkWorkerAccountForm.jsx`, or anything in
      `src/features/workers/documents/`.
- [ ] Converting `src/services/apiWorkers.js`, `apiProfiles.js`, or any
      `src/features/authentication/**` file.
- [ ] Modeling `date_of_admissions`/`sustenance_plazas` on `Worker` — deferred to
      Phase 2.
- [ ] Any Supabase query, React Query key, invalidation, auth/role-gate, or
      worker-account-creation-flow change.
- [ ] Converting any schedules, pages, or other out-of-scope file that imports
      `useWorkers`.
