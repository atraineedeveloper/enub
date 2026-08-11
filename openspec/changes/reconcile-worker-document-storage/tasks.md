# Tasks

- [x] Confirm current production object/reference counts without reading document contents or file names.
- [x] Review current Supabase Storage deletion guidance and Edge Function patterns.
- [x] Define a queue-bound, reference-checked reconciliation design.
- [x] Add the cleanup queue, restrictive grants and transactional delete trigger migration.
- [x] Add pgTAP regression coverage for queue/trigger access controls.
- [x] Add the authenticated `reconcile-worker-document-storage` Edge Function.
- [x] Register JWT verification for the new Edge Function in `supabase/config.toml`.
- [x] Integrate best-effort reconciliation into delete and replacement cleanup without weakening current immediate cleanup.
- [x] Add focused frontend tests for cleanup/reconciliation outcomes.
- [x] Run typecheck, lint, frontend tests and build in GitHub CI.
- [ ] Run the complete local Supabase lint/test suite when a local Supabase runtime is available; the connector-only environment used for rollout cannot run that local stack.
- [x] Obtain explicit approval before applying the migration or deploying the Edge Function to the remote Supabase project.
- [x] Apply production migration `20260811190024_queue_worker_document_storage_cleanup`.
- [x] Deploy `reconcile-worker-document-storage` with `verify_jwt=true`.
- [x] Execute the 9 catalog/security pgTAP assertions against production inside a rollback-only transaction.
- [x] Run post-rollout security/performance advisors and verify Storage/reference counts remain consistent at 54 objects, 54 metadata rows, 0 unreferenced objects and 0 missing objects.
- [ ] Perform one authenticated delete/replace smoke test during normal application use and confirm any queued cleanup resolves as expected.
- [ ] Synchronize/archive the OpenSpec change after the remaining smoke/local verification.
