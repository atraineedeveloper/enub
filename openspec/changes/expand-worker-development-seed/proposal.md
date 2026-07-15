## Why

`supabase/seed.sql` exists locally but is excluded from Git only through the clone-local `.git/info/exclude`, so it has no shared history and every developer starts from whatever they happen to have on disk. It also only seeds two workers, neither of which has an Auth account — so today there is no repeatable, local way to exercise account-linking, password-recovery, or "worker signs in and reaches `/my-documents`" without hand-creating fixtures by hand each time. This change brings the seed under version control and expands it with a small, deterministic set of worker scenarios needed to manually verify the existing worker-account and password-recovery features.

## What Changes

- Track `supabase/seed.sql` in Git: as local prep, optionally remove its line from this clone's `.git/info/exclude` (that file is per-clone and never distributed, so this step is not itself part of the portable change), then `git add -f supabase/seed.sql` once. Acceptance is based solely on `git ls-files supabase/seed.sql` returning the tracked path.
- Reserve a practical out-of-band worker-ID block (`9001`–`9007`) for new fixtures. Explicit-id inserts do not advance `workers_id_seq`, so the normal application-created worker sequence continues from `id = 3` as it does today. This avoids collision with a developer's own manually-created local worker for normal development use — it is not a claim that collision is mathematically impossible forever, since the natural sequence could in principle reach `9001` after thousands of local worker creations.
- Add seven new worker fixtures (ids `9001`–`9007`) covering: an email with an orphaned Auth user but no profile link, a fully linked worker who can actually log in (including exercising password recovery and `/my-documents`), a worker without an email, an inactive worker, a deliberately malformed email, and a deliberate duplicate-email pair (two fixtures). The "no schedule assignments" baseline scenario is already covered by the existing worker 2 fixture and needs no new row.
- Correct the existing worker fixture's `type_worker` from `'Docente'` (not a value the worker form's `<Select>` offers) to `'Maestro'` — a local fixture consistency fix, not a schema or business-rule change.
- Reuse the existing, already-proven `auth.users` + `auth.identities` + `public.profiles` seeding pattern (the same one that creates the bootstrap admin today) for the two new fixtures that need real Auth accounts. This guarantees repeatability across clean `db reset` runs; it does not claim to safely reconcile arbitrary pre-existing local Auth state against a future, evolved version of these fixtures.

**BREAKING**: none. This only touches local development seed data; no schema, migration, RLS policy, or production behavior changes.

## Capabilities

### New Capabilities
- `worker-development-seed`: the local-only worker/Auth/profile fixture set in `supabase/seed.sql`, its ID-block allocation strategy, and its idempotency/determinism guarantees under `supabase db reset`.

### Modified Capabilities
(none — no existing `openspec/specs/*` capability covers local seed data today)

## Impact

- `supabase/seed.sql` — expanded fixture set; becomes a tracked file.
- No migrations, no schema changes, no RLS changes, no Edge Function changes, no production data, no remote Supabase operations.
- No repository file other than `supabase/seed.sql` is impacted. `.git/info/exclude` is a clone-local, non-distributed file — removing its `seed.sql` line (optional local prep, not a required task) has no effect outside this developer's own clone and is never staged or committed.
