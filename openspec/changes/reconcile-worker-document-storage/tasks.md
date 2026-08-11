# Tasks

- [x] Confirm current production object/reference counts without reading document contents or file names.
- [x] Review current Supabase Storage deletion guidance and Edge Function patterns.
- [x] Define a queue-bound, reference-checked reconciliation design.
- [x] Add the cleanup queue, restrictive grants and transactional delete trigger migration.
- [x] Add pgTAP regression coverage for queue/trigger access controls.
- [x] Add the authenticated `reconcile-worker-document-storage` Edge Function.
- [ ] Register JWT verification for the new Edge Function in `supabase/config.toml`.
- [x] Integrate best-effort reconciliation into delete and replacement cleanup without weakening current immediate cleanup.
- [x] Add focused frontend tests for cleanup/reconciliation outcomes.
- [ ] Run typecheck, lint, frontend tests and build.
- [ ] Run local Supabase lint/tests before production rollout.
- [ ] Obtain explicit approval before applying the migration or deploying the Edge Function to the remote Supabase project.
- [ ] After approved rollout, run security advisors and verify Storage/reference counts remain consistent.
- [ ] Synchronize/archive the OpenSpec change after validation.
