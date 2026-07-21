## 1. Database transaction

- [x] 1.1 Add an authorized transactional RPC with preserve/replace/clear semantics and admin/staff relational write policies.
- [x] 1.2 Add database regression tests for basic edits, relationship replacement/removal, authorization and rollback.
- [x] 1.3 Regenerate the Supabase TypeScript contract for the RPC.

## 2. Client integration

- [x] 2.1 Route existing-worker edits through the RPC and retain structured Supabase diagnostics with a safe user error.
- [x] 2.2 Submit relation sections only when they are dirty, while preserving explicit empty arrays.
- [x] 2.3 Add focused unit tests for relation-change selection, error sanitization and success/error toast behavior.

## 3. Verification

- [x] 3.1 Run OpenSpec validation, typecheck, lint, unit tests and build.
- [x] 3.2 Run Supabase lint and relevant local database tests when the local stack is available.
- [x] 3.3 Manually verify basic-only edit, plaza edit/removal, admission-date edit and toast behavior on the workers administration route.
