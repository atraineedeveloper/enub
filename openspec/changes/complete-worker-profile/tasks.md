# Tasks

## 1. Migración RLS (sustenance_plazas, date_of_admissions)

- [x] 1.1 Verificar empíricamente el comportamiento actual (transacción
      local con rollback): confirmar que un worker puede leer plazas/fechas
      de otro trabajador y que `anon` puede leer ambas tablas completas.
- [x] 1.2 Crear
      `supabase/migrations/20260721000000_worker_relation_ownership_select_policies.sql`
      con el helper `_replace_worker_relation_ownership_select_policy`
      (precondición exacta de la política abierta, DROP, 2×CREATE,
      postcondiciones estructurales), siguiendo el patrón de
      `20260716215631_schedule_ownership_rls_policies.sql`.
- [x] 1.3 No modificar INSERT/UPDATE/DELETE de ninguna de las dos tablas.
- [x] 1.4 Aplicar localmente (`bunx supabase db reset`) y confirmar que
      `bun run supabase:lint` no reporta hallazgos sobre la función nueva.

## 2. Pruebas pgTAP

- [x] 2.1 `supabase/tests/database/sustenance_plazas_ownership_rls.test.sql`
      (20 aserciones): admin/staff ven todo (incluida fila `worker_id
      NULL`); worker A ve solo su fila; worker A no ve la de B ni la
      `NULL`; worker B simétrico; `anon` cero filas; sesión sin perfil
      cero filas; catálogo (política abierta ausente, exactamente 2
      políticas SELECT, formas exactas); INSERT/UPDATE/DELETE sin cambios
      (conductual: worker no puede insertar directo, admin sí).
- [x] 2.2 `supabase/tests/database/date_of_admissions_ownership_rls.test.sql`
      — misma cobertura, misma tabla espejo.
- [x] 2.3 Confirmar que `schedule_*_ownership_rls.test.sql` y
      `update_worker_with_relations.test.sql` siguen en verde (no se tocó
      nada de lo que dependen).

## 3. Consulta de datos

- [x] 3.1 `src/services/apiWorkers.ts`: ampliar `MyWorkerProfile` (+ nuevos
      `MySustenancePlaza`/`MyDateOfAdmission`) y el `.select()` de
      `getMyWorkerProfile` a una consulta anidada con proyección explícita
      — nunca `select("*")`, ni en `workers` ni en las relaciones
      embebidas. `.eq("id", id)` se conserva solo como filtro de fila.
- [x] 3.2 Confirmar que `workerProfileQuery.ts` no requiere cambios (el
      tipo importado crece, la query key/protección de identidad se
      reutiliza tal cual).

## 4. Helpers puros

- [x] 4.1 `workerProfileLabels.ts`: `formatCivilDate` (parseo manual de
      `"YYYY-MM-DD"`, sin `Date`, sin desplazamiento de zona horaria),
      `formatDateOfAdmissionValue`/`formatDateOfAdmissionType`.
- [x] 4.2 `sortSustenancePlazas` (sostenimiento → plaza → clave de pago) y
      `sortDateOfAdmissions` (cronológico, `type` como desempate) — ambos
      puros, inmutables, independientes del orden de entrada.

## 5. Interfaz

- [x] 5.1 `MyProfileView.tsx`: secciones Datos personales, Contacto,
      Domicilio, Información laboral, Plazas, Fechas de admisión —
      encabezados `<h2>` semánticos, `<dl>/<dt>/<dd>` para campos
      escalares, `<ul>/<li>` de tarjetas para plazas/fechas.
- [x] 5.2 Renombrar la etiqueta de estatus del trabajador a "Estatus"
      (antes "Estado", igual que el formulario admin) para no colisionar
      con "Estado" del domicilio.
- [x] 5.3 `observations` excluido del componente y de la consulta.
      `id`/`worker_id`/`created_at` nunca solicitados ni renderizados.
- [x] 5.4 Placeholder por campo vacío/null: "No registrado" (genérico),
      "Tipo no especificado" (tipo de trabajador y tipo de fecha),
      traducción de estatus existente, "Fecha no registrada" (fecha de
      admisión), mensajes de sección vacía para plazas/fechas.

## 6. Pruebas unitarias (frontend)

- [x] 6.1 `apiWorkers.test.ts`: proyección exacta de `.select()` (incluidas
      las dos relaciones embebidas con sus propias columnas explícitas),
      nunca `select("*")`, nunca `observations`/`created_at`/`worker_id`,
      filtro `.eq("id", ...)` exacto.
- [x] 6.2 `workerProfileQuery.test.ts`: fixture actualizado al contrato
      completo; confirma que la key/protección de identidad sigue intacta.
- [x] 6.3 `workerProfileLabels.test.ts`: `formatCivilDate` (12 meses, caso
      del desplazamiento de zona horaria explícitamente probado como
      ausente, valores malformados), orden determinista de plazas y
      fechas (mismo resultado sin importar el orden de entrada, valores
      nulos al final, no mutación), cero/una/múltiples relaciones.
- [x] 6.4 `MyProfileView.test.tsx` (nuevo): las 6 secciones renderizan;
      RFC y domicilio visibles; "Estatus"/"Estado" no colisionan;
      `observations` nunca aparece aunque esté presente en el objeto;
      placeholders por campo; cero/una/múltiples plazas y fechas
      (tarjetas, nunca `<table>`); fecha sin desplazamiento de día; árbol
      sin `<button>`/`<form>`/`<input>`/palabras de acción; estados de
      carga/fila-faltante/error distintos.

## 7. OpenSpec

- [x] 7.1 `proposal.md`, `design.md`, `tasks.md`.
- [x] 7.2 Delta de spec (`specs/worker-profile-viewing/spec.md`): allow-list
      ampliado, exclusión explícita de `observations`, orden determinista,
      formateo de fecha civil.

## 9. Correcciones post-revisión (hallazgos de Codex)

- [x] 9.1 Cerrar el hueco de ACL del helper: añadir el
      `REVOKE ALL ... FROM "service_role"` faltante (la primera versión
      solo revocaba `PUBLIC`/`anon`/`authenticated`). Conservar el helper
      (no `DROP FUNCTION`) por razón técnica comprobable: la cobertura de
      drift/allow-list de la tarea 9.2 necesita invocar la función real,
      igual que el patrón ya establecido para el helper hermano de
      horarios. Documentado explícitamente en la migración y en
      `design.md` §6.
- [x] 9.2 `supabase/tests/database/worker_relation_ownership_rls_migration_drift.test.sql`
      (70 aserciones, nuevo): ACL — `anon`/`authenticated`/`service_role`
      reciben `42501` real al intentar ejecutar el helper; 7 escenarios de
      drift × 2 tablas (política renombrada, cmd distinto, RESTRICTIVE,
      roles distintos, predicado distinto, política PERMISSIVE extra,
      política RESTRICTIVE extra) — cada uno verifica que la llamada real
      lanza, que el catálogo queda sin cambios respecto al estado
      mutado, y que ninguna política de reemplazo se creó parcialmente;
      camino exitoso por tabla; rechazo del allow-list de nombres de
      política (nombre arbitrario, nombres intercambiados, nombres de la
      otra tabla) y de tabla fuera del allow-list de 2 tablas.
- [x] 9.3 Ampliar `sustenance_plazas_ownership_rls.test.sql` y
      `date_of_admissions_ownership_rls.test.sql` (20→28 aserciones cada
      uno): UPDATE/DELETE de un worker sobre su propia fila no lanzan
      excepción (la cláusula `USING` sin `WITH CHECK` solo filtra filas
      candidatas) pero tampoco cambian nada — verificado comprobando que
      la fila queda intacta/sigue existiendo, no solo que "no lanza";
      UPDATE/DELETE administrativo (staff/admin) verificado con
      `RETURNING`-como-ROW_COUNT (exactamente 1 fila afectada) más una
      consulta posterior por `id` que confirma el valor cambiado /
      count(*) = 0, no solo `lives_ok`; INSERT sin cambios (ya cubierto).
- [x] 9.4 Extraer `parseCivilDate` (`workerProfileLabels.ts`) como fuente
      única de verdad para validación de calendario real: mes 1–12, días
      reales por mes, años bisiestos por aritmética exacta
      (`año%4===0 && año%100!==0) || año%400===0`), nunca un `Date`.
      `formatCivilDate` y el `dateKey` de `sortDateOfAdmissions` lo
      consumen — la versión previa de `sortDateOfAdmissions` solo
      verificaba la forma del patrón, así que `"2024-04-31"` habría
      ordenado en su lugar en vez de al final.
- [x] 9.5 Pruebas de `parseCivilDate`: 2024-02-29 válida, 2023-02-29
      inválida, 2024-02-30 inválida, 2024-04-31 inválida, 2024-04-30
      válida, 2000-02-29 válida, 1900-02-29 inválida, todo mes con su
      último día real, valores malformados, fecha inválida-pero-con-forma
      ordena al final en `sortDateOfAdmissions` (junto a null), sin
      mutación del arreglo.
- [x] 9.6 Documentar el orden de despliegue de 8 pasos en `proposal.md`
      (auditoría → dry-run → aplicar remoto → verificar políticas/acceso
      remoto → push de rama → preview de Vercel → verificación manual →
      merge).

## 10. Verificación

- [x] 10.1 `git diff --check` (sin conflictos de espacio en blanco)
- [x] 10.2 `bunx openspec validate complete-worker-profile --strict`
- [x] 10.3 `bun run typecheck`
- [x] 10.4 `bun run lint`
- [x] 10.5 Pruebas enfocadas: `apiWorkers.test.ts`,
      `workerProfileQuery.test.ts`, `workerProfileLabels.test.ts`,
      `MyProfileView.test.tsx`.
- [x] 10.6 `bun test src/features/workers src/services/apiWorkers.test.ts`
- [x] 10.7 `bun run build`
- [x] 10.8 `bun run supabase:lint`
- [x] 10.9 `bun run supabase:test`
- [ ] 10.10 Verificación manual en navegador (requiere sesión real con al
      menos dos trabajadores vinculados, con y sin plazas/fechas — no
      disponible en este entorno; pasos exactos en el reporte final).
