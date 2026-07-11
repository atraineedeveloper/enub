## 1. Helper — semester-code parsing, next-code, and school_year computation

- [ ] 1.1 Create a new helper module scoped to the semesters feature (e.g.
      `src/features/semesters/nextSemesterCode.ts`) — deliberately not
      importing from or modifying `src/helpers/calculateSemesterGroup.ts`
      (design.md Context/Decision 2).
- [ ] 1.2 Implement `parseSemesterCode(code: string | null | undefined): { year: number; letter: "A" | "B" } | null`
      using the lenient pattern `/^(\d{2}|\d{4})-?([AB])$/i` (accepting both
      `YYA`/`YYB` and `YYYY-A`/`YYYY-B`, case-insensitive, 2-digit years
      normalized to `2000 + year`), matching design.md Decision 1.
- [ ] 1.3 Implement `formatSemesterCode({ year, letter }): string` producing
      the 2-digit, unseparated `YYA`/`YYB` format (e.g. `26A`) — the
      going-forward generation convention (design.md Decision 2).
- [ ] 1.4 Implement `getSchoolYearForSemester({ year, letter }): string`
      per design.md Decision 3's formula
      (`A → "${year-1} - ${year}"`, `B → "${year} - ${year+1}"`).
- [ ] 1.5 Implement `getNextSemester({ year, letter }): { year, letter }`
      per design.md Decision 2's term-ordinal formula.
- [ ] 1.6 Implement `findLatestSemester(semesters: Semester[]): { year, letter } | null`
      — parses every `semester` value (via 1.2), skips and
      `console.warn`s any that fail to parse, returns the one with the
      highest term-ordinal, or `null` if none parse (design.md Decision 1).

## 2. Service layer — duplicate and skip-ahead validation

- [ ] 2.1 `src/services/apiSemesters.ts`: in `createSemester()`, before
      inserting, fetch current semesters and reject (throw a clear Spanish
      error, no insert attempted) if the normalized
      (`.trim().toUpperCase()`) candidate `semester` value exactly matches
      an existing one (design.md Decision 5).
- [ ] 2.2 `src/services/apiSemesters.ts`: in `createSemester()`, when at
      least one existing `semester` value parses successfully (via the new
      helper's `findLatestSemester`), reject any candidate `semester` code
      that is not exactly that latest semester's computed next code — this
      is a strict, user-confirmed rule (design.md Decision 6): no skipping
      ahead, and no backfilling a historical semester, through this path.
      When zero semesters parse (empty-database or all-unparseable case),
      accept any well-formatted candidate code as the initial semester
      (the sequential-order check does not apply — there is no latest
      semester to compute a successor from).
- [ ] 2.3 Do not add a database migration, unique constraint, or any schema
      change in this task group — confirmed as a non-blocking follow-up,
      not part of this change (design.md Decision 6).

## 3. UI — CreateSemesterForm.tsx

- [ ] 3.1 `src/features/semesters/CreateSemesterForm.tsx`: call
      `useSemesters()` to read existing semesters (React Query dedupes
      against `SemesterTable.tsx`'s own call — no extra network cost).
- [ ] 3.2 Normal path (at least one semester parses successfully): compute
      the next semester code and its `school_year` (via the task 1 helper)
      and display both read-only, with a confirm/cancel action — remove
      the independent `semester`/`school_year` `<Select>` dropdowns
      entirely from this path (design.md Decision 4).
- [ ] 3.3 Initial path (zero semesters, or none parse): render a minimal
      `<Select>` of candidate starting `semester` codes only (current year
      + next two, both `A`/`B` terms); once a code is chosen, compute and
      display its `school_year` read-only — never render a second,
      independently-selectable `school_year` field in either path
      (design.md Decision 4).
- [ ] 3.4 `onSubmit` calls `mutate({ semester, school_year })` with the
      computed values (not raw form-field values) in both paths.
- [ ] 3.5 Preserve the existing `onSuccess`/`onError` toast and
      cache-invalidation behavior (`queryClient.invalidateQueries({ queryKey: ["semesters"] })`)
      unchanged.

## 4. Explicitly unchanged (verify, do not modify)

- [ ] 4.1 Confirm `src/features/semesters/SemesterTable.tsx` and
      `SemesterRow.tsx` are untouched — display behavior for existing and
      newly-created semesters is unaffected by this change.
- [ ] 4.2 Confirm `src/features/semesters/useSemesters.ts` is untouched —
      no signature or query-key change.
- [ ] 4.3 Confirm no file under `src/features/schedules/**`, `src/pdf/**`,
      `src/features/groups/**`, or `src/features/workers/**` changed.
- [ ] 4.4 Confirm `src/helpers/calculateSemesterGroup.ts` is untouched (no
      import from or edit to this file).
- [ ] 4.5 Confirm no migration file added or modified, and no schema
      change of any kind.

## 5. Verification

- [ ] 5.1 `bun run typecheck`
- [ ] 5.2 `bun run build`
- [ ] 5.3 `bun run lint`
- [ ] 5.4 `bunx @fission-ai/openspec validate generate-next-semester --type change --strict`
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
      - `/semesters/:id` (`ScheduleDashboard.tsx`) still loads and behaves
        normally for an existing semester — spot check, not a full regression
        pass, since no schedules-module file was touched.
- [ ] 5.6 Record pass/fail for each 5.5 item, plus the 5.1–5.4 command
      output, in this file's Verification Results section before
      considering this change complete.

## Verification Results

(To be filled in during implementation; do not pre-fill.)
