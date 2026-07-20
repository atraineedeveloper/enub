## Context

`/my-profile`'s field allow-list was deliberately minimal when first built
(`add-worker-schedule-and-profile`, archived): 8 fields, chosen
conservatively. The product now wants the worker's full useful record,
read-only. `workers` RLS was already correct (own-row + staff/admin,
`20260703002454`). `sustenance_plazas`/`date_of_admissions` were not:
still the base-schema `"Enable read access for all users" USING (true)`,
no `TO` clause. Verified empirically (a rolled-back local transaction, not
just policy text) before writing any migration: a `worker`-role session
belonging to worker B could read worker A's plaza/admission-date rows by
`worker_id`, and `anon` could read both tables in full.

## Decisions

**1. RLS migration mirrors `20260716215631_schedule_ownership_rls_policies.sql`
exactly**, not a new pattern: same guard+replace helper shape
(scope allow-list → policy-name allow-list → 3 preconditions → DROP →
2×CREATE → 6 postconditions), applied to `sustenance_plazas`/
`date_of_admissions` instead of `schedule_assignments`/`schedule_teachers`.
A new function, `_replace_worker_relation_ownership_select_policy`, is
created rather than reusing the schedule one, since that one's scope/name
allow-lists are hard-coded to its own two tables by design (defense in
depth against a crafted table/policy-name pair) — extending its allow-list
would weaken that guarantee for an unrelated migration.

**2. Nested-relations query over `workers`, no RPC.** Considered three
options (coordinated multi-query, `SECURITY INVOKER` RPC, nested select).
A `SECURITY INVOKER` RPC would rely on the exact same row-level policies
as a plain nested select — no additional guarantee — while adding a
function to maintain/grant/revoke for no functional gain, since this is a
straight FK-related read, not logic that needs server-side computation.
Nested select: one round trip, RLS enforced independently on `workers` and
on each embedded relation, matching the admin's own `getWorkersFull()`
precedent (`select("*, date_of_admissions(*), sustenance_plazas(*)")`) —
narrowed here to an explicit column list on every level, never `*`.

**3. `observations` stays excluded, explicitly.** Not a security boundary
(RLS is row-level; a worker's own client could already request it
directly) — a product decision: it is an internal administrative note
about the worker, not the worker's own information. Documented here so a
future contributor doesn't read the omission as an oversight.

**4. Deterministic ordering lives in `workerProfileLabels.ts`, not in the
query.** `sortSustenancePlazas` (sustenance → plaza → payment_key) and
`sortDateOfAdmissions` (chronological, `type` tie-break) are pure
functions applied after the fetch resolves, directly unit-testable without
mocking Supabase — consistent with this codebase's existing preference for
pure, tested comparators over relying on implicit query/DB return order
(`compareWorkerScheduleEntries`, `sortWorkersBySurname`,
`sortSemestersForSelector`). No `.order(..., { foreignTable })` is used on
the query itself; the post-fetch sort is the single source of truth for
display order, so "don't depend on DB return order" holds unconditionally,
not just "usually."

**5. `parseCivilDate` never constructs a `Date` object, and is the single
source of truth for calendar validity.** `new Date("2024-08-16")` parses
as UTC midnight; formatting it in any timezone behind UTC (all of Mexico)
renders the previous day — a real, well-known class of bug — and using
`Date` merely to VALIDATE (e.g. checking whether `new Date(2024, 3, 31)`
"rolled over" into May) carries the identical exposure. `parseCivilDate`
only does string/number arithmetic on the three regex-captured components
(`/^(\d{4})-(\d{2})-(\d{2})$/`) plus an explicit leap-year rule
(`year % 4 === 0 && year % 100 !== 0) || year % 400 === 0`) and a
per-month day-count table, so there is no timezone interpretation
anywhere in the code path, and a shape-valid but nonexistent date (e.g.
`"2024-04-31"`) is correctly rejected rather than accepted on regex shape
alone. Both `formatCivilDate` (display) and `sortDateOfAdmissions`'s
`dateKey` (ordering) call `parseCivilDate` — a review found the initial
version of `sortDateOfAdmissions` only checked digit shape, so an
invalid-but-shape-matching date would have sorted in-place instead of
last, alongside a genuinely missing date, as required.

**6. The migration's helper function is retained, not dropped, with a
verifiable technical justification.** The initial preference (stated by
the reviewer) was `DROP FUNCTION` at the end of the migration, since the
helper is migration-only. That was reconsidered because the requested
pgTAP coverage — rejecting a target_table outside the two-table
allow-list, rejecting an unapproved policy-name pair, aborting on any of
seven independent drift scenarios per table — can only be proven by
calling the REAL function; a test that reconstructs the guard logic from
scratch to work around a dropped function would be exactly the
"reimplemented approximation" this project's own sibling migration
(`20260716215631_schedule_ownership_rls_policies.sql`) explicitly avoids
by keeping ITS helper alive for the identical reason. The function is
therefore kept, exactly like its sibling, with the ACL fully closed
(`REVOKE ALL` from `PUBLIC`, `anon`, `authenticated`, AND `service_role` —
the first three were already revoked; `service_role` was the gap a review
found and this pass closes) so it carries zero production/application
invocable surface either way, verified directly in
`worker_relation_ownership_rls_migration_drift.test.sql` by attempting to
call it as each of the three real connectable roles and asserting a real
`permission denied` (`42501`), not merely the absence of a grant row.

## Deployment order

Este cambio incluye una migración RLS no aditiva sobre dos tablas con datos
en producción, por lo que el despliegue sigue un orden obligatorio, sin
saltos (repetido aquí, en `design.md`, además de en `proposal.md`, porque
es una decisión de diseño en sí misma: separa deliberadamente "aplicar la
migración" de "desplegar el frontend que depende de ella"):

1. **Auditoría** — revisar el diff final de la migración y de las 3 suites
   pgTAP nuevas/ampliadas una vez más antes de continuar.
2. `supabase db push --dry-run` contra el proyecto remoto vinculado.
3. Aplicar la migración remota (`supabase db push`), solo tras revisar el
   resultado del dry-run.
4. **Verificar políticas y acceso remoto**: confirmar que
   `sustenance_plazas`/`date_of_admissions` tienen exactamente las 2
   políticas SELECT esperadas, que el helper no es ejecutable por ningún
   rol de aplicación, y que INSERT/UPDATE/DELETE siguen intactos.
5. Push de la rama del frontend.
6. Preview de Vercel — confirmar que `/my-profile` carga sin errores
   contra el remoto ya migrado.
7. **Verificación manual** (sesión real con al menos dos trabajadores
   vinculados).
8. Merge — solo después de que 1–7 estén confirmados.

El orden importa por la misma razón que motiva la Decisión 1 (patrón
precondición/postcondición, fail-closed): si el frontend nuevo (pasos 5–6)
se desplegara antes de que la migración (pasos 2–4) esté aplicada y
verificada en remoto, las relaciones anidadas de `getMyWorkerProfile`
devolverían filas de más (la política heredada `USING (true)` seguiría
vigente) hasta que la migración corra — un estado intermedio inseguro que
este orden hace estructuralmente imposible.

## Risks / Trade-offs

- Migration touches two tables with existing (if incidentally-open) data
  in production. Mitigated by the exact same precondition-verified,
  fail-closed pattern already proven safe for `schedule_assignments`/
  `schedule_teachers`, plus new pgTAP coverage (behavioral + catalog) run
  locally before this is approved for a remote push.
- `sortSustenancePlazas`'s tie-break for two rows identical on all three
  sort keys falls back to `Array.sort`'s stability (input order) — no
  `id` is fetched for this view by design, so a true final tie-break isn't
  available. Accepted: this is a data-quality edge case, not a normal one,
  and re-adding `id` to the projection just for sorting would reintroduce
  the internal-identifier exposure this change explicitly avoids.
