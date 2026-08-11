# Tasks

- [x] Review current Supabase upgrade guidance and breaking changes.
- [x] Measure database size and inspect replication slots, login-role password methods, and incompatible extensions.
- [x] Confirm `pgjwt` has no external database dependencies or ENUB function references.
- [x] Dry-run extension removal in a rolled-back transaction.
- [x] Apply migration `20260811140724_remove_pgjwt_before_postgres_17_upgrade`.
- [x] Capture and compare pre/post-maintenance data fingerprints.
- [x] Pause and restore the Free-plan project.
- [x] Verify ENUB returned `ACTIVE_HEALTHY` with all checked counts unchanged.
- [ ] Initiate the PostgreSQL in-place upgrade from Supabase Dashboard.
- [ ] Verify PostgreSQL version, application workflows, and security advisors after the in-place upgrade.
- [ ] Synchronize accepted requirements and archive this change after final upgrade verification.
