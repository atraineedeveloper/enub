# Phase 4A tracking

- [x] Diagnose group API, menu, production RLS, FK and aggregate data.
- [x] Specify rules, role matrix, historical protection and acceptance scenarios.
- [x] Review full schedule write/read paths and identity conventions; design schema and preflight checks.
- [ ] Implement CLI-generated additive migration and audit schema.
- [ ] Implement authorization, concurrency controls, lifecycle and schedule guard.
- [ ] Implement TypeScript types, validation, services and error mapping.
- [ ] Implement UI edit/archive/reactivate/delete and contextual filters.
- [ ] Add pgTAP, role matrix, two-session race tests, frontend and PDF regressions; pass CI.
- [ ] Rehearse restore isolated; verify backup and deployment gates.
- [ ] Apply approved migration, verify data, merge and deploy.
- [ ] Validate production and close specification.

Progress counts completed checklist items, not elapsed time or estimated effort. No production writes performed.

Detailed implementation contract: database-and-schedules.md. Institutional limits and concurrency behavior remain verification gates, not proven implementation.

## Implementation checkpoint
- Schema candidate committed: `schema-candidate.sql` (additive columns, preflight, constraints, private audit table and supporting indexes).
- Production index inspection confirmed no index beginning with schedule_assignments.group_id.
- Local session has no Supabase CLI, Docker or psql; candidate is not yet a CLI-generated migration or executed SQL. Keep task 4 unchecked until migration generated and tested in isolated CI. Do not deploy candidate separately from lifecycle guards.
