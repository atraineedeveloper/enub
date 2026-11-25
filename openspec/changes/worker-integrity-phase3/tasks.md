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

- [x] Candidate CI 45656359969: generated both migration names via CLI, applied on isolated database; full pgTAP and lint passed. General CI 45656359694: 57 test files passed.
- [x] Promote exact validated candidate SQL to tracked migration paths; add pgTAP to standard suite; connect frontend to atomic RPC and type contract.
- [ ] Validate final integrated migrations/frontend, inspect all other identity allocators, verify backup and approve production separately. Preview must not be used to create workers against a DB without the RPC.

- [x] Audit 18 public owned ID sequences against max IDs: three confirmed behind; subjects sequence requires explicit last_value/is_called check. Remaining 14 not behind in snapshot.
- [x] Fix unused import reported by CI 45657004563; typecheck passed, lint initially failed. Re-run required.
