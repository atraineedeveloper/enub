# Groups lifecycle

## ADDED Requirements

### Requirement: Canonical identity
The system SHALL preserve group identifiers and enforce unique normalized admission year, letter and degree, including archived groups.
#### Scenario: Duplicate group
- WHEN a user submits an identity already present
- THEN the mutation is rejected without partial changes.

### Requirement: Historical protection
The system SHALL prevent deletion or identity mutation of groups referenced by schedules.
#### Scenario: Group has assignments
- WHEN an authorized administrator requests deletion or identity change
- THEN the database rejects it and preserves all schedules.

### Requirement: Reversible archive
Staff and administrators SHALL be able to archive and reactivate groups with a reason without losing historical references.
#### Scenario: Archived group in historical schedule
- WHEN a historical schedule or PDF is loaded
- THEN the group remains available with its identity.
#### Scenario: New assignment to archived group
- WHEN a schedule assignment is inserted or reassigned into an archived group
- THEN the database rejects it, including concurrent archive cases.

### Requirement: Authorized deletion
Only administrators SHALL be permitted to delete a group with no references, with confirmation and reason.
#### Scenario: Unreferenced group
- WHEN an admin submits a valid current version and reason
- THEN the group is deleted and the audit event survives.
#### Scenario: Unauthorized mutation
- WHEN a worker, unassigned user or anonymous user attempts a group mutation
- THEN it is denied.

### Requirement: Concurrency and audit
Every successful lifecycle mutation SHALL record an atomic audit event and protect against stale writes.
#### Scenario: Stale version
- WHEN a second editor submits an outdated version
- THEN no changes are committed and the UI requests refresh.
#### Scenario: Audit failure
- WHEN audit insertion fails
- THEN the associated mutation rolls back.
