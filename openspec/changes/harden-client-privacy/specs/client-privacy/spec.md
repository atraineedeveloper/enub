## ADDED Requirements

### Requirement: Clear client query and mutation caches on logout
After successful explicit logout, the client SHALL cancel outstanding queries and clear query and mutation caches before navigating to login.

#### Scenario: Successful logout
- **WHEN** sign-out succeeds
- **THEN** cached query and mutation records are removed before login navigation

#### Scenario: Late query response
- **WHEN** a query remains pending during logout
- **THEN** its late response does not repopulate the cleared query cache
