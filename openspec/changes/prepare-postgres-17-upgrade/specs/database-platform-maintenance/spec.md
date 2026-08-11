# database-platform-maintenance Specification

## Requirement: PostgreSQL 17 preparation preserves application data

The system SHALL remove `pgjwt` only after proving that no application-owned object depends on the extension.

### Scenario: Unexpected dependency exists

- **WHEN** an external database object depends on `pgjwt`
- **THEN** the migration aborts before removing the extension.

### Scenario: Extension is unused

- **WHEN** `pgjwt` exists and has no external dependency
- **THEN** only the extension and its own functions are removed.

## Requirement: Maintenance is verified by fingerprints

The operation SHALL compare Auth, profile, worker, document, Storage, schedule, schema, policy, and migration counts before and after maintenance.

### Scenario: Project returns healthy

- **WHEN** Supabase reports `ACTIVE_HEALTHY`
- **THEN** every fingerprint count matches its pre-maintenance value except the intentional migration increment and absent `pgjwt`.

### Scenario: PostgreSQL version does not change

- **WHEN** pause/restore returns the project on the same PostgreSQL version
- **THEN** the process SHALL NOT be repeated automatically and the in-place upgrade remains an explicit Dashboard operation.
