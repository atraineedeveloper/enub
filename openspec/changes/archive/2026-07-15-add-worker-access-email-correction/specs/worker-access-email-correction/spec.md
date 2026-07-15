## ADDED Requirements

### Requirement: Administrator-only per-worker access-email correction action
The system SHALL provide a per-worker administrator action, "Actualizar correo de acceso," available only for a worker who already has a linked self-service Auth account, and SHALL NOT expose this action to any non-administrator role.

#### Scenario: Action visible only for a linked worker, to an administrator
- **WHEN** an administrator views a worker row for a worker who already has a linked profile (`role = 'worker'`)
- **THEN** the "Actualizar correo de acceso" action is available for that worker

#### Scenario: Action not available for an unlinked worker
- **WHEN** an administrator views a worker row for a worker with no linked profile
- **THEN** the "Actualizar correo de acceso" action is not shown for that worker

#### Scenario: Action never visible to a non-administrator
- **WHEN** a non-administrator (e.g. `staff` or `worker` role) views any worker row
- **THEN** "Actualizar correo de acceso" never appears, regardless of that worker's linked status

### Requirement: This action never sends an access link
The system SHALL NOT call `resetPasswordForEmail` or any other access-link delivery mechanism as part of this action, under any outcome, and SHALL treat sending a fresh access link as a separate, administrator-triggered step using the existing "Reenviar enlace de acceso" action.

#### Scenario: A successful correction sends no email
- **WHEN** a correction completes with the email synchronized (whether newly transitioned or already synchronized)
- **THEN** the system does not send any access-link email as part of that response, and does not claim to have done so

#### Scenario: Success guidance points to the existing resend action
- **WHEN** a correction completes with the email synchronized
- **THEN** the confirmation dialog tells the administrator the access email was updated and to now send a fresh access link separately, and offers a clear path to the existing "Reenviar enlace de acceso" action without invoking it automatically

### Requirement: Authorization precedes body parsing and every privileged read
The system SHALL authenticate the caller and confirm administrator role, for both the correction endpoint and the current-Auth-email-context endpoint, before parsing the request body or performing any read of worker, profile, or Auth data.

#### Scenario: Unauthenticated request is rejected before body parsing
- **WHEN** either endpoint receives a request with no `Authorization` header, including one with a malformed or unknown-key body
- **THEN** the system returns 401 without parsing the body and without reading any worker, profile, or Auth data

#### Scenario: Authenticated non-administrator request is rejected before body parsing
- **WHEN** either endpoint receives a request from an authenticated caller whose role is not `admin`, including one with a malformed or unknown-key body
- **THEN** the system returns 403 without parsing the body and without reading any worker, profile, or Auth data, and without any service-role mutation

### Requirement: The claim operation accepts only trusted business input
The system SHALL create or resume a correction claim using only a worker identifier and the raw requested email — never a caller-supplied linked Auth user id, a caller-asserted "expected worker email," a caller-asserted already-canonical email, or a profile id — and SHALL resolve every other value (the linked profile, the linked Auth user, the canonical form of the requested email, the worker's current raw email) server-side, inside that same operation.

#### Scenario: Only worker id and requested email are accepted as claim inputs
- **WHEN** the system creates or resumes a correction claim
- **THEN** it does so using only the target worker's identifier and the raw requested email supplied by the correction endpoint, deriving every other value itself rather than accepting it as an input

#### Scenario: The linked Auth user id is never returned to the browser
- **WHEN** a claim is created, resumed, or rejected
- **THEN** the response the browser eventually receives never contains the linked Auth user's id, at any point in the flow

### Requirement: Internal operation functions are reachable only through the server's own privileged connection
The system SHALL restrict every internal correction-operation function (creating or resuming a claim, reading operation context, synchronizing the worker record, and transitioning operation state) so that it is callable only through the server's own privileged connection, and SHALL NOT grant execution of any of them to an ordinary authenticated browser session, regardless of that session's role.

#### Scenario: An authenticated administrator session cannot call an internal operation function directly
- **WHEN** an authenticated session, including one belonging to an administrator, attempts to invoke any of the internal correction-operation functions directly rather than through the correction Edge Function
- **THEN** the attempt is rejected at the database privilege level, before any of that function's own logic runs

#### Scenario: Authorization happens once, at the Edge Function boundary
- **WHEN** the correction Edge Function has confirmed the caller is an authenticated administrator
- **THEN** every subsequent internal operation function it calls for that request is reached only through the server's own privileged connection, not the caller's own session

### Requirement: A single, operation-bound identity is used throughout one correction attempt
The system SHALL use one consistent, operation-bound view of the target worker and linked Auth identity throughout a single correction attempt after a claim has been created or resumed, rather than independently re-resolving a potentially different identity at a later step.

#### Scenario: Later steps use the claimed identity, not a fresh independent resolution
- **WHEN** a correction attempt proceeds past claiming or resuming an operation
- **THEN** every subsequent step uses the worker and linked Auth identity recorded on that same operation, not a separately re-derived resolution that could disagree with it

### Requirement: Server-side resolution of the linked Auth account
The system SHALL resolve the worker's exact linked profile and linked Auth user server-side, and SHALL reject the request with a controlled, closed status if the worker is not found, is not linked, has an invalid linked-profile role, or references a missing Auth user.

#### Scenario: Worker does not exist
- **WHEN** a correction or context request targets a worker id with no matching worker
- **THEN** the system returns a closed `worker_not_found` result and performs no side effect

#### Scenario: Worker has no linked profile
- **WHEN** a correction or context request targets a worker with no `profiles` row
- **THEN** the system returns a closed `worker_not_linked` result and performs no side effect

#### Scenario: Linked profile references a missing Auth user
- **WHEN** the worker's linked profile references an Auth user id that no longer exists
- **THEN** the system verifies this before creating any correction operation, returns a closed `linked_auth_user_missing` result, creates no operation, performs no Auth or worker mutation, and does not expose the missing id to the browser

### Requirement: Canonical email validation and duplicate rejection
The system SHALL canonicalize the requested new email (`lower(trim(email))`) internally — never trusting a caller-supplied value as already canonical — and SHALL reject a missing, malformed, or canonically-duplicated (against another worker's `workers.email`) request before creating any claim or performing any mutation.

#### Scenario: Missing or malformed new email
- **WHEN** the requested email is empty, whitespace-only, or does not match a valid email format
- **THEN** the system returns a closed `invalid_email` result and performs no side effect

#### Scenario: New email canonically matches another worker's recorded email
- **WHEN** the canonical form of the requested email already equals another worker's `workers.email`, canonicalized
- **THEN** the system checks this before creating any correction operation, returns a closed `duplicate_worker_email` result, creates no operation, and performs no Auth or worker mutation

### Requirement: Zero/one/multiple canonical Auth-match detection before mutation
The system SHALL determine, before calling any Auth-account mutation, whether the canonical requested email matches zero, exactly one, or more than one existing Auth user, and SHALL only proceed to mutate the Auth account when the match set is empty or resolves to the worker's own currently-linked Auth user.

#### Scenario: Requested email already belongs to the worker's own linked Auth account
- **WHEN** the canonical requested email already equals the linked Auth user's own current canonical email
- **THEN** the system does not attempt any Auth mutation for that reason alone

#### Scenario: Requested email belongs to a different Auth user
- **WHEN** the canonical requested email matches exactly one Auth user other than the worker's own linked Auth user
- **THEN** the system returns a closed `email_owned_by_another_auth_user` result and performs no mutation

#### Scenario: Requested email matches more than one Auth user
- **WHEN** the canonical requested email matches more than one existing Auth user (a case/whitespace-variant duplicate)
- **THEN** the system returns a closed `multiple_canonical_auth_matches` result and performs no mutation, never picking one match arbitrarily

### Requirement: A durable claim enforces at most one blocking correction per identity
The system SHALL record every correction attempt as a durable, persisted operation with a closed state (`active`, `completed`, or `manual_attention_required`), and SHALL enforce — via a database-level uniqueness guarantee — that at most one operation in `active` or `manual_attention_required` state exists for a given worker, and at most one for a given linked Auth identity, at any time. A `completed` operation SHALL NOT block a future correction for the same worker or Auth identity; a `manual_attention_required` operation SHALL continue blocking until it is resolved outside this feature.

#### Scenario: First correction for a worker creates a new claim
- **WHEN** a correction is requested for a worker with no currently blocking correction
- **THEN** the system creates a new durable operation recording the target worker, the resolved linked Auth user, the canonical requested email, and the worker's raw email observed at that moment

#### Scenario: Identical concurrent correction resumes the same claim
- **WHEN** a second correction request arrives for the same worker with the same canonical requested email, while the first request's operation is still `active`
- **THEN** the system resumes the existing operation rather than creating a second one

#### Scenario: Different-target correction is rejected while one is active
- **WHEN** a correction is requested for a worker that already has an `active` operation targeting a different canonical requested email
- **THEN** the system rejects the new request with a closed `correction_already_in_progress` result, HTTP 409, `retryable: false`, and performs no Auth or worker mutation

#### Scenario: A manual-attention operation blocks any further correction
- **WHEN** a correction is requested for a worker whose most recent operation is `manual_attention_required`, regardless of what email that operation targeted
- **THEN** the system rejects the new request with a closed `manual_attention_required` result, HTTP 409, `retryable: false`, and performs no Auth or worker mutation

#### Scenario: A completed correction does not block a later one
- **WHEN** a worker's most recent correction has already reached `completed`
- **THEN** a new correction request for that worker is free to create a new operation

#### Scenario: No automatic resolution of a manual-attention operation
- **WHEN** an operation has reached `manual_attention_required`
- **THEN** the system provides no automatic or in-app way to advance it back to `active` or to `completed`; resolving it is a manual, technical action outside this feature

### Requirement: Claim ambiguity is reconciled without attempting an impossible database operation
The system SHALL inspect any existing blocking operation for the target worker identity and the target linked Auth identity independently before deciding whether to create a new operation, and SHALL NOT attempt to insert a new operation row whenever a blocking row for either identity already exists — an operation that would necessarily violate the same database-level uniqueness guarantee this requirement itself relies on. When an existing blocking row's own recorded identity no longer matches what was just freshly resolved, the system SHALL transition that existing row in place rather than creating a second one.

#### Scenario: One consistent blocking row is found by both identities
- **WHEN** a correction request finds exactly one blocking operation, and that same operation is found independently by both the target worker identity and the target linked Auth identity
- **THEN** the system resumes it if the requested email matches, rejects with a different-target conflict if it does not, or reports it as manual-attention-blocking if it is already `manual_attention_required` — in every case without creating a second row

#### Scenario: One blocking row is implicated with inconsistent identity
- **WHEN** a correction request finds a blocking operation through only one of the two identity searches (worker or linked Auth), indicating that row's recorded identity has drifted since it was created
- **THEN** the system transitions that existing row in place to `manual_attention_required` when it is still `active`, or leaves it unchanged if already `manual_attention_required`, and returns a controlled ambiguity result referencing that same row — never inserting a new row

#### Scenario: Two distinct blocking rows are found
- **WHEN** a correction request's independent searches by worker identity and by linked Auth identity each find a blocking row, and the two rows are not the same row
- **THEN** the system returns a controlled ambiguity result without mutating either row, without attempting any insert, and without exposing which row or database constraint was involved

#### Scenario: No blocking row exists
- **WHEN** neither search finds any blocking operation for the target worker identity or the target linked Auth identity
- **THEN** the system is free to create a new operation, either directly as a completed idempotent success (when both systems already match the target) or as a newly active operation

### Requirement: Observed state is authoritative, not the claim's own recorded state
The system SHALL freshly re-read the linked profile, the current Auth email, and the current raw `workers.email` whenever an operation starts or resumes, and SHALL decide its next action from that fresh observation rather than from what the claim record alone states.

#### Scenario: Auth and worker both already equal the requested email
- **WHEN** a fresh read shows both the linked Auth account and `workers.email` already match the requested email
- **THEN** the system marks the operation completed and returns an idempotent success result without repeating any mutation

#### Scenario: Auth matches, worker record does not
- **WHEN** a fresh read shows the linked Auth account already matches the requested email but `workers.email` does not
- **THEN** the system attempts only the guarded worker-record synchronization

#### Scenario: Worker record matches, Auth does not
- **WHEN** a fresh read shows `workers.email` already matches the requested email but the linked Auth account does not
- **THEN** the system revalidates Auth ownership and conflicts using a fresh lookup and attempts only the remaining Auth update

#### Scenario: Neither side matches
- **WHEN** a fresh read shows neither the Auth account nor `workers.email` yet match the requested email
- **THEN** the system performs the Auth update first, then attempts worker-record synchronization, under the same operation

#### Scenario: A conflicting or changed identity is never silently overwritten
- **WHEN** a fresh read shows either side now conflicts with a different identity, or the linked profile has changed since the operation was created
- **THEN** the system does not overwrite either side and marks the operation `manual_attention_required`

#### Scenario: The operation's own recorded identity is no longer internally consistent
- **WHEN** an independent re-check of the operation's own recorded worker and linked Auth identity, performed under lock, finds that identity no longer resolves consistently (for example, the recorded linked Auth user no longer exists at all, independent of whether the worker's own profile has changed)
- **THEN** the system does not overwrite either side, transitions the operation to `manual_attention_required` with the distinct reason code `operation_identity_mismatch`, and returns a controlled, non-retryable result

### Requirement: Manual-attention transitions are restricted to a narrow, explicit set of reasons
The system SHALL only transition an operation to `manual_attention_required` for one of a small, explicit set of reasons, and SHALL reject any other value even if that value would otherwise be an acceptable stored reason code for a different purpose.

#### Scenario: An accepted manual-attention reason is applied
- **WHEN** the system transitions an operation to `manual_attention_required` for an ambiguous claim state, a duplicate worker email detected mid-synchronization, a changed linkage, an internally-inconsistent operation identity, or an unresolved Auth or worker synchronization uncertainty
- **THEN** the transition succeeds and the specific reason is recorded

#### Scenario: An unrelated reason is rejected for this transition
- **WHEN** something attempts to transition an operation to `manual_attention_required` using a reason outside that explicit set
- **THEN** the transition is rejected, even if the supplied value is otherwise a generally-valid stored reason code

### Requirement: Existing Auth account is updated in place, never replaced or deleted
The system SHALL update the worker's existing linked Auth user's email directly and SHALL NOT create a new Auth user or delete the existing Auth user under any code path of this action.

#### Scenario: Successful correction updates the existing Auth user
- **WHEN** the requested new email passes every prior check and the worker's linked Auth account needs updating
- **THEN** the system updates that same, existing Auth user's email, and no new Auth user is created

#### Scenario: No deletion under any outcome
- **WHEN** the correction fails at any step, for any reason
- **THEN** the worker's existing Auth account is left intact — never deleted, never disabled

### Requirement: Worker-email synchronization is bound only to the operation, with an immutable guard
The system SHALL synchronize `workers.email` through a database operation that accepts only the operation identifier (never a separately-supplied worker id, Auth id, or email), loads every value it needs from that operation's own durable record, acquires deterministic locks for the worker identity and its linked Auth identity in a fixed order, rechecks canonical duplicates inside its own transaction, and applies an optimistic concurrency guard against the worker's raw email as observed once at claim time — a value that is never refreshed or replaced by a later read.

#### Scenario: Concurrent ordinary worker edit is detected and does not silently overwrite
- **WHEN** an unrelated edit to the same worker's `email` field commits between the claim's initial read and the synchronization step
- **THEN** the synchronization step detects the mismatch against the original, immutable observed value and reports a stale-edit outcome rather than overwriting the concurrent edit

#### Scenario: Worker row already matches the requested email
- **WHEN** `workers.email` already canonically equals the requested new email at synchronization time
- **THEN** the synchronization step reports an idempotent no-op outcome rather than performing a redundant write

#### Scenario: A genuine duplicate is detected only at synchronization time
- **WHEN** the in-transaction duplicate recheck at synchronization time finds another worker's `workers.email` now canonically matching the requested email, even though the Auth account has already been updated
- **THEN** the system does not overwrite `workers.email` and marks the operation `manual_attention_required`, and does not treat this as automatically self-healing through a blind retry

### Requirement: Non-atomic Auth/Postgres handling is self-healing and idempotent
The system SHALL treat the Auth update and the `workers.email` synchronization as two independent, non-transactional steps, SHALL NOT attempt any destructive rollback of one when the other fails, and SHALL make a resumed or repeated request always safe to resolve any partial state left by a prior request.

#### Scenario: Auth updated, worker synchronization not yet applied
- **WHEN** the Auth account is successfully updated to the new email but the worker-synchronization step does not complete in the same request
- **THEN** the system preserves the updated Auth account and a subsequent resumed request completes the synchronization without repeating the Auth update unnecessarily

#### Scenario: Worker record updated, Auth account not yet applied
- **WHEN** `workers.email` already equals the requested new email but the linked Auth account does not yet
- **THEN** the system attempts only the remaining Auth update after fresh revalidation, and does not treat the already-correct worker record as an error

### Requirement: Uncertain external results are resolved by fresh observation, never assumed from a timeout
The system SHALL NOT map a timeout or transport failure directly to an uncertain status without first attempting a fresh read of the affected state, and SHALL derive `emailSynchronized` only from freshly observed Auth and worker state.

#### Scenario: A timed-out Auth update is checked before being reported uncertain
- **WHEN** the Auth-account update call times out or its result cannot be parsed
- **THEN** the system attempts a fresh read of the Auth account's current email before concluding the outcome is uncertain, and reports a definite success or failure if that fresh read resolves it

#### Scenario: A timed-out synchronization call is checked before being reported uncertain
- **WHEN** the worker-synchronization call times out or its result cannot be parsed
- **THEN** the system attempts a fresh read of `workers.email` before concluding the outcome is uncertain, and reports a definite outcome if that fresh read resolves it

#### Scenario: A timed-out completion or manual-attention transition is checked before being reported uncertain
- **WHEN** the call that transitions an operation to `completed` or to `manual_attention_required` times out or its result cannot be parsed
- **THEN** the system re-reads the operation's own recorded state, together with the worker and Auth state, before concluding anything: it reports success if the operation is now genuinely completed and converged, the matching manual-attention result if the operation is now genuinely in that state, a controlled retryable uncertainty if the operation remains safely resumable, or transitions the operation to `manual_attention_required` if none of these can be established

### Requirement: Closed, safe response contract with no delivery fields
The system SHALL return a closed, discriminated response containing `status`, `reasonCode`, `retryable`, and `emailSynchronized`, using only predefined values for each closed field, and SHALL NOT expose any raw Auth UUID, SQL error, service-role error, internal operation identifier, or other internal message to the browser under any outcome. The response SHALL NOT contain any delivery-related field.

#### Scenario: Every response carries the full closed shape
- **WHEN** the correction endpoint returns any response, success or failure
- **THEN** that response includes `status`, `reasonCode`, `retryable`, and `emailSynchronized`, each drawn from its own predefined closed set of values, with only an optional, display-only `message`, and no delivery-related field of any kind

#### Scenario: No internal detail ever reaches the browser
- **WHEN** any internal step fails for an unclassified or unexpected reason
- **THEN** the response uses a generic, closed status and never includes a raw database error, Auth API error object, internal operation identifier, or service-role-related detail

#### Scenario: Structurally-unreachable defense-in-depth states use generic display text
- **WHEN** the response status is `invalid_profile_role` or `linked_auth_user_missing`
- **THEN** the displayed message is the generic Spanish text "Revisión manual requerida," while the underlying `reasonCode` remains specific to each condition for diagnosis

### Requirement: Dedicated administrator-only current-Auth-email context endpoint with a closed contract
The system SHALL provide a dedicated, administrator-only Edge Function that returns a masked-by-default, explicitly-revealable current linked Auth login email and worker display name for a worker, using a closed response contract for both success and error outcomes, SHALL NOT expose the underlying Auth user id, any internal operation identifier, or any other Auth metadata, and SHALL NOT expose this lookup to any non-administrator role or as a general-purpose RPC reachable by ordinary authenticated callers.

#### Scenario: Default response is masked
- **WHEN** an administrator requests the current-Auth-email context for a linked worker without requesting reveal
- **THEN** the response contains a masked form of the current Auth login email, the worker's display name, and no Auth user id, operation identifier, or other Auth metadata

#### Scenario: Explicit reveal returns the full email
- **WHEN** an administrator requests the current-Auth-email context with an explicit reveal request
- **THEN** the response contains the full current Auth login email, still with no Auth user id, operation identifier, or other Auth metadata

#### Scenario: Non-administrator callers are rejected
- **WHEN** a `worker` or `staff`-role caller requests the current-Auth-email context for any worker
- **THEN** the system rejects the request and returns no email information, masked or otherwise

#### Scenario: Every error outcome uses an explicit, closed HTTP and reason code
- **WHEN** the context endpoint cannot fulfill a request, whether due to missing authentication, an unauthorized caller, a malformed request, a worker that does not exist, is not linked, has an invalid linked-profile role, or references a missing Auth user
- **THEN** the response uses one predefined HTTP status and one predefined, closed reason code for that specific condition, never an ad hoc or unclassified error shape

### Requirement: Dedicated accessible confirmation dialog
The system SHALL present the correction action through a dedicated dialog component — not the existing shared, non-accessible `Modal` component — providing real dialog semantics, an accessible title and description, initial focus on open, focus containment while open, explicit focus restoration to the triggering control on close, `Escape` and outside-click handling, and a single guard blocking every close path while a request is pending.

#### Scenario: Dialog shows required information before submission
- **WHEN** an administrator opens "Actualizar correo de acceso" for a worker
- **THEN** the dialog shows that worker's name, current `workers.email`, a masked current Auth login email with an explicit reveal control, and a warning that the login email will change

#### Scenario: Submission requires explicit confirmation and blocks duplicates
- **WHEN** an administrator has entered a requested new email
- **THEN** the system requires an explicit confirming action before submitting the correction, disables the submit action while a request is pending, and prevents a second submission for the same worker while one is already in flight

#### Scenario: Every close path is guarded while a request is pending
- **WHEN** a correction request is pending and the administrator attempts to close the dialog via Escape, an outside click, or a cancel control
- **THEN** none of those close paths succeed until the pending request settles

#### Scenario: Focus is restored to the trigger on close
- **WHEN** the dialog closes after a safe (non-pending) close action
- **THEN** keyboard focus returns to the control that originally opened it

#### Scenario: Manual-attention outcomes remain readable
- **WHEN** the dialog displays a `manual_attention_required` or an `active`/retryable-pending result
- **THEN** the outcome is rendered in plain, non-raw-error language, consistent with the closed response contract's display-only message convention

### Requirement: Cache invalidation after side-effect-capable or ambiguous results
The system SHALL refetch the worker list, linked-worker-account status, relevant profile data, and the current-Auth-email context after any correction attempt that could have changed state or whose outcome is uncertain.

#### Scenario: Refetch after a definite outcome
- **WHEN** a correction attempt completes with `updated` or `already_synchronized`
- **THEN** the workers list, linked-worker-account status, and current-Auth-email context queries are invalidated and refetched

#### Scenario: Refetch after an ambiguous or uncertain outcome
- **WHEN** a correction attempt completes with any retryable-pending, uncertain, or manual-attention status
- **THEN** the same queries are invalidated and refetched, since the true resulting state cannot be assumed from the request alone

#### Scenario: No refetch after a request rejected before any side effect
- **WHEN** a correction request is rejected before any side effect (e.g. validation failure, or a different-target/manual-attention-blocking conflict)
- **THEN** no cache invalidation is required, since nothing could have changed
