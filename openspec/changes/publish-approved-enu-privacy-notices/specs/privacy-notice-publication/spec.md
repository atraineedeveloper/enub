# privacy-notice-publication Specification

## Requirement: Only institutionally approved notice text is published

The application SHALL NOT expose a draft privacy notice as the institution's operative notice while any required legal field remains unvalidated.

### Scenario: Approval package contains placeholders

- **WHEN** the integral or simplified notice still contains an institutional-validation marker
- **THEN** the application does not publish that draft through a production route or collection surface.

### Scenario: Notice is approved

- **WHEN** all required fields have been institutionally validated and an approved version/date is recorded
- **THEN** the application may publish that exact approved content.

## Requirement: Integral notice is publicly accessible

The application SHALL provide the approved integral privacy notice through a stable route that does not require authentication.

### Scenario: Unauthenticated person requests the notice

- **WHEN** a person navigates to the privacy-notice route without a session
- **THEN** the complete approved integral notice is available without redirecting to login.

## Requirement: Simplified notice precedes direct collection

The application SHALL present the approved simplified notice before a data subject directly submits personal data through an ENU collection surface.

### Scenario: Worker document upload

- **WHEN** a worker is about to upload a document containing personal data
- **THEN** the simplified notice is presented before submission and provides access to the integral notice.

### Scenario: Direct worker-data collection

- **WHEN** ENU directly obtains worker information through an application form
- **THEN** the simplified notice is presented before the information is submitted.

## Requirement: Authentication surfaces expose privacy information

Public login, recovery, and password-establishment surfaces SHALL provide a stable link to the approved integral notice. If institutional review classifies a flow as direct personal-data collection, that flow SHALL also present the simplified notice before submission.

## Requirement: Notice scope matches actual treatments

The approved notice and supporting inventory SHALL cover the worker, account-linkage, schedule, document, and access-correction treatments actually performed by ENU.

### Scenario: Uploaded academic record contains third-party data

- **WHEN** an allowed academic or tutoring upload contains student or third-party personal data
- **THEN** the applicable purpose, legal basis, access model, retention rule, and notice coverage have been institutionally classified rather than implicitly treating the file as worker-only data.

## Requirement: Publication does not imply blanket compliance

The application and documentation SHALL NOT state or imply that publication of the privacy notices alone proves full compliance with applicable personal-data law.
