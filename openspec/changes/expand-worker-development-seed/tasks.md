## 1. Git tracking

- [ ] 1.1 *(Optional local prep)* Remove the `supabase/seed.sql` line from this clone's `.git/info/exclude` (leave the backup-SQL-file line untouched). This step is not required for acceptance.
- [ ] 1.2 `git add -f supabase/seed.sql` once the fixture expansion below is complete, and confirm `git ls-files supabase/seed.sql` returns the path. This is the sole acceptance criterion for git tracking.

## 2. Existing seed correction

- [ ] 2.1 Update worker 1's `type_worker` value in its existing `INSERT ... ON CONFLICT DO UPDATE` from `'Docente'` to `'Maestro'`.

## 3. Reserved fixture ID block (9001–9007)

- [ ] 3.1 Add a prominent comment at the top of the new fixture block explaining the reserved `9001`–`9007` range, that it is a practical (not absolute) safeguard, and that `workers_id_seq` must NOT be advanced to match it.
- [ ] 3.2 Insert worker 9001 (auth user exists, no profile): valid `.test` email, `status = 1`, `type_worker = 'Maestro'`.
- [ ] 3.3 Insert worker 9002 (fully linked): valid `.test` email, `status = 1`, `type_worker = 'Administrativo'`.
- [ ] 3.4 Insert worker 9003 (no email): `email = NULL`, `status = 1`, `type_worker = 'Contratacion'`.
- [ ] 3.5 Insert worker 9004 (inactive): valid `.test` email, `status = 0`, `type_worker = 'Maestro'`.
- [ ] 3.6 Insert worker 9005 (deliberate invalid email, named `FIXTURE NEGATIVO — ...`): email value with no `@` (fails `EMAIL_FORMAT_PATTERN`), `status = 1`, `type_worker = 'Administrativo'`, with a comment explaining its purpose.
- [ ] 3.7 Insert worker 9006 and worker 9007 (deliberate duplicate-email pair, both named `FIXTURE NEGATIVO — ...`): identical `.test` email on both, `status = 1`, distinct `type_worker` values, with a comment explaining their purpose.
- [ ] 3.8 Confirm the trailing `setval` for `workers_id_seq` still targets `2` (unchanged) and that no `setval` call for any other sequence was added for the 9001–9007 block.

## 4. Auth/profile fixtures for 9001 and 9002

- [ ] 4.1 Add `auth.users` + `auth.identities` rows for worker 9001's email, reusing the existing bootstrap-admin pattern (`crypt(..., gen_salt('bf'))`, deterministic UUID, `ON CONFLICT` upserts). No `public.profiles` row for 9001.
- [ ] 4.2 Add `auth.users` + `auth.identities` rows for worker 9002's email, same pattern, plus a `public.profiles` row with `role = 'worker'` and `worker_id = 9002`.
- [ ] 4.3 Confirm both new passwords are deterministic, fictitious, and documented in the seed file's header comment alongside the existing admin credential note.

## 5. Automated / local command checks

These run entirely from the command line or via direct SQL and require no browser and no manual Edge Function invocation.

- [ ] 5.1 Confirm `supabase/seed.sql` is tracked: `git ls-files supabase/seed.sql`.
- [ ] 5.2 Run `bunx supabase db reset` twice in succession; confirm both succeed with no errors.
- [ ] 5.3 After a clean reset, run a stable-columns query confirming: fixture ids 1, 2, 9001–9007 exist with their designed `email`/`status`/`type_worker` values; worker 9001 has a matching `auth.users`/`auth.identities` row and no `profiles` row; worker 9002 has a matching `auth.users`/`auth.identities` row and a `profiles` row with `role = 'worker'`, `worker_id = 9002`; worker 1 has ≥1 `schedule_assignments` row; worker 2 has zero `schedule_assignments` rows; workers 9006/9007 share one exact email. Do **not** compare `created_at`/`updated_at`/`email_confirmed_at`/`encrypted_password` byte values — only the stable columns/relationships above.
- [ ] 5.4 Repeat 5.3 after the second reset in 5.2 and confirm identical stable-column results (row counts unchanged, no duplicates) — again excluding timestamps/password-hash bytes from comparison.
- [ ] 5.5 Verify `workers_id_seq` by direct inspection after a clean reset: `SELECT last_value, is_called FROM public.workers_id_seq;` (or equivalent `pg_sequences` query) reports `last_value = 2`, `is_called = true`. Do not create-and-delete a probe worker through the application for this check.
- [ ] 5.6 Run `bunx supabase db lint`.
- [ ] 5.7 Run `bunx supabase test db --local`.
- [ ] 5.8 Run `bun run typecheck`.
- [ ] 5.9 Run `bun run lint`.
- [ ] 5.10 Run `bun run build`.
- [ ] 5.11 Run `bunx @fission-ai/openspec@1.6.0 validate "expand-worker-development-seed" --strict`.

## 6. Manual browser checks

These require a running dev server and a browser. None are satisfied by the SQL reset alone.

- [ ] 6.1 Verify the local administrator (`admin.local@enub.test`) can sign in.
- [ ] 6.2 Verify worker 9002 can sign in with its deterministic local password.
- [ ] 6.3 Verify worker 9002, once signed in, reaches the worker experience (`/my-documents` / `WorkerAppLayout`), not `/pending-access`.
- [ ] 6.4 Verify worker 9001 appears as a candidate for the existing "Vincular cuenta existente" (link-existing-account) path, and that completing that link succeeds. This intentionally mutates local state (creates a `profiles` row for 9001) — that mutation is expected and this test may be performed normally; restoring the canonical seeded state afterward is handled by the mandatory final reset in §8, not by this task.
- [ ] 6.5 Verify workers 1, 2, 9004, 9005, 9006, and 9007 (all have a non-empty, if sometimes intentionally invalid or duplicated, email and no linked profile) display the "Crear cuenta de acceso" action in the workers UI.
- [ ] 6.6 Verify worker 9003 (no email) appears in the workers list but does **not** display the "Crear cuenta de acceso" action — this is expected current UI behavior (`hasEmail` gate in `WorkerRow.tsx`), not a defect.
- [ ] 6.7 Verify worker 9004 (inactive) renders correctly wherever the current UI reflects worker status (e.g. "Inactivo" label in the workers list).
- [ ] 6.8 Verify the negative fixtures (9005, 9006, 9007) are visibly identifiable as such in the workers list (their `FIXTURE NEGATIVO` naming is visible, not hidden or truncated).
- [ ] 6.9 **Password-recovery flow for worker 9002** (remains incomplete until actually exercised): sign in as worker 9002 using the seeded password; sign out; from `/login`, use "¿Olvidaste tu contraseña?" to request recovery for worker 9002's email; verify the recovery email arrives in local Mailpit; verify its link targets `/set-password`; follow it and complete a new password; verify worker 9002 can sign in with the new password. This intentionally mutates worker 9002's password away from the seeded value — that mutation is expected and this test may be performed normally; restoring the canonical seeded password afterward is handled by the mandatory final reset in §8, not by this task.

## 7. Direct local API / Edge Function checks

These call the local Edge Functions directly (e.g. `supabase functions invoke`, or an equivalent direct HTTP call to the local Functions endpoint) — not through the browser — because no UI path reaches them for these fixtures. These calls may send a local invitation email or mutate local Auth/profile state; that is expected and these checks may be performed normally. Order them deliberately; restoring canonical state afterward is handled by the mandatory final reset in §8, not by these tasks individually.

- [ ] 7.1 Invoke `create-worker-account` directly with `{ "workerId": 9003 }` (no email) and confirm it is rejected with the existing no-email-registered error. Do not attempt this through the browser — no UI action can trigger it for this fixture.
- [ ] 7.2 Invoke `create-worker-account` directly with `{ "workerId": 9005 }` (malformed email) and confirm it is rejected with the existing malformed-email 400 guard.
- [ ] 7.3 Invoke `create-worker-account` directly with `{ "workerId": 9006 }` (or 9007) and confirm it is rejected with the existing duplicate-email-count 400 guard.

## 8. Final canonical-state restoration (mandatory, not optional cleanup)

Worker 9001's linking test (§6.4) and worker 9002's password-recovery test (§6.9) intentionally mutate the local database — that is expected, and those tests may be performed normally. However, this change is **not considered fully verified** until this final section is also completed. It must run after all mutating manual and direct-API checks above, and is required for completing the seed change — not an optional convenience step.

- [ ] 8.1 Run `bunx supabase db reset`.
- [ ] 8.2 Re-run the stable fixture assertions defined by this change and confirm every one of the following holds:
  - expected worker fixture ids (1, 2, 9001–9007) and row counts are present;
  - worker 9001 has its seeded `auth.users`/`auth.identities` row but **no** `public.profiles` row (the linking-flow test's profile from §6.4 is gone);
  - worker 9002 has its seeded `public.profiles` row with `role = 'worker'` and `worker_id = 9002` (still linked);
  - worker 9002's seeded local password (documented in the seed file) works again for sign-in (the recovery-flow test's replacement password from §6.9 no longer applies);
  - the local administrator's seeded password (`admin.local@enub.test` / the documented credential) still works for sign-in;
  - worker 9003 still has `email IS NULL`;
  - workers 9006 and 9007 still share the intended exact duplicate email;
  - worker 1 still has `type_worker = 'Maestro'`;
  - worker 2 remains the designated no-schedule-assignments baseline (zero `schedule_assignments` rows);
  - `workers_id_seq.last_value = 2`;
  - `workers_id_seq.is_called = true`.
- [ ] 8.3 Confirm that the state mutated by manual/API testing has been fully reverted by the reset: worker 9001 no longer carries the profile created during §6.4's linking test; worker 9002 no longer retains the password selected during §6.9's recovery test; no temporary, probe, or leftover test record remains anywhere in the database.
- [ ] 8.4 Do not mark this change complete until 8.1–8.3 all pass. This final reset and recheck is a required completion step, not optional cleanup.
