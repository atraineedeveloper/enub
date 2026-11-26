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

## Lifecycle implementation checkpoint
- `lifecycle-candidate.sql` committed: private privileged helper, invoker RPC wrappers, creation normalization/audit, version checks, role checks, historical dependency protection, schedule lock guard and bounded admin audit read.
- Production grant inspection confirms authenticated table-level SELECT/INSERT only; service_role has broader grants. Candidate narrows authenticated insert to identity columns. Review service-role/direct maintenance paths and existing SQL fixture compatibility before release: creation audit currently requires an authenticated staff/admin actor, and privileged maintenance UPDATE/DELETE is not audited by the RPC implementation. Verify effective privileges, API schema exposure, isolation, backup coverage of private schema, and concurrent transactions. Do not claim all mutation paths covered until verified and hardened as needed.
- Tasks 4 and 5 remain unchecked pending CLI migration generation and isolated validation. No production execution.
