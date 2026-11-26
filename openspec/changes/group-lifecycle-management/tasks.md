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

## TypeScript checkpoint
- Added groupValidation.ts, groupErrors.ts, groupValidation.test.ts; updated apiGroups.ts and provisional generated-contract types in src/types/supabase.ts.
- Explicit identity allowlist, normalized letter, safe positive integer checks, version and reason validation, safe Spanish errors and RPC bindings.
- Types remain provisional until isolated migration and regeneration; existing typed group fixtures may need updates. Verify scalar composite RPC return shape, PostgREST behavior and full TypeScript CI; no test run claimed yet. Keep task 6 unchecked until validated.
- No production changes. Next: inspect CI, repair compile issues if present, then implement role-aware UI and historical schedule filtering.

## UI and schedule checkpoint
- Added GroupActionForm and GroupAudit, role-gated row actions and audit entry point, administrative/academic filters, protected form version snapshot, audit cache invalidation and user-scoped audit pagination.
- Schedule selectors reject archived targets for new assignments, historical referenced groups remain visible, empty-slot creation hidden for archived groups; SQL error GRP03 mapped to Spanish.
- CI for commit 1561ba7 was pending on inspection (run 45886598633). No successful integrated CI, browser accessibility checks, or PDF regression tests confirmed. Keep UI task unchecked until validated. No migration or production writes.

## QA checkpoint
- CI run 45886977157 at c29e703: typecheck, lint, frontend test, build, architecture inventory and performance audit succeeded. Dependency audit job completed (report-only, not proof of no vulnerabilities). Existing DB job was still running at initial inspection.
- Added 16 candidate pgTAP assertions and branch-only CI step applying both SQL candidates in a single transaction to localhost PostgreSQL, linting and running candidate tests. No candidate results yet. Need additional referenced-group, worker, direct bypass, audit rollback and two-session concurrency tests; reconcile existing seed (privileged insert without auth actor), legacy grants tests and generated types before promoting migration.
- Candidate CI does not replace definitive migration and full regression. Tasks remain unchecked pending integrated verification. No production writes.

## Concurrency QA checkpoint
- Run 45887185604 passed all jobs; job 140140701307 explicitly reported 16/16 candidate pgTAP tests passed and SQL lint without blocking errors (three pre-existing warnings).
- Expanded candidate suite to 28 assertions at 102a15e1; run 45887460463 frontend succeeded, database candidate step not yet complete at inspection.
- Added concurrency-candidate.sh and wired it into disposable local CI: two actual psql sessions, observed blocking via pg_blocking_pids, release first transaction, assert expected GRP03/GRP02/GRP01 and final row states. Results pending; not yet verified. No production writes.
- Remaining release gates: reconcile seed and legacy permission tests, generate migration via CLI, rerun full suite, verify generated types, backup coverage and isolated restore, manual UI/PDF regression. Formal checklist remains 3/11.
