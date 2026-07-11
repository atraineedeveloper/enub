## Why

`CreateSemesterForm.tsx` currently generates two **independent** dropdowns:
a `semester` code list (`options`, e.g. `26A`, `26B`, `27A`...) and a
`school_year` list (`optionsYear`, e.g. `2023 - 2024`, `2024 - 2025`...).
The admin picks one value from each, with no cross-validation between them.
`apiSemesters.ts`'s `createSemester()` only checks that both fields are
non-empty strings — it does not check that `school_year` actually matches
`semester`, does not check for a duplicate `semester` code, and does not
check that the new semester is the true chronological successor of the
latest existing one. There is also no database-level constraint: the
`semesters` table (`supabase/migrations/20260702000000_remote_schema.sql`)
has only a primary key on `id` — no unique index, no check constraint on
`semester`/`school_year`, no format enforcement at all.

This makes three real mistakes possible today, with no error shown: picking
a `school_year` that doesn't correspond to the chosen `semester` (e.g.
`26A` with `2020 - 2021`), creating the same `semester` code twice, and
skipping ahead (e.g. jumping from `25B` straight to `27A`, leaving `26A`
and `26B` never created). Since every schedule, group, and worker-document
semester assignment downstream depends on `semesters.id` being a correct,
unique, chronologically-sound record, bad data created here is hard to
detect and awkward to fix after the fact.

## What Changes

- Add a new semester-code helper (parse a `YYA`/`YYB` code, compute its
  `school_year` per the stated academic-term rules, and compute the next
  chronological code) — scoped to the semesters feature only, independent
  of the schedules module's own, differently-purposed grade helper.
- Rework `CreateSemesterForm.tsx`: when at least one semester already
  exists, the form computes and displays the next chronological semester
  automatically (code and `school_year` both) — the admin confirms or
  cancels, with no manual dropdown for either field. When no semester
  exists yet (first-ever use), the form falls back to a minimal
  semester-code-only picker; `school_year` is still always auto-derived
  from whichever code is chosen, never independently selectable in either
  path.
- Add server-side validation in `apiSemesters.ts`'s `createSemester()`:
  reject a `semester` code that already exists, and — when a latest
  semester already exists — reject any `semester` code that is not its
  exact chronological successor (closes the "skip ahead" gap at the layer
  that can't be bypassed by a stale UI or a direct API call, not just in
  the form).
- No database migration in this change (see `design.md` Decision 6 for the
  explicit reasoning) — a unique constraint on `semester` is documented as
  a recommended, non-blocking follow-up.

## Capabilities

**New Capabilities:**
- `semester-generation`: covers automatic next-semester computation,
  automatic `school_year` derivation, the initial-semester bootstrap path,
  and duplicate/skip-ahead prevention for semester creation.

**Modified Capabilities:**
(none — no existing OpenSpec capability governs semester creation today)

## Impact

- Affected code: `src/features/semesters/CreateSemesterForm.tsx`,
  `src/services/apiSemesters.ts`, plus one new helper module scoped to
  `src/features/semesters/`.
- Not changed: `src/features/semesters/SemesterTable.tsx`,
  `SemesterRow.tsx`, `useSemesters.ts` (no signature/behavior change),
  anything under `src/features/schedules/**`, `src/pdf/**`,
  `src/features/groups/**`, `src/features/workers/**`, `schedule_assignments`/
  `schedule_teachers` data, `src/helpers/calculateSemesterGroup.ts` (the
  schedules module's own, differently-scoped grade helper — deliberately
  not reused or touched here, see `design.md`), database schema, or
  migrations.
- No new dependencies.
- Risk is concentrated in: (1) the exact `school_year` formula and its
  interaction with two already-confirmed, real format inconsistencies in
  existing `semester`/`school_year` data (seed data uses `"2026-A"` /
  `"2025-2026"`; the form today generates `"26A"` / `"2023 - 2024"`) — see
  `design.md` Decisions 1–3; (2) the strictness of the new "must be the
  exact next code" rule, which intentionally forecloses ever backfilling a
  skipped historical semester through this form again — flagged explicitly
  in `design.md`'s Risks, not silently assumed; (3) the residual
  duplicate/race risk from relying on an application-level check instead of
  a database constraint (Decision 6).
