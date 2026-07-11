## Context

`src/pages/ScheduleDashboard.tsx` is the only page that reads
`schedule_assignments`/`schedule_teachers` for the "schedules" feature.
Today it calls two unparameterized hooks:

```ts
const { scheduleAssignments } = useScheduleAssignments();
const { scheduleTeachers } = useScheduleTeachers();
```

which call `getScheduleAssignments()` / `getScheduleTeachers()`
(`src/services/apiScheduleAssignments.ts:9-22`,
`src/services/apiScheduleTeachers.ts:9-20`) — each a bare
`supabase.from(table).select(...)` with no filter. `ScheduleDashboard.tsx`
then filters both full arrays down to the current semester
(`src/pages/ScheduleDashboard.tsx:114-115`) before putting the filtered
arrays into `SemesterContext` and passing them as props to `ScholarSchedule`
and `TeacherSchedule`.

Everything downstream of `ScheduleDashboard.tsx` — `ScholarSchedule.tsx`,
`TeacherSchedule.tsx`, `ShowScholarSchedule.tsx`, `ShowTeacherSchedule.tsx`,
`CreateEditScholarSchedule.tsx` (via `SemesterContext`),
`CreateEditTeacherSchedule.tsx`, `TeacherAssignment.tsx`, and the PDF
exporters — already only ever receives the semester-filtered arrays as
props, never the full unfiltered dataset. This means the entire fix is
containable to the fetch boundary: the two services, the two read hooks, and
the one page that calls them.

Supabase/PostgREST caps unpaginated `select()` responses (default 1000
rows). Once `schedule_assignments` or `schedule_teachers` crosses that count
across all semesters combined, the unfiltered fetch silently returns a
truncated set (no error surfaced to the app), and the existing client-side
`.filter()` then has no way to recover the missing rows for the current
semester — the bug this proposal fixes.

## Goals / Non-Goals

**Goals:**
- Filter `schedule_assignments` and `schedule_teachers` reads by
  `semester_id` at the Supabase query level (`.eq("semester_id", semesterId)`),
  so correctness no longer depends on both tables staying under PostgREST's
  row cap.
- Keep the `queryKey` for both read hooks semester-aware
  (`["scheduleAssignments", semesterId]` / `["scheduleTeachers", semesterId]`)
  so TanStack Query caches each semester's data independently instead of
  sharing one global cache entry across every semester ever visited.
- Preserve every other observable behavior: rendered tables, create/edit/delete
  flows, conflict detection, `SemesterContext` shape, PDF exports, and the
  teacher assignment-hours summary.

**Non-Goals:**
- No pagination/infinite-scroll for schedules within a semester.
- No Supabase schema or migration changes (no new indexes added by this
  change — see Decision 6).
- No unification of `schedule_assignments`/`schedule_teachers` into one
  table.
- No changes to the 6 existing schedule mutation hooks' `mutationFn`
  signatures or the create/edit/delete Supabase calls in
  `apiScheduleAssignments.ts`/`apiScheduleTeachers.ts` — only the two GET
  functions change.
- No changes to `src/features/semesters/**` (the semester picker/list itself
  is out of scope; this change only scopes the two schedule tables).

## Decisions

**1. Where does the `.eq("semester_id", ...)` filter live?**
In the service layer (`getScheduleAssignments(semesterId)` /
`getScheduleTeachers(semesterId)`), matching the codebase's existing
convention that `src/services/api*.ts` files own all raw Supabase call
shapes, and hooks only wire React Query around them.

**2. What type does `semesterId` have at each layer? *(Closed)***
The route param (`useParams().id` in `ScheduleDashboard.tsx`) is
`string | undefined`. `ScheduleDashboard.tsx` parses it to a number **once**,
at the top of the component, and passes the parsed value down — the hooks
and services never see the raw string:

```ts
const { id } = useParams();
const semesterId = id !== undefined ? Number(id) : undefined;
```

- `useScheduleAssignments`/`useScheduleTeachers` accept
  `semesterId: number | undefined` (not `string | number`).
- `getScheduleAssignments`/`getScheduleTeachers` accept `semesterId: number`
  (always already-parsed by the time a `queryFn` calls them — `enabled`,
  per Decision 3, guarantees the query never runs with a non-number).
- This replaces the earlier draft of this decision (hooks/services accepting
  `string | number` and coercing internally) — parsing happens exactly once,
  at the same route-param boundary the removed `+id!` client-side filter
  used to coerce at, not duplicated at every layer.

**3. Do the read hooks need an `enabled` guard? *(Closed)***
Yes, and it must check **numeric validity**, not just truthiness — `Boolean(semesterId)`
alone would incorrectly disable the query for a legitimate falsy-but-invalid
edge case and, more importantly, would not catch `NaN` (`Boolean(NaN)` is
`false`, so that specific case is safe, but the check should be explicit
about *why* rather than relying on `NaN`'s coincidental falsiness):

```ts
enabled: typeof semesterId === "number" && Number.isFinite(semesterId)
```

This guards both `semesterId === undefined` (route param not yet resolved)
and `semesterId` being `NaN` (a malformed route param, e.g. a non-numeric
`:id` segment). Existing UI behavior does not change: today, a missing/
malformed `id` produces `+id!` → `NaN`, and `array.filter((s) => s.semester_id === NaN)`
always returns `[]` — so the page already effectively showed empty schedules
for this edge case. After this change, the query simply never fires and the
hook's `data` stays `undefined`.

**Correction (found during implementation):** this decision originally
assumed `ScheduleDashboard.tsx`'s existing `isLoading` gate alone would
render `<Spinner />` for this case, on the premise that a disabled query
reports `isLoading: true` while it has no data. That premise does not hold
for this codebase's installed `@tanstack/react-query` (`^5.51.23`): v5
derives `isLoading` as `isPending && isFetching`, and a disabled query never
fetches, so `isFetching` is `false` and `isLoading` is `false` even though
`data` stays `undefined` indefinitely. Left uncorrected, the loading gate
would have returned `false` for this edge case and let the page render past
it with `scheduleAssignments`/`scheduleTeachers` still `undefined` —
crashing at the `SemesterContext` value and every downstream prop expecting
an array. The implementation instead adds an explicit
`!scheduleAssignments || !scheduleTeachers` check to the same loading-gate
condition in `ScheduleDashboard.tsx`, which keeps `<Spinner />` showing for
as long as either scoped query has no data — covering the disabled case
this decision intended, by a condition that actually holds in this
codebase's TanStack Query version, rather than by `isLoading` alone.

**Second correction (post-review):** the first correction above introduced
its own regression — `!scheduleAssignments || !scheduleTeachers` is also
`true` while either query is in an *error* state (a failed fetch also
leaves `data` `undefined`), and that new guard was checked *before* the
existing `anyError` check further down the component. This made the
`<ErrorMessage message={anyError.message} />` branch unreachable for
`errorAssignments`/`errorTeachers` (and, incidentally, for
`errorWorkers`/`errorSubjects`/`errorGroups`/`errorSemesters` too, since the
same single `if` covered all of them) — a real query error would render an
infinite `<Spinner />` instead of the error message, changing pre-existing
error behavior. Fixed by computing `anyError` before the loading/missing-data
`if` and excluding that `if` whenever `anyError` is truthy
(`if (!anyError && (...loading/missing-data conditions...)) return <Spinner />;`),
so an error always falls through to the existing
`if (anyError) return <ErrorMessage .../>;` check immediately after,
regardless of what `scheduleAssignments`/`scheduleTeachers`/the loading
flags are doing. The invalid/missing-`semesterId` case (no error, just a
disabled query) is unaffected — it still has `anyError` falsy, so the
missing-data guard still applies and still renders `<Spinner />` as
intended.

**4. Does `queryKey` including `semesterId` break the existing mutation
hooks' cache invalidation? *(Verified by inspection, confirm behaviorally)***
Inspected all 6 mutation hooks directly; every one calls `invalidateQueries`
with a **plain array key and no `exact` option**:
- `useCreateScheduleAssignments.ts` / `useEditScheduleAssignments.ts` /
  `useDeleteScheduleAssignment.ts` → `queryClient.invalidateQueries({ queryKey: ["scheduleAssignments"] })`
- `useCreateScheduleTeacher.ts` / `useEditScheduleTeacher.ts` /
  `useDeleteScheduleTeacher.ts` → `queryClient.invalidateQueries({ queryKey: ["scheduleTeachers"] })`

None passes `exact: true`. TanStack Query v5's documented default for
`invalidateQueries` is prefix matching (`exact` defaults to `false`), so a
call keyed `["scheduleAssignments"]` matches any cached query whose key
*starts with* `"scheduleAssignments"` — including the new
`["scheduleAssignments", semesterId]`. This holds **only if** the new key
stays a plain array with `"scheduleAssignments"`/`"scheduleTeachers"` as
element `[0]` (task 2.1/2.2) — implementation must not switch to an object-style
key (e.g. `{ type: "scheduleAssignments", semesterId }`), which would break
prefix matching against these unchanged mutation hooks.

This change still does **not** modify any of the 6 mutation hooks — the
inspection above is why. It remains a requirement (not a formality) that
`tasks.md` §4.5 manually confirms create/edit/delete refresh the visible
schedule table without a full page reload, since prefix-matching is a
documented default, not something this codebase's own tests currently cover.
If manual verification in §4.5 finds it does *not* refresh automatically,
`tasks.md` §2.3 requires escalating to updating the mutation hooks' `invalidateQueries`
calls (e.g. explicit `queryKey: ["scheduleAssignments", semesterId]`, or a
predicate-based invalidation) as an in-scope follow-up fix, not a shipped-broken
gap.

**5. Does `ScheduleDashboard.tsx` still need its own `.filter()` calls
after this change?**
No — they become redundant once the Supabase query itself is scoped, and
are removed. `currentSemester = semesters!.find((s) => s.id === +id!)` is
unrelated (reads the separate `semesters` table, already returns one row per
page load, not subject to the row-cap issue) and is left unchanged.

**6. Are `schedule_assignments.semester_id` / `schedule_teachers.semester_id`
indexed today? *(Inspected, non-blocking follow-up)***
No. Inspected `supabase/migrations/20260702000000_remote_schema.sql` (the
base schema dump, where both tables are defined) and every other file under
`supabase/migrations/**`: neither table has a `CREATE INDEX`/`CREATE UNIQUE INDEX`
statement anywhere in the migration history. Each table has only a primary
key on `id` (`schedule_assignments_pkey`, `schedule_teachers_pkey`) and a
foreign-key constraint on `semester_id`
(`schedule_assignments_semester_id_fkey`, `schedule_teachers_semester_id_fkey`)
— and Postgres does **not** automatically create an index on the
*referencing* column of a foreign key (only on the referenced column, which
here is `semesters.id`, already covered by that table's own primary key).
So today, `.eq("semester_id", semesterId)` will execute as a sequential scan
over each table.

This repo already has a precedent for adding indexes as their own dedicated
migration (`supabase/migrations/20260702145831_worker_document_indexes.sql`,
which includes a composite `worker_documents_worker_id_semester_id_idx`) —
so a follow-up index migration for these two tables would follow an
established pattern, not introduce a new one. Per this change's explicit
scope (Non-Goals: no Supabase schema or migration changes), no index is
added here. This is recorded as a **non-blocking follow-up**: the primary
goal of this change is correctness (querying by `semester_id` instead of
relying on/being broken by PostgREST's row cap), which does not depend on
indexing — an unindexed scoped scan is already strictly more correct than
today's unfiltered-then-truncated fetch, just not maximally fast at very
large row counts.

## Risks / Trade-offs

- **Cache-invalidation (Decision 4)**: mitigated to "verify, not assume" —
  inspection confirms all 6 mutation hooks use prefix-compatible plain-array
  keys with no `exact` option, so TanStack Query v5's default behavior
  should invalidate the new scoped keys with zero changes to those hooks.
  `tasks.md` §4.5 requires manually confirming this for create/edit/delete on
  both tables before the change is considered done; §2.3 defines the
  fallback (update the mutation hooks' `invalidateQueries` calls) if manual
  verification finds otherwise.
- **Missing index on `semester_id` (Decision 6)**: confirmed absent by
  inspection, not merely unconfirmed. Non-blocking per this change's scope —
  flagged as a follow-up for the user/DBA, optionally as its own future
  OpenSpec change reusing the `worker_document_indexes.sql` pattern.
- **Route param edge case (Decisions 2–3, closed)**: `useParams().id` can be
  `undefined` or non-numeric. `ScheduleDashboard.tsx` parses it once to
  `number | undefined`; the `enabled: typeof semesterId === "number" && Number.isFinite(semesterId)`
  guard on both read hooks prevents a broken/unscoped query from firing in
  either case. Resulting behavior (hooks stay pending, page shows
  `<Spinner />`) matches today's implicit behavior for this already-degenerate
  case (see Decision 3) — no observable UI change.
