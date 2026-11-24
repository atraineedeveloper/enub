# Architecture quality

## ADDED Requirements
### Requirement: Reproducible source inventory
The project SHALL provide a read-only architecture baseline without additional dependencies.
#### Scenario: Audit source tree
- WHEN the architecture audit runs
- THEN it reports source sizes, type-safety review indicators, and internal import cycles, distinguishing tests and excluding generated assets from rankings.
### Requirement: Preserve behavior
Refactors SHALL preserve existing routes, query contracts and UI behavior unless a separate change explicitly approves modifications.
#### Scenario: Validate a refactor
- WHEN a refactor is proposed
- THEN existing checks and relevant regression tests SHALL be executed before integration.
