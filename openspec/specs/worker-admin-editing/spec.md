# worker-admin-editing Specification

## Purpose
TBD - created by archiving change fix-worker-update-plazas-error. Update Purpose after archive.
## Requirements
### Requirement: Atomic administrative worker editing
The system SHALL update an existing worker and every requested plazas/admission-date section in one database transaction, authorized only for `admin` or `staff` application roles.

#### Scenario: Basic edit preserves relations
- **WHEN** an administrator changes only the worker phone or name
- **THEN** the worker is updated and existing `sustenance_plazas` and `date_of_admissions` rows remain unchanged

#### Scenario: Plaza edit replaces plazas
- **WHEN** an administrator submits a changed plazas section
- **THEN** the requested plazas replace the previous plazas within the same transaction

#### Scenario: Empty plazas are intentional
- **WHEN** an administrator explicitly submits an empty plazas section
- **THEN** all plazas for that worker are removed if database rules permit it

#### Scenario: Admission dates have matching semantics
- **WHEN** admission dates are unchanged, changed, or explicitly emptied
- **THEN** they are respectively preserved, replaced, or removed with the same transactional semantics as plazas

#### Scenario: Relational failure rolls back the worker
- **WHEN** a requested plaza or admission-date operation fails
- **THEN** the worker and both relation sets retain their pre-request state

#### Scenario: Unauthorized caller is rejected
- **WHEN** a caller without the `admin` or `staff` application role invokes the edit operation
- **THEN** the operation fails without changing any worker data

### Requirement: Accurate worker-edit feedback
The system SHALL report success only after the complete requested transaction succeeds and SHALL provide a useful safe error while retaining Supabase diagnostic fields in developer logging.

#### Scenario: Complete success
- **WHEN** all requested worker-edit operations commit
- **THEN** the UI shows the worker-update success toast

#### Scenario: Database failure
- **WHEN** Supabase rejects the transaction
- **THEN** the UI states that no changes were saved and developer logging includes available `code`, `message`, `details`, and `hint` without exposing those details in the toast

