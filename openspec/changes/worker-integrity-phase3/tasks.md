# Tasks

- [x] Diagnose production 409 and compare identity sequences.
- [x] Inspect RLS and aggregate duplicate/incomplete counts (no PII retained).
- [x] Prepare standalone repair SQL and atomic RPC candidate, client validation and safe diagnostics.
- [ ] Generate actual migration filenames with Supabase CLI; apply candidates to fresh local DB, run pgTAP including permission/rollback tests and verify types.
- [ ] Confirm backup and explicit approval; deploy sequence repair separately and verify counters without consuming IDs.
- [ ] Verify atomic creation and edit in isolated test environment; approve RPC migration then compatible frontend deployment.
- [ ] Audit all identity sequences, Storage reconciliation, constraints and institutional duplicate rules; validate browser flows and close PR55 after replacement verified.

- [x] Frontend and existing database CI passed in 45655806592.
- [x] Added isolated candidate workflow: CLI-generated migrations, local database lint and pgTAP atomic creation/rollback/authorization assertions. Candidate results pending.
