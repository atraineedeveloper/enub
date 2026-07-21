## Context

Verified directly before writing any code (not assumed): the real local
catalog has `Asesoría` (`category_id=4`, `sort_order=40`) with `Control de
asesorías` (id 24, sort_order 10), `Evidencias` (id 23, sort_order 20,
`allows_multiple=true`), `Documentos de titulación` (id 22, sort_order 30),
`Informes` (id 21, sort_order 40); and `Tutoría` (`category_id=3`,
`sort_order=30`) with `Relación de estudiantes tutorados` (id 20,
sort_order 10), `Canalizaciones` (id 19, sort_order 20), `Evidencias de
actividades` (id 18, sort_order 30, `allows_multiple=true`), `Listas de
asistencia` (id 17, sort_order 40), `Informes de tutoría` (id 16,
sort_order 50). `worker_document_types` has no `description` column.
**Zero** `worker_documents` rows reference any of these 9 types in the
local database — the "retired type with historical files still visible"
scenario is structurally correct (proven by the pgTAP suite's own
temporarily-reactivate-insert-retire-again fixture, see tasks.md §2) but
has no real data to eyeball locally; manual verification needs a real
worker session with actual historical Asesoría/Tutoría documents.

The category-reset bug was diagnosed by reading `WorkerDocumentsView.tsx`,
not assumed: `isLoading = ... || (selectedSemesterId && isLoadingSemesterDocuments)`
gates rendering `<WorkerDocumentsDashboard>` vs `<Spinner/>`.
`useWorkerDocumentsBySemester`'s `queryKey` includes `semesterId` with no
`placeholderData`, so a semester change is a genuinely new, uncached query
key — `isLoading` (React Query v5: `isPending && isFetching`) goes `true`
again, swapping the subtree to `<Spinner/>`, unmounting
`WorkerDocumentsDashboard`, destroying its `selectedCategoryId` `useState`
(whose lazy initializer re-picks `documentCatalog[0]?.id` on the ensuing
remount). Ruled out explicitly: no `key` prop changes on
`WorkerDocumentsDashboard`; no effect reads `documentCatalog` to reset the
selection; `useWorkerDocumentCatalog`'s own `queryKey` doesn't depend on
`selectedSemesterId` and keeps a stable reference across a period change
(confirmed via its `staleTime: 5 * 60 * 1000`).

## Decisions

**1. The Asesoría/Tutoría migration is guarded but explicitly NOT designed
to be re-run — same choice as
`20260721010000_docencia_active_types_allow_multiple.sql`, not the older
branching-insert pattern from
`20260716013947_retire_and_rename_docencia_document_types.sql`.**
Preconditions require `Informes`/`Relación de estudiantes tutorados` to
still be `is_active = true`, `Control de asesorías`/`Documentos de
titulación` to still have `description IS NULL`, and `Plan de Trabajo` to
not already exist — checked in that exact order, so a second run fails at
the FIRST one actually reached: `Asesoría / Informes` already being
`is_active = false`. The migration raises the corresponding diagnostic for
that unexpected state before it ever reaches either description check —
not a silent no-op and not a crash on an unhandled unique-violation.
Chosen for simplicity and consistency with the most recent
sibling migration in this exact subsystem; the older branching-insert
pattern (detect "already applied" and skip cleanly) was considered and
rejected only for that consistency reason, not because it's wrong — a
reasonable alternative if a future maintainer prefers that precedent
instead.

**2. `Plan de Trabajo`'s `sort_order` is computed, not hard-coded, and no
other Tutoría row is renumbered.** `(SELECT min(sort_order) FROM
worker_document_types WHERE category_id = v_tutoria_id) - 5` — today
resolves to 5 (below the current minimum, 10), verified by a postcondition
that it's strictly less than every other Tutoría row's `sort_order` (not
merely trusting the arithmetic). Renumbering the whole category (e.g. to
`0, 10, 20, 30, 40, 50`) was considered and rejected: it would touch 5
rows that don't need to change at all for "sorts first, no ties" to hold,
enlarging the migration's footprint and risk surface for no behavioral
gain.

**3. Retiring `Informes`/`Relación de estudiantes tutorados` reuses the
exact same shared lifecycle advisory lock as the existing retirement
migration and `enforce_active_worker_document_type`
(`pg_advisory_xact_lock(hashtextextended('worker_document_type:lifecycle:' || id, 0))`).**
Not a style choice — `enforce_active_worker_document_type` (the trigger
that blocks new uploads against an inactive type) acquires this identical
lock before its own `is_active` read specifically so it never observes a
stale value from a retirement that's mid-transaction; skipping the lock
here would reopen exactly the race that mechanism exists to prevent. The
two `description` `UPDATE`s and the `Plan de Trabajo` `INSERT` need no
lock — no trigger reads `description`, and a brand-new row has no
concurrent-reader race to guard against.

**4. The editorial `description` and the functional single/multiple hint
are two distinct elements, never merged into one.** `DocumentDetailDrawer`
already had a styled component literally named `Description` for "Se
admite un archivo."/"Puedes adjuntar varios archivos." — renamed to
`UploadRule` (the rule about how uploading this type works) so the new
`TypeDescription` (the editorial content about what the requirement *is*)
can't be confused with it in the code, matching the product distinction
explicitly requested: description is catalog content, not a substitute for
the single/multi affordance text, and both render together when a
description is present. `DocumentRequirementRow` gets an equivalent new
line under the name; neither location renders anything (no placeholder,
no generic fallback string) when `description` is `null`, `undefined`,
`""`, or whitespace-only (`"   "`) — both components normalize with
`const description = documentType.description?.trim();` before deciding
whether to render, so a description with accidental leading/trailing
whitespace is shown trimmed, never with the stray spaces intact, and
whitespace-only input is treated identically to absent input. No
special-casing by name in either case.

**5. The category-persistence fix is two layers, not one, and each layer
alone would already fix today's reproduction case.** `placeholderData:
keepPreviousData` (query layer) is the actual root-cause fix — without it,
nothing else here matters, since the dashboard still unmounts. But
`resolveActiveCategoryId` (component layer, `documentRequirementSummary.ts`)
is kept as real, tested, independent defense-in-depth: it derives the
*displayed* category from `documentCatalog`/`selectedCategoryId` at every
render (`selectedCategoryId` kept if it still names a category in the
current array, by id — never by array reference or index; falls back to
the first category only when `selectedCategoryId` is `null` or genuinely
absent from the current catalog), so a future change that reintroduces an
unmount, or that gives `documentCatalog` a new array reference for
unrelated reasons, still can't resurface this bug through this component's
own logic. `selectedCategoryId`'s raw `useState` was simplified to start
`null` (previously lazily initialized from `documentCatalog[0]?.id`) so
there is exactly one place — `resolveActiveCategoryId` — encoding "what
happens with no selection," not two that could drift apart;
`handleSelectCategory`'s early-return guard was updated to compare against
the *derived* `activeCategoryId`, not the raw state, so clicking the tab
that's already visually active is correctly a no-op regardless of whether
a selection has ever been made explicitly.

**6. `resolveActiveCategoryId` is a pure, render-time derivation — it is
never paired with a `useEffect` that writes its result back into
`selectedCategoryId`.** That specific pattern (sync-via-effect) was
considered and rejected: it reintroduces exactly the "extra render + stale
intermediate state" class of bug this whole change is fixing, and it's
strictly unnecessary — nothing downstream needs `selectedCategoryId`
itself to equal the fallback, only the derived value used for rendering
does.

**7. `DocumentSummary`'s percentage/progress bar is removed outright, not
hidden behind a flag or kept as a computed-but-unused field.**
`computeDocumentProgressSummary`'s `percentage` field is deleted from
`DocumentProgressSummary` entirely (confirmed zero other consumers before
removing it) rather than left computed-but-unrendered — per the explicit
product reasoning: requirements don't necessarily carry equal weight, and
there's no formal compliance rule a single percentage could honestly
represent, so a value nobody should be computing at all is not kept around
as dead code "just in case." `DocumentSummary` still shows the zero-active
human message ("No hay requisitos activos configurados.") for the empty
case, unchanged.

**8. `Tutoría / Plan de Trabajo` is `allows_multiple = false`.** No
existing requirement or catalog precedent suggested otherwise; it's a
single planning document per semester, the same shape as Docencia's own
`Planeación semestral` before that category's later multi-file migration
— nothing here implies Plan de Trabajo should follow that same later
change. Scope is semester (inherited from the `Tutoría` category, not a
column on the type itself), active, sorted first (Decision 2).

**9. The `isPlaceholderData` window is treated as fully read-only, not
merely "shows slightly stale data."** `useWorkerDocumentsBySemester`
returns `isPlaceholderData`/`isFetching` explicitly (not just `isLoading`)
so `WorkerDocumentsView` can compute `isUpdatingSemesterData =
Boolean(selectedSemesterId) && isPlaceholderData` and pass it down as an
explicit prop — deliberately NOT also derived from `isFetching`
unconditionally: `isFetching` also goes `true` for same-period background
refetches (e.g. the cache invalidation that already follows a successful
upload), which must NOT freeze the UI; `isPlaceholderData` is the precise
signal for "the displayed dataset belongs to a different query key than
the one currently selected," which is the actual risk. `isFetching` is
still returned from the hook (as asked) for callers that need it for other
purposes, just not folded into this particular gate. `WorkerDocumentsDashboard`
turns this single prop into: `aria-busy` on its root element; a visible
"Actualizando periodo…" indicator (hosted inside `DocumentSummary`, which
also dims its counts rather than presenting them as the new period's real
result — one shared indicator, not two); `disabled` on every row's
buttons (`DocumentRequirementList`/`DocumentRequirementRow`, dimmed via
`aria-disabled` + `opacity`, never hidden); `disabled` on the semester
`<select>` itself (no new period change can start until the current one
resolves) and on "Descargar reporte". `openRequirement` additionally
consults `canOpenDocumentRequirement({ isUpdatingSemesterData })` — a
small, named, independently unit-tested pure predicate
(`documentRequirementSummary.ts`), not an inline `if` — and
`handleSemesterChange` guards on `isUpdatingSemesterData` directly
(defense in depth alongside the disabled controls, in case a call ever
reaches either handler through a path other than a native click on an
enabled button, which a disabled HTML attribute alone cannot rule out) —
this is what makes "no drawer can open, no mutation can execute" true
structurally, not just as a UI convenience: every mutation in this
feature is only ever triggered from inside the drawer, so a drawer that
categorically cannot open during this window means categorically no
mutation can run against the wrong period's placeholder data either.
`handleSemesterChange`'s pending-transition closure was also reordered to
call `closeDrawer()` before `onSemesterChange(value)`, documenting the
required sequence directly (both still land in the same batched commit
either way, so this is a clarity fix, not a behavior change on its own).

**10. Three distinct lock families protect this migration, each with a
real and different responsibility — none of them substitutes for
another, and an earlier draft of this decision overstated what the
advisory lock alone provides.**

- **Table lock — the actual protection against concurrent writers.**
  `LOCK TABLE worker_document_categories, worker_document_types IN SHARE
  ROW EXCLUSIVE MODE` is acquired first, before any precondition read, in
  that fixed order (categories, then types, matching the order these
  tables are otherwise touched in this block, to minimize deadlock risk
  against any other transaction that also locks both), and held until the
  transaction commits or rolls back. `SHARE ROW EXCLUSIVE` still permits
  ordinary `SELECT`s against these tables from any other session, but
  blocks any other session's `INSERT`/`UPDATE`/`DELETE` (or an equally- or
  more-restrictive lock) against them for the whole duration — this is
  what actually excludes a genuinely concurrent writer (e.g. a future
  catalog-editing admin UI, or a differently-ordered migration run)
  observing or racing the precondition checks, the `min(sort_order)`
  computation, both description updates, both retirements, the insert, or
  the postconditions.
- **Advisory transaction lock — cooperative only, not exclusionary.**
  `pg_advisory_xact_lock(hashtextextended('worker_document_catalog:update_advising_tutoring_requirements', 0))`
  is also held for the whole block, but it ONLY serializes against another
  session that *also* calls `pg_advisory_xact_lock` with this exact same
  key — i.e. another concurrent attempt to run this SAME migration (a
  real, if narrow, possibility: a second `supabase db reset`/deploy
  invoked before the first finishes). It has no effect whatsoever on an
  ordinary `UPDATE`/`INSERT` from application code or another migration,
  which never take this advisory lock at all — asserting that this
  advisory lock by itself keeps other writers out would be false; that is
  exactly what the table lock above is for.
- **Per-type lifecycle advisory locks — a separate, pre-existing
  protocol, unrelated to catalog-table writes.** The two
  `pg_advisory_xact_lock(hashtextextended('worker_document_type:lifecycle:' || id, 0))`
  calls immediately before each retirement `UPDATE` are the same
  namespace/construction already used by
  `enforce_active_worker_document_type` and
  `replace_worker_document_metadata`, established by
  `20260716013947_retire_and_rename_docencia_document_types.sql` — they
  coordinate a type's retirement specifically against a concurrent
  upload/replacement attempt against that same type (a different concern
  than catalog-table row visibility, which the table lock above already
  covers regardless).

Purely a concurrency-control addition — no functional/data effect on the
migration's own result, verified by re-running the full pgTAP suite (and
re-applying via `supabase db reset`, confirming an identical resulting
catalog) after adding the table lock.

## Risks / Trade-offs

- Locally, zero historical documents exist under any of the 9 affected
  types, so the "retired type, still browsable with its history, no
  upload control" path is only verified structurally (pgTAP: temporarily
  reactivate → insert → re-retire → confirm the join and the FK survive)
  and via the existing generic frontend union-visibility tests — not
  eyeballed against real historical data. Flagged explicitly for manual
  verification in a real environment (tasks.md).
- `placeholderData: keepPreviousData` means a semester switch briefly
  shows the *previous* semester's documents while the new semester's
  request is in flight — by itself, that window is exactly the risk a
  prior draft of this change under-addressed (a `DocumentDetailDrawer`
  opened, or a mutation started, against data that turns out to belong to
  the wrong semester). This is now closed by treating that entire window
  as read-only end to end (Decision 9): the dashboard stays mounted and
  visible, but no drawer can open and no mutation can execute until the
  new period's real data has actually arrived.
