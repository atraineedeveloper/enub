# database-access-control Specification

## Requirement: Administrative records are not public

The database SHALL deny anonymous access to `roles` and `state_roles`. Authenticated `staff` and `admin` sessions SHALL retain full application DML access. A `worker` session MAY read only `roles` rows linked to its own `worker_id` and SHALL NOT access `state_roles`.

### Scenario: Anonymous role-table access

- **WHEN** an anonymous session attempts SELECT, INSERT, UPDATE, or DELETE on either administrative role table
- **THEN** the database denies the operation.

### Scenario: Assisted administration remains available

- **WHEN** a valid staff or admin session manages role records
- **THEN** the operation is permitted by database policy.

## Requirement: Schedule writes require a staff or admin role

The database SHALL permit INSERT, UPDATE, and DELETE on `schedule_assignments` and `schedule_teachers` only when `current_app_role()` resolves to `staff` or `admin`.

### Scenario: Worker attempts a schedule write

- **WHEN** an authenticated worker attempts to create, update, or delete any schedule row
- **THEN** the database denies the write independently of frontend routing.

### Scenario: Staff manages schedules

- **WHEN** an authenticated staff or admin session performs the same write
- **THEN** the operation is permitted.

### Scenario: Worker reads own schedule

- **WHEN** an authenticated worker queries either schedule table
- **THEN** existing ownership policies continue to return only rows linked to that worker.

## Requirement: Email-correction state is service-role-only

The database SHALL enable RLS on `worker_access_email_corrections`, SHALL grant no direct access to `PUBLIC`, `anon`, or `authenticated`, and SHALL expose no client RLS policy.

### Scenario: Client attempts direct access

- **WHEN** an anonymous or authenticated client queries or mutates the correction table
- **THEN** the database denies the operation.

### Scenario: Trusted correction workflow runs

- **WHEN** the service-role-only correction workflow accesses the table
- **THEN** it continues to operate through its explicitly granted functions and privileges.

## Requirement: Privileged functions are not anonymously executable

The database SHALL revoke `EXECUTE` from `PUBLIC` and `anon` on `current_app_role`, `current_worker_id`, `grant_staff_role`, `link_worker_account`, and `unlink_worker_account`.

### Scenario: Anonymous RPC invocation

- **WHEN** an anonymous caller invokes any protected function through the Data API
- **THEN** PostgreSQL rejects execution.

### Scenario: Authenticated administrative RPC invocation

- **WHEN** an authenticated caller invokes an administrative RPC
- **THEN** PostgreSQL permits invocation and the function's internal admin-role guard determines whether the mutation proceeds.
