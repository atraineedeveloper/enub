## ADDED Requirements

### Requirement: Worker-initiated password recovery entry point
The system SHALL provide a "¿Olvidaste tu contraseña?" action on the login form that navigates to a dedicated public password-recovery request page, without requiring any admin action. This action SHALL NOT change any existing login behavior.

#### Scenario: Worker navigates from login to the recovery request page
- **WHEN** an unauthenticated visitor on `/login` selects "¿Olvidaste tu contraseña?"
- **THEN** the system navigates to a dedicated public route (e.g. `/forgot-password`) without altering the login form's existing fields, validation, or submit behavior

#### Scenario: Worker requests recovery from the dedicated page
- **WHEN** a visitor on the password-recovery request page submits an email address
- **THEN** the system triggers a Supabase Auth password recovery email using the official client API (`resetPasswordForEmail`), the existing `recovery` template, and `${window.location.origin}/set-password` as `redirectTo`, with no new Edge Function, public registration, or service-role credential used anywhere in the request

#### Scenario: Redirect target follows the app environment
- **WHEN** recovery is requested from a locally served or deployed app
- **THEN** `redirectTo` uses that app's current origin plus `/set-password`, the exact URL is present in that environment's Supabase Auth redirect allow-list, and the server-only `WORKER_INVITE_REDIRECT_URL` is not exposed to browser code

#### Scenario: Worker returns to login from the recovery page
- **WHEN** a visitor on the password-recovery request page wants to abandon the request
- **THEN** the page provides a navigation action back to `/login`

### Requirement: Recovery request page handles submission state safely
The system SHALL prevent duplicate recovery requests from a single submission and SHALL NOT expose internal error details to the visitor.

#### Scenario: Submit action disabled while a request is in flight
- **WHEN** a visitor submits the recovery request form
- **THEN** the submit action is disabled (or otherwise guarded) until the request completes, preventing accidental duplicate submissions from a repeated click

#### Scenario: Unexpected error does not leak internal details
- **WHEN** the recovery request fails for a reason unrelated to whether the email exists (e.g. a network error)
- **THEN** the page shows a generic, client-safe error state and does not expose internal error messages, stack traces, or Supabase/service internals

### Requirement: Recovery response does not reveal account existence
The system SHALL respond identically to a password recovery request regardless of whether the submitted email corresponds to an existing account.

#### Scenario: Unknown email submitted
- **WHEN** a visitor submits an email address that has no matching `auth.users` record
- **THEN** the system shows the same neutral confirmation message it would show for a known email, and does not indicate whether the email exists

#### Scenario: Known email submitted
- **WHEN** a visitor submits an email address that has a matching `auth.users` record
- **THEN** the system shows the same neutral confirmation message shown for an unknown email, and a recovery email is sent to that address

### Requirement: `/set-password` completes both invitation and recovery flows
The system SHALL let `/set-password` complete a password-setting session regardless of whether the session was established via an invitation link or a recovery link, using copy that does not assume one or the other.

#### Scenario: Recovery link followed to completion
- **WHEN** a worker follows a valid recovery email link and lands on `/set-password` with an active session
- **THEN** the page shows link-type-neutral copy (not invite-specific wording such as "activar cuenta") and lets the worker set a new password via the existing `updateUser({ password })` call

#### Scenario: Invitation link followed to completion
- **WHEN** a worker follows a valid invitation email link and lands on `/set-password` with an active session
- **THEN** the page shows the same link-type-neutral copy and completes the password-setting flow exactly as it does today

#### Scenario: Invalid or expired link
- **WHEN** a visitor reaches `/set-password` without an active session (expired or already-used link, from either an invitation or a recovery email)
- **THEN** the page shows an invalid/expired-link error state, worded generically enough to apply to either link type

#### Scenario: Post-success navigation is unchanged
- **WHEN** a worker successfully sets a new password on `/set-password`, regardless of whether they arrived via an invitation or a recovery link
- **THEN** the system navigates them to the same destination it does today, with no new or different destination introduced by this change

### Requirement: Consistent password length enforcement
The system SHALL enforce an 8-character minimum on the client and in both local and hosted Supabase Auth configuration. Updating hosted configuration is a human-approved deployment prerequisite and SHALL NOT be performed by browser code.

#### Scenario: Password shorter than the canonical minimum is rejected consistently
- **WHEN** a worker submits a new password shorter than the canonical minimum length (8 characters) on `/set-password`
- **THEN** the client-side validation rejects it before submission, and the Supabase Auth server configuration would independently reject it as well if the client check were bypassed

### Requirement: Recovery shares existing email throttling safely
The system SHALL retain the existing shared `auth.rate_limit.email_sent = 2` limit for this iteration and SHALL treat throttling as a client-safe operational error without revealing account existence or Supabase internals.

#### Scenario: Shared email limit is reached
- **WHEN** invitation, admin resend, or self-service recovery requests exhaust the shared email-sending allowance
- **THEN** the recovery page shows only the generic client-safe error state, and documentation identifies that one flow can throttle another
