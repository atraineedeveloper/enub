# Deployment gates

1. Verify final CI and migration inventory. Remote history includes 20261109232145 prevent_duplicate_school_groups not present in main inventory; exact applied SQL recovered and restored to branch; verify final CI and matching migration history before any database push. Never fabricate history or use migration repair.
2. Confirm recoverable backup in Supabase dashboard and an agreed maintenance window. No backup creation or restore verified by this session.
3. Apply identity repair separately with transactional table locks; recalculate next IDs, compare row counts, never lower allocator. Verify all four next IDs exceed maximum existing IDs without calling nextval.
4. Apply atomic creation and relation/photo policy migrations in order after approval. Verify function privileges and policies, then deploy compatible frontend. Avoid preview mutation against production before RPC installed.
5. Smoke-test using approved synthetic records in isolated environment: staff creates/edits, invalid input rolls back, worker cannot mutate photos, staff can remove via Storage API (not SQL), existing photos remain visible. Do not delete the two unreferenced production photos until provenance reviewed.
6. Check logs/advisors, document remaining institutional uniqueness decisions and reconcile ambiguous photo uploads. Retain rollback plan; do not rewind sequences or delete production data.
