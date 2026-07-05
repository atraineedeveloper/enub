# Proposal: Plan Schedules TypeScript Migration

## Status

Planning only — no code changes. This proposal defines the contract a future
implementation change must satisfy; it does not itself convert any file.

## Why

`src/features/schedules/` (23 files) is the largest remaining untyped feature
domain in the codebase. Every other consumer-facing domain has already been
converted (workers, workers/documents, admin catalog features, pages, core
UI) or has an explicit follow-up plan (PDF exporters). Schedules was
deliberately excluded from `convert-pdf-exporters-to-ts` and
`convert-pages-to-ts` because it's large, has real pre-existing bugs mixed in
with normal migration friction, and its consuming page
(`src/pages/ScheduleDashboard.tsx`) already depends on it in ways that need
careful sequencing (e.g. `SemesterContext`, out-of-scope in this plan, is
already typed and consumed by `CreateEditScholarSchedule.jsx`).

Before spending implementation effort, this repo's practice (every prior
`convert-*-to-ts` change) is to research the target surface fully first:
read every file, run lint, identify real bugs vs. migration-only friction,
and write down a phase plan — so an implementer (or reviewer) can see the
whole shape of the work before any file is touched. This change produces
that plan as an OpenSpec artifact set, mirroring the `openspec-ts-migration-
foundation` and `typescript-tooling-foundation` changes that similarly
planned ahead of execution.

## What Changes

- Adds a new OpenSpec capability, `schedule-typescript-safety`, that defines
  the behavior-preservation contract a schedules TypeScript migration must
  satisfy — not new user-facing functionality.
- No source file under `src/` is modified, renamed, or type-converted by this
  change. No lint is fixed. No dependency, `tsconfig.json`, `eslint.config.js`,
  or generated type is touched.
- Produces `design.md` (full file-by-file analysis, phase breakdown, risk
  analysis) and `tasks.md` (a numbered, unchecked task list) to govern the
  actual migration once approved.

## Capabilities

- `schedule-typescript-safety` — behavior-preservation contract for
  converting `src/features/schedules/**` to TypeScript: preserves schedule
  list/table rendering, assignment create/edit/delete behavior, teacher
  schedule behavior, group schedule behavior, React Query cache/Supabase
  query behavior, and the feature's existing route/page integration, while
  explicitly excluding PDF exporter files from this migration's scope.
  Most pre-existing bugs found during research are documented in `design.md`
  and preserved as-is — this is not a general bug-fixing pass. Exactly two
  fixes are explicitly authorized for the future implementation, both
  recorded as Closed Decisions in `design.md`: schedule mutation hooks'
  `isLoading` → TanStack Query v5 `isPending` (the disabled/loading UI state
  is broken today), and `HourScheduleTeacher`'s undefined `setEditModal`
  reference (a live `no-undef` bug that would otherwise become a hard
  compile error). No other behavior change is in scope.

### Modified Capabilities

_(none — no existing `openspec/specs/` capability changes as a result of this
plan)_

## Impact

- **Affected specs:** adds
  `openspec/changes/plan-schedules-typescript-migration/specs/schedule-typescript-safety/spec.md`.
- **Affected code:** none in this change. The eventual implementation change
  (not this one) will affect up to 23 files in `src/features/schedules/`,
  plus possibly `src/pages/ScheduleDashboard.tsx` (import-path touch-ups only)
  — see `design.md` for the exact file list and phase breakdown.
- **Affected lint baseline:** none in this change (current baseline: 205
  problems, confirmed via `bun run lint` during research — see `design.md`
  Section on known lint/type issues for the schedules-specific subset).
- **Next step:** this proposal stops after the artifacts are written.
  Implementation requires explicit human approval and a separate `tasks.md`
  execution pass (see `design.md`'s recommendation on branching).
