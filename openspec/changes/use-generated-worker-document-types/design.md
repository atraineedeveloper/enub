# Design: Use Generated Worker Document Types

## 1. Confirming the generated `Row` shapes match the hand-rolled interfaces first

Before changing anything, read the regenerated `src/types/supabase.ts`'s
`worker_document_categories`/`worker_document_types`/`worker_documents` `Row`
blocks (already diffed once during `regenerate-supabase-types`) side by side
with the hand-rolled interfaces:

| Field | Hand-rolled | Generated `Row` |
|---|---|---|
| `worker_document_categories.scope` | `"permanent" \| "semester"` | `string` |
| every other field on all three tables | — | identical (name, nullability, type) |

Only one real divergence: `scope`'s literal union vs. bare `string` (see
`proposal.md`'s "Type-precision trade-off" section) — a codegen limitation
(CHECK constraints aren't reflected), not a mistake in either version. Every
other field — `worker_document_types.category_id`/`allows_multiple`/`sort_order`,
`worker_documents.document_type_id`/`worker_id`/`semester_id`/`uploaded_by`/
`file_size`, etc. — matches exactly, including nullability (`semester_id: number | null`,
`uploaded_by: string | null`, everything else `NOT NULL`).

## 2. `WorkerDocumentType` — plain alias

```ts
export type WorkerDocumentType =
  Database["public"]["Tables"]["worker_document_types"]["Row"];
```

No composed/extra fields needed — the hand-rolled interface never had any field
beyond the table's own columns, so this is a direct, lossless (`scope` aside,
n/a here) replacement.

## 3. `WorkerDocumentCategory` — intersection, not `interface extends`, and why

First attempt was `interface WorkerDocumentCategory extends Database["public"]["Tables"]["worker_document_categories"]["Row"] { document_types: WorkerDocumentType[] }`.
`bun run typecheck` rejected this: `TS2499: An interface can only extend an
identifier/qualified-name with optional type arguments.` — TypeScript's
`interface ... extends` clause requires the extended type to be a plain
identifier or generic reference (e.g. `Omit<X, "y">` is fine, since `Omit` is an
identifier with type arguments); `Database["public"]["Tables"][...]["Row"]` is
an **indexed-access type**, a different syntactic category the `extends` clause
doesn't accept, regardless of what it resolves to.

Fixed by using a type alias with an intersection instead:

```ts
export type WorkerDocumentCategory =
  Database["public"]["Tables"]["worker_document_categories"]["Row"] & {
    document_types: WorkerDocumentType[];
  };
```

`document_types` is deliberately not part of the intersected DB row — it's
computed by `groupDocumentTypesByCategory` in `apiWorkerDocuments.js` (a plain
JS array filter, not a Supabase embed at all, per
`convert-workers-documents-to-ts` `design.md` Section 19) and has no
corresponding column, so composing it via `&` (an application-level addition on
top of the real row) is the accurate model, not a Supabase relationship.

## 4. Downstream cascade — confirms Omit/extends still resolve correctly

Changing `WorkerDocumentCategory` from a hand-rolled `interface` to a type-alias
intersection could have broken `useWorkerDocumentReportData.ts`'s
`interface WorkerDocumentReportCategory extends Omit<WorkerDocumentCategory, "document_types"> {...}`,
since `interface extends` is picky about syntax (Section 3). It didn't: `Omit<X, K>`
is itself a generic type reference (`Omit` is an identifier, `<...>` is type
arguments) — the `extends` clause only cares about the reference's own syntactic
shape, not what `X` resolves to internally, so `Omit<WorkerDocumentCategory, "document_types">`
remains valid regardless of `WorkerDocumentCategory` being an alias vs. an
`interface`. Confirmed via `bun run typecheck` passing with zero edits needed to
`useWorkerDocumentReportData.ts`.

`WorkerDocumentReportDocumentType extends WorkerDocumentType` similarly needed
no change — `WorkerDocumentType` is now an alias to a generated `Row` (a plain
object type), and a bare identifier reference in an `extends` clause is always
valid as long as it resolves to an object type, which every `Row` type does.

## 5. `bun run typecheck` failures caused by the `scope`/field changes, and why they cascaded

The first typecheck run (before the Section 3 fix) additionally surfaced 7
"Property does not exist" errors in `WorkerDocumentsView.tsx` (`scope`, `name`,
`id`) and 2 in `generateWorkerDocumentReportPdf.ts` (`name`) — all downstream
symptoms of the same root cause (`WorkerDocumentCategory`'s broken `interface
extends`, Section 3): when TS can't resolve an `extends` clause, the interface
it's attached to effectively has none of the base type's members, so every
consumer reading `category.scope`/`category.name`/`category.id` failed. Once
Section 3's intersection fix was applied, all 9 of these disappeared with no
changes needed in either consumer file — confirming they were a single root
cause, not 9 separate issues.

## 6. Why `useWorkerDocumentReportData.ts` needed zero direct edits

`WorkerDocumentReportWorker` (a `Pick<Worker, ...>` projection),
`WorkerDocumentReportDocumentType` (extends `WorkerDocumentType`, adds
`documents`/`status`/`uploaded_at`/`file_name`), `WorkerDocumentReportCategory`
(extends `Omit<WorkerDocumentCategory, "document_types">`, adds
`document_types: WorkerDocumentReportDocumentType[]`), and
`WorkerDocumentReportData` were never hand-rolled duplicates of a table row to
begin with — they're report-shaped compositions with computed fields that don't
exist on any table. They already imported `WorkerDocumentCategory`/
`WorkerDocumentType` by name from the two files this change touches, so
swapping those two files' internals was fully transparent to this one. Kept
exactly as-is, per the task's own instruction to keep non-table-row local types
as local derived types.

## 7. Verification — results

Baseline going in: **206 problems (202 errors, 4 warnings)**.

- [x] `bun run typecheck` — failed once (Section 3's `interface extends`
      restriction), fixed with a type-alias intersection; the 9 cascading
      "property does not exist" errors (Section 5) disappeared with the same
      one fix. Final run: clean, no errors.
- [x] `bun run build` — clean pass, `✓ built in 4.74s`, no diagnostics.
- [x] `bun run lint` — total: **206 problems (202 errors, 4 warnings)** —
      unchanged from baseline. Confirmed neither touched file appears in the
      lint output.
- [x] `git status`/`git diff --stat` — changed-file set is exactly
      `useWorkerDocumentCatalog.ts`, `useWorkerDocuments.ts`, and this change's
      own `proposal.md`/`design.md`/`tasks.md`. No other file — in particular,
      `useWorkerDocumentsBySemester.ts`, `useUploadWorkerDocument.ts`,
      `useReplaceWorkerDocument.ts`, `useWorkerDocumentReportData.ts`,
      `generateWorkerDocumentReportPdf.ts`, `WorkerDocumentsView.tsx`,
      `src/types/supabase.ts`, `apiWorkerDocuments.js` all untouched.
