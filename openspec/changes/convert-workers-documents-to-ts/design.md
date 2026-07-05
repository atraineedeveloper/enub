# Design: Convert Workers/Documents to TS

Multi-phase change. **Only Phase 1 (workers core list/table/hooks) is implemented in
this pass**, per explicit instruction. Phases 2–4 are not designed in detail yet.

## 1. `Worker` type — base Row only, embeds deliberately deferred

```ts
export type Worker = Database["public"]["Tables"]["workers"]["Row"];
```

`workers` has no `Relationships` of its own in `src/types/supabase.ts` (it's the
"one" side of every FK pointing at it, never the "many" side of one pointing away).
`apiWorkers.js`'s `getWorkersFull()` — used whenever `useWorkers({ fullDetails: true })`
is called — embeds `date_of_admissions(*)` and `sustenance_plazas(*)`. Checked both
child tables' `Relationships`: `date_of_admissions.worker_id` and
`sustenance_plazas.worker_id` both point *at* `workers.id` with `isOneToOne: false`
— meaning these are **to-many** embeds from `workers`' perspective, so Supabase
returns them as **arrays** (`DateOfAdmissionRow[]`, `SustenancePlazaRow[]`), never
`null` — the opposite shape from every to-one embed typed in prior phases
(`Subject`→`degrees`, `Group`→`degrees`, `Role`→`workers`, all `Row | null`).

Neither is modeled on `Worker` in this phase: grepped `WorkerRow.jsx`/`WorkerTable.jsx`
for `date_of_admissions`/`sustenance_plazas` — neither field is ever read by either
file. Adding them to `Worker` now would type data no Phase 1 consumer touches, and
`useWorkers()` is called both with `fullDetails: true` (which actually has these
fields, populated) and `fullDetails: false` (`getWorkers()`, a plain `select("*")`
with no embeds at all — the shape genuinely differs by call site). Modeling that
distinction precisely would need either a discriminated/overloaded return type or a
second exported type — real work, deferred to Phase 2 (`CreateEditWorkerForm.jsx`),
where these two fields are actually read and written for the plaza/admission-date
editing UI. This is a deliberate, documented scoping boundary, not an oversight.

## 2. Which hooks are "Phase 1" — verified by dependency, not just directory

`src/features/workers/` (excluding `documents/`) has 7 files. Phase 1 takes exactly
the 4 that a clean conversion of `WorkerRow.tsx`/`WorkerTable.tsx` requires:

- `useWorkers.js` — the list hook both files use directly.
- `useLinkedWorkerAccounts.js` — `WorkerRow.jsx` calls it directly
  (`const { linkedWorkerIds, isLoading: isLoadingLinkedAccounts } = useLinkedWorkerAccounts();`)
  to decide which of 3 account-action menu items (`Crear cuenta de acceso`,
  `Reenviar enlace de acceso`, `Vincular cuenta existente`) to show. Without typing
  this hook too, `WorkerRow.tsx` couldn't cleanly type `linkedWorkerIds.has(worker.id)`.

The other 3 are out of scope, confirmed by checking their actual consumers rather
than assuming from directory location:

- `useCreateWorker.js`/`useEditWorker.js` — grepped: only imported by
  `CreateEditWorkerForm.jsx` (Phase 2). Not touched.
- `useWorker.js` (singular) — grepped every importer across `src/`: the **only** one
  is `src/features/workers/documents/WorkerDocumentsView.jsx` (Phase 3). Despite
  living in the same directory as the Phase 1 files, it has zero Phase 1/2
  consumers, so it's deferred to whichever phase actually converts its real
  consumer.

## 3. `useLinkedWorkerAccounts.ts`

```ts
export function useLinkedWorkerAccounts() {
  const { isAdmin } = useProfile();

  const { data, isLoading } = useQuery<number[]>({
    queryKey: ["linked-worker-accounts"],
    queryFn: getLinkedWorkerIds,
    enabled: isAdmin,
  });

  return {
    isLoading: isAdmin && isLoading,
    linkedWorkerIds: new Set(data ?? []),
  };
}
```

`getLinkedWorkerIds` (`apiProfiles.js`, out of scope, untyped) returns
`data.map((row) => row.worker_id)` — a plain array of the `profiles.worker_id`
column's values for `role = "worker"` rows. Typed the `useQuery` generic as
`number[]` — matching how the returned `Set` is actually used
(`linkedWorkerIds.has(worker.id)`, where `worker.id: number`) — rather than
threading `apiProfiles.js`'s own (untyped) inference through, consistent with every
prior hook in this migration typing the `useQuery` generic directly rather than
fixing the untyped service layer underneath it.

## 4. `WorkerRow.tsx` — removing a now-dead `eslint-disable` comment

`WorkerRow.jsx` opens with `/* eslint-disable react/prop-types */` — an existing,
file-wide suppression of exactly the rule this whole migration has been retiring
per-file as each component gets real types. Once `WorkerRowProps { worker: Worker }`
exists, `react/prop-types` has nothing left to flag in this file (confirmed: 0
entries for this file in the baseline, consistent with the comment either
suppressing errors that no longer apply or having suppressed 0 to begin with — either
way, once real types exist the directive is provably inert). Removed as part of the
conversion — this is the same category of cleanup as removing `GroupRow.jsx`'s dead
`role="row"` prop in `convert-admin-catalog-features-to-ts`: a directly-encountered,
now-provably-dead artifact in the file being converted, not a separate lint fix.

`name?.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()` (the
`initials` computation) — only the first link (`?.`) is optional-chained, but per JS/TS
optional-chaining semantics, one `?.` short-circuits the **entire** remaining chain
if the left side is nullish (not just the immediately-following property) — so this
was already safe at runtime, and TypeScript's control-flow understanding of `?.`
confirms it needs no additional assertions or guards anywhere in the chain.

## 5. `WorkerTable.tsx`

No props; `handleSearch` typed `(e: ChangeEvent<HTMLInputElement>)`; non-null
assertion on `worker.name!.toLowerCase()` in the filter, matching the existing
no-guard behavior (same pattern as every prior feature table's name/code filter).
`Row` and `usePagination` are both already properly typed (from
`fix-ts-migration-blockers`) — this is the **first** feature table in the whole
migration that needs **no** local cast for either, confirming that cleanup's payoff.

## 6. Pre-conversion lint baseline (confirmed via `bun run lint`, per file)

| File | `react/prop-types` |
|---|---:|
| `WorkerRow.jsx` | 0 (suppressed by its own `/* eslint-disable react/prop-types */`) |
| `WorkerTable.jsx` | 0 (no props) |
| `useWorkers.js` | 0 (not a component) |
| `useLinkedWorkerAccounts.js` | 0 (not a component) |

Total to remove: **0**. This phase's payoff is type coverage and dead-comment
removal, not a lint-count drop — flagged up front so the verification step doesn't
misread "no change" as a failure.

## 6b. Unplanned discovery: `CreateEditWorkerForm.jsx`/`LinkWorkerAccountForm.jsx`'s `onCloseModal` inferred as required

`bun run typecheck` initially failed in both `WorkerRow.tsx` and `WorkerTable.tsx`:
`Property 'onCloseModal' is missing in type '{...}' but required in type
'{ workerToEdit?: {}; onCloseModal: any; }'`. Neither `.tsx` file ever passes
`onCloseModal` to `<CreateEditWorkerForm>`/`<LinkWorkerAccountForm>` at their JSX
call sites — it's always supplied later, at runtime, by `Modal.Window`'s
`cloneElement(children, { onCloseModal: close })` injection (or never called at
all, since both components already guard every use with `onCloseModal?.()`).

Cause: both components (untyped, out of scope — Phase 2) destructure
`onCloseModal` with **no default value**
(`function CreateEditWorkerForm({ workerToEdit = {}, onCloseModal }) { ... }`).
TypeScript's `allowJs` inference for an untyped function parameter with no default
and no other evidence of optionality infers it as **required** — unlike
`workerToEdit`, which has a `= {}` default and so infers as optional. This is a new
variant of the same "untyped out-of-scope component's real contract is looser than
what TS infers" class of issue seen repeatedly in this migration (`Button.jsx`,
`Row.jsx`, `useOutsideClick.js`), just triggered by a missing default parameter
rather than a missing type annotation.

Fixed with a local, type-only cast at each of the two `.tsx` call sites — **not** by
adding a default value to either out-of-scope `.jsx` file:

```ts
import UntypedCreateEditWorkerForm from "./CreateEditWorkerForm";
const CreateEditWorkerForm = UntypedCreateEditWorkerForm as ComponentType<{
  workerToEdit?: Worker;
  onCloseModal?: () => void;
}>;
```

(and the `LinkWorkerAccountForm`/`{ workerId: number; onCloseModal?: () => void }`
equivalent in `WorkerRow.tsx`). Zero runtime effect — same imported component,
neither `.jsx` file touched. This will recur for any future `.tsx` file that renders
either component directly (outside a `Modal.Window`'s `cloneElement` injection
path) until Phase 2 converts them.

## 7. Explicit-extension import check

Grepped `src/` for `workers/WorkerRow.jsx`, `workers/WorkerTable.jsx`,
`workers/useWorkers.js`, `workers/useLinkedWorkerAccounts.js` (the pattern that broke
builds in 3 prior changes). **Zero matches.** Also confirmed every out-of-scope
consumer of `useWorkers` (`CreateEditScholarSchedule.jsx`, `EditScholarSchedule.jsx`,
`CreateEditRoleForm.tsx`, `Dashboard.jsx`, `ScheduleDashboard.jsx`) imports
extension-less already.

## 8. Verification plan — results

Baseline going in: **208 problems (204 errors, 4 warnings)**.

- [x] `bun run typecheck` — failed once (Section 6b, the `onCloseModal`
      inferred-required issue), fixed with a local cast in both files, then passes
      with no errors.
- [x] `bun run build` — implementer reported a clean pass. Independent review ran
      `timeout 180s bun run build`; it timed out after Vite printed `$ vite build`
      with no diagnostics. Treat as a local environment caveat and rerun before
      commit if a fresh build transcript is required.
- [x] `bun run lint` — total: **208 problems (204 errors, 4 warnings)** — unchanged
      from baseline, exactly as predicted (Section 6: none of the 4 files
      contributed any `react/prop-types` errors to begin with).
- [x] `git status`/`git diff --stat` — changed-file set is exactly: the 4 renames
      (`WorkerRow`/`WorkerTable`/`useWorkers`/`useLinkedWorkerAccounts`) and this
      change's own `proposal.md`/`design.md`/`tasks.md`. No other file —
      `apiWorkers.js`, `apiProfiles.js`, `authentication/**`,
      `CreateEditWorkerForm.jsx`, `LinkWorkerAccountForm.jsx`, `Row.tsx`,
      `usePagination.ts`, `eslint.config.js`, `tsconfig.json`, `package.json` all
      untouched.
