# Design: PostgreSQL 17 upgrade preparation

## Safety checks

Before removal, the migration requires `pgjwt` to exist and queries PostgreSQL dependency catalogs. It aborts if any object outside the extension depends on an extension-owned object.

## Scope

The migration executes `DROP EXTENSION pgjwt` without `CASCADE`. PostgreSQL therefore refuses removal if an unexpected dependency exists. No table or application record is modified.

## Operational validation

Pre- and post-maintenance fingerprints compare:

- Auth users and profiles
- workers and worker documents
- Storage buckets and objects
- schedule rows
- public table and RLS policy counts
- migration history
- server version and extension presence

The completed pause/restore returned every checked count unchanged. It restored PostgreSQL 15.8, so the security-patch upgrade remains pending through the Dashboard's dedicated in-place-upgrade control.
