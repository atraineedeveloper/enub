# Design: Convert Admin Catalog Features to TS

Multi-phase change. **Only Phase 1 (degrees, subjects) is implemented in this pass**,
per explicit instruction. Phase 2 (groups, semesters) and Phase 3 (studyPrograms,
roles) are not designed in detail yet.

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
