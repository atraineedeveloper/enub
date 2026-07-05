# Design: Convert Workers/Documents to TS

Multi-phase change. **Phase 1 (workers core list/table/hooks), Phase 2 (worker
create/edit/account forms), and Phase 3 (worker documents) are implemented.**
Phase 4 is not designed in detail yet; do not begin without explicit instruction.

## 1. `Worker` type — base Row plus Phase 2 detail export

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

These embeds stay off the base `Worker` type: grepped
`WorkerRow.jsx`/`WorkerTable.jsx` for `date_of_admissions`/`sustenance_plazas` —
neither field is ever read by either Phase 1 file. Also, `useWorkers()` is called
both with `fullDetails: true` (which actually has these fields populated) and
`fullDetails: false` (`getWorkers()`, a plain `select("*")` with no embeds at all),
so the shape genuinely differs by call site. Phase 2 adds the separate
`WorkerWithDetails` export for `CreateEditWorkerForm.tsx`, where these two fields
are actually read and written for the plaza/admission-date editing UI.

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

## Phase 2: worker create/edit/account forms

### 9. `WorkerWithDetails` — the embed typing deferred in Phase 1, now needed

`CreateEditWorkerForm.jsx` reads and writes `workerToEdit.date_of_admissions` and
`workerToEdit.sustenance_plazas` (for the plaza/admission-date `useFieldArray` rows),
which Phase 1 deliberately left off `Worker` (Section 1 above). Added to
`useWorkers.ts`:

```ts
export type DateOfAdmission =
  Database["public"]["Tables"]["date_of_admissions"]["Row"];
export type SustenancePlaza =
  Database["public"]["Tables"]["sustenance_plazas"]["Row"];

export type WorkerWithDetails = Worker & {
  date_of_admissions: DateOfAdmission[];
  sustenance_plazas: SustenancePlaza[];
};
```

Both to-many (`Row[]`, never `null`), confirmed again against the same
`Relationships` reasoning as Section 1: `date_of_admissions.worker_id` and
`sustenance_plazas.worker_id` both point *at* `workers.id`. `useWorkers()`'s own
return type is unchanged (still `Worker[]`) — `WorkerWithDetails` is only used as
`CreateEditWorkerFormProps.workerToEdit`'s type, since `WorkerTable.tsx` calls
`useWorkers({ fullDetails: true })` (which actually populates these fields via
`getWorkersFull()`) and passes a `worker` down through `WorkerRow` into the form.
A plain `Worker` (lacking these two fields) still structurally satisfies
`Partial<WorkerWithDetails>` since both are optional in the `Partial` — so
`WorkerTable`'s "add worker" call site (`<CreateEditWorkerForm />`, no
`workerToEdit` at all) and `WorkerRow`'s edit call site (`workerToEdit={worker}`)
both type-check with no cast.

### 10. `isLoading` → `isPending`: an intentional, authorized bug fix

`useCreateWorker.js`/`useEditWorker.js` both used
`const { mutate, isLoading } = useMutation({...})` — but TanStack Query v5 renamed
this field to `isPending` for mutations (`isLoading` no longer exists on the
mutation result type at all). This means `isCreating`/`isEditing` were **always
`undefined`** at runtime — every `disabled={isWorking}` in
`CreateEditWorkerForm.tsx` and every `disabled={isLinking}` equivalent silently
never disabled during submission. Explicitly instructed to fix this directly rather
than preserve-via-cast (the pattern used for genuinely-intended behavior elsewhere in
this migration): both hooks now destructure `isPending: isCreating` /
`isPending: isEditing`. Checked `useLinkWorkerAccount.js` (out of scope,
`authentication/`, consumed by `LinkWorkerAccountForm.tsx`) for the same bug — it
already correctly uses `isPending: isLinking`, so no change was needed there.
Runtime effect: forms now actually disable their inputs/buttons while a
create/edit mutation is in flight, which they never did before.

### 11. `useForm()` + object-literal `defaultValues` narrows the field-path union — unplanned discovery

`CreateEditWorkerForm.jsx` calls `useForm({ defaultValues: isEditSession ? {...} :
{...} })` with no generic (matching every other form in this migration). Unlike the
simpler forms already converted, this component also calls `register`/`watch`/
`setValue` with two field names — `"profile_picture_file"` and
`"remove_profile_picture"` — that don't appear anywhere in either `defaultValues`
branch (they're separate, unregistered-by-default fields backing the file input and
the "remove picture" checkbox). `bun run typecheck` failed here:
`Argument of type '"profile_picture_file"' is not assignable to parameter of type
"name" | "status" | ... | \`sustenance_plazas.${number}.plaza\``. Cause: passing a
concrete object literal as `defaultValues` with no explicit generic makes TS infer
`TFieldValues` **from that literal's own shape**, producing a closed union of
literal field-path strings instead of the open, effectively-`any` typing every
untyped `useForm()` call in this codebase has always implicitly relied on.

Fixed by giving `useForm` an explicit, loose generic and casting the
`defaultValues` literal to match it, rather than adding the two missing fields to
either `defaultValues` branch (which would change what react-hook-form treats as
"dirty"/reset-to on load — a real behavior change the original code doesn't have):

```ts
const { register, handleSubmit, reset, control, formState, watch, setValue } =
  useForm<FieldValues>({
    defaultValues: (isEditSession ? {...} : {...}) as FieldValues,
  });
```

This restores the same effectively-untyped `register`/`watch`/`setValue`/`errors`
behavior every other converted form in this migration already has (`FieldValues` is
react-hook-form's own `Record<string, any>`-shaped type) — not a new, weaker
pattern, just avoiding literal-inference narrowing that only triggers when
`defaultValues` is a concrete object and the form also touches fields outside it.

### 12. `createEditWorkers`'s inferred `options` parameter is narrower than its real contract — unplanned discovery

`apiWorkers.js` (untyped, out of scope) declares
`createEditWorkers(newWorker, id, { profilePictureFile = null, ... } = {})`. With no
JSDoc and `checkJs: false`, TS's `allowJs` inference derives each destructured
option's type from its **default value alone** — `profilePictureFile = null` infers
as `null`, not `File | null` (its real accepted type; the function assigns it into a
`FormData`/upload call broadcasting no argument-type constraint TS can see). This
surfaced as `Type 'CreateWorkerOptions' is not assignable to type '{
profilePictureFile?: null | undefined; ... }'` in both `useCreateWorker.ts` and
`useEditWorker.ts`. Same class of issue as every other untyped-dependency mismatch
in this migration (`Button.jsx`, `Row.jsx`, `onCloseModal`, Section 6b above) — a
default-value-only JS parameter with a narrower inferred type than its actual
runtime contract.

Fixed with a local, type-only cast of the imported function at each call site (not
by touching `apiWorkers.js`):

```ts
const createOrEditWorker = createEditWorkers as (
  newWorker: Record<string, unknown>,
  id: number | undefined,
  options?: CreateWorkerOptions // EditWorkerOptions in useEditWorker.ts
) => Promise<unknown>;
```

Zero runtime effect — same imported function, same call arguments; only the
compile-time signature TS checks against changes.

### 13. `LinkWorkerAccountForm.tsx`'s `onSubmit` — same object-literal-narrowing family, no `defaultValues` this time

`LinkWorkerAccountForm.tsx` calls bare `useForm()` (no `defaultValues` at all), so
`TFieldValues` defaults to react-hook-form's own `FieldValues`. Declaring
`onSubmit(data: { email: string })` as a named function (not inline) and passing it
to `handleSubmit(onSubmit)` failed: `Property 'email' is missing in type
'FieldValues' but required in type '{ email: string; }'` — `handleSubmit` requires
`onSubmit`'s parameter type to be assignable *from* `FieldValues`, and an
index-signature type doesn't guarantee a specific required property is present.
Fixed by typing `onSubmit(data: FieldValues)` directly and asserting
`data.email as string` at the one access site, matching the same
loosely-typed-by-design shape used everywhere else `useForm()` has no generic.

### 14. Removing the Phase 1 `onCloseModal` casts from `WorkerRow.tsx`/`WorkerTable.tsx`

Both files' local `ComponentType<{...}>` casts around `CreateEditWorkerForm`/
`LinkWorkerAccountForm` (Section 6b) existed solely because those two components
were still untyped `.jsx`. Now that both have real `Props` interfaces
(`onCloseModal?: () => void` — always optional, matching how both components
already call it via `onCloseModal?.()`), the casts are provably dead weight.
Replaced `import UntypedCreateEditWorkerForm from "./CreateEditWorkerForm"; const
CreateEditWorkerForm = UntypedCreateEditWorkerForm as ComponentType<{...}>;` with a
plain `import CreateEditWorkerForm from "./CreateEditWorkerForm";` in both files
(and the `LinkWorkerAccountForm` equivalent in `WorkerRow.tsx`). Zero behavior
change — same components, same JSX call sites.

### 15. Pre-conversion lint baseline (confirmed via `bun run lint`, per file)

| File | `react/prop-types` |
|---|---:|
| `CreateEditWorkerForm.jsx` | 2 (`workerToEdit`, `onCloseModal`) |
| `LinkWorkerAccountForm.jsx` | 0 (had its own `eslint-disable-next-line` comment) |
| `useCreateWorker.js` | 0 (not a component) |
| `useEditWorker.js` | 0 (not a component) |

Total to remove: **2**, both from `CreateEditWorkerForm.jsx` — matches the
baseline-to-206 delta recorded below.

### 16. Explicit-extension import check

Grepped `src/` for `workers/CreateEditWorkerForm.jsx`,
`workers/LinkWorkerAccountForm.jsx`, `workers/useCreateWorker.js`,
`workers/useEditWorker.js`. **Zero matches** — the only importers of the two form
components were `WorkerRow.tsx`/`WorkerTable.tsx` (Phase 1 files, both already
extension-less via their Phase 1 casts, updated in Section 14). Also confirmed
`useLinkWorkerAccount.js` (out of scope, `authentication/`) was not otherwise
touched.

### 17. Verification plan — results

Baseline going in: **208 problems (204 errors, 4 warnings)**.

- [x] `bun run typecheck` — failed 3 times against real, distinct issues (Sections
      11, 12, 13 above), each fixed with a local, type-only cast/annotation; no
      other files touched to make it pass. Final run: clean, no errors.
- [x] `bun run build` — implementer reported a clean pass, `✓ built in 5.47s`,
      no diagnostics. Independent review ran `timeout 180s bun run build`; it
      timed out after Vite printed `$ vite build` with no diagnostics. Treat as a
      local environment caveat and rerun before commit if a fresh build transcript
      is required.
- [x] `bun run lint` — total: **206 problems (202 errors, 4 warnings)** — exactly
      the predicted 2-error drop from the 208 baseline (Section 15), both
      `react/prop-types` on `CreateEditWorkerForm.jsx`'s `workerToEdit`/
      `onCloseModal`. Confirmed via a targeted grep that none of the 4 Phase 2 files
      (nor the two Phase 1 files touched for cast cleanup) appear anywhere in the
      lint output.
- [x] `git status`/`git diff --stat` — changed-file set is exactly: the 4 Phase 2
      renames (`CreateEditWorkerForm`/`LinkWorkerAccountForm`/`useCreateWorker`/
      `useEditWorker`), `WorkerRow.tsx`/`WorkerTable.tsx` (cast cleanup only),
      `useWorkers.ts` (new type exports), and this change's own `proposal.md`/
      `design.md`/`tasks.md`. No other file — `apiWorkers.js`, `apiProfiles.js`,
      `authentication/**` (including `useLinkWorkerAccount.js`), `useWorker.js`,
      `eslint.config.js`, `tsconfig.json`, `package.json` all untouched.

## Phase 3: worker documents

### 18. Unplanned discovery: three tables are entirely absent from `src/types/supabase.ts`

Before writing any hook, grepped `src/types/supabase.ts` for `worker_document` —
zero matches. Confirmed via `supabase/migrations/` that `worker_document_categories`,
`worker_document_types`, and `worker_documents` are real tables (created by
`20260702145810_worker_document_categories.sql`, `20260702145829_worker_document_types.sql`,
`20260702145830_worker_documents.sql`, with later RLS-policy migrations), actively
queried by `apiWorkerDocuments.js` — this isn't a naming mismatch, the generated
types file is simply stale relative to the database schema; it was never
regenerated after these tables were added.

Since running Supabase codegen is out of scope for this migration (it's a
tooling/process concern, not a per-file conversion, and would touch a large shared
generated file well beyond this phase's blast radius), hand-rolled interfaces were
written to match the migrations' actual columns exactly, in the same file as the
hook that first needs them (matching this migration's established pattern of
co-locating a Row type with its primary consuming hook):

```ts
// useWorkerDocumentCatalog.ts
export interface WorkerDocumentType {
  id: number;
  category_id: number;
  name: string;
  allows_multiple: boolean;
  sort_order: number;
  created_at: string;
}
export interface WorkerDocumentCategory {
  id: number;
  name: string;
  scope: "permanent" | "semester";
  sort_order: number;
  created_at: string;
  document_types: WorkerDocumentType[];
}

// useWorkerDocuments.ts
export interface WorkerDocument {
  id: number;
  worker_id: number;
  document_type_id: number;
  semester_id: number | null;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}
```

Every column's nullability was read directly off the `CREATE TABLE` statements
(e.g. `worker_documents.semester_id` has no `NOT NULL`, so `number | null`;
`uploaded_by` defaults to `auth.uid()` but has no `NOT NULL` either, so
`string | null`; every other column in both tables is `NOT NULL`). This is flagged
in `proposal.md` as a real gap for a future types-regeneration change to close —
not something this phase silently papers over.

### 19. `WorkerDocument`/`WorkerDocumentCategory` model only the base columns actually read — embeds deferred again

`apiWorkerDocuments.js`'s `getWorkerDocuments`/`getWorkerDocumentsBySemester` select
`"*, worker_document_types(*, worker_document_categories(*)), semesters(*)"` — real
embeds. But grepped `WorkerDocumentsView.tsx` (the only consumer of either hook) for
`.worker_document_types`/`.semesters` on a document object — **zero reads**; every
document field accessed is a base column (`document_type_id`, `file_name`,
`created_at`, `storage_path`, `id`). Consistent with every prior phase's rule
(`Worker`/`date_of_admissions` in Phase 1, deferred until Phase 2 actually read
them): `WorkerDocument` models the base row only, no embeds. The actual runtime
objects have more fields than the type declares — harmless, since nothing reads
them and TS's structural typing doesn't require an exact match for values obtained
through an untyped `queryFn` cast into a `useQuery<T>` generic (same pattern as
`Worker[]`/`Semester[]` throughout this migration).

Similarly, `getWorkerDocumentCategoriesAndTypes()`'s `document_types` field on each
category comes from a **plain JS array filter** (`groupDocumentTypesByCategory`),
not a Supabase embed at all — so `WorkerDocumentCategory.document_types:
WorkerDocumentType[]` is a real, always-populated array with no cardinality
question to resolve.

### 20. `useWorkerDocumentReportData.ts` — reusing `Worker` via `Pick`, not a new hand-rolled interface

`getWorkerDocumentReportData`'s worker query is `select("id, name, RFC, type_worker, status")`
— a strict subset of the `workers` table, which **is** in `src/types/supabase.ts`
(unlike the three tables in Section 18). Modeled as
`Pick<Worker, "id" | "name" | "RFC" | "type_worker" | "status">` rather than a
second hand-rolled interface — reuses the generated type per the standing
instruction to prefer `src/types/supabase.ts` wherever a table is actually present
in it, even for a projected subset of columns.

The rest of the report shape nests `WorkerDocumentCategory`/`WorkerDocumentType`
(Section 18) with the extra fields `addReportStatusToCategories` computes at
runtime (`documents`, `status`, `uploaded_at`, `file_name` on each document type) —
modeled as `WorkerDocumentReportDocumentType extends WorkerDocumentType` and
`WorkerDocumentReportCategory extends Omit<WorkerDocumentCategory, "document_types">`,
composed into `WorkerDocumentReportData { worker; semester: Semester | null; categories: WorkerDocumentReportCategory[] }`.
`semester: Semester | null` reuses `Semester` from `useSemesters.ts` (already typed,
`fix-ts-migration-blockers`-era), since `getWorkerDocumentReportData` does a plain
`semesters` table select when a `semesterId` is given, `null` otherwise (matching
the original `let semester = null` control flow exactly).

### 21. Recurring friction: untyped service functions with a defaulted param, again — three more instances, same fix as Phase 2 Section 12

Exactly the same class of issue as `createEditWorkers`'s `options` param (Phase 2
Section 12) recurred three times in this phase, each fixed the same way — a local,
type-only cast of the imported function at its one call site, `apiWorkerDocuments.js`
itself untouched:

- `uploadWorkerDocument`/`replaceWorkerDocument` — both destructure
  `{ workerId, documentTypeId, semesterId = null, file }`; the `semesterId = null`
  default narrows that property to bare `null`, rejecting the real
  `number | string | null` values callers pass. Cast in
  `useUploadWorkerDocument.ts`/`useReplaceWorkerDocument.ts`.
- `getWorkerDocumentReportData(workerId, semesterId = null)` — a plain (not
  destructured) defaulted parameter; same narrowing (`bun run typecheck`:
  `Argument of type 'string | number | null' is not assignable to parameter of type
  'null | undefined'`). Cast in `useWorkerDocumentReportData.ts`.

`deleteWorkerDocument(documentId)` needed **no** cast — its one parameter has no
default value at all, so TS's `allowJs` inference leaves it implicit `any`
(the narrowing mechanism only triggers on destructured-or-plain parameters that
*have* a default expression to infer from). Its return type was also inferred
correctly with no cast: a plain async function whose only two `return` statements
are object literals with the same three keys (`documentId`, `workerId`,
`storageCleanupFailed`) — TS's control-flow return-type inference handles this
without help.

### 22. `jsPDF.autoTable` — the installed `jspdf-autotable` types don't augment `jsPDF`'s own type

`generateWorkerDocumentReportPdf.ts` calls `doc.autoTable({...})` — the same
instance-method call style already used by every out-of-scope PDF generator in
`src/pdf/*.jsx`. `bun run typecheck` failed: `Property 'autoTable' does not exist on
type 'jsPDF'`. Checked the installed package
(`node_modules/jspdf-autotable/dist/index.d.ts`): this version's bundled types
export a standalone `declare function autoTable(d: jsPDFDocument, options: UserOptions): void`
— no `declare module "jspdf" { interface jsPDF { autoTable(...): void } }`
augmentation, even though the plugin's side-effect import (`import "jspdf-autotable"`)
does patch `jsPDF.prototype.autoTable` in at runtime. A types/runtime mismatch in
the third-party package itself, not something introduced by this conversion.

Fixed with a local type-only cast at the one call site — not an ambient `.d.ts`
augmentation (broader, module-wide) and not a dependency change:

```ts
type JsPdfWithAutoTable = jsPDF & {
  autoTable: (options: Record<string, unknown>) => void;
};
const doc = new jsPDF("landscape", "px", "letter") as JsPdfWithAutoTable;
```

Every other `doc.*` call (`setFont`, `setFontSize`, `text`, `internal.pageSize`,
`output`, `save`) is still checked against the real `jsPDF` type; only `autoTable`
gets the widened surface.

### 23. `WorkerDocumentsView.tsx` — state, refs, and the `document` parameter shadow

- `selectedFiles: Record<number, File | null>` — the original `handleFileChange`
  unconditionally writes `[documentTypeId]: file` (including when `file` is
  `null`, from clearing the native input), never deleting the key; preserved
  exactly rather than "improving" it to delete falsy entries, since the original
  read sites (`selectedFiles[documentType.id]`, `!selectedFile` checks) already
  handle `null`/`undefined` identically.
- `fileInputVersions: Record<number, number>`; `fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({})`.
- `handleDownloadDocument(document: WorkerDocument)` — the parameter is named
  `document`, shadowing the global `Document` interface's `window.document`
  exactly as the original `.jsx` already did; the function body already
  disambiguates via `window.document.createElement(...)`/`window.document.body`,
  so no rename was needed or made.
- Each `catch (error)` block casts `(error as Error)?.message` — TypeScript types
  catch-clause variables as `unknown` by default; the original JS's
  `error?.message` (already optional-chained, since a thrown value isn't
  guaranteed to be an `Error`) is preserved with the minimal cast needed to keep
  that same "try to read `.message`, else fall back" behavior.
- No new guards added anywhere `workerId`/`worker`/document fields are
  dereferenced without one in the original — e.g. `worker.name`/`worker.type_worker`
  after the existing `if (!worker) return <ErrorMessage ... />` guard, matching
  every prior phase's non-null-assertion-over-new-guard rule (no assertion was
  even needed here, since the existing early return already narrows `worker` for
  TS).

### 24. Pre-conversion lint baseline (confirmed via `bun run lint`, per file)

All 13 Phase 3 files (12 in `documents/` plus `useWorker.js`) produced **0**
`react/prop-types` errors before conversion — `WorkerDocumentsView.jsx` because of
its own `// eslint-disable-next-line react/prop-types` comment (same pattern as
`LinkWorkerAccountForm.jsx` in Phase 2), the rest because they're hooks/modules,
not components. Total to remove: **0** — flagged up front, same as every phase
whose baseline was already clean.

### 25. Explicit-extension import check

Grepped `src/` for every Phase 3 file's `.jsx`/`.js` extension form, and for
`workers/documents"` (a barrel-style extensionless import of `index`). **Zero
matches** for either — `WorkerDocumentsView`'s only two call sites
(`src/pages/MyDocuments.jsx`, `src/pages/Records/WorkerDocuments.jsx`) already
import it extension-less, and nothing imports the `documents/index` barrel at all
(dead barrel, converted anyway since it's inside the explicit Phase 3 target path).
This makes Phase 4's originally anticipated import-fix work a verified no-op; the
pages themselves remain `.jsx` and out of scope.

### 26. Verification plan — results

Baseline going in: **206 problems (202 errors, 4 warnings)**.

- [x] `bun run typecheck` — failed twice against real, distinct issues (Sections
      21's `getWorkerDocumentReportData` cast and Section 22's `jsPDF.autoTable`
      cast), each fixed with a local, type-only cast; no other files touched.
      Final run: clean, no errors.
- [x] `bun run build` — implementer reported a clean pass, `✓ built in 5.30s`,
      no diagnostics. Independent review ran `timeout 180s bun run build`; it
      timed out after Vite printed `$ vite build` with no diagnostics. Treat as a
      local environment caveat and rerun before commit if a fresh build transcript
      is required.
- [x] `bun run lint` — total: **206 problems (202 errors, 4 warnings)** — unchanged
      from baseline, exactly as predicted (Section 24: none of the 13 files
      contributed any `react/prop-types` errors to begin with). Confirmed via a
      targeted grep that none of the 13 Phase 3 files appear anywhere in the lint
      output.
- [x] `git status`/`git diff --stat` — changed-file set is exactly: the 12
      `documents/` renames (1 `.jsx` → `.tsx`, 11 `.js` → `.ts`),
      `src/features/workers/useWorker.ts`, and this change's own `proposal.md`/
      `design.md`/`tasks.md`. No other file — `apiWorkerDocuments.js`,
      `src/types/supabase.ts`, `src/pages/MyDocuments.jsx`,
      `src/pages/Records/WorkerDocuments.jsx`, `eslint.config.js`, `tsconfig.json`,
      `package.json` all untouched.
