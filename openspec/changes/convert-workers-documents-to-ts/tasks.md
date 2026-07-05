# Tasks — convert-workers-documents-to-ts

Status: **Phase 1 (workers core list/table/hooks) and Phase 2 (worker create/edit/
account forms) done; typecheck/lint verified.** Phases 3–4 not started — do not
begin without explicit instruction to continue.

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

## Phase 3: worker documents — NOT STARTED

Do not begin without explicit instruction.

## Phase 4: related pages/import-path fixes — NOT STARTED

Do not begin without explicit instruction.

## Not in scope for this change (any phase)

- [ ] Converting `useWorker.js` (singular) or anything in
      `src/features/workers/documents/` — Phase 3.
- [ ] Converting `src/services/apiWorkers.js`, `apiProfiles.js`, or any
      `src/features/authentication/**` file (including `useLinkWorkerAccount.js`,
      already confirmed bug-free).
- [ ] Any Supabase query, React Query key, invalidation, auth/role-gate, or
      worker-account-creation-flow change.
- [ ] Converting any schedules, pages, or other out-of-scope file that imports
      `useWorkers`.
