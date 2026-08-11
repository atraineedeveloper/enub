# Design: P0 database access hardening

## Authorization model

| Resource | Worker | Staff/Admin | Anonymous or invalid role |
| --- | --- | --- | --- |
| `roles` | Read rows linked to own `worker_id` | Full DML | Denied |
| `state_roles` | Denied | Full DML | Denied |
| Schedule tables | Read own `worker_id` rows | Full DML | Denied |
| `groups` / `semesters` | Authenticated read | Authenticated read + create | Denied |
| `utilities` | Authenticated read | Authenticated read + update | Denied |
| `worker_access_email_corrections` | Denied | Denied directly | Denied |
| Privileged helper/admin RPCs | Authenticated execution only; mutating RPCs enforce admin internally | As enforced by each RPC | Denied |

## Decisions

- RLS remains the row-authorization boundary; table grants expose only required authenticated DML operations.
- Existing worker-owned schedule SELECT policies remain unchanged.
- Schedule write policies use both `USING` and `WITH CHECK` for UPDATE.
- Shared catalog reads require authentication; catalog writes are limited to the exact operations used by staff/admin flows.
- Catalog sequence privileges are granted only when inserts need them; `utilities_id_seq` stays unavailable to clients because the application does not insert utilities.
- `worker_access_email_corrections` intentionally has no client policy. Its functions and direct table grant remain service-role-only.
- `current_app_role` and `current_worker_id` remain `SECURITY DEFINER` because RLS predicates depend on them without recursive profile-policy evaluation.
- `grant_staff_role`, `link_worker_account`, and `unlink_worker_account` remain callable by `authenticated`, because each function performs a null-safe admin-role check before mutation. Their inherited `PUBLIC` and `anon` grants are removed.
- Both security migrations perform preflight and postcondition checks and abort transactionally on catalog drift.

## Production synchronization

Migration `20260811151857_harden_authenticated_catalog_access` was applied to production after the initial P0 migration. This change versions that already-applied migration verbatim so the repository once again represents the production migration history. The synchronization must not re-run the migration against production.

## Rollback considerations

Restoring public policies or anonymous grants would recreate the vulnerability and is not a supported operational rollback. Functional regressions should be corrected by a forward migration that preserves the authorization model.
