# Change: Prepare PostgreSQL 17 upgrade

## Why

The hosted ENUB database is on PostgreSQL 15.8. Supabase reports outstanding security patches and PostgreSQL 17 does not support the legacy `pgjwt` extension.

## What changes

- Verify that `pgjwt` has no application-owned external dependencies.
- Remove only the unused `pgjwt` extension.
- Preserve every application table, record, Storage object, Auth user, RLS policy, and database function outside that extension.
- Add a regression check proving the extension is absent.

## Operational result

The prerequisite is complete in production. A Free-plan pause and restore preserved the project but did not change its PostgreSQL version; the remaining in-place upgrade must be initiated from Supabase Dashboard infrastructure settings.
