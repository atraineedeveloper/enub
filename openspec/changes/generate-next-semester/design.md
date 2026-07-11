## Context

`src/features/semesters/CreateSemesterForm.tsx` generates two fully
independent option lists and lets the admin pick freely from each:

```ts
const options = Array.from({ length: 3 }, (_, i) => {
  const year = currentYear + i;
  return [`${year.toString().slice(-2)}A`, `${year.toString().slice(-2)}B`];
}).flat();

const optionsYear = Array.from({ length: 4 }, (_, i) => {
  const startYear = lastYear + i;
  const endYear = startYear + 1;
  return `${startYear} - ${endYear}`;
});
```

`src/services/apiSemesters.ts`'s `createSemester()` only checks both fields
are non-empty (`if (!newSemester?.semester?.trim()) throw ...`); it does not
cross-check `school_year` against `semester`, does not check for a
duplicate `semester`, and does not check the new semester is the true
successor of the latest one. `getSemesters()` returns all rows unsorted.

Inspected `supabase/migrations/20260702000000_remote_schema.sql` (the table
definition) and every other migration file: `semesters` has only
`"id" bigint NOT NULL` as a primary key
(`ADD CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")`) — no unique index, no
check constraint, no format enforcement on `semester`/`school_year`
(both plain nullable `character varying`) anywhere in the schema.

Two real, pre-existing format inconsistencies were confirmed by inspection
(carried over from the immediately-prior `scope-group-grade-to-selected-semester`
change's own research, re-confirmed here):
- `supabase/seed.sql` seeds `semester = '2026-A'` / `'2026-B'` (4-digit
  year, hyphenated) and `school_year = '2025-2026'` / `'2026-2027'` (no
  spaces around the hyphen).
- `CreateSemesterForm.tsx` itself generates `semester = "26A"` / `"26B"`
  (2-digit, no separator) and `school_year = "2023 - 2024"` (spaced) for
  every semester created through the UI today.

Neither format is enforced by the database, and both exist in real data.
This change does not "fix" or normalize either — it only needs to *parse*
existing `semester` values (to find the latest one) and needs to decide
which format to *generate* going forward (see Decisions 2–3).

`src/helpers/calculateSemesterGroup.ts` (the schedules module's grade
helper, added in `scope-group-grade-to-selected-semester`) already contains
similar-looking `YYA`/`YYB` parsing logic — but it is scoped to computing a
*group's grade relative to a semester*, a different concern with a
different consumer (the schedules module). Per this change's own
constraint ("Do not change schedules, groups, workers, or existing
schedule assignments"), this change does not import from or modify that
file; a small amount of parsing-logic duplication (Decision 2) is accepted
as the cost of keeping the two features decoupled.

## Goals / Non-Goals

**Goals:**
- The admin can no longer pick an arbitrary, unrelated `semester`/
  `school_year` pair — the normal creation path computes both
  automatically from the latest existing semester.
- Duplicate `semester` codes are rejected.
- Skipping ahead (creating a semester that isn't the true chronological
  successor of the latest one) is rejected.
- A first-ever semester can still be created when the table is empty.
- `semester` values continue to be created in `YYA`/`YYB` format going
  forward (matching this codebase's already-established generation
  convention, per `CreateSemesterForm.tsx`'s current code).

**Non-Goals:**
- No change to `schedules`, `groups`, `workers`, or existing
  `schedule_assignments`/`schedule_teachers` data or behavior.
- No change to `SemesterTable.tsx`, `SemesterRow.tsx`, or `useSemesters.ts`
  — display and fetching are unaffected; only how a new semester is
  *created* changes.
- No reuse of or change to `src/helpers/calculateSemesterGroup.ts`.
- No database migration in this change (Decision 6) — no new unique
  constraint, no backfill/normalization of existing `semester`/
  `school_year` values.
- No change to how existing (already-created) semesters display or behave.

## Decisions

**1. How to determine the latest semester?**

Fetch all semesters (`useSemesters()`, already cached), parse each
`semester` value with the same lenient pattern established in the prior
change (`/^(\d{2}|\d{4})-?([AB])$/i`, accepting both `YYA`/`YYB` and
`YYYY-A`/`YYYY-B`), and rank by the term-ordinal
`termIndex(year, letter) = year * 2 + (letter === "A" ? 0 : 1)`. The
semester with the highest `termIndex` is "latest." Any `semester` value
that fails to parse is skipped (not considered a candidate for "latest")
and logged via `console.warn` — matching the fallback convention already
established for semester-code parsing in this codebase. If zero semesters
exist, or every existing `semester` value fails to parse, there is no
"latest" — the UI falls back to the initial-semester path (Decision 4).

**2. How to compute the next semester?**

Pure arithmetic on the term-ordinal from Decision 1, independently
reimplemented in this feature's own helper (not imported from
`calculateSemesterGroup.ts` — see Context):

```
nextIndex = termIndex(latest) + 1
nextYear  = floor(nextIndex / 2)
nextLetter = nextIndex % 2 === 0 ? "A" : "B"
nextCode  = `${(nextYear % 100).toString().padStart(2, "0")}${nextLetter}`
```

Verified by chaining all 6 examples in the request:
`24A→24B→25A→25B→26A→26B→27A` — every step matches (confirmed via an ad
hoc `bun`-run script; see Verification Results in `tasks.md` once
implemented).

**3. How to compute `school_year` from a semester code?**

Per the stated rule (`YYA` belongs to `20(YY-1) - 20YY`; `YYB` belongs to
`20YY - 20(YY+1)`), using the already-parsed 4-digit `year`:

```
schoolYear = letter === "A" ? `${year - 1} - ${year}` : `${year} - ${year + 1}`
```

Verified against all 6 examples in the request — `24A → "2023 - 2024"`,
`24B → "2024 - 2025"`, `25A → "2024 - 2025"`, `25B → "2025 - 2026"`,
`26A → "2025 - 2026"`, `26B → "2026 - 2027"` — all match exactly (confirmed
via the same ad hoc script). The output format (`"YYYY - YYYY"`, spaced)
matches `CreateSemesterForm.tsx`'s own existing `optionsYear` generation
convention, not the unspaced seed-data format — the same "match the form's
own established going-forward convention over legacy seed data" choice
made for `semester` codes in the prior change.

**4. How to handle an empty database?**

When `useSemesters()` returns zero parseable semesters (Decision 1), the
form falls back to an initial-semester path: a minimal `<Select>` of
candidate starting codes (reusing the same kind of generation
`CreateSemesterForm.tsx` already does today — current year and the next
two, both `A`/`B` terms — 6 options), but **only for the `semester` field**.
`school_year` is never an independent field in either path: once a
candidate code is chosen (or auto-computed), `school_year` is always
derived from it via Decision 3's formula and submitted as a computed value,
not read from a second dropdown. This closes the "arbitrary school_year"
gap even in the bootstrap case, not just in normal (non-empty) creation.

**5. How to prevent duplicates?**

Enforced server-side, in `apiSemesters.ts`'s `createSemester()` — not only
client-side — since the client's cached `useSemesters()` data can be stale
(5-minute `staleTime`) and a purely client-side check cannot be authoritative
against a concurrent creation. Before inserting, `createSemester()` fetches
current semesters and checks the candidate against every existing one; an
exact match throws a clear Spanish error
(`"Ya existe un semestre con ese código."`) before any insert is attempted.
The UI's own computed-next-semester flow also can't realistically produce a
duplicate in the normal path (it's always latest+1, and latest is freshly
re-fetched before computing it), so this check's practical purpose is
defense-in-depth against a stale form session or a direct API call, not the
everyday path.

**Correction (found during code review): the duplicate check compares by
parsed (canonical) identity, not only raw normalized strings.** The
original implementation compared `.trim().toUpperCase()` string equality
only — which would treat `"26A"` and `"2026-A"` as *different* semesters
even though both parse to the same calendar term (Decision 2's own parsing
rule already treats them as equivalent everywhere else). Fixed: for each
existing row, `createSemester()` now parses `s.semester` and compares its
*formatted canonical code* against the candidate's canonical code when the
existing value parses successfully; it only falls back to a raw
normalized-string comparison for an existing row whose value doesn't parse
at all (legacy/malformed data with no canonical form to compare against).
This closes the semantic-duplicate gap (`26A` submitted when `2026-A`
already exists is now correctly rejected as a duplicate) without weakening
the fallback for genuinely unparseable legacy rows.

**Correction (found during code review): candidate format validation and
authoritative school_year derivation happen at the service boundary, not
only in the UI.** Two related gaps in the original implementation:
- The candidate `semester` was only parsed (and validated) *inside* the
  `if (latest)` branch — meaning a malformed code like `"garbage"` would
  skip validation entirely in the bootstrap path (no `latest` to branch
  into) and reach the insert unchecked. Fixed: `createSemester()` now
  parses and validates the candidate **first**, before either the
  duplicate or sequential-order check, and rejects an unparseable code in
  *every* case, bootstrap included — not just when a latest semester
  happens to exist.
- `createSemester()` previously inserted whatever `school_year` string the
  caller submitted, trusting the UI to have computed it correctly
  (Decision 3). A direct, stale, or manipulated call could submit a
  structurally valid, correctly-sequenced `semester` code paired with a
  wrong `school_year`. Fixed: once the candidate parses, `createSemester()`
  computes `school_year` itself via `getSchoolYearForSemester(candidateParsed)`
  and **always inserts that computed value**, ignoring whatever
  `school_year` string the caller sent (the presence check —
  `"El ciclo escolar es requerido"` — is kept as basic input validation,
  but the persisted value is never the caller's raw string). The same
  authoritative treatment is extended to `semester` itself: the **canonical**
  formatted code (`formatSemesterCode(candidateParsed)`) is inserted, not
  the caller's raw string — so a submission like `"26a"` (lowercase) or
  `"2026-A"` is still stored in the consistent going-forward `YYA` format,
  not verbatim. This is a small, deliberate extension beyond only
  `school_year`, applying the same "the service is authoritative for
  derived/canonical values" principle consistently to both fields.

**6. Should database uniqueness be a follow-up migration or part of this
change? *(Closed — confirmed by the user)***

**Not part of this change — a non-blocking follow-up.** Reasoning:
- The actually-reported problem is that the **UI** lets an admin pick
  arbitrary, uncorrelated, duplicate, or skipped values with no validation
  anywhere. Decisions 1–5 close that gap entirely at the application layer
  (both the UI, which no longer offers free choice in the normal path, and
  the service layer, which now validates duplicates and — the
  sequential-order rule below — chronological order).
- A unique constraint is schema work with a larger blast radius than this
  change's scope: it requires auditing existing data for pre-existing
  duplicates first (none are known, but this change's research did not
  exhaustively check the production database, only the local seed/migration
  files), and per `AGENTS.md`'s Supabase safety rules, several of the
  commands that would be needed to verify/apply this against a real
  environment require explicit human approval — appropriately out of scope
  for an OpenSpec change whose stated scope is UI/generation logic, not
  schema hardening.
- The residual gap this leaves (a true concurrent-request race — two
  creations racing past the application-level check at the same instant)
  is real but low-probability for this application's actual usage pattern
  (a small school, semesters created rarely, effectively never by two
  admins simultaneously) — see Risks below, not silently ignored.

**Sequential-order (anti-skip) enforcement is strict and is part of this
change, not a migration — confirmed by the user.** Once at least one
semester exists, the normal creation flow SHALL create only the exact next
chronological semester: no skipping ahead, and no backfilling a historical
semester, through this form or `createSemester()`. `createSemester()`
rejects any `semester` code that is not the exact Decision-2-computed
successor of the current latest semester, whenever at least one existing
semester parses successfully. This is pure application logic (no schema
change) and is the mechanism that actually closes the "skipping the next
chronological semester" problem at a layer a stale UI or direct API call
can't bypass — the UI's removal of free choice (Decision 4) is necessary
but not sufficient on its own, since nothing stops a direct
`createSemester()` call with an arbitrary payload today.

User-confirmed rationale: this is an administrative workflow for regular
semester progression. Preventing accidental duplicates, wrong school years,
and skipped semesters is more important than supporting rare historical
corrections in the normal UI. **Historical backfill or correction is
explicitly out of scope for this change and for `createSemester()`'s
normal path** — if ever needed, it is handled manually by an admin/developer
(e.g. a direct database insert) or through a future, separately-scoped
OpenSpec change that would need to deliberately carve out an exception to
this rule. This change does not build that exception path.

**7. What manual tests are required?**

- Empty-database bootstrap: with zero semesters, confirm the initial path
  renders a semester-code-only picker, `school_year` is computed and
  displayed (not independently selectable) once a code is chosen, and
  submission succeeds.
- Normal generation, all 6 request examples: starting from each of `24A`,
  `24B`, `25A`, `25B`, `26A` as the (only) existing latest semester,
  confirm the form computes and offers exactly `24B`, `25A`, `25B`, `26A`,
  `26B` respectively, each with the matching `school_year` from Decision 3.
- Duplicate rejection: attempt to create a semester whose code already
  exists (e.g. via two rapid submissions, or by manipulating the mutation
  payload) and confirm a clear error, no new row created.
- Skip rejection: attempt to submit a `semester` code other than the true
  computed next one (e.g. via devtools manipulation of the mutation
  payload, since the UI itself no longer offers a way to do this normally)
  and confirm the service layer rejects it.
- Regression check: confirm `/semesters/:id` (`ScheduleDashboard.tsx`) and
  the schedules module continue to work unchanged for existing semesters —
  this change touches no file under `src/features/schedules/**` or
  `src/pdf/**`, but the fix should still be spot-checked against a real
  semester to confirm no incidental breakage.
- Confirm `SemesterTable.tsx`/`SemesterRow.tsx` display newly-created
  semesters correctly (both code and `school_year`), unchanged from
  today's rendering.

## Risks / Trade-offs

- **No database-level uniqueness (Decision 6)**: a genuine concurrent-request
  race could still create a duplicate `semester`, bypassing the
  application-level check. Accepted as low-probability for this
  application's real usage pattern; confirmed by the user as a non-blocking
  follow-up, not silently deferred.
- **Semantic duplicates across formats (Decision 5, found and fixed during
  code review)**: `"26A"` and `"2026-A"` are the same calendar term but
  different strings; the original duplicate check only compared raw
  normalized strings and would have let a semantic duplicate through. Fixed
  by comparing parsed canonical identity when the existing value parses
  (see Decision 5's Correction) — this residual risk is closed, not merely
  documented.
- **Strict "must be exact next" enforcement (Decision 6's sequential rule,
  user-confirmed)** forecloses ever creating a skipped historical semester
  (e.g. backfilling a semester that should have existed between two
  already-created ones) through this form or `createSemester()`'s normal
  path. This is an accepted, deliberate trade-off, not an oversight: the
  user confirmed that preventing accidental duplicates/wrong school
  years/skips in the regular administrative workflow matters more than
  supporting rare historical corrections here. If that need ever arises,
  it is handled manually (a direct database insert) or via a future,
  separately-scoped OpenSpec change — not by this change.
- **Parsing legacy/malformed `semester` values (Decision 1)**: if a
  production `semesters` row has a `semester` value outside both supported
  formats, it's silently excluded from "latest" determination (with a
  logged warning) rather than blocking semester creation entirely — the
  same graceful-degradation philosophy used in the prior grade-scoping
  change, applied here to a different function.
- **Two known, pre-existing format inconsistencies are not resolved by
  this change** (seed data's `"2026-A"`/`"2025-2026"` vs. the form's own
  `"26A"`/`"2023 - 2024"`) — this change generates the latter going
  forward (matching the form's own established convention) and parses both
  for reading, but does not normalize existing rows. Worth a follow-up
  data-cleanup decision if the inconsistency ever causes a real problem
  beyond what lenient parsing already handles.
