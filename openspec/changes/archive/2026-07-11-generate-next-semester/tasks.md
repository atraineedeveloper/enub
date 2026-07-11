## 1. Helper — semester-code parsing, next-code, and school_year computation

- [x] 1.1 Create a new helper module scoped to the semesters feature (e.g.
      `src/features/semesters/nextSemesterCode.ts`) — deliberately not
      importing from or modifying `src/helpers/calculateSemesterGroup.ts`
      (design.md Context/Decision 2).
- [x] 1.2 Implement `parseSemesterCode(code: string | null | undefined): { year: number; letter: "A" | "B" } | null`
      using the lenient pattern `/^(\d{2}|\d{4})-?([AB])$/i` (accepting both
      `YYA`/`YYB` and `YYYY-A`/`YYYY-B`, case-insensitive, 2-digit years
      normalized to `2000 + year`), matching design.md Decision 1.
- [x] 1.3 Implement `formatSemesterCode({ year, letter }): string` producing
      the 2-digit, unseparated `YYA`/`YYB` format (e.g. `26A`) — the
      going-forward generation convention (design.md Decision 2).
- [x] 1.4 Implement `getSchoolYearForSemester({ year, letter }): string`
      per design.md Decision 3's formula
      (`A → "${year-1} - ${year}"`, `B → "${year} - ${year+1}"`).
- [x] 1.5 Implement `getNextSemester({ year, letter }): { year, letter }`
      per design.md Decision 2's term-ordinal formula.
- [x] 1.6 Implement `findLatestSemester(semesters: Semester[]): { year, letter } | null`
      — parses every `semester` value (via 1.2), skips and
      `console.warn`s any that fail to parse, returns the one with the
      highest term-ordinal, or `null` if none parse (design.md Decision 1).

## 2. Service layer — duplicate and skip-ahead validation

- [x] 2.1 `src/services/apiSemesters.ts`: in `createSemester()`, before
      inserting, fetch current semesters and reject (throw a clear Spanish
      error, no insert attempted) if the candidate `semester` value is a
      duplicate of an existing one (design.md Decision 5). **Revised (see
      design.md Decision 5's Correction, found during code review):**
      compare by parsed canonical identity when the existing value parses
      (so `26A`/`2026-A` are recognized as the same semester), falling back
      to a raw normalized-string comparison only for an existing row that
      doesn't parse at all.
- [x] 2.2 `src/services/apiSemesters.ts`: in `createSemester()`, when at
      least one existing `semester` value parses successfully (via the new
      helper's `findLatestSemester`), reject any candidate `semester` code
      that is not exactly that latest semester's computed next code — this
      is a strict, user-confirmed rule (design.md Decision 6): no skipping
      ahead, and no backfilling a historical semester, through this path.
      When zero semesters parse (empty-database or all-unparseable case),
      accept any well-formatted candidate code as the initial semester
      (the sequential-order check does not apply — there is no latest
      semester to compute a successor from). **Revised (see design.md
      Decision 5's Correction, found during code review):** the candidate
      is now parsed and format-validated *before* this check (and before
      the duplicate check), unconditionally — including the bootstrap path,
      which previously skipped validation entirely since it has no
      `latest` to branch into. `school_year` is also now computed from the
      parsed candidate and always inserted as the authoritative value,
      never trusted from the caller; the canonical `semester` code is
      inserted too, not the caller's raw string.
- [x] 2.3 Do not add a database migration, unique constraint, or any schema
      change in this task group — confirmed as a non-blocking follow-up,
      not part of this change (design.md Decision 6).

## 3. UI — CreateSemesterForm.tsx

- [x] 3.1 `src/features/semesters/CreateSemesterForm.tsx`: call
      `useSemesters()` to read existing semesters (React Query dedupes
      against `SemesterTable.tsx`'s own call — no extra network cost).
- [x] 3.2 Normal path (at least one semester parses successfully): compute
      the next semester code and its `school_year` (via the task 1 helper)
      and display both read-only, with a confirm/cancel action — remove
      the independent `semester`/`school_year` `<Select>` dropdowns
      entirely from this path (design.md Decision 4).
- [x] 3.3 Initial path (zero semesters, or none parse): render a minimal
      `<Select>` of candidate starting `semester` codes only (current year
      + next two, both `A`/`B` terms); once a code is chosen, compute and
      display its `school_year` read-only — never render a second,
      independently-selectable `school_year` field in either path
      (design.md Decision 4).
- [x] 3.4 `onSubmit` calls `mutate({ semester, school_year })` with the
      computed values (not raw form-field values) in both paths.
- [x] 3.5 Preserve the existing `onSuccess`/`onError` toast and
      cache-invalidation behavior (`queryClient.invalidateQueries({ queryKey: ["semesters"] })`)
      unchanged.

## 4. Explicitly unchanged (verify, do not modify)

- [x] 4.1 Confirm `src/features/semesters/SemesterTable.tsx` and
      `SemesterRow.tsx` are untouched — display behavior for existing and
      newly-created semesters is unaffected by this change.
- [x] 4.2 Confirm `src/features/semesters/useSemesters.ts` is untouched —
      no signature or query-key change.
- [x] 4.3 Confirm no file under `src/features/schedules/**`, `src/pdf/**`,
      `src/features/groups/**`, or `src/features/workers/**` changed.
- [x] 4.4 Confirm `src/helpers/calculateSemesterGroup.ts` is untouched (no
      import from or edit to this file).
- [x] 4.5 Confirm no migration file added or modified, and no schema
      change of any kind.

## 5. Verification

- [x] 5.1 `bun run typecheck`
- [x] 5.2 `bun run build`
- [x] 5.3 `bun run lint`
- [x] 5.4 `bunx @fission-ai/openspec validate generate-next-semester --type change --strict`
- [ ] 5.5 Manual smoke test on `/semesters` (per design.md Decision 7):
      - Empty-database bootstrap renders the initial code-only picker;
        `school_year` displays correctly once a code is chosen; submission
        succeeds and the new semester appears in `SemesterTable.tsx`.
      - Starting from each of `24A`, `24B`, `25A`, `25B`, `26A` as the sole
        existing semester (test data, not production), confirm the form
        computes exactly `24B`, `25A`, `25B`, `26A`, `26B` respectively,
        each with the `school_year` from design.md Decision 3's table.
      - Duplicate creation is rejected with a clear error and no new row.
      - A non-next `semester` code (submitted via a manipulated payload,
        since the UI no longer offers a way to do this normally) is
        rejected by `createSemester()`.
      - A malformed `semester` code (e.g. `"garbage"`) submitted via a
        manipulated payload is rejected by `createSemester()` when there is
        **no** existing latest semester (the bootstrap case).
      - A malformed `semester` code submitted via a manipulated payload is
        also rejected by `createSemester()` when a latest semester **does**
        exist — not only in the bootstrap case.
      - A manipulated payload that pairs a valid, correctly-sequenced
        `semester` code with a mismatched `school_year` results in the
        authoritative derived `school_year` being persisted (per
        Decision 3's formula), not the submitted one — confirm the row
        actually written to `semesters` has the correct value, not the
        tampered one.
      - Submitting `26A` via a manipulated payload is rejected as a
        duplicate when `2026-A` already exists, and submitting `2026-A` is
        rejected as a duplicate when `26A` already exists — both
        directions of the cross-format semantic-duplicate check.
      - `/semesters/:id` (`ScheduleDashboard.tsx`) still loads and behaves
        normally for an existing semester — spot check, not a full regression
        pass, since no schedules-module file was touched.
- [ ] 5.6 Record pass/fail for each 5.5 item, plus the 5.1–5.4 command
      output, in this file's Verification Results section before
      considering this change complete.

## Verification Results

- Tasks 1.1–1.6: new `src/features/semesters/nextSemesterCode.ts` created
  with `parseSemesterCode`, `formatSemesterCode`, `getSchoolYearForSemester`,
  `getNextSemester`, and `findLatestSemester`, exactly as specified — no
  import from or edit to `src/helpers/calculateSemesterGroup.ts` (confirmed
  via `git diff`, that file does not appear in this change's diff at all).
  Verified against the real, compiled module (not just a standalone
  formula check) via an ad hoc `bun`-run script importing the actual file
  (not committed — no test framework exists in this project per
  `AGENTS.md`): all 6 `school_year` examples, all 6 next-semester chain
  steps, cross-format (`2026-A` vs `26A`) equivalence, `findLatestSemester`
  correctly picking the higher-ordinal semester from a mixed-format list
  and skipping+warning on unparseable entries, and both empty/all-garbage
  inputs returning `null` — 18 checks total, all pass.
- Tasks 2.1–2.3: `src/services/apiSemesters.ts`'s `createSemester()` now
  fetches existing semesters and rejects a duplicate
  (`"Ya existe un semestre con ese código."`) before any insert — compared
  by parsed canonical identity for existing rows that parse successfully
  (so `26A` and `2026-A` are recognized as the same semester), falling back
  to a raw normalized-string comparison only for existing rows that don't
  parse. Whenever `findLatestSemester` finds a parseable latest, the
  service also rejects any candidate whose formatted code isn't exactly
  that latest's computed next code (clear Spanish error naming the
  required next code). No migration, constraint, or schema file added or
  touched.
- Tasks 3.1–3.5: `CreateSemesterForm.tsx` now calls `useSemesters()` and
  branches on `findLatestSemester(semesters ?? [])`. Normal path: the next
  semester code and `school_year` are computed and displayed read-only (no
  `<Select>` for either), confirm/cancel only. Initial path (no parseable
  semester exists): a `semester`-only `<Select>` (current year + next two,
  both `A`/`B` — 6 options, mirroring the original form's own candidate
  generation) with a read-only, live-computed `school_year` display below
  it. Both paths call `mutate({ semester, school_year })` with values
  computed in `onSubmit`, not raw form data. The mutation's `onSuccess`/
  `onError` toast and `queryClient.invalidateQueries({ queryKey: ["semesters"] })`
  call are unchanged from the original file.
- Tasks 4.1–4.5: confirmed via `git status`/`git diff --stat` — exactly 3
  files changed (`CreateSemesterForm.tsx` modified,
  `src/services/apiSemesters.ts` modified,
  `src/features/semesters/nextSemesterCode.ts` new). Zero changes to
  `SemesterTable.tsx`, `SemesterRow.tsx`, `useSemesters.ts`, any file under
  `src/features/schedules/**`, `src/pdf/**`, `src/features/groups/**`,
  `src/features/workers/**`, `src/helpers/calculateSemesterGroup.ts`, or
  any migration file.
- `bun run typecheck` → clean, zero errors.
- `bun run build` → succeeds.
- `bunx @fission-ai/openspec validate generate-next-semester --type change --strict`
  → valid.
- `bun run lint` → 43 problems (39 errors, 4 warnings) — unchanged from the
  established baseline; zero lint issues in any of the 3 files this change
  touched (confirmed by grepping the lint output for each file's path).
- Task 5.5 (manual smoke test) and 5.6 (recording its results): **not
  performed** — no browser/dev-server session was available in this
  implementation pass. In particular: the bootstrap path, the
  duplicate-rejection and skip-rejection error UX as actually seen by an
  admin, and the `/semesters/:id` regression spot-check have not been
  visually confirmed. The underlying formulas and validation logic were
  verified programmatically (above), which covers correctness of the
  computation but not the actual UI/UX flow.

**Correction (found during code review, this pass):** two required
service-boundary gaps and one additional risk, all in
`src/services/apiSemesters.ts`'s `createSemester()`:
1. **Malformed bootstrap semester codes were not rejected.** The candidate
   was only parsed inside the `if (latest)` branch, so a direct service
   call with an invalid code (e.g. `"garbage"`) skipped validation
   entirely when no existing semester parsed (the bootstrap case) and
   would have reached the insert. Fixed: the candidate is now parsed and
   validated first, unconditionally, before either the duplicate or
   sequential-order check — rejected in every path, bootstrap included.
2. **`school_year` was trusted from the caller.** `createSemester()`
   inserted whatever `school_year` string was submitted, so a direct/stale/
   manipulated call could pair a correct, correctly-sequenced `semester`
   code with a wrong `school_year`. Fixed: `school_year` (and, as a
   consistent extension, `semester` itself) is now always computed from
   the parsed candidate and inserted as the authoritative value — the
   caller's raw `school_year` string is never persisted.
3. **Semantic duplicate risk across formats (`26A` vs `2026-A`).** The
   original duplicate check compared raw normalized strings only, so the
   same calendar term written in two different supported formats would not
   have been recognized as a duplicate. Fixed: existing rows are now
   compared by parsed canonical identity when they parse, falling back to
   raw-string comparison only for unparseable legacy rows.

All three are documented in `design.md` Decision 5's Corrections and
reflected in `specs/semester-generation/spec.md` (new "candidate format
validated before any other check" requirement, updated `school_year`
requirement, and updated/added duplicate-detection scenarios).

Re-verified against the real, compiled module via an ad hoc `bun`-run
script simulating `createSemester()`'s exact logic (not committed — no
test framework exists in this project): bootstrap-path malformed code
rejected; valid bootstrap code accepted with authoritative `school_year`
regardless of a wrong submitted value; normal-path `school_year` overridden
to the authoritative value even when the submitted one is wrong; `26A`
correctly rejected as a duplicate of an existing `2026-A`; skip-ahead still
rejected; malformed candidate rejected even when a latest exists — 6/6
scenarios pass.

Re-ran after this fix:
- `bun run typecheck` → clean, zero errors.
- `bun run build` → succeeds.
- `bun run lint` → 43 problems (39 errors, 4 warnings), unchanged baseline;
  zero issues in `apiSemesters.ts`.
- `bunx @fission-ai/openspec validate generate-next-semester --type change --strict`
  → valid.

**Worktree hygiene:** re-confirmed via `git status` — the worktree is now
clean of the other change's files; only this change's intended files
(`design.md`, `specs/semester-generation/spec.md`, `tasks.md`,
`CreateSemesterForm.tsx`, `apiSemesters.ts`, `nextSemesterCode.ts`) are
present as changes. No separation action remains outstanding.
