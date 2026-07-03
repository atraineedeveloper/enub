-- One-time backfill: every auth.users row that exists at migration time and
-- has no profiles row yet is, by the current (pre-feature) app's own
-- behavior, a staff account -- there is no other kind of account yet. This
-- migration only encodes that existing fact explicitly so the new
-- deny-by-default RLS policies (see the preceding migrations in this
-- feature) don't lock legitimate existing users out.
--
-- This is a one-time snapshot, not an ongoing default: any auth.users row
-- created after this migration runs gets no profiles row and no access
-- until link_worker_account / grant_staff_role / manual admin bootstrap
-- gives it one. See decisions.md #7 and #18.

INSERT INTO "public"."profiles" ("id", "role", "worker_id")
SELECT "id", 'staff', NULL
FROM "auth"."users"
WHERE "id" NOT IN (SELECT "id" FROM "public"."profiles")
ON CONFLICT ("id") DO NOTHING;
