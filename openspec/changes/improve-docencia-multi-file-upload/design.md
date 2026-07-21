## Context

Verified directly before writing any code (not assumed from prior specs):
`allows_multiple` is a per-row boolean on `worker_document_types`, already
generic — `enforce_single_worker_document_file`
(`20260702145848_worker_document_integrity_triggers.sql`) reads it per
insert and only enforces single-file when `false`;
`replace_worker_document_metadata`
(`20260716014037_replace_worker_document_metadata.sql`) already refuses
any `allows_multiple = true` type outright. Reconstructing the catalog
migration-by-migration: of Docencia's 9 seeded types, 2 are retired
(`is_active = false`, untouched by this change) and, of the 7 active
types, only `Evidencias bimestrales` (renamed from `Evidencias` by
`20260716013947_retire_and_rename_docencia_document_types.sql`) already had
`allows_multiple = true`. The other 6 active types
(`Planeación semestral`, `Rúbricas`, `Listas de cotejo`,
`Listas de asistencia`, `Actas de evaluación`,
`Concentrado de calificaciones finales`) are what this change flips.

The frontend has zero category-name branching anywhere (`grep -rn
"Docencia" src` returns nothing) — every type/category-specific behavior
is already driven generically by `allows_multiple`, `is_active`, and
`category.scope`. This is why the change is schema-cheap (flip 6 rows) but
UI-heavy (the multi-select/drag-and-drop experience didn't exist for any
type before this change, single- or multi-file).

## Decisions

**1. The migration is a plain guarded `UPDATE`, not a
helper-function/DROP+CREATE pattern.** The RLS migrations in this
codebase (`20260716215631_schedule_ownership_rls_policies.sql`,
`20260721000000_worker_relation_ownership_select_policies.sql`) use a
SECURITY DEFINER helper + policy DROP/CREATE because they replace security
policies, where drift detection against the *exact prior policy shape* is
safety-critical. This migration only flips a boolean on catalog rows —
there is no policy shape to drift-check, and RLS is unaffected. A single
`DO $$ ... $$` block with an explicit precondition (the exact expected set
of 7 active Docencia type names, by name — fails on any renamed/
added/removed/retired/reactivated type since the last verified snapshot),
an exact-row-count postcondition (6), and a "the 2 retired types stayed
untouched" postcondition is proportionate, and mirrors the
precondition/postcondition rigor of
`20260716013947_retire_and_rename_docencia_document_types.sql` without
importing that migration's heavier apparatus.

**2. "Only Docencia, never another category" is proven by construction,
not by runtime snapshot-diff.** `worker_document_categories.name` is
`UNIQUE`; the migration resolves `category_id` once from the literal
string `'Docencia'` and scopes its `UPDATE` to that `category_id`
exclusively. Unlike the RLS migrations (where a policy can, in principle,
be recreated under a different table/name and would need an explicit
"other categories' rows are byte-for-byte unchanged" check), there is no
mechanism by which this `UPDATE`'s `WHERE category_id = v_docencia_id`
clause could touch a different category's rows — so no such check was
added; the pgTAP suite instead asserts the *positive* fact directly
(Datos personales/Tutoría/Asesoría/Investigación's `allows_multiple = true`
counts are unchanged), which is the observable property that actually
matters.

**3. No trigger, RPC, or client validation-logic changes.**
`enforce_single_worker_document_file` already reads `allows_multiple` per
row; `replace_worker_document_metadata` already refuses any
`allows_multiple = true` type; `uploadWorkerDocument`/
`replaceWorkerDocument` in `apiWorkerDocuments.ts` already branch on
`documentType.allows_multiple` generically. Flipping the flag is
sufficient by itself for every one of these to behave correctly for the 6
newly-multi types — proven directly by pgTAP (new drift/duplicate-
admission assertions in `worker_documents_triggers.test.sql`, new
RPC-rejection assertions in `worker_document_replacement_rpc.test.sql`)
rather than assumed.

**4. Sequential upload, not parallel; no new batch RPC.** Considered
bounded parallelism (e.g. 3 concurrent uploads) for speed. Rejected for
v1: sequential execution gives deterministic per-file status transitions
(`preparado → subiendo → completado/error`), which is both simpler to
reason about and directly testable (`runUploadQueue`'s pgTAP-adjacent unit
tests assert the exact transition sequence); it avoids spiking load on
Storage/Postgres connection pools during a large drop; and it reuses the
existing single-file `uploadWorkerDocument` function verbatim, N times,
rather than requiring either a hand-rolled concurrency limiter or a new
dependency. A batch RPC was also considered and rejected: it would imply
an atomicity Storage+Postgres cannot actually provide across N files (see
Non-goals) — the existing single-file function's own Storage-then-Postgres
sequencing, with its already-correct best-effort compensating cleanup, is
reused unchanged per file instead.

**5. Cache invalidation fires once per batch, not once per file.** The
existing `invalidateWorkerDocumentQueries` is intentionally broad (the
whole `worker(workerId)` query subtree plus the catalog). Calling it after
every individual file in a 10-file batch would trigger 10 full refetch
cascades. `useUploadWorkerDocuments.uploadQueuedFiles` instead calls the
single-file `uploadWorkerDocument` function directly (not the
`useUploadWorkerDocument` *hook*, which owns its own per-call
invalidation) and invalidates exactly once after the whole batch settles.

**6. Pure-core/thin-hook split, matching `useCurrentIdentity.ts`'s
established pattern.** `useUploadWorkerDocuments.ts` exports its queue
transforms (`buildQueueItem`, `updateQueueItem`, `removeQueueItem`,
`getPendingItems`), its double-submit guard predicate (`canStartUpload`),
its summary-text builder (`buildBatchSummary`), and its sequential-upload
orchestrator (`runUploadQueue`, which takes an *injected* uploader
function), its discard-guard predicate (`getDiscardableItems`), and its
post-batch cleanup (`removeCompletedItems`) as standalone, non-React
functions — the hook itself is a thin `useState`/`useRef` wrapper
composing them. This is what makes "éxito total/parcial/error total",
"doble clic no duplica", and the exact per-file transition sequence
directly unit-testable with `bun:test` without a DOM/QueryClientProvider,
consistent with how this codebase already tests hooks. (A real-DOM
dependency was added later, for a different purpose — see Decision 12 —
but every one of these pure functions remains testable with no DOM at
all, and their own tests still don't use one.)

**7. Single-file types keep their exact existing behavior, only
re-skinned.** Rather than routing every document type through the
multi-file queue (capped at 1 file for single-file types),
`DocumentDetailDrawer` calls two entirely separate code paths depending on
`documentType.allows_multiple`: multi-file types go through
`useUploadWorkerDocuments`' queue; single-file types keep calling the
unchanged `useUploadWorkerDocument`/`useReplaceWorkerDocument` hooks
directly, with the exact same upload-vs-replace decision
(`hasExistingDocument ? replaceDocument(...) : uploadDocument(...)`) the
previous table-row markup made. This is the most direct way to honor "no
changes to Datos personales/Tutoría/Asesoría/Investigación behavior" —
those hooks, their mutation logic, and their upload/replace branching are
byte-for-byte unchanged; only their container markup (a drawer instead of
a table cell) and their mutation-hook *instantiation scope* changed
(per-open-drawer instead of page-wide, see Decision 8).

**8. Mutation hooks are instantiated per open drawer, not once for the
whole page.** Previously `WorkerDocumentsView` called
`useUploadWorkerDocument`/`useReplaceWorkerDocument`/
`useDeleteWorkerDocument` once each, so `isUploading`/`isReplacing`/
`isDeleting` were single booleans shared across every row — uploading in
any one row disabled every other row's controls too. `DocumentDetailDrawer`
now calls these hooks itself, and is remounted (via a `key={documentType.id}`
in `WorkerDocumentsDashboard`) every time a different requirement is
opened, so each requirement's session gets its own fresh hook instances —
`isBusy` is scoped to whichever single requirement is actually open at
all. Only one drawer can ever be open at a time (by construction of
`drawerOpen`/`selectedDocumentTypeId` being single pieces of state), so
this is simpler than true per-row instantiation would have been, while
still satisfying "an in-flight upload for one document type never disables
another's controls" — the other rows' own action buttons remain enabled
throughout, since they don't depend on the open drawer's hook state at
all.

**9. Table → dashboard + single lateral/full-screen drawer, applied to
every category, not just Docencia.** `WorkerDocumentsView` has no
category-name branching, so there was no seam to apply the new layout to
Docencia rows only without introducing one. A per-type card grid was
considered and rejected in favor of a compact list + drawer: a full card
per requirement (title, status, dropzone, pending queue, uploaded files,
all inline) forces every requirement to pay for the multi-file affordance's
vertical space even when collapsed and not in use, and scales badly once a
category has 7+ types (Docencia's real count). A one-line-per-requirement
list keeps the default view scannable regardless of category size, and the
upload/queue/file-list UI only exists in the DOM at all while its one
requirement's drawer is open — never rendered N times for N requirements
simultaneously. The drawer is lateral (fixed-width, page behind still
visible) on desktop/tablet and full-screen (`100dvh`, not `100vh`, so a
mobile browser's address bar can't cover part of it) below the 640px
breakpoint, with the underlying page's scroll locked (`document.body.style.overflow
= "hidden"`) while it's open and restored on close.

**10. The discard-confirmation guard counts `preparado + error`, never
`completado` — and the queue self-cleans after every batch/retry
settles.** An earlier iteration derived "does the drawer have anything to
lose" directly from `multi.items.length > 0`, which counted `completado`
items too — a batch that fully succeeded still left its now-`completado`
entries sitting in the queue array, so closing the drawer right after a
100%-successful upload incorrectly opened the "you have unsaved files"
discard confirmation. Fixed two ways together: `getDiscardableItems`
(`useUploadWorkerDocuments.ts`) is the single predicate for "what would
actually be lost", counting only `preparado` (never attempted) and `error`
(attempted, failed, still retryable/discardable) — never `completado`,
whose upload already committed server-side, and never `subiendo`, which
`isBusy` already blocks outright before this guard is even consulted. And
`removeCompletedItems` sweeps every `completado` entry out of `items`
immediately after `uploadQueuedFiles`/`retryItem` settles, so a fully
successful batch structurally ends with an empty queue — there is nothing
lingering for a future guard check to miscount, even in principle.
`discardableCount` (the number shown in the confirmation's "Tienes N
archivos sin subir" text) and `pendingCount` (the number shown in
"Subir N archivos", `preparado`-only) are deliberately two different
counters computed from the same `items` array — conflating them was the
root cause of the original bug, so they're kept as two named,
independently-tested values rather than one reused number.

**11. `Modal.Window`'s accessibility fix reuses `useOutsideClick`'s own
ref, and `useModal` was extracted to its own module to satisfy
`react-refresh/only-export-components`.** Rather than adding a second ref
alongside the pre-existing outside-click-dismissal ref, `Modal.Window`
adds `role="dialog"`, `aria-modal`, an `aria-labelledby`/`aria-label`
fallback, initial-focus, a Tab/Shift+Tab focus trap, Escape-to-close, and
`isConnected`-guarded focus restoration all on top of the same
`useOutsideClick(close)` ref it already had — one ref serving both
purposes, since both are properties of the same dialog container element.
Fixing the pre-existing `react-refresh/only-export-components` ESLint
warning on `Modal.tsx` (it co-exported the `useModal` hook alongside the
`Modal` component) required moving `useModal` out of that file entirely —
re-exporting it from `Modal.tsx` was tried first and still triggered the
warning (a re-export of a non-component still counts), so `useModal` now
lives in `ui/useModal.ts`, backed by the context object in
`ui/ModalContext.ts`; every consumer imports `useModal` from its own
module directly. `Modal.tsx`'s only public API change is that `useModal`
is no longer importable from it.

**12. `happy-dom` was added, explicitly approved, scoped to only the test
files that import it.** Escape/Tab-focus-trap/overlay/scroll-lock/focus-
restoration behavior cannot be verified by this codebase's established
`renderToStaticMarkup`-only testing convention (no `document`, no real
event dispatch, no `document.activeElement`) — and per explicit
instruction, these interaction tests must exercise the real hooks/queue
logic, never a mocked stand-in for the exact behavior under test. Adding a
real-DOM test dependency was proposed and explicitly approved (as
`happy-dom` specifically, over `jsdom` or forgoing DOM tests) rather than
assumed. It is intentionally *not* preloaded globally (no `bunfig.toml`
entry): `src/testUtils/domTestSetup.ts` registers it only when imported,
guarded by `typeof document === "undefined"`, so only the handful of test
files that explicitly import it (transitively, via
`src/testUtils/renderDom.tsx`) ever run with a DOM present — every other
test file in the repo, including this same feature's own pure-logic and
static-render suites, is completely unaffected and keeps running exactly
as before.

## Risks / Trade-offs

- Flipping `allows_multiple` on 6 Docencia types permanently retires the
  "reemplazar" affordance for them (the RPC already refuses
  `allows_multiple = true` types). Mitigated: this exactly matches how
  `Evidencias bimestrales`/`Tutoría`/`Asesoría`'s evidence types already
  behave, the client already gates this generically, and the new pgTAP
  coverage proves the RPC rejection holds for the newly-flipped types too.
- The known-but-unaddressed open-read RLS finding on
  `worker_document_categories`/`worker_document_types` (see Non-goals)
  remains open after this change. Accepted: bundling it here would repeat
  the "no amplíes el alcance" lesson from the prior RLS-focused session;
  it is a pre-existing, separate-severity issue (world-readable catalog
  metadata, not per-worker document rows) better handled as its own
  change with its own guarded migration and pgTAP drift coverage.
- No automated mobile-viewport/visual-regression test exists in this
  toolchain (`happy-dom`, added by this change — see Decision 12 — gives
  real DOM events and layout-independent assertions like focus/ARIA
  attributes, but not actual CSS media-query/viewport rendering, and no
  `@testing-library/react` or visual-diffing dependency was added). Mobile
  single-column/no-horizontal-scroll behavior falls out structurally from
  removing the `Table` grid component entirely (there are no columns to
  collapse) and from the drawer's own `@media (max-width: 640px)` rules,
  but is verified manually per tasks.md, not by an automated test — same
  precedent as this codebase's other UI changes.
- The discard-confirmation guard (Decision 10) is evaluated from
  `DocumentDetailDrawer`'s own local state and reported upward via
  `onGuardChange` on every render where `isBusy`/`hasPendingSelection`
  changes; `WorkerDocumentsDashboard` trusts the most recently reported
  value rather than re-deriving it itself. This keeps the guard's
  business logic in one place (co-located with the queue/single-file state
  it reads), at the cost of one extra prop round-trip; accepted since the
  alternative (lifting the queue/single-file state itself into the
  dashboard) would have broken Decision 8's per-open-drawer hook
  instantiation.
