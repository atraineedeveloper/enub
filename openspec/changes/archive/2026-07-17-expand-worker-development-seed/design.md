## Context

`supabase/seed.sql` is a 335-line, fully idempotent seed (`ON CONFLICT (id) DO UPDATE` against literal ids, no `TRUNCATE`/`DELETE`, trailing `setval()` calls) loaded by `supabase db reset`. It is currently excluded only via the clone-local `.git/info/exclude`, has no Git history, and seeds exactly two workers (ids 1, 2), neither with an Auth account. The bootstrap admin block already demonstrates a complete, working `auth.users` + `auth.identities` + `public.profiles` pattern that this change reuses verbatim for two new worker fixtures.

Two independent problems are being solved together because they both live in the same file and are naturally verified together: (1) the file has no version history, and (2) the fixture set is too thin to manually exercise the worker-account and password-recovery flows without hand-rolling data first.

## Goals / Non-Goals

**Goals:**
- Track `supabase/seed.sql` in Git.
- Add exactly the fixtures needed for the 8 required scenarios, reusing the existing idempotent-upsert pattern.
- Guarantee the reserved fixture ID block never advances the sequence the live application actually uses for new workers.
- Fix the one existing data-quality bug (`type_worker = 'Docente'`) blocking that row from being edited through the UI.

**Non-Goals:**
- No schema, migration, or RLS change of any kind.
- No worker-document fixtures (see "Documents" below).
- No change to `create-worker-account`, `resend-worker-access-link`, `link_worker_account`, or any Edge Function/RPC.
- No fix to `.git/info/exclude` for other clones — that file is inherently local-only; this change can only fix *this* clone's copy and document the situation for others.
- No new tooling, scripts, or dependencies for seeding.

## Decisions

### Git tracking: one-time forced add; local exclude cleanup is optional prep, not a deliverable

`.git/info/exclude` is per-clone, never distributed, and not itself version-controlled — it is not a repository file this change impacts, and no edit to it is part of the portable change. The plan:
1. As optional local preparation only, this developer's clone may have the `supabase/seed.sql` line removed from *its own* `.git/info/exclude`. This step is not required for the change to be acceptable — `git add -f` works regardless of whether the local exclude entry is removed first — and it has no effect on, and says nothing about, any other clone. The unrelated `supabase-backup-before-worker-documents.sql` exclusion is a separate, pre-existing backup artifact and must remain untouched regardless.
2. A one-time `git add -f supabase/seed.sql` is acceptable and sufficient to place the file under version control, whether or not step 1 was done first.
3. Other clones each carry their own independent `.git/info/exclude`. This change cannot fix them, does not attempt to, and does not need to: once tracked, `git diff`/`commit`/`pull` behave normally for the file everywhere regardless of any clone's local ignore entry (the ignore entry only ever suppressed *untracked*-file discovery, which stops applying once the file is tracked).
4. **Sole acceptance criterion**: `git ls-files supabase/seed.sql` returns the path after this change. There is no other pass/fail condition for this part of the change.

### Worker ID strategy: a reserved block that never touches `workers_id_seq`

This is the one place where the file's existing pattern ("every `setval` pins its table's sequence to the max literal id just inserted") must be **deliberately not followed** for `workers`.

Postgres identity/serial sequences only advance when a row is inserted *without* specifying the id (i.e. via `DEFAULT`, which calls `nextval()`). Inserting explicit literal ids `9001`–`9007` does **not** itself move `workers_id_seq` at all — the sequence is a separate object. Today's seed already ends with:
```sql
SELECT pg_catalog.setval('public.workers_id_seq', 2, true);
```
This line is left completely unchanged. The new fixtures (9001–9007) are inserted with explicit literal ids, exactly like ids 1 and 2 are today, and **no new `setval` call is added for `workers_id_seq`**. Net effect: after `db reset`, the next worker created through the app (`INSERT ... DEFAULT id` via `nextval()`) still receives `id = 3`, precisely as it does today — completely unaffected by the existence of rows at 9001–9007.

This is the opposite of the instinct the file's existing convention would suggest (match the sequence to the max id used), and is exactly why it needs an explicit comment at the point of use, not just in this design doc: a future contributor adding an 8th fixture and reflexively "fixing" the sequence to match would silently reintroduce the collision risk this change exists to avoid.

**Same principle applied to related tables**: none of the new fixtures get rows in `date_of_admissions`, `sustenance_plazas`, `roles`, `schedule_assignments`, or `schedule_teachers` (see "Related data" below), so no other sequence is touched by this change at all. If a future change ever does add a related row at a high explicit id for one of these fixtures, the same rule applies: insert the literal id, do not advance that table's sequence to match it.

**On the precision of the "no collision" claim**: `9001`–`9007` is a practical reserved local fixture range for normal day-to-day development, not a mathematical guarantee for all time. `workers_id_seq` genuinely continues from `3` after this change — that part is exact and mechanical. But because the sequence is never capped, a developer who creates thousands of workers by hand through the running application, in the same local database, without ever resetting it, could in principle eventually reach `id = 9001` and collide with a fixture row on the next `db reset`. This is expected to be effectively never encountered in ordinary local development (a `db reset` is the normal way to return to a clean state long before thousands of manual worker rows would accumulate), so the range is adopted as a practical, not absolute, safeguard. This document does not claim collision is impossible.

**Sequence verification method**: the sequence's state (`last_value`, `is_called`) SHALL be verified by direct inspection after a clean reset — e.g. `SELECT last_value, is_called FROM public.workers_id_seq;` (or the equivalent `pg_sequences` query) — expecting `last_value = 2` and `is_called = true`. This is preferred over creating an actual worker through the running application, asserting its id, then deleting it, because that approach leaves room for a leftover probe row if any step is skipped or fails partway. Direct sequence inspection requires no application interaction, leaves no residue, and is fully automatable. A probe-insert-and-delete is not required by this change; it is not precluded as a manual fallback if direct SQL inspection is ever unavailable to a given verifier, but if used, the probe row must be deleted immediately, verified deleted, and no other test data left behind.

### Existing seed correction: `Docente` → `Maestro`

`CreateEditWorkerForm.tsx`'s `type_worker` `<Select>` only offers `Maestro`, `Administrativo`, `Contratacion` — `'Docente'` (worker 1's current value) matches none of them, so opening that row in "Editar" renders an unmatched/blank select. There is no CHECK constraint enforcing this enum at the DB layer (by design — out of scope to add one here), so the bug is silent until someone opens the edit form. Fixed by changing the literal value in the existing `INSERT ... ON CONFLICT DO UPDATE` for worker 1 from `'Docente'` to `'Maestro'`. This is a one-value fixture correction, not a behavior change to any code path — the UI, RLS, and Edge Functions are untouched.

### Fixture matrix

| id | role in scenario list | email | status | type_worker | auth.users | auth.identities | profiles | related rows |
|----|---|---|---|---|---|---|---|---|
| 1 *(existing, corrected)* | #1 — valid email, no account, **has** schedule assignments | `maria.prueba@example.test` | 1 | `Maestro` (was `Docente`) | no | no | no | unchanged (`date_of_admissions`, `sustenance_plazas`, `roles`, `schedule_assignments` ×2) |
| 2 *(existing, unchanged)* | #2 — designated no-schedule-assignments baseline, verified by this specific id | `carlos.demo@example.test` | 1 | `Administrativo` | no | no | no | unchanged (zero `schedule_assignments` rows) |
| 9001 | #3 — orphaned Auth user, no profile | `auth-sin-perfil.local@enub.test` | 1 | `Maestro` | **yes** | **yes** | no | none |
| 9002 | #4 — fully linked, can sign in | `trabajador.vinculado.local@enub.test` | 1 | `Administrativo` | **yes** | **yes** | **yes**, `role='worker'`, `worker_id=9002` | none |
| 9003 | #5 — active, no email | `NULL` | 1 | `Contratacion` | no | no | no | none |
| 9004 | #6 — inactive, valid email, no account | `inactivo.local@enub.test` | **0** | `Maestro` | no | no | no | none |
| 9005 | #7 — deliberate invalid email | `trabajador-correo-invalido` *(no `@`, fails `EMAIL_FORMAT_PATTERN`)* | 1 | `Administrativo` | no | no | no | none |
| 9006 | #8a — duplicate-email pair, member A | `correo.duplicado.local@enub.test` | 1 | `Contratacion` | no | no | no | none |
| 9007 | #8b — duplicate-email pair, member B | `correo.duplicado.local@enub.test` *(same as 9006)* | 1 | `Maestro` | no | no | no | none |

Scenarios #1 and #2 from the required matrix are already satisfied by the two *existing* workers (once #1's `type_worker` is corrected) — no new rows needed for those two. Worker 2 is the **designated** fixture for the "no schedule assignments" scenario and is verified specifically by its stable id (`2`); it is not claimed to be the only worker with zero `schedule_assignments` rows — none of the new 9001–9007 fixtures get `schedule_assignments` rows either (see "Related data" below), so several fixtures happen to share that property. That is expected and does not violate this scenario's acceptance criteria, which are about worker 2 specifically, not about uniqueness across the whole table.

Names for 9001–9007 are clearly fictitious and, for the two negative fixtures (9005, 9006, 9007), prefixed `FIXTURE NEGATIVO —` so they are visually unmistakable in the workers list and cannot be mistaken for real data by a future reader. Comments directly above each negative fixture's `INSERT` explain: why it exists, which Edge Function branch it exercises (`create-worker-account`'s malformed-email 400 / duplicate-email-count 400), and that it must never be treated as valid production data.

**Related data**: per "do not populate every related table for every worker," none of 9001–9007 get `date_of_admissions`/`sustenance_plazas`/`roles`/`schedule_assignments`/`schedule_teachers` rows — none of the 8 required scenarios call for them. The two existing workers already provide both the "has schedule assignments" and "has no schedule assignments" coverage.

### Auth fixture safety

9001 and 9002 reuse the exact bootstrap-admin pattern: `extensions.crypt(<password>, extensions.gen_salt('bf'))` for `encrypted_password`, matching `auth.identities` row, `ON CONFLICT` upserts on both. New reserved UUIDs, following the existing single-repeated-digit style (admin is `11111111-...`): `22222222-2222-2222-2222-222222222222` (9001) and `33333333-3333-3333-3333-333333333333` (9002). Passwords are deterministic, local-only, `.test`-domain-paired, following the existing `<Word>Local123!` convention (e.g. `TrabajadorLocal123!` for 9002) — no service-role key, no remote call, no real credential anywhere.

### Auth idempotency: what is and isn't guaranteed

The bootstrap-admin pattern this change reuses is proven for the case it has always run under: a **clean** `supabase db reset`, which drops and rebuilds the entire local Postgres schema before `seed.sql` ever runs. Under that condition, the guarantee is exact: `ON CONFLICT (id) DO UPDATE` / `ON CONFLICT (provider_id, provider) DO UPDATE` against stable, hardcoded UUIDs (`22222222-...`, `33333333-...`) means repeated clean resets always converge to the same logical fixture set (same ids, same emails, same roles, same links, same working plaintext passwords).

This change does **not** claim the seed can be safely rerun standalone (e.g. via `psql -f supabase/seed.sql`) against arbitrary, already-diverged local Auth state — for example, a database where a developer previously manually changed one of these fixture's linked profile, or where a future revision of this file changes a fixture's email/provider identity out from under an existing row keyed by the same UUID. Reconciling arbitrary pre-existing state against an evolved fixture definition is a different, harder problem than repeatable clean-slate seeding, and is not attempted here. If a future revision changes a seeded worker's email or Auth identity, that revision is expected to document any manual reconciliation step a developer with pre-existing local state may need (e.g. a fresh `db reset`); this change does not build new reconciliation tooling to avoid that, since a clean reset is already the normal, supported way to pick up any seed change in this repository.

On every clean reset, the seed does refresh the Auth metadata fields that matter for local sign-in and confirmation to succeed (`encrypted_password`, `email_confirmed_at`, `raw_app_meta_data`, `raw_user_meta_data`, `updated_at` — mirroring exactly what the existing admin block already refreshes on conflict). It does not claim to refresh every conceivable Auth column, and it does not claim stale metadata beyond that set is impossible — only that the fields needed for the documented sign-in/verification scenarios in this change are kept correct across resets.

### Determinism, defined precisely

"Deterministic" and "idempotent" in this change do **not** mean byte-for-byte identical rows across resets. Two mechanisms in the reused pattern are intentionally non-repeating at the byte level:
- `now()` — used for `created_at`/`updated_at`/`email_confirmed_at`/`last_sign_in_at` — produces a different timestamp on every reset.
- `extensions.gen_salt('bf')` — used to hash each fixture's plaintext password — generates a fresh random salt every time the seed runs, so `encrypted_password` bytes differ across resets even though the plaintext password is always the same literal string.

What **is** guaranteed, and is what verification actually checks, across repeated clean resets:
- stable fixture ids (1, 2, 9001–9007, and the admin's fixed UUID);
- stable logical identities (the same email — or intentionally `NULL`, or an intentionally malformed string, or an intentionally duplicated string — per fixture);
- stable plaintext local credentials (the documented password for 9002 continues to authenticate successfully, even though the stored hash bytes differ);
- stable row counts for the fixtures this change owns (no accumulation of duplicate rows across repeated resets);
- stable relationships (`worker_id` links, `role` values, FK targets);
- stable business-relevant fixture values (`status`, `type_worker`, `email`, names);
- no constraint errors or failures on repeated resets.

Explicitly **excluded** from any equality check: generated timestamps, salted password-hash bytes, and any other value Postgres or GoTrue's own conventions generate fresh each run. Verification tasks compare these stable columns and observable behavior (row counts, relationships, successful authentication), never raw byte-for-byte row equality.

### No-email worker: UI absence is expected, server guard is verified separately

Worker 9003 (`email = NULL`) is a case the UI already handles correctly today: `WorkerRow.tsx` computes `hasEmail = Boolean(email?.trim())` and only renders the "Crear cuenta de acceso" action when `hasEmail` is true. Worker 9003 will therefore appear in the workers list like any other worker, but **without** that action — this is expected, current, pre-existing UI behavior, not something this change needs to fix or work around.

Because the UI provides no button to trigger the no-email case, the server-side guard (`create-worker-account`'s "este trabajador no tiene correo registrado" 400) cannot be exercised through the browser at all for this fixture. Verifying it therefore requires a **direct** invocation of the Edge Function (e.g. `supabase functions invoke create-worker-account --body '{"workerId": 9003}'`, or an equivalent direct HTTP call to the local Functions endpoint) — not a browser action. This is called out explicitly as a "direct local API/Edge Function check," distinct from the browser-verification tasks, precisely because no UI path reaches it.

### Documents: out of scope, and why

The `worker_documents` storage bucket is private; downloads go through signed URLs against real bytes in the Storage backend's file volume. `seed.sql` is plain SQL executed against Postgres — it cannot create the corresponding Storage object bytes. A `worker_documents` DB row with no real object behind it would list in the UI and then 404 the moment anyone tried to view/download it: an inconsistent, misleading fixture. A real fixture would require a separate, non-SQL upload mechanism (e.g. a script calling the Storage API) — explicitly out of scope for this change.

## Risks / Trade-offs

- **[Risk]** A future contributor adds an 8th worker fixture at, say, id `9008`, and — following the file's usual convention — also updates `workers_id_seq`'s `setval` to `9008`, silently reintroducing the exact collision this change avoids. → **Mitigation**: an explicit, prominent comment directly above the `workers_id_seq` `setval` line (and in this design doc) stating the sequence must stay pinned to the highest *naturally-numbered* worker id (currently 2), never to the fixture block's max.
- **[Risk, accepted]** The reserved block is a practical safeguard, not an absolute one: a local database that accumulates thousands of manually-created workers without ever being reset could theoretically reach `id = 9001`. → **Mitigation**: none beyond documentation — a `db reset` is the normal way to return to a clean local state long before that would happen, so this is accepted as a known, low-probability edge case rather than engineered around.
- **[Trade-off]** The id block leaves a visible "gap" (3–9000 unused) in the `workers` table when inspected directly. This is standard practice for a reserved fixture range and is documented at the top of the new fixture block.
- **[Risk]** Two workers sharing one literal email (9006/9007) could be mistaken for a real data-integrity bug by someone unfamiliar with this change. → **Mitigation**: `FIXTURE NEGATIVO` naming prefix plus an explanatory comment directly above the insert.
- **[Risk]** 9002's password, while fictitious, is a literal credential string committed to Git. → **Mitigation**: consistent with the already-committed admin password (`EnubLocal123!`), `.test`-domain-paired, documented as local-only fictitious data in the file's existing header comment — the established, accepted pattern in this repo.

## Migration Plan

1. *(Optional local prep)* Remove the `supabase/seed.sql` line from this clone's `.git/info/exclude`.
2. Correct worker 1's `type_worker` to `Maestro`.
3. Add the 9001–9007 fixture block (workers, plus `auth.users`/`auth.identities`/`profiles` only for 9001/9002), with the explicit "do not advance `workers_id_seq`" comment.
4. `git add -f supabase/seed.sql`, confirm tracked via `git ls-files supabase/seed.sql`.
5. No rollback complexity: reverting is a plain revert of the same commit; nothing outside `seed.sql` and the local exclude file changes.

## Open Questions

None. All decisions above (id block bounds, which fixtures get real Auth accounts, which get related-table rows, the Docente→Maestro correction) are treated as settled by this design, per the direction already given for this change.
