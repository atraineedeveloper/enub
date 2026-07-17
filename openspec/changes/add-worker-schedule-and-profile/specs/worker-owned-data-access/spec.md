## ADDED Requirements

### Requirement: Database-enforced schedule ownership
The system SHALL enforce, at the database level, that an authenticated session with `profiles.role = 'worker'` can read only `schedule_assignments` and `schedule_teachers` rows whose `worker_id` equals that session's `profiles.worker_id`, independent of any value supplied by the client (URL parameter, query parameter, local storage, component prop, or browser state).

#### Scenario: Worker reads own schedule assignments
- **WHEN** an authenticated `worker`-role session queries `schedule_assignments` for a given semester
- **THEN** only rows whose `worker_id` matches that session's linked worker are returned

#### Scenario: Worker cannot read another worker's schedule assignments
- **WHEN** worker A's authenticated session queries `schedule_assignments` for a semester in which worker B also has rows
- **THEN** worker B's rows are never included in the result

#### Scenario: Querying with no worker filter returns only the caller's own rows
- **WHEN** a `worker`-role session issues the same semester-scoped query the frontend uses, which applies no explicit `worker_id` filter at all
- **THEN** the result still contains only that session's own rows, because row-level security supplies the filter independent of the client's query shape

#### Scenario: Attempting to filter by another worker's id returns zero rows
- **WHEN** a `worker`-role session issues a query explicitly filtered to a different worker's `worker_id`
- **THEN** zero rows are returned — the explicit filter does not override or bypass row-level security

#### Scenario: Worker reads own schedule teacher activities
- **WHEN** an authenticated `worker`-role session queries `schedule_teachers` for a given semester
- **THEN** only rows whose `worker_id` matches that session's linked worker are returned

#### Scenario: Worker cannot read another worker's schedule teacher activities
- **WHEN** worker A's authenticated session queries `schedule_teachers` for a semester in which worker B also has rows
- **THEN** worker B's rows are never included in the result

#### Scenario: Staff and admin read all rows, including unowned rows
- **WHEN** an authenticated `staff`- or `admin`-role session queries `schedule_assignments` or `schedule_teachers`
- **THEN** all rows for the requested semester are returned, including any row whose `worker_id` is `NULL`, exactly as before this change

#### Scenario: Rows with a null worker_id are hidden from every worker session
- **WHEN** a `schedule_assignments` or `schedule_teachers` row has `worker_id IS NULL`
- **THEN** no `worker`-role session — regardless of which worker they are — can read that row, since `NULL = current_worker_id()` is never true

#### Scenario: Anonymous sessions receive no schedule data
- **WHEN** an unauthenticated request queries `schedule_assignments` or `schedule_teachers`
- **THEN** no rows are returned

#### Scenario: A session with no profile row is denied
- **WHEN** an authenticated session with no corresponding `profiles` row queries `schedule_assignments` or `schedule_teachers`
- **THEN** no rows are returned

#### Scenario: A worker session with an invalid or missing worker link is denied
- **WHEN** an authenticated `worker`-role session's `profiles.worker_id` is null or does not correspond to any existing `workers` row
- **THEN** no `schedule_assignments` or `schedule_teachers` rows are returned to that session

#### Scenario: An unrecognized role is denied
- **WHEN** an authenticated session's `profiles.role` is a value other than `admin`, `staff`, or `worker`
- **THEN** no `schedule_assignments` or `schedule_teachers` rows are returned to that session

#### Scenario: An admin account with a stale worker_id cannot use it as a secondary identity
- **WHEN** a `profiles` row has `role = 'admin'` (or `staff`) and also has a non-null `worker_id` value
- **THEN** that session is authorized as `admin`/`staff` only — it is never granted worker-scoped row access via that `worker_id`

#### Scenario: Existing INSERT/UPDATE/DELETE behavior is unchanged
- **WHEN** any session that could previously write to `schedule_assignments` or `schedule_teachers` attempts the same write after this change
- **THEN** the outcome is identical to before this change — this capability governs `SELECT` only

### Requirement: The RLS migration verifies its own preconditions and postconditions
The migration that tightens `schedule_assignments`/`schedule_teachers` read access SHALL verify, before making any change, that the policy it is about to remove exists in the exact expected shape and that no other permissive `SELECT` policy exists that could preserve unrestricted access under a different name. It SHALL fail closed — aborting with no effect — if either check does not hold. After applying the change, it SHALL verify that the resulting policy catalog exactly matches the intended design. These checks SHALL execute inside the migration transaction itself, not only in a separate test suite run afterward.

#### Scenario: Migration aborts if the expected policy is missing or already changed
- **WHEN** the migration runs and `schedule_assignments` or `schedule_teachers` does not have exactly one `SELECT` policy named `"Enable read access for all users"` with an unconditionally-true predicate
- **THEN** the migration raises an exception and applies no change to that table's policies

#### Scenario: Migration aborts if an additional permissive SELECT policy is detected
- **WHEN** the migration runs and either table has any `SELECT` policy other than the one expected policy from the previous scenario
- **THEN** the migration raises an exception and applies no change, rather than proceeding and silently leaving the additional policy in place

#### Scenario: Migration verifies no anonymous or public access remains
- **WHEN** the migration completes successfully
- **THEN** neither `schedule_assignments` nor `schedule_teachers` has any `SELECT` policy naming `anon` or `public` among its roles

#### Scenario: Migration verifies no unrestricted policy remains under any name
- **WHEN** the migration completes successfully
- **THEN** neither table has a `SELECT` policy (permissive or restrictive) with a predicate that normalizes to an unconditionally-true value, under any policy name

#### Scenario: A failed migration leaves the database unchanged
- **WHEN** any precondition or postcondition check fails
- **THEN** the entire migration transaction is rolled back, and the database's policy state is identical to before the migration ran

### Requirement: The migration verifies each intended SELECT policy individually, on every dimension, inside the transaction
For both `schedule_assignments` and `schedule_teachers`, the migration SHALL look up each of the two newly-created `SELECT` policies by exact name and verify, as a single combined postcondition, that `cmd = 'SELECT'`, `permissive = 'PERMISSIVE'`, `roles` is exactly `{authenticated}` (no more and no fewer), and the normalized predicate text matches the expected normalized predicate for that policy — where the expected text was itself captured from Postgres's own reconstruction of the same `CREATE POLICY` statement (not independently authored), and normalization consists only of case-folding and whitespace collapsing, not general SQL-equivalence analysis. The migration SHALL also verify that exactly these two policies exist for `SELECT` on each table and no others, of either permissive or restrictive mode.

#### Scenario: Admin/staff policy verified on every dimension
- **WHEN** the migration's postcondition check runs against the newly-created "Staff and admin can read all schedule assignments"/"...schedule teachers" policy
- **THEN** it confirms `cmd = 'SELECT'`, `permissive = 'PERMISSIVE'`, `roles = {authenticated}`, and a normalized predicate semantically matching `current_app_role() IN ('staff', 'admin')`, failing the migration if any one of these does not hold

#### Scenario: Worker-own-row policy verified on every dimension
- **WHEN** the migration's postcondition check runs against the newly-created "Workers can read own schedule assignments"/"...schedule teacher activities" policy
- **THEN** it confirms `cmd = 'SELECT'`, `permissive = 'PERMISSIVE'`, `roles = {authenticated}`, and a normalized predicate semantically matching `worker_id = current_worker_id()`, failing the migration if any one of these does not hold

#### Scenario: Harmless predicate formatting differences do not cause a false failure
- **WHEN** Postgres reconstructs a policy's stored predicate with different but semantically identical formatting than the literal `CREATE POLICY` source text (for example, rewriting an `IN (...)` list or schema-qualifying a function reference)
- **THEN** the postcondition check still passes, because the expected predicate text was itself derived from Postgres's own reconstruction of the same statement rather than authored independently

#### Scenario: No unexpected restrictive or permissive SELECT policy remains
- **WHEN** the migration's postcondition check runs
- **THEN** it confirms the total `SELECT` policy count for the table is exactly two, and that both are the two individually-verified policies from the scenarios above — no additional policy of either permissive or restrictive mode is present under any name

### Requirement: Write-policy behavior on both schedule tables is proven unchanged, not merely assumed
The system SHALL provide structural and behavioral evidence that this change's `SELECT`-only migration does not alter `INSERT`, `UPDATE`, or `DELETE` behavior on `schedule_assignments` or `schedule_teachers`. This evidence SHALL NOT be interpreted as endorsing the current write policies as secure — hardening them is tracked as a separate, definite follow-up.

#### Scenario: Structural regression coverage for each write command on each table
- **WHEN** the write-policy catalog for `schedule_assignments` and `schedule_teachers` is inspected after the migration
- **THEN** the `INSERT`, `UPDATE`, and `DELETE` policies on each table are confirmed present with the same `policyname`, `roles`, `qual`, `with_check`, and permissive/restrictive mode as before the migration

#### Scenario: Behavioral regression coverage for each write command on each table
- **WHEN** a representative `INSERT`, `UPDATE`, and `DELETE` is attempted against each of `schedule_assignments` and `schedule_teachers`, under the same authenticated-session conditions the pre-existing policies already permitted
- **THEN** each of the six writes (two tables × three commands) succeeds exactly as it would have before this change

### Requirement: Database-enforced profile row ownership
The system SHALL enforce, at the database level, that an authenticated `worker`-role session can read only the `workers` row linked to its own `profiles.worker_id`, independent of any client-supplied worker id.

#### Scenario: Worker reads own worker row
- **WHEN** an authenticated `worker`-role session requests its own linked `workers` row
- **THEN** the row is returned

#### Scenario: Worker cannot read another worker's row
- **WHEN** an authenticated `worker`-role session requests a `workers` row belonging to a different worker, by any client-supplied id
- **THEN** no row is returned

#### Scenario: A worker session with an invalid or missing worker link receives no worker data
- **WHEN** an authenticated `worker`-role session's `profiles.worker_id` is null or does not correspond to any existing `workers` row
- **THEN** the profile query returns no row

### Requirement: Row-level security is row-scoped, not column-scoped — documented honestly
The system SHALL document that `workers` row-level security authorizes which *row* a worker session may read, not which *columns*. An application-layer explicit column projection (such as the profile page's service function) is a request/UI minimization, not a database-enforced confidentiality boundary — a worker's own authenticated client remains capable of requesting every column of their own `workers` row directly, including columns the profile page never renders.

#### Scenario: Documentation does not claim column-level confidentiality
- **WHEN** the profile page's data-fetching approach is described in this capability's design documentation
- **THEN** it is described as limiting what the application requests and renders, not as preventing the worker's own client from requesting additional columns of their own row

### Requirement: Role is authoritative, never inferred from routing or client state
The system SHALL determine `worker`, `staff`, and `admin` authorization exclusively from the authenticated session's `profiles.role`, resolved server-side. The frontend MUST NOT rely on hiding navigation items, route names, or component props as an authorization mechanism.

#### Scenario: Direct navigation to a worker route without a worker link
- **WHEN** an authenticated session with `role` other than `worker`, or with `role = 'worker'` but no valid `worker_id`, requests `/my-schedule` or `/my-profile` directly
- **THEN** the page does not render worker-owned data, and the underlying database queries independently return no data even if the frontend gate were bypassed

#### Scenario: URL tampering cannot reveal another worker's data
- **WHEN** a `worker`-role session modifies client-side state, component props, or any in-browser value in an attempt to view another worker's schedule or profile
- **THEN** the database-level ownership checks in this capability still return only that session's own data
