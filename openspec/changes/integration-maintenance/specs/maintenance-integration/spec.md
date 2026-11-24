# Maintenance integration

## ADDED Requirements
### Requirement: Preserve approved worker form
The integrated candidate SHALL retain the responsive worker form while using the shared typed mutation contract.
#### Scenario: Navigate sections
- WHEN a worker form section changes
- THEN entered values and selected files remain registered.
### Requirement: Validate combined changes
The integrated candidate SHALL pass standard CI and architecture/performance audits before production promotion.
#### Scenario: Integration pull request
- WHEN a candidate targets main
- THEN CI runs local database tests, dependency audit, application checks and build inventories without modifying the remote database.
