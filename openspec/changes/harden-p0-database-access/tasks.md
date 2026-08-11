# Tasks

- [x] Inspect production policies, table privileges, function ACLs, and security advisors.
- [x] Confirm staff/admin and worker access requirements against application routes and services.
- [x] Add the fail-closed RLS and privilege migration.
- [x] Add catalog regression coverage.
- [x] Dry-run the migration in a rolled-back production transaction.
- [x] Apply migration `20260811133321_harden_p0_database_access` to ENUB.
- [x] Verify resulting policies, privileges, function ACLs, migration history, and security advisors.
- [x] Apply and verify production catalog hardening migration `20260811151857_harden_authenticated_catalog_access`.
- [x] Restore the production catalog migration to repository history without re-running it remotely.
- [x] Add pgTAP regression coverage for catalog RLS, table grants, and sequence grants.
- [ ] Run the complete local Supabase pgTAP suite in CI.
- [ ] Synchronize the accepted requirements and archive this change after CI/review.
