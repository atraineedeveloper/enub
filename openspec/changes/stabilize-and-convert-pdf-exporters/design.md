# Design: Stabilize and Convert PDF Exporters

## Context

`src/pdf/**` is the last untyped area directly reachable from the now-fully-typed
`src/features/schedules/**` and `src/pages/**`. It contains four PDF export
components. Two of them (`ScheduleGroupPDF.jsx`, `ScheduleTeacherPDF.jsx`)
share an unguarded array-indexing pattern against `useRoles()`/`useStateRoles()`
data that crashes deterministically under the current seed data. This was
reported as a live bug (`ScheduleTeacherPDF.jsx:351`,
`Cannot read properties of undefined (reading 'role')`) and has been traced to
its root cause below. This change repairs that bug using a pattern already
proven elsewhere in the codebase, then brings all four PDF files up to the
same TypeScript bar as the rest of the migration.

An earlier, unrelated attempt to convert PDF exporters to TypeScript
(`convert-pdf-exporters-to-ts`) was implemented once but discarded before it
could be reviewed; none of its changes are present in the current tree. Its
typing patterns (documented below) remain valid and are reused here.

## Goals

- Eliminate the deterministic `roles[1]`/`stateRoles[1]` crash in
  `ScheduleGroupPDF.jsx` and `ScheduleTeacherPDF.jsx`.
- Convert all four `src/pdf/**` component files to TypeScript.
- Preserve all existing PDF visual output exactly, except for the minimal,
  explicit repair described below.
- Reuse existing generated/feature types rather than inventing new ones.

## Non-Goals

- No new PDF exports, buttons, or export formats.
- No redesign of PDF layout, styling, or content beyond the one documented
  repair.
- No changes to `services/`, Supabase queries, migrations, or generated types.
- No resolution of the three orphaned schedule files beyond re-confirming
  their status (see Closed Decision 7).
- No consolidation of the three duplicated `groupData`/`filterHour*` helpers
  across PDF/schedule files (out of scope, consistent with the schedules
  migration's Decision 5).

## Closed Decisions

**1. Which PDF exporters exist?**
Four, all under `src/pdf/`:
- `src/pdf/Schedules/ScheduleGroupPDF.jsx` (237 lines)
- `src/pdf/Schedules/ScheduleTeacherPDF.jsx` (411 lines)
- `src/pdf/Schedules/TeacherAssignmentPDF.jsx` (485 lines)
- `src/pdf/WorkerSheetSemester.jsx` (842 lines)

Supporting non-component modules used only by these: `src/pdf/Schedules/filterHour.js`,
`src/pdf/Schedules/filterHourGroup.js`, `src/pdf/Schedules/filterHourActivity.js`.
Static assets `src/pdf/enub.jpg`, `src/pdf/setab.jpeg` are unaffected.

**2. Which buttons/call sites invoke each PDF?**
- `ScheduleGroupPDF`: `src/features/schedules/ShowScholarSchedule.tsx:77` —
  `<ScheduleGroupPDF schedules={filteredSchedules} />`, rendered only when
  `filteredSchedules.length > 0`.
- `ScheduleTeacherPDF`: `src/features/schedules/ShowTeacherSchedule.tsx:178-182` —
  `<ScheduleTeacherPDF totalHours={totalHours} schedulesScholar={filteredSchedulesAssignments} scheduleTeacher={filteredSchedulesTeacher} />`,
  rendered only when `recordExist`.
- `TeacherAssignmentPDF`: `src/features/schedules/TeacherAssignment.tsx:259-263` —
  `<TeacherAssignmentPDF groupedSubjects={groupedSubjects} uniqueTeacherSchedule={uniqueTeacherSchedule} currentWorker={currentWorker} />`,
  unconditionally rendered inside that tab.
- `WorkerSheetSemester`: `src/pages/ScheduleDashboard.tsx:139` via a local
  `ComponentType` cast (`UntypedWorkerSheetSemester as ComponentType<{ workers, semester, scheduleAssignments?, scheduleTeachers? }>`)
  established during `convert-pages-to-ts`.

All four are leaf components with no further internal call sites.

**3. Which PDF currently fails in main and why?**
`ScheduleTeacherPDF.jsx` and `ScheduleGroupPDF.jsx` both fail. Root cause,
confirmed via `supabase/seed.sql`:
```sql
INSERT INTO "public"."roles" ("id", "role", "worker_id")
VALUES (1, 'Coordinación local ficticia', 1) ...
SELECT pg_catalog.setval('public.roles_id_seq', 1, true);

INSERT INTO "public"."state_roles" ("id", "role", "name_worker")
VALUES (1, 'Representante local ficticio', 'María Prueba López') ...
SELECT pg_catalog.setval('public.state_roles_id_seq', 1, true);
```
Exactly one row is seeded into each table. Both `ScheduleTeacherPDF.jsx` (line
351) and `ScheduleGroupPDF.jsx` build an `infoSchool` table that unconditionally
indexes `roles[0]`, `roles[1]`, `stateRoles[0]`, and `stateRoles[1]`. With only
one row in each table, `roles[1]` and `stateRoles[1]` are `undefined`, and
`.role`/`.workers.name`/`.name_worker` access on them throws. This is
deterministic given the current seed data, not an intermittent or
data-dependent edge case. `TeacherAssignmentPDF.jsx` only reads `roles[0]`
(never `roles[1]` or any `stateRoles` index), so it does not reproduce this
specific crash today, though it shares the same unguarded-first-element
assumption should `roles` ever be empty.

**4. Which PDF bugs are authorized to fix in this change?**
Only the `roles[1]`/`stateRoles[0]`/`stateRoles[1]` unguarded-index crash in
`ScheduleGroupPDF.jsx` and `ScheduleTeacherPDF.jsx`. `TeacherAssignmentPDF.jsx`'s
`roles[0]` access will be made null-safe (optional chaining/fallback) as a
matter of consistent typing during its TS conversion, but this is not treated
as "fixing a bug" since it does not currently throw. No other behavior is
authorized to change.

**5. Which PDF visual/layout details must remain unchanged?**
Filenames (`doc.save(...)` arguments), page orientation/size, all table
column/row structure and order, all static labels and headers, fonts
(`Montserrat-*` family references), margins, and all date/text formatting
helpers (`capitalizeName`, `filterHour*`). The only permitted visual change is
what appears in the two specific cells affected by the Decision 4 repair when
fewer than two roles/state_roles rows exist — and even there, the fallback
must be a sensible, non-crashing value, not a redesign of the cell.

**6. Which files will be converted to TS/TSX?**
All four PDF component files, converted to `.tsx`:
- `src/pdf/Schedules/ScheduleGroupPDF.jsx` → `.tsx`
- `src/pdf/Schedules/ScheduleTeacherPDF.jsx` → `.tsx`
- `src/pdf/Schedules/TeacherAssignmentPDF.jsx` → `.tsx`
- `src/pdf/WorkerSheetSemester.jsx` → `.tsx`

The three helper modules (`filterHour.js`, `filterHourGroup.js`,
`filterHourActivity.js`) are small, pure, already-implicit-`any`-tolerant
functions consumed only by the files above. They will be converted to `.ts`
only if doing so is required to eliminate a resulting implicit-`any` typecheck
error in their callers; otherwise they are left as `.js` and imported with
their explicit `.js` extension, consistent with the "convert only explicitly-named
target files" rule. (Decided during implementation, Phase 2/3 — see tasks.md.)

**7. Will the three orphaned schedule files be deleted in this change, or deferred?**
**Deferred — not touched in this change.** `CreateScholarSchedule.jsx` has zero
live importers. `RowTeacherAssignment.jsx` is a placeholder stub with zero live
importers. `EditScholarSchedule.jsx` is imported once, into an unused local
binding, by `HourScheduleSubjectGroup.tsx`, and independently contains a real
Rules-of-Hooks violation (hooks called after an early `return <Spinner />`,
with `Spinner` never imported — a live `react/jsx-no-undef` error). Deleting
or fixing `EditScholarSchedule.jsx` is nontrivial and unrelated to PDF
stabilization; consistent with the schedules migration's Decision 1, all three
files remain untouched. This decision may be revisited in a future, dedicated
cleanup change.

**8. Are any service/Supabase query changes allowed?**
No. `apiRoles.js`'s `getRoles()` (`select("*, workers(*)")`) and
`apiStateRoles.js`'s `getStateRoles()` (`select("*")`) are confirmed adequate
for a defensive-consumption fix — the bug is in how the PDF components consume
the data, not in what the services fetch. No service or query changes are
required or authorized.

**9. How will PDF output be manually verified?**
Each affected PDF is generated once before implementation (baseline,
where possible — `ScheduleTeacherPDF`/`ScheduleGroupPDF` cannot produce a
baseline for the fewer-than-2-rows case since that case currently crashes) and
once after each phase, using the running dev app against the local Supabase
instance with its seeded data. Comparison covers: file opens without error,
filename matches, table structure/labels/fonts match, and — for the two
repaired exporters — the previously-crashing action now completes and renders
a sensible fallback in place of the missing second role/state-role.

**10. One branch with phases, or multiple branches?**
One branch, phased, matching the established pattern from every prior change
in this migration (each phase reviewed and committed before the next begins).

## File Inventory

| File | Lines | Current state | Target state |
|---|---|---|---|
| `src/pdf/Schedules/ScheduleGroupPDF.jsx` | 237 | `.jsx`, unsafe `roles`/`stateRoles` indexing | `.tsx`, repaired |
| `src/pdf/Schedules/ScheduleTeacherPDF.jsx` | 411 | `.jsx`, unsafe `roles`/`stateRoles` indexing (reported crash) | `.tsx`, repaired |
| `src/pdf/Schedules/TeacherAssignmentPDF.jsx` | 485 | `.jsx`, `roles[0]` only (no crash today) | `.tsx`, null-safe |
| `src/pdf/WorkerSheetSemester.jsx` | 842 | `.jsx`, already defensive re: `roles` | `.tsx`, typed, unchanged behavior |
| `src/pdf/Schedules/filterHour.js` | small | `.js`, untyped | `.js` or `.ts` (Decision 6) |
| `src/pdf/Schedules/filterHourGroup.js` | small | `.js`, untyped | `.js` or `.ts` (Decision 6) |
| `src/pdf/Schedules/filterHourActivity.js` | small | `.js`, untyped | `.js` or `.ts` (Decision 6) |

## PDF Exporter Dependency Map

```
ShowScholarSchedule.tsx  ──renders──> ScheduleGroupPDF.jsx
                                        ├─ useRoles() [typed: useRoles.ts]
                                        ├─ useStateRoles() [untyped: useStateRoles.js]
                                        ├─ useUtilities() [untyped]
                                        └─ filterHour.js

ShowTeacherSchedule.tsx  ──renders──> ScheduleTeacherPDF.jsx
                                        ├─ useRoles(), useStateRoles(), useUtilities()
                                        ├─ filterHourGroup.js, filterHourActivity.js
                                        └─ capitalizeName (untyped helper)

TeacherAssignment.tsx    ──renders──> TeacherAssignmentPDF.jsx
                                        ├─ useRoles() only
                                        ├─ local groupData() (own copy, Decision 5 precedent)
                                        └─ jsPDF autoTable + lastAutoTable

ScheduleDashboard.tsx    ──renders──> WorkerSheetSemester.jsx (via ComponentType cast)
                                        ├─ useRoles() [already defensive]
                                        ├─ useWorkers-derived data (via props)
                                        └─ hardcoded Supabase storage URL for photos
```

All four are leaves; none of them render each other or are rendered
conditionally on one another.

## Current Failure Analysis

`ScheduleTeacherPDF.jsx` (crash site, line 351) and `ScheduleGroupPDF.jsx`
(identical latent construct) each build an `infoSchool` autoTable body
containing:
```js
[
  { content: roles[1].role, styles: {...} },        // throws: roles[1] is undefined
  { content: "Vo. Bo", rowSpan: 4, ... },
  { content: roles[0].role, styles: {...} },
],
[
  capitalizeName(roles[1].workers.name),             // throws
  capitalizeName(roles[0].workers.name),
],
[
  { content: stateRoles[0].role, ... },              // undefined if state_roles empty
  { content: stateRoles[1].role, ... },              // throws with 1-row seed
],
[
  capitalizeName(stateRoles[0].name_worker.toUpperCase()),
  capitalizeName(stateRoles[1].name_worker.toUpperCase()),  // throws
],
```
Both files also read `utilities[0].value` unguarded, and
`schedulesScholar[0]?.semesters.school_year || scheduleTeacher[0].semesters.school_year`
— optional-chained on the left operand only, still unguarded on the right.
These additional unguarded reads are lower risk (`utilities`/`schedulesScholar`/
`scheduleTeacher` are not known to be under-seeded the way `roles`/`state_roles`
are) and are addressed only incidentally, by the TypeScript conversion forcing
explicit handling, not as a standalone "fix."

**Proven reference repair pattern**, already live in `WorkerSheetSemester.jsx`
against the exact same `useRoles()` source:
```js
const availableRoles = roles ?? [];
const findRoleByKeywords = (keywords = []) =>
  availableRoles.find((role) =>
    keywords.some((keyword) => role?.role?.toLowerCase().includes(keyword.toLowerCase()))
  );
const leftFooterRole =
  findRoleByKeywords(["subdirector"]) ?? availableRoles[1] ?? availableRoles[0] ?? null;
const leftFooterName = leftFooterRole?.workers?.name
  ? toUpperEs(capitalizeName(leftFooterRole.workers.name))
  : "—";
const leftFooterTitle = leftFooterRole?.role
  ? toUpperEs(leftFooterRole.role)
  : "SUBDIRECTOR ACADÉMICO";
```
This degrades gracefully to a hardcoded default title and an em-dash name
placeholder when no matching role exists, rather than crashing. The repair
phase adapts this same shape (optional chaining + explicit fallback value) to
`ScheduleGroupPDF.jsx`/`ScheduleTeacherPDF.jsx`'s `infoSchool` cells: each of
the four currently-unguarded `roles[n]`/`stateRoles[n]` accesses becomes
`roles[n]?.role ?? ""` / `roles[n]?.workers?.name ? capitalizeName(...) : ""`
(and the `state_roles` equivalents), preserving the exact same cell positions
and table structure, changing only what renders in a cell when the backing
row does not exist. No hardcoded titles are invented for these two files since,
unlike `WorkerSheetSemester.jsx`'s named "subdirector"/"encargado" footer
roles, `infoSchool`'s two role slots have no fixed semantic identity in the
current code — an empty string is the minimal, non-inventive fallback.

## Data-Shape Analysis Per PDF

- **`ScheduleGroupPDF`**: `schedules: ScheduleAssignment[]` (reuse
  `src/features/schedules/useScheduleAssignments.ts`'s exported type). Also
  consumes `Role` (`useRoles.ts`) and
  `Database["public"]["Tables"]["state_roles"]["Row"]` (via a local type
  alias, since `useStateRoles.js` itself stays untyped/out of scope — its
  return value is cast at the PDF's own boundary).
- **`ScheduleTeacherPDF`**: `schedulesScholar: ScheduleAssignment[]`,
  `scheduleTeacher: ScheduleTeacher[]` (reuse `useScheduleTeachers.ts`'s
  exported type), `totalHours: number`. Same `Role`/`state_roles` typing as
  above.
- **`TeacherAssignmentPDF`**: `groupedSubjects` (return shape of its own local
  `groupData` helper — typed inline, matching the already-typed copies in
  `ScholarSchedule`/`TeacherSchedule`/`useScheduleAssignments`-adjacent files
  per Decision 5), `uniqueTeacherSchedule: ScheduleTeacher[]`,
  `currentWorker: Worker | undefined` (reuse `useWorkers.ts`'s exported type).
  Same `Role` typing (no `state_roles` usage).
- **`WorkerSheetSemester`**: already consumes `Worker[]`, `Semester[]`
  (matching the shape asserted in `ScheduleDashboard.tsx`'s current cast) via
  its props; `scheduleAssignments`/`scheduleTeachers` currently typed as
  `unknown[]` in the page-level cast — this change gives them their real
  `ScheduleAssignment[]`/`ScheduleTeacher[]` types once `WorkerSheetSemester.tsx`
  declares real prop types, allowing `ScheduleDashboard.tsx`'s cast to be
  narrowed or removed entirely (page file touched only to update/remove this
  cast, no other change).
- **jsPDF typing gap** (all four files): `autoTable` is not on jsPDF's own
  type (`jspdf-autotable` only exports a standalone function) — resolved via
  `type JsPdfWithAutoTable = jsPDF & { autoTable: (options: UserOptions) => void }`.
  `TeacherAssignmentPDF` additionally uses `doc.lastAutoTable.finalY`, requiring
  `lastAutoTable: { finalY: number }` on the same widened type.
  `internal.getCurrentPageInfo` is missing from jsPDF's bundled types despite
  existing at runtime — same widening-cast treatment, only in the file(s) that
  call it.

## Exact Target Files

- `src/pdf/Schedules/ScheduleGroupPDF.jsx` → `ScheduleGroupPDF.tsx`
- `src/pdf/Schedules/ScheduleTeacherPDF.jsx` → `ScheduleTeacherPDF.tsx`
- `src/pdf/Schedules/TeacherAssignmentPDF.jsx` → `TeacherAssignmentPDF.tsx`
- `src/pdf/WorkerSheetSemester.jsx` → `WorkerSheetSemester.tsx`
- `src/pages/ScheduleDashboard.tsx` — updated only to remove/narrow its
  existing `WorkerSheetSemester` `ComponentType` cast once the component is
  natively typed; no other change.
- `src/features/schedules/ShowScholarSchedule.tsx`,
  `ShowTeacherSchedule.tsx`, `TeacherAssignment.tsx` — updated only if their
  existing import path/extension needs adjustment after conversion (e.g.
  `.jsx` → no extension or `.tsx`, per project import convention); no prop or
  behavior changes.

## Files Explicitly Out of Scope

- `src/features/roles/useRoles.ts`, `src/services/apiRoles.js`,
  `src/features/stateRoles/useStateRoles.js`, `src/services/apiStateRoles.js`,
  `src/features/utilities/*` (whatever `useUtilities.js`'s actual path is) —
  no changes.
- `supabase/seed.sql`, any Supabase migration — no changes. The fix is
  consumption-side, not data-side.
- `src/features/schedules/CreateScholarSchedule.jsx`, `EditScholarSchedule.jsx`,
  `RowTeacherAssignment.jsx` — untouched (Decision 7).
- `package.json`, `tsconfig.json`, `eslint.config.js`, `src/types/supabase.ts`.

## Risk Analysis

- **Highest risk**: the repair to `ScheduleGroupPDF.jsx`/`ScheduleTeacherPDF.jsx`
  changes runtime behavior (not just types) for the currently-crashing case.
  Mitigated by keeping the fallback minimal (empty string / no-op), matching
  cell positions and table shape exactly, and manually verifying both the
  common case (≥2 rows, if ever tested against a seed with more data) and the
  current seed's 1-row case.
  Since the current seed always has exactly 1 row, there is no way to manually
  verify the "≥2 rows" case flows through unaffected without temporarily
  seeding extra rows in a local/dev database — this will be done as a manual,
  non-committed local step during verification, not as a migration change.
- **Medium risk**: jsPDF/`autoTable`/`lastAutoTable`/`getCurrentPageInfo` type
  widening — low behavioral risk (type-only), but must be re-verified per file
  since the earlier `convert-pdf-exporters-to-ts` attempt that established
  this pattern was discarded before review.
- **Low risk**: `TeacherAssignmentPDF.jsx`'s `roles[0]` null-safety addition —
  does not change behavior for the current seed (which always has ≥1 role),
  only guards a case that cannot currently occur.
- **Low risk**: `WorkerSheetSemester.jsx` conversion — logic is already
  defensive; this is a type-only pass.

## Phase Breakdown

See `tasks.md` for the authoritative, checkbox-tracked phase list. Summary:
- Phase 0: Diagnosis (no code changes) — confirm findings in this document
  against the live app.
- Phase 1: Repair `ScheduleGroupPDF.jsx`/`ScheduleTeacherPDF.jsx`'s unsafe
  `roles`/`stateRoles` indexing (still `.jsx`).
  handling.
- Phase 2: Convert `ScheduleGroupPDF.jsx` and `ScheduleTeacherPDF.jsx` to
  `.tsx`.
- Phase 3: Convert `TeacherAssignmentPDF.jsx` to `.tsx` (including null-safety
  for `roles[0]` and the `lastAutoTable` typing).
- Phase 4: Convert `WorkerSheetSemester.jsx` to `.tsx`; update
  `ScheduleDashboard.tsx`'s cast.
- Phase 5: Full verification (typecheck/build/lint/import-audit/manual PDF
  checks).

No orphaned-file-cleanup phase is included (Decision 7: deferred).

## Verification Plan

After each implementation phase:
- `bun run typecheck`
- `bun run build`
- `bun run lint` (report exact before/after warning/error counts)
- Grep for remaining explicit `.jsx`/`.js` imports of converted files.

After all phases:
- `bunx @fission-ai/openspec validate stabilize-and-convert-pdf-exporters --type change --strict`
- Full manual PDF smoke pass (see below).

## Manual PDF Comparison Plan

For each of the four PDFs, using the running dev app against local Supabase:
1. Generate the PDF before the relevant phase's changes (baseline), where the
   action does not already crash.
2. Generate the PDF after the phase's changes.
3. Compare: file downloads without a thrown error; filename unchanged; table
   structure, column order, labels, fonts, and margins unchanged; for
   `ScheduleGroupPDF`/`ScheduleTeacherPDF`, confirm the previously-crashing
   export now completes and the two `infoSchool` role cells render an empty
   fallback instead of throwing.
4. Record pass/fail per PDF in `tasks.md`'s verification section, matching the
   documentation style used in the completed `plan-schedules-typescript-migration`
   change (which recorded a 6/7 manual-check result there).

## Rollback / Cancel Criteria

- If the Phase 1 repair changes visible output for the case where ≥2 rows
  exist (verified by temporarily seeding extra local rows), halt and revise
  the repair before proceeding to Phase 2.
- If any phase's `bun run build` or `bun run typecheck` fails and cannot be
  resolved without touching an out-of-scope file (services, generated types,
  config), halt and re-scope rather than expanding the change's boundaries
  without approval.
- If manual verification reveals the repair does not actually resolve the
  reported crash, halt Phase 2+ and re-diagnose rather than proceeding to
  convert a still-broken file.
