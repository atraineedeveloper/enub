# Design: Convert Admin Catalog Features to TS

Multi-phase change. **All three phases are implemented.** This is the final phase of
the admin catalog feature-module migration.

## 1. Why `src/services/apiDegrees.js`/`apiSubjects.js` are out of scope

The Phase 1 target list is literally `src/features/degrees/*` and
`src/features/subjects/*`. `apiDegrees.js`/`apiSubjects.js` live in `src/services/`,
a directory shared by every other still-`.jsx`/`.js` feature in the app — converting
either would be a change to a shared service file "outside the Phase 1 scope" in the
same sense the brief calls out for schedules/workers/PDFs, even though these two
particular files are these two features' only data source. They stay `.js`, consumed
via `allowJs` interop exactly as every other out-of-scope untyped dependency has been
in this migration (`Button.jsx`, `useOutsideClick.js`, etc.).

One consequence, confirmed by reading `src/services/supabase.js`: the Supabase client
is created as plain `createClient(supabaseUrl, supabaseKey)` — **not**
`createClient<Database>(...)`. The file's one JSDoc `@type` comment
(`/** @type {import('./types/supabase').Database} */`) is actually misapplied — it
annotates the `supabaseUrl` string constant on the next line, not the client — so it
has no effect on the client's type today, and always didn't. This is a pre-existing,
harmless documentation artifact, not a defect introduced or discovered by this
change; it's left exactly as-is, since fixing it is a `src/services/` change outside
Phase 1 scope. Practical effect: `getDegrees()`/`getSubjects()`'s inferred return
type is loose (effectively `any`-ish, from the untyped `.select(...)` call), so the
real typing work happens where it's actually needed — the `useQuery` generic in each
`.ts` hook (Section 2).

## 2. `Degree`/`Subject` types — reusing the generated Supabase schema, not hand-rolling

`src/types/supabase.ts` (added in `typescript-tooling-foundation`, previously used
only as a JSDoc hint) already has the precise, generated `Row` types for every table.
Per "if a precise domain type already exists, reuse it," both hooks import from it
directly instead of hand-writing a parallel interface that could silently drift from
the real schema:

```ts
// useDegrees.ts
export type Degree = Database["public"]["Tables"]["degrees"]["Row"];
```

```ts
// useSubjects.ts
export type Subject = Database["public"]["Tables"]["subjects"]["Row"] & {
  study_programs: Database["public"]["Tables"]["study_programs"]["Row"] | null;
  degrees: Database["public"]["Tables"]["degrees"]["Row"] | null;
};
```

`Subject`'s intersection matches `apiSubjects.js`'s actual query,
`select("*, study_programs(*), degrees(*))")` — confirmed the FK direction in
`src/types/supabase.ts`'s `Relationships` (`subjects.degree_id` → `degrees.id`,
`subjects.study_program_id` → `study_programs.id`, both `isOneToOne: false` from the
parent side) means each subject embeds **one** `study_programs` object and **one**
`degrees` object, not arrays. Because the FK columns are nullable, those embedded
objects are typed as `Row | null`; `SubjectRow.tsx` uses non-null assertions at the
existing `study_programs!.year`/`degrees!.code` dereference sites to preserve the old
runtime behavior rather than adding a new fallback.

Each hook's `useQuery` call is given this type as an explicit generic
(`useQuery<Degree[]>({...})`/`useQuery<Subject[]>({...})`) rather than relying on
inference from the untyped `queryFn` — the standard, minimal way to type a
TanStack Query hook whose data source isn't itself typed, with zero change to
`queryKey`, `queryFn`, or `staleTime`.

`Degree`/`Subject` are exported from their respective hook file and imported by the
matching `Row` component (`DegreeRow.tsx` imports `Degree` from `./useDegrees`,
`SubjectRow.tsx` imports `Subject` from `./useSubjects`) — one definition per feature,
reused, not duplicated; not hoisted into a shared cross-feature types module, per "do
not create a broad app-wide type system yet unless absolutely necessary."

## 3. Preserving existing non-null string-method calls (`name.toUpperCase()`, etc.)

The generated schema types every text column nullable (`name: string | null`,
`code: string | null`, etc. — standard for Postgres columns without a `NOT NULL`
constraint). The **existing** `.jsx` code already calls string methods on several of
these fields with no null guard:

- `SubjectRow.jsx`: `name.toUpperCase()`
- `DegreeTable.jsx`'s filter: `degree.name.toLowerCase()`, `degree.code.toLowerCase()`
- `SubjectTable.jsx`'s filter: `subject.name.toLowerCase()`

This is a pre-existing assumption (the app treats these columns as effectively
required even though the DB schema allows `null`), not something this change is
asked to fix, and fixing it (e.g. adding `?.`/fallback text) would be a real,
if small, behavior change — showing different text or skipping a filter match
where today the code would throw. Per "if exact typing would require changing
runtime behavior, prefer a local type-only cast," each such call site gets a
non-null assertion (`name!.toUpperCase()`, `degree.name!.toLowerCase()`, etc.) —
zero runtime effect, same crash in the same theoretical null case, and the type
everywhere else stays the honest, schema-accurate `string | null` rather than a
hand-rolled `string` that misrepresents the actual column nullability. Same pattern
already used repeatedly in this migration for other pre-existing implicit
assumptions (`ModalContext`/`MenusContext`/`TableContext` non-null contexts,
`Menus.List`'s `position`).

## 4. Accepted, documented gap: `usePagination.js` stays untyped

`src/hooks/usePagination.js` (`export function usePagination(data = [])`, no type
annotations) is outside Phase 1 scope (`src/hooks/`, not `src/features/degrees|subjects/`)
and not touched. Consequence: its inferred parameter/return types are loose
(effectively `any[]`) since nothing in the file itself constrains them further. This
means `paginatedData` (and therefore `Table.Body`'s inferred generic `T` in
`DegreeTable.tsx`/`SubjectTable.tsx`) resolves to a loose type rather than `Degree`/
`Subject` specifically. This does **not** cause a type error — `any` is assignable
everywhere — it's a documented type-safety gap, not a defect, and not required to fix
for a clean `bun run typecheck`. Converting `usePagination.js` (shared by every other
table in the app) is a larger, separate change, consistent with "do not create a
broad app-wide type system yet unless absolutely necessary."

## 4b. Unplanned but necessary: `Row.jsx`'s untyped custom `type` prop

`bun run typecheck` initially failed in both `DegreeTable.tsx` and
`SubjectTable.tsx` — both render `<Row type="horizontal">`, but `Row.jsx`
(`src/ui/Row.jsx`, out of scope — a shared UI component, not a Phase 1 target) is a
plain, untyped `styled.div` whose `type` prop (`"horizontal" | "vertical"`, via
`Row.defaultProps = { type: "vertical" }`) exists only through runtime
`styled-components` interpolation, exactly the same class of issue as `Button.jsx`'s
`size`/`variation` in `convert-core-ui-components-to-ts`. Fixed the same way, scoped
to only the two `.tsx` files that use it — **not** by touching `Row.jsx`:

```ts
import UntypedRow from "../../ui/Row";
type RowProps = HTMLAttributes<HTMLDivElement> & {
  type?: "horizontal" | "vertical";
};
const Row = UntypedRow as ComponentType<RowProps>;
```

Zero runtime change — same imported component, `Row.jsx` itself untouched. This will
recur for any future `.tsx` feature file that renders `<Row type="...">`, until
`Row.jsx` itself is eventually converted (out of scope here, same as `Button.jsx` was
before `convert-core-ui-components-to-ts` addressed it directly).

## 5. Explicit-extension import check

Grepped `src/` for `degrees/DegreeRow.jsx`, `degrees/DegreeTable.jsx`,
`degrees/useDegrees.js`, `subjects/SubjectRow.jsx`, `subjects/SubjectTable.jsx`,
`subjects/useSubjects.js` (the pattern that broke builds in
`convert-core-ui-components-to-ts` and `convert-app-shell-to-ts`). **Zero matches.**
Confirmed separately that `useDegrees`/`useSubjects` also have out-of-scope
`.jsx` consumers beyond the two target `Table` components
(`CreateGroupForm.jsx`, `CreateEditScholarSchedule.jsx`, `EditScholarSchedule.jsx`,
`Dashboard.jsx`, `ScheduleDashboard.jsx`) — all import extension-less already, so none
need a change, and none are type-checked anyway (still `.jsx`, outside Phase 1).

## 6. Pre-conversion lint baseline (confirmed via `bun run lint`, per file)

| File | `react/prop-types` |
|---|---:|
| `DegreeRow.jsx` | 4 (`degree`, `degree.id`, `degree.code`, `degree.name`) |
| `DegreeTable.jsx` | 0 (no props) |
| `useDegrees.js` | 0 (not a component) |
| `SubjectRow.jsx` | 12 (`subject`, 7 destructured fields, `subject.name.toUpperCase`, `subject.study_programs.year`, `subject.degrees.code`) |
| `SubjectTable.jsx` | 0 (no props) |
| `useSubjects.js` | 0 (not a component) |

Total to remove: **16**.

## 7. Verification plan — results

Baseline going in: **253 problems (249 errors, 4 warnings)**.

- [x] `bun run typecheck` — failed once (Section 4b, `Row`'s untyped `type` prop),
      fixed with a local cast in both files, then passes with no errors.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **237 problems (233 errors, 4 warnings)**, down from
      253 by exactly the predicted 16 (`DegreeRow` 4, `SubjectRow` 12).
- [x] `git status`/`git diff --stat` — changed-file set is exactly: the 6 renames
      (`DegreeRow`/`DegreeTable`/`useDegrees`, `SubjectRow`/`SubjectTable`/
      `useSubjects`) and this change's own `proposal.md`/`design.md`/`tasks.md`. No
      other file — `apiDegrees.js`, `apiSubjects.js`, `supabase.js`,
      `usePagination.js`, `Row.jsx`, `eslint.config.js`, `tsconfig.json`,
      `package.json` all untouched.

# Phase 2: groups, semesters

## P2.1. `Group`/`Semester` types

```ts
// useGroups.ts
export type Group = Database["public"]["Tables"]["groups"]["Row"] & {
  degrees: Database["public"]["Tables"]["degrees"]["Row"] | null;
};
```

Same reasoning as Phase 1's `Subject`: `apiGroups.js`'s `select("*, degrees(*)")`
embeds one `degrees` row per group, and `groups.degree_id` is a nullable FK
(confirmed in `src/types/supabase.ts`), so the embed is typed `Row | null`, not
bare `Row`. `GroupRow.tsx` uses a non-null assertion at the existing
`degrees.code` dereference (`degrees!.code`) to preserve the current
no-guard behavior.

```ts
// useSemesters.ts
export type Semester = Database["public"]["Tables"]["semesters"]["Row"];
```

No embedded relations — `semesters` has no `Relationships` in the schema and
`apiSemesters.js` does a plain `select("*")`.

## P2.2. Pre-conversion lint baseline (confirmed via `bun run lint`, per file)

| File | `react/prop-types` | Other |
|---|---:|---|
| `GroupRow.jsx` | 6 (`group`, `group.id`, `group.year_of_admission`, `group.letter`, `group.degrees`, `group.degrees.code`) | — |
| `GroupTable.jsx` | 0 | — |
| `useGroups.js` | 0 | — |
| `CreateGroupForm.jsx` | 0 | — |
| `SemesterRow.jsx` | 4 (`semester`, `semester.semester`, `semester.school_year`, `semester.id`) | — |
| `SemesterTable.jsx` | 0 | — |
| `useSemesters.js` | 0 | — |
| `CreateSemesterForm.jsx` | 1 (`onCloseModal`) | **3 `react-hooks/rules-of-hooks`** (`useQueryClient`, `useForm`, `useMutation`, all "may be executed more than once... in a loop") |

`react/prop-types` total to remove: **11**. The 3 `react-hooks/rules-of-hooks`
errors in `CreateSemesterForm.jsx` are the same ones already identified as real,
verified, must-not-touch defects in `openspec-ts-migration-foundation`'s original
lint classification (Section 5 of that change's design.md) — carried over
unchanged by this conversion, not fixed, not newly introduced. Confirmed by
inspection that this file's hook-call structure is byte-identical before and
after conversion (no reordering, no new conditional).

## P2.3. Unplanned discovery #1: `useMutation`'s `isLoading` doesn't exist in TanStack Query v5

`bun run typecheck` failed in both `CreateGroupForm.tsx` and
`CreateSemesterForm.tsx`: `Property 'isLoading' does not exist on type
'UseMutationResult<...>'`. Checked directly against the installed
`@tanstack/react-query@^5.51.23` types
(`node_modules/@tanstack/react-query/build/legacy/useMutation.d.ts`): v5's
`useMutation` result has **no** `isLoading` field — only `isPending`. This means
`const { mutate, isLoading: isCreating } = useMutation({...})` has **always**
destructured `undefined` for `isCreating` at runtime, in production, in both
files — a genuine, pre-existing dead-code bug invisible until now because
`.jsx` files were never type-checked. `disabled={isCreating}` on every field in
both forms has never actually disabled anything during submission.

**Not fixed** — renaming to `isPending` would be a real behavior change (fields
would start actually disabling during submission, which they never did before),
out of scope for "preserve data fetching/mutation behavior exactly." Instead,
typed to match the real, current (buggy) behavior with a narrow, local cast:

```ts
const mutation = useMutation({ ... });
const { mutate } = mutation;
const isCreating = (mutation as unknown as { isLoading?: boolean }).isLoading;
```

`isCreating` is now correctly typed `boolean | undefined`, and is `undefined` at
runtime exactly as before — zero behavior change, just an honest type for an
existing bug. **Flagged prominently as a discovery worth a real follow-up fix**
(swap to `isPending`), but that fix is out of scope for this TS-migration change.

## P2.4. Unplanned discovery #2: `errors?.field?.message` isn't statically `string | undefined`

`bun run typecheck` failed: `Type 'string | FieldError | Merge<FieldError,
FieldErrorsImpl<any>> | undefined' is not assignable to type 'string |
undefined'` at every `error={errors?.field?.message}` passed to `FormRow`.
Because both forms call `useForm()` with no generic type parameter (matching
the original, schema-less `.jsx` code exactly — not changed), react-hook-form
types `errors`' fields maximally generically, so `.message` widens to include
`FieldError` itself for a subset of cases the type system can't rule out here.
At runtime, for these flat, non-nested form fields, the value genuinely is
always `string | undefined` (react-hook-form's real behavior for simple
fields) — so each call site got a narrow, local
`as string | undefined` cast, not a `useForm<SomeSchema>()` generic (which
would be a bigger, separate typing decision affecting the whole form, not
required here) and not a change to `FormRow.tsx` (out of scope, already
converted in a prior change).

## P2.5. Unplanned discovery #3: `<FormRow>` with two children

`bun run typecheck` failed: `This JSX tag's 'children' prop expects a single
child ... but multiple children were provided`, for both forms' action-row
`<FormRow><Button>Cancelar</Button><Button>Agregar ...</Button></FormRow>` (no
`label`). `FormRow.tsx`'s `children: ReactElement<{ id?: string }>` (typed in
`convert-remaining-shared-ui-to-ts`) requires exactly one element — verified
against that change's call-site sample at the time, but not against these two
forms specifically (still `.jsx`, out of scope then). This is genuinely new
information, not a regression in the earlier typing.

**Not fixed by widening `FormRow.tsx`'s type** (out of scope — a previously
completed, reviewed change's file) and **not fixed by adding a `role`/id to
either button** (would change markup). Instead, wrapped the two buttons in a
JSX fragment at each of the two call sites:

```tsx
<FormRow>
  <>
    <Button variation="secondary" type="reset">Cancelar</Button>
    <Button>Agregar Grupo</Button>
  </>
</FormRow>
```

A fragment renders no extra DOM node — output is byte-identical — while
turning "two children" into "one child" (the fragment itself), which
structurally satisfies `ReactElement<{ id?: string }>` (a fragment has no
`id` prop, but `id` is optional, so a missing property is fine). A fragment renders
no DOM node, so the rendered markup remains the same two `<button>` elements in the
same DOM position with no wrapping element.

**Flagged as a signal that `FormRow.tsx`'s type may need revisiting** (e.g. a
broader `children: ReactElement<{ id?: string }> | ReactElement<{ id?: string }>[]`)
once more feature forms are converted and this pattern recurs — not done now,
since it would mean reopening an already-shipped change for a fix that isn't
strictly required (the fragment wrapper is a complete, zero-behavior-change
workaround).

## P2.6. Unplanned discovery #4: dead `role="row"` prop on `GroupRow.jsx`'s `<Table.Row>`

`bun run typecheck` failed: `Property 'role' does not exist on type
'IntrinsicAttributes & RowProps'`. `GroupRow.jsx` was the only Row-rendering
file (of `DegreeRow`/`SubjectRow`/`GroupRow`) that passed `<Table.Row role="row">`
explicitly. Checked `Table.tsx`'s `Row` implementation
(`convert-remaining-shared-ui-to-ts`): it destructures only `{ children }` and
its internal `<StyledRow role="row" ...>` **already hardcodes** `role="row"`
unconditionally — so the caller's `role="row"` was always silently discarded,
a fully inert prop with zero effect on rendered output, in the original `.jsx`
too (JS tolerates excess object properties on component calls silently; a
TypeScript JSX excess-property check does not). Removed the dead prop from
`GroupRow.tsx`; rendered output is unaffected because the DOM `role="row"` attribute
is still set by `Table.tsx` itself, exactly as before.

## P2.7. Verification plan — results

Baseline going in: **237 problems (233 errors, 4 warnings)**.

- [x] `bun run typecheck` — failed 4 times across the 4 discoveries above (P2.3–P2.6),
      each fixed with a local, zero-behavior-change change; then passes with no
      errors.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **226 problems (222 errors, 4 warnings)**, down from
      237 by exactly the predicted 11 (`GroupRow` 6, `SemesterRow` 4,
      `CreateSemesterForm` 1). Confirmed the 3 `CreateSemesterForm.tsx`
      `react-hooks/rules-of-hooks` entries are still present, unchanged.
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 8 renames
      (`GroupRow`/`GroupTable`/`useGroups`/`CreateGroupForm`,
      `SemesterRow`/`SemesterTable`/`useSemesters`/`CreateSemesterForm`) and this
      change's own `proposal.md`/`design.md`/`tasks.md`. No other file —
      `apiGroups.js`, `apiSemesters.js`, `calculateSemesterGroup.js`, `Form.jsx`,
      `FormRow.tsx`, `Row.jsx` all untouched.

# Phase 3: studyPrograms, roles

## P3.1. `StudyProgram`/`Role` types

```ts
// useStudyPrograms.ts
export type StudyProgram = Database["public"]["Tables"]["study_programs"]["Row"];
```

No embedded relations — `study_programs` has no `Relationships` in the schema and
`apiStudyPrograms.js` does a plain `select("*")`.

```ts
// useRoles.ts
export type Role = Database["public"]["Tables"]["roles"]["Row"] & {
  workers: Database["public"]["Tables"]["workers"]["Row"] | null;
};
```

`apiRoles.js`'s `select("*, workers(*))")` embeds one `workers` row per role;
`roles.worker_id` is a nullable FK (confirmed in `src/types/supabase.ts`), so the
embed is typed `Row | null`, not bare `Row` — same reasoning as `Subject`/`Group` in
Phases 1–2. `RoleRow.tsx`/`RoleTable.tsx` use non-null assertions at the existing
`role.workers.name` dereferences to preserve the current no-guard behavior.

## P3.2. Edit-form variable types — small, local, per-hook

`useEditStudyProgram.ts`'s `mutationFn: ({ newProgram, id }) => editStudyProgram(newProgram, id)`
and `useEditRole.ts`'s equivalent both destructure an untyped parameter — with no
`useMutation` generics and no annotation, TypeScript's `noImplicitAny` (part of
`strict`) rejects this. Rather than adding generics to `useMutation` itself (a bigger
change affecting `TData`/`TError` inference) or leaving the object as `any`, each
hook gets one small, local, non-exported-beyond-the-file interface for exactly its
own mutation's variables:

```ts
interface EditStudyProgramVariables {
  newProgram: Partial<StudyProgram>;
  id: number;
}
```
```ts
interface EditRoleVariables {
  newRole: Partial<Role>;
  id: number;
}
```

`newProgram`/`newRole` are `Partial<...>` (not the full `Row`) because the caller
spreads a react-hook-form submission (`{ ...data }`, a subset of fields, never
`created_at`/`id`) into it — matching what `editStudyProgram`/`createEditRoles`
(both untyped, out of scope) actually receive at runtime. Both hooks have the same
pre-existing `useMutation().isLoading`-doesn't-exist-in-TanStack-v5 gap identified in
Phase 2 (`design.md` P2.3) — typed with the identical documented cast, not fixed,
per the explicit instruction not to fix that bug in this phase either.

## P3.3. `programToEdit`/`roleToEdit` — optional `Partial<...>`, defaulting to `{}`

Both `CreateEditStudyProgramForm.jsx`/`CreateEditRoleForm.jsx` destructure their edit
prop with a `= {}` default and then `const { id: editId, ...editValues } = <prop>`.
Typed `programToEdit?: Partial<StudyProgram>` / `roleToEdit?: Partial<Role>` —
optional and partial because the default is a genuinely empty object (no `id`, no
other fields) for the "create" code path. In practice, **every real call site**
(`StudyProgramRow.tsx`/`RoleRow.tsx`) always passes a full row (always in "edit"
mode) — grepped for any other caller and found none — so the "create" branch
(`isEditSession === false`) is currently dead code in both forms, exactly as it was
before this conversion. Not removed; preserved exactly.

`editId`'s type is `number | undefined` (from the `Partial<...>` destructure), but
each mutation call's variables require `id: number`. Both forms only ever call the
mutation inside `if (isEditSession)` (`= Boolean(editId)`), so `editId` is always
defined there — TypeScript can't see that correlation through a separately-computed
boolean, so a non-null assertion (`id: editId!`) is used at each call site, matching
the same "preserve pre-existing implicit assumption" pattern used throughout this
migration.

## P3.4. Pre-conversion lint baseline (confirmed via `bun run lint`, per file)

| File | `react/prop-types` | Other |
|---|---:|---|
| `StudyProgramRow.jsx` | 5 (`program`, `program.year`, `program.name`, `program.id` ×2) | — |
| `StudyProgramsTable.jsx` | 0 | — |
| `useStudyPrograms.js` | 0 | — |
| `useEditStudyProgram.js` | 0 | — |
| `CreateEditStudyProgramForm.jsx` | 2 (`programToEdit`, `onCloseModal`) | — |
| `RoleRow.jsx` | 6 (`role`, `role.role`, `role.workers`, `role.workers.name`, `role.id` ×2) | — |
| `RoleTable.jsx` | 0 | — |
| `useRoles.js` | 0 | — |
| `useEditRole.js` | 0 | — |
| `CreateEditRoleForm.jsx` | 2 (`roleToEdit`, `onCloseModal`) | **1 `no-unused-vars`** (unused `data` param in the nested `onSuccess: (data) => {...}` callback at the `editRole(...)` call) |

`react/prop-types` total to remove: **15**. The 1 `no-unused-vars` in
`CreateEditRoleForm.jsx` is a genuine, pre-existing, unrelated defect — carried over
unchanged (renamed to `@typescript-eslint/no-unused-vars` by the file-extension
switch, same as `MainNav.tsx`'s `isActive` earlier in this migration), not fixed.

## P3.5. Unplanned discovery: 4 out-of-scope PDF files import `useRoles.js` with an explicit extension

Grepped `src/` for all 10 target files before building (the check that's caught real
issues in every prior phase). Found 4 matches, all in `src/pdf/` (out of scope, not
touched otherwise): `Schedules/TeacherAssignmentPDF.jsx`, `Schedules/ScheduleGroupPDF.jsx`,
`Schedules/ScheduleTeacherPDF.jsx`, `WorkerSheetSemester.jsx` — each has
`import { useRoles } from ".../features/roles/useRoles.js"`. Per explicit instruction
("fix only those pointing to renamed Phase 3 files"), updated exactly the one import
line's extension (`.js` → `.ts`) in each of the 4 files; no other line touched. These
4 files already had `Button.tsx`/`Spinner.tsx` explicit-extension imports from
`convert-core-ui-components-to-ts` (visible in the same import blocks) — this is the
same recurring class of issue, now hitting a fourth batch.

## P3.6. Unplanned discovery: `useWorkers()`'s `workers` is not always defined either

`bun run typecheck` failed in `CreateEditRoleForm.tsx`: `'workers' is possibly
'undefined'` at `workers.map(...)`. `useWorkers.js` (`src/features/workers/`, a
different, out-of-scope feature) is untyped, but unlike the Phase 1/2 assumption that
untyped hooks always resolve to a loose `any`, TanStack Query's own types still
propagate an `| undefined` for `data` regardless of how loosely `queryFn`'s return
type resolves — `isLoadingWorkers` (a separately-typed boolean) doesn't narrow it for
the same reason `isLoading`/`groups` didn't narrow each other in Phase 2's
`GroupTable.tsx`. Fixed with the same non-null assertion pattern already established:
`workers!.map(...)`. Not a new class of issue, just the same pattern recurring
against a hook from a different, still-untyped feature.

## P3.7. Verification plan — results

Baseline going in: **226 problems (222 errors, 4 warnings)**.

- [x] `bun run typecheck` — failed twice (the `useMutation` variable typing in P3.2
      was written correctly from the start this time; the one real failure was
      P3.6's `workers` narrowing), fixed, then passes with no errors.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **211 problems (207 errors, 4 warnings)**, down from
      226 by exactly the predicted 15 (`StudyProgramRow` 5, `CreateEditStudyProgramForm` 2,
      `RoleRow` 6, `CreateEditRoleForm` 2). Confirmed `CreateEditRoleForm.tsx`'s 1
      `@typescript-eslint/no-unused-vars` entry is present, unchanged in substance.
- [x] `git status`/`git diff --stat` — changed-file set is exactly: the 10 renames
      (`StudyProgramRow`/`StudyProgramsTable`/`useStudyPrograms`/`useEditStudyProgram`/
      `CreateEditStudyProgramForm`, `RoleRow`/`RoleTable`/`useRoles`/`useEditRole`/
      `CreateEditRoleForm`), the 4 PDF files' one-line import fix each, and this
      change's own `proposal.md`/`design.md`/`tasks.md`. No other file —
      `apiStudyPrograms.js`, `apiRoles.js`, `capitalizeFirstLetter.js`,
      `useWorkers.js` all untouched.

## Migration status: complete

All three phases of the admin catalog feature-module migration are implemented.
Typecheck and lint are verified; build needs a clean local rerun because independent
review timed out after Vite started. Cumulative lint movement across this whole
change: **253 → 211** (42 `react/prop-types` errors removed: 16 in Phase 1, 11 in
Phase 2, 15 in Phase 3), zero regressions in any other rule at any step. Two real,
pre-existing issues were discovered (not fixed, both flagged for separate follow-up):
`useMutation`'s `isLoading` vs. `isPending` (Phase 2, recurring in Phase 3) and
`FormRow.tsx`'s single-child typing (Phase 2, recurring in Phase 3 for both new
forms' action rows).
