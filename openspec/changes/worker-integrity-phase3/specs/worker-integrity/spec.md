# Worker integrity

## ADDED Requirements
### Requirement: Atomic creation
Creation SHALL save the worker and relations in one transaction, with staff/admin authorization and no client-supplied identity.
#### Scenario: Failed relation insert
- WHEN a relation insert fails
- THEN no newly created worker or relations persist.
### Requirement: Sequence repair
Identity repair SHALL preserve existing rows and never move an allocator backward.
#### Scenario: Existing imported IDs exceed allocator
- WHEN maintenance runs under exclusive write coordination
- THEN the next generated ID exceeds existing IDs.
### Requirement: Safe validation
The client SHALL reject incomplete or duplicate submitted relations before upload; transport uncertainty SHALL not trigger deletion of a potentially committed photo.
#### Scenario: Unknown mutation outcome
- WHEN the transport fails without a definitive rejection
- THEN preserve the uploaded file and instruct the operator to verify the record before retrying.
