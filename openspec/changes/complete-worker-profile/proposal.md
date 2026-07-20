## Why

`/my-profile` mostraba deliberadamente una lista mínima de 8 campos
(`name, email, phone, type_worker, status, specialty, function_performed,
profile_picture`). El trabajador no podía consultar su RFC, domicilio,
plazas ni fechas de admisión — información que ya existe en el esquema y
que el propio trabajador tiene interés legítimo en ver de sí mismo, en
modo estrictamente de solo lectura.

Diagnóstico previo (ver conversación): `workers` ya tenía RLS correcta
(propia fila + staff/admin), verificada con `workers_rls.test.sql`. Pero
`sustenance_plazas` y `date_of_admissions` **no** — sus políticas SELECT
seguían siendo `"Enable read access for all users" USING (true)` sin
`TO`, heredadas del esquema base. Confirmado empíricamente (transacción
local con rollback, no solo lectura de políticas): una sesión `worker`
autenticada como el trabajador B podía leer las plazas y fechas de
admisión del trabajador A, y `anon` podía leer ambas tablas completas.
Ampliar la vista sin cerrar ese hueco primero habría expuesto ese defecto
a través de la nueva UI.

## What Changes

- **Migración RLS no aditiva** sobre `sustenance_plazas` y
  `date_of_admissions`: reemplaza la política abierta heredada por el
  mismo patrón staff/admin-todo + worker-propia-fila ya usado en
  `workers` y en `schedule_assignments`/`schedule_teachers`
  (`20260716215631`). Sigue el mismo esqueleto de precondición/DROP/
  CREATE/postcondición, con un helper `_replace_worker_relation_ownership_select_policy`
  paralelo al de horarios. INSERT/UPDATE/DELETE no se tocan (ya
  restringidos a staff/admin desde `update_worker_with_relations`).
- **Amplía `getMyWorkerProfile`** (`src/services/apiWorkers.ts`) a una
  única consulta con relaciones anidadas sobre `workers`
  (`sustenance_plazas(...)`, `date_of_admissions(...)`), con proyección
  explícita de columnas — nunca `select("*")` — confiando en RLS (no en
  un filtro de cliente) para ambas relaciones. No se crea ninguna RPC.
- **`workerProfileQuery.ts` no se modifica**: su infraestructura de query
  key/protección de identidad (`["my-worker-profile", authUserId,
  workerId]`, descarte de snapshots obsoletos) ya cumple exactamente lo
  necesario; el tipo `MyWorkerProfile` importado simplemente crece.
- **Nuevos helpers puros** en `workerProfileLabels.ts`: `parseCivilDate`
  (parseo manual de `"YYYY-MM-DD"` con validación real de calendario —
  años bisiestos por aritmética, días reales por mes — sin construir
  nunca un `Date`, para evitar el desplazamiento de día por zona horaria
  y para rechazar fechas inexistentes como `2024-04-31` en vez de
  aceptarlas por solo coincidir con el patrón de dígitos), `formatCivilDate`
  (construida sobre `parseCivilDate`), `sortSustenancePlazas` (orden por
  sostenimiento → plaza → clave de pago) y `sortDateOfAdmissions` (orden
  cronológico ascendente vía `parseCivilDate`, con `type` como desempate;
  una fecha inválida ordena al final igual que una fecha ausente) — todos
  deterministas, independientes del orden de retorno de la base de datos.
- **`MyProfileView.tsx`** gana las secciones: Datos personales (Nombre,
  RFC), Contacto (Correo, Teléfono), Domicilio (Calle, Colonia, Código
  postal, Ciudad, Estado), Información laboral (Especialidad, Función que
  desempeña, Estatus), Plazas y Fechas de admisión — estas dos últimas
  como listas de tarjetas apiladas, nunca tablas horizontales.
- `observations` permanece deliberadamente oculto en esta vista: es una
  nota administrativa interna, no información propia del trabajador. Se
  excluye tanto de la proyección de la consulta como del componente.

## Post-review fixes (bloqueantes de Codex)

Una revisión posterior encontró 3 hallazgos reales, corregidos en este
mismo cambio antes de desplegar:

1. **Helper `_replace_worker_relation_ownership_select_policy` sin
   `service_role` revocado.** La primera versión de la migración solo
   revocaba `PUBLIC`/`anon`/`authenticated`, dejando `service_role`
   (rol equivalente a superusuario para RLS, pero sujeto a GRANT/REVOKE
   de función igual que cualquier otro) con `EXECUTE` implícito. Se
   conserva el helper (no se elimina con `DROP FUNCTION`) porque existe
   una razón técnica comprobable para hacerlo: la cobertura de ejecución
   real en `worker_relation_ownership_rls_migration_drift.test.sql`
   (rechazo de tabla fuera del allow-list, rechazo de nombres de política
   no aprobados, aborto ante 7 escenarios de drift por tabla) necesita
   invocar la función real, no una reimplementación — exactamente el
   mismo criterio que ya justificaba conservar el helper hermano de
   horarios (`_replace_schedule_ownership_select_policy`). Se corrigió
   añadiendo el `REVOKE ALL ... FROM "service_role"` faltante; ahora
   ningún rol de aplicación (`PUBLIC`, `anon`, `authenticated`,
   `service_role`) puede ejecutar el helper — verificado con `throws_ok`
   (`42501`) para los tres roles reales.
2. **`formatCivilDate`/el orden de `date_of_admissions` no validaban
   calendario real.** Solo verificaban la forma `\d{4}-\d{2}-\d{2}` —
   `"2024-04-31"` (abril no tiene 31 días) pasaba como si fuera válida.
   Se extrajo `parseCivilDate`, fuente única de verdad para ambos
   consumidores, con años bisiestos por aritmética exacta
   (`año%4===0 && año%100!==0) || año%400===0`) y días reales por mes.
3. **Cobertura pgTAP insuficiente** para el comportamiento del helper y
   para la regresión de escritura. Se añadió
   `worker_relation_ownership_rls_migration_drift.test.sql` (70
   aserciones: ACL de los 4 roles, 7 escenarios de drift × 2 tablas, 5
   casos de rechazo del allow-list de nombres, camino exitoso) y se
   amplió cada uno de los dos archivos de ownership existentes con
   UPDATE/DELETE rechazados para `worker` (comportamiento silencioso —
   la cláusula `USING` sin `WITH CHECK` no lanza excepción, solo afecta
   cero filas — verificado comprobando que la fila queda intacta, no
   solo que "no lanza") y permitidos para staff/admin.

## Deployment order

Este cambio incluye una migración RLS no aditiva. Orden de despliegue
obligatorio, sin saltos:

1. **Auditoría** — revisar el diff final de la migración y de las 3
   suites pgTAP nuevas/ampliadas una vez más antes de continuar.
2. `bunx supabase db push --dry-run` contra el proyecto remoto vinculado.
3. Aplicar la migración remota (`bunx supabase db push`), solo tras
   revisar el resultado del dry-run.
4. **Verificar políticas y acceso remoto**: confirmar en el dashboard de
   Supabase (o vía SQL de solo lectura contra remoto) que
   `sustenance_plazas`/`date_of_admissions` tienen exactamente las 2
   políticas SELECT esperadas, que la función helper no es ejecutable por
   ningún rol de aplicación, y que INSERT/UPDATE/DELETE siguen intactos.
5. Push de la rama del frontend.
6. Preview de Vercel — confirmar que `/my-profile` carga sin errores
   contra el remoto ya migrado.
7. **Verificación manual** (ver tasks.md, pendiente — requiere sesión
   real con al menos dos trabajadores vinculados).
8. Merge — solo después de que 1–7 estén confirmados.

El orden importa: la migración (2–4) debe estar aplicada y verificada en
remoto **antes** de que el frontend nuevo (5–6) dependa de las relaciones
anidadas — si el frontend se desplegara primero, seguiría funcionando
igual (ya que `workers` ya tenía RLS correcta), pero las relaciones
anidadas devolverían filas de más hasta que la migración corra.

## Non-goals

- No se crea ninguna RPC de lectura — la consulta anidada sobre `workers`
  ya resuelve todo en una sola petición, con RLS como única autoridad.
- No se toca `workerScheduleQuery.ts`, `WorkerScheduleGrid.tsx`, ni
  ninguna parte del módulo de horario.
- No se modifica INSERT/UPDATE/DELETE de `sustenance_plazas`/
  `date_of_admissions`, ni la RPC `update_worker_with_relations`.
- No se añade ningún control de edición, carga de fotografía, ni acción
  administrativa — la vista sigue siendo estrictamente de solo lectura.
- No se expone `observations`, `id`, `worker_id` ni `created_at` en
  ningún punto de la vista del trabajador.

## Capabilities

### Modified Capabilities

- `worker-profile-viewing`: reemplaza el requisito de "solo la lista de
  8 campos" por un contrato ampliado (datos personales, RFC, contacto,
  domicilio, información laboral, plazas y fechas de admisión), añade
  requisitos de orden determinista de las relaciones y de formateo de
  fecha civil sin desplazamiento de zona horaria, y documenta
  explícitamente que `observations` se excluye a propósito. Ver
  `specs/worker-profile-viewing/spec.md` de este cambio para el delta
  completo.

## Impact

- Base de datos: nueva migración
  `20260721000000_worker_relation_ownership_select_policies.sql`.
- Código: `src/services/apiWorkers.ts`,
  `src/features/workers/workerProfileLabels.ts`,
  `src/features/workers/MyProfileView.tsx`. `workerProfileQuery.ts` sin
  cambios.
- Pruebas: 3 archivos pgTAP nuevos
  (`sustenance_plazas_ownership_rls.test.sql`,
  `date_of_admissions_ownership_rls.test.sql`,
  `worker_relation_ownership_rls_migration_drift.test.sql`), pruebas
  unitarias ampliadas en `apiWorkers.test.ts`, `workerProfileQuery.test.ts`,
  `workerProfileLabels.test.ts`, y nuevo `MyProfileView.test.tsx`.
- Riesgo: medio — migración RLS no aditiva sobre dos tablas en
  producción, mitigado con precondición/postcondición verificadas y
  cobertura pgTAP conductual + de catálogo antes de aplicar.
