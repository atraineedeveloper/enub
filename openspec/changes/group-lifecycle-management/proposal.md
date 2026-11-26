# Group lifecycle management — Phase 4A

## Why
The group catalog currently supports reading and creation only. The edit menu has no handler. Production baseline: 29 groups, 24 referenced by schedule assignments, 5 without assignments, no null identity fields (2026-11-26 read-only diagnosis). Existing uniqueness covers admission year, letter and degree.

## What changes
- Complete safe group editing, archiving, reactivation and administrator-only hard deletion.
- Protect historical schedules, PDF regeneration and group identifiers.
- Add database-enforced validation, concurrency control and immutable-to-client audit events.
- Preserve existing read/create behavior during rollout; no automatic archival or deletion of existing groups.
- Reuse React, TypeScript, TanStack Query, Supabase PostgreSQL and existing CI; no new paid infrastructure.

## Non-goals
No historical corrections that rewrite referenced identity fields, no cascade deletion, no schedule redesign, no global archival of graduated groups, no production migration in the specification PR until acceptance gates pass.
