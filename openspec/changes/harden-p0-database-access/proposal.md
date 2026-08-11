# Change: Harden P0 database access

## Why

Legacy RLS policies and broad grants allowed anonymous/public writes to schedule tables and unrestricted access to administrative role tables. The internal worker email-correction table also lacked RLS, and several privileged helper/RPC functions inherited execution by anonymous callers.

## What changes

- Replace public policies on `roles`, `state_roles`, `schedule_assignments`, and `schedule_teachers` with authenticated, role-aware policies.
- Preserve worker-owned schedule reads and worker-owned `roles` reads.
- Preserve staff/admin administration of role and schedule records.
- Enable RLS on `worker_access_email_corrections` while keeping it service-role-only.
- Remove anonymous table and privileged-function access.
- Add catalog-level regression tests for policies, grants, and function ACLs.

## Impact

The staff application keeps its current capabilities. Workers keep access to their own schedules and role records. Anonymous sessions, sessions without a valid profile role, and unrecognized roles cannot read or mutate the protected records.
