## ADDED Requirements

### Requirement: `supabase/seed.sql` is tracked by Git
The system SHALL keep `supabase/seed.sql` under Git version control. Removing the clone-local `.git/info/exclude` entry that previously hid it is optional local preparation, not a required or portable part of this change — `.git/info/exclude` is per-clone, never distributed, and is not a repository file this change impacts. No other locally-excluded artifact (e.g. `supabase-backup-before-worker-documents.sql`) SHALL be added as part of this change.

#### Scenario: Seed file is tracked
- **WHEN** `git ls-files supabase/seed.sql` is run after this change
- **THEN** it returns the path, confirming the file is tracked — this is the sole acceptance criterion for git tracking

#### Scenario: Unrelated local-only files remain untouched
- **WHEN** this developer's `.git/info/exclude` file is inspected after this change
- **THEN** any other pre-existing locally-excluded entry (e.g. the backup SQL file) is unchanged, regardless of whether the `supabase/seed.sql` line was removed from it

### Requirement: Reserved fixture ID block does not perturb normal worker numbering
The system SHALL insert new worker development fixtures using explicit literal ids in a reserved, practical out-of-band block (`9001`–`9007`) without advancing `workers_id_seq` (or any related table's sequence for a row inserted at a high explicit id) to match that block. This is a practical safeguard for ordinary local development, not a claim that collision with the reserved block is mathematically impossible in every conceivable scenario (e.g. a local database that accumulates thousands of manually-created workers without ever being reset).

#### Scenario: Sequence stays pinned to the non-fixture maximum
- **WHEN** `supabase/seed.sql` is inspected after this change
- **THEN** the `setval` call for `workers_id_seq` still reflects the highest naturally-numbered worker id (`2`), not `9007`

#### Scenario: Sequence state is verified by direct inspection
- **WHEN** `bunx supabase db reset` completes
- **THEN** a direct query of `workers_id_seq` (e.g. `SELECT last_value, is_called FROM public.workers_id_seq`) reports `last_value = 2` and `is_called = true`

#### Scenario: Next application-created worker receives the expected low id
- **WHEN** a developer creates a new worker through the running application after a clean reset
- **THEN** that worker receives `id = 3`, not an id inside or after the `9001`–`9007` reserved block

### Requirement: Local worker fixture matrix supports required manual-verification scenarios
The system SHALL provide deterministic, fictitious local worker fixtures covering: a worker with a valid email, no Auth account, no linked profile, and schedule assignments; a worker with a valid email, no Auth account, no linked profile, and no schedule assignments; a worker whose email has a matching `auth.users`/`auth.identities` row but no `public.profiles` row; a fully linked worker (matching `auth.users`, `auth.identities`, and a `public.profiles` row with `role = 'worker'` and `worker_id` set) capable of signing in; an active worker with no email; an inactive worker with a valid email and no account; a deliberately malformed-email worker; and a deliberate duplicate-email worker pair.

#### Scenario: Worker with schedule assignments and no account
- **WHEN** the seeded workers table is queried for a worker with a valid email, no `profiles` row referencing it, and at least one `schedule_assignments` row
- **THEN** exactly this worker (the existing worker 1 fixture) satisfies all three conditions

#### Scenario: Worker 2 is the designated no-schedule-assignments baseline
- **WHEN** worker `2` specifically is queried for a valid email, no `profiles` row, and `schedule_assignments` rows
- **THEN** worker 2 has a valid email, no linked profile, and zero `schedule_assignments` rows. This scenario is verified against worker 2's stable id specifically; it does not require worker 2 to be the only worker in the table with zero `schedule_assignments` rows, and other fixtures may also have none without affecting this scenario's acceptance

#### Scenario: Worker with an orphaned Auth user and no profile
- **WHEN** the seeded `auth.users`/`auth.identities` tables are queried for an email matching a `workers.email` value
- **THEN** a matching Auth user and identity exist for that worker, and no `public.profiles` row references either the Auth user or the worker

#### Scenario: Fully linked worker can sign in
- **WHEN** the seeded fixtures are queried for a worker with a matching `auth.users` row, a matching `auth.identities` row, and a `public.profiles` row where `role = 'worker'` and `worker_id` equals that worker's id
- **THEN** exactly one such worker exists, using a deterministic local password documented in the seed file, so a developer can sign in as that worker and reach `/my-documents`

#### Scenario: Fully linked worker can complete the password-recovery flow
- **WHEN** a developer requests password recovery for the fully linked worker's email from `/forgot-password`, follows the resulting local Mailpit email, and completes a new password on `/set-password`
- **THEN** the recovery email arrives, its link targets `/set-password`, the password update succeeds, and the worker can subsequently sign in with the new password (manual verification; not claimed to be exercised until actually performed)

#### Scenario: Active worker without an email
- **WHEN** the seeded workers table is queried for an active worker (`status = 1`) with a `NULL` email
- **THEN** exactly one such worker exists

#### Scenario: Inactive worker with a valid email and no account
- **WHEN** the seeded workers table is queried for a worker with `status` other than `1`, a valid email, and no linked `profiles` row
- **THEN** exactly one such worker exists

#### Scenario: Deliberate invalid-email fixture
- **WHEN** the seeded workers table is queried for a worker whose `email` value fails the application's email format validation
- **THEN** exactly one such worker exists, clearly named as a negative test fixture

#### Scenario: Deliberate duplicate-email fixture pair
- **WHEN** the seeded workers table is queried by email
- **THEN** exactly one email value is shared by exactly two worker fixtures, both clearly named as negative test fixtures

### Requirement: No-email worker fixture is verified at the correct layer
The system SHALL treat the absence of the "Crear cuenta de acceso" action for a worker with no email as expected, current UI behavior (`WorkerRow.tsx`'s existing `hasEmail` gate), not a defect to route around. The corresponding server-side no-email guard SHALL be verified through a direct local API/Edge Function invocation, not through the browser, since no UI path can trigger that request for this fixture.

#### Scenario: No-email worker appears in the list without the create-account action
- **WHEN** the workers list is viewed after seeding
- **THEN** worker 9003 appears in the list, and the "Crear cuenta de acceso" action is not rendered for it, matching the existing `hasEmail` gate's behavior for any worker with no email

#### Scenario: No-email server guard is verified by direct invocation, not the UI
- **WHEN** the `create-worker-account` Edge Function is invoked directly (not through the browser) with `{ "workerId": 9003 }`
- **THEN** it rejects the request with its existing no-email-registered error, and no artifact in this change claims the normal UI can trigger this same request

### Requirement: Negative fixtures are documented and visibly identifiable
The system SHALL document, directly alongside the malformed-email and duplicate-email fixtures, why each exists, which account-provisioning branch it exercises, and that it does not represent valid production data. Each negative fixture SHALL be named so it is visually distinguishable from ordinary fixtures in the worker list.

#### Scenario: Negative fixture naming is unmistakable
- **WHEN** the malformed-email or duplicate-email worker fixtures are viewed in the workers list
- **THEN** their names clearly mark them as intentional negative test fixtures, not real workers

#### Scenario: Negative fixture intent is documented in the seed file
- **WHEN** the seed file is read directly
- **THEN** a comment directly above each negative fixture's insert explains its purpose and the specific account-provisioning check it is meant to exercise

### Requirement: Existing fixture data uses valid UI-supported enum values
The system SHALL ensure every seeded worker's `type_worker` value is one of the values the worker form actually offers (`Maestro`, `Administrativo`, `Contratacion`).

#### Scenario: Existing worker fixture corrected
- **WHEN** the existing worker 1 fixture (previously `type_worker = 'Docente'`) is loaded after this change
- **THEN** its `type_worker` value is `Maestro`, and opening it in the worker edit form shows a matched, non-blank selection

### Requirement: Auth/profile fixtures follow the existing safe local pattern, with a bounded idempotency guarantee
The system SHALL create any new Auth-linked worker fixture using the same local-only pattern already used for the seeded bootstrap admin (`auth.users` + `auth.identities` + `public.profiles`, deterministic UUIDs, deterministic fictitious passwords), without using a service-role key, calling any remote API, or modifying hosted Supabase. The guarantee this provides is repeatability across **clean** `supabase db reset` runs; it does NOT claim to safely reconcile these fixtures against arbitrary, already-diverged pre-existing local Auth state, and no new reconciliation system is introduced to attempt that.

#### Scenario: New Auth fixtures use only the existing local pattern
- **WHEN** the new Auth-linked worker fixtures (9001 and 9002) are seeded
- **THEN** they are created via direct `auth.users`/`auth.identities`/`public.profiles` inserts identical in shape to the existing bootstrap admin fixture, with no service-role key, Edge Function, or remote call involved

#### Scenario: Guarantee is scoped to clean resets
- **WHEN** the idempotency of the Auth fixtures is evaluated
- **THEN** it is evaluated across repeated **clean** `supabase db reset` runs; standalone re-execution of the seed against arbitrary pre-existing, already-diverged local Auth state is not claimed to be safe or supported by this change

### Requirement: Seed remains deterministic and idempotent under repeated clean resets
The system SHALL preserve the existing explicit-id, `ON CONFLICT DO UPDATE` seeding pattern so that repeated clean `supabase db reset` runs produce a database that is stable in every business-relevant respect, without requiring byte-for-byte identical rows.

Determinism is defined as: stable fixture ids; stable logical identities (email present/absent/malformed/duplicated exactly as designed per fixture); stable plaintext local credentials (the documented password continues to authenticate successfully); stable row counts for the fixtures this change owns; stable relationships (`worker_id` links, roles, foreign keys); and stable business-relevant values (`status`, `type_worker`, names, emails). Explicitly excluded from any equality comparison: values generated fresh on every run, specifically `now()`-derived timestamps and `gen_salt('bf')`-salted password-hash bytes, along with any other value intentionally generated as implementation metadata rather than fixture content.

#### Scenario: Repeated clean reset is safe
- **WHEN** `bunx supabase db reset` is run two or more times in succession
- **THEN** each run completes successfully, with no duplicate rows and no constraint errors, and the stable columns/relationships defined above are unchanged between runs

#### Scenario: Non-deterministic-by-design values are excluded from comparison
- **WHEN** verifying determinism across repeated resets
- **THEN** timestamps and password-hash bytes are not compared for equality — only the stable columns, relationships, and authentication behavior listed above are compared

### Requirement: Worker document fixtures are out of scope
The system SHALL NOT seed any `worker_documents` rows as part of this change, since a database row without a corresponding real Storage object would be an inconsistent, misleading fixture.

#### Scenario: No worker document rows are seeded
- **WHEN** the `worker_documents` table is queried after this change's seed runs
- **THEN** it contains no rows attributable to this change
