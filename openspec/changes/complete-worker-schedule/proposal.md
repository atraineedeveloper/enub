## Why

`/my-schedule` está deshabilitada: `src/pages/MySchedule.tsx` deliberadamente
renderiza solo un `<Heading>` placeholder en vez de `MyScheduleView`
(commit `098d83a`, el mismo día que se construyó la función completa en
`0963e62`). El código real (`MyScheduleView.tsx`, `WorkerScheduleGrid.tsx`,
`WorkerScheduleAgenda.tsx`, `workerScheduleEntry.ts`, `workerScheduleQuery.ts`,
`apiWorkerSchedule.ts`) ya existe, ya pasó varias rondas de auditoría
documentadas en el cambio archivado `2026-07-17-add-worker-schedule-and-profile`,
y ya está protegido por la migración
`20260716215631_schedule_ownership_rls_policies.sql` (aplicada en remoto).
Nunca se completaron sus dos tareas de verificación manual (1.7, 12.6), y la
página se quedó apagada.

Diagnóstico confirmado (ver conversación previa): el aislamiento entre
trabajadores es responsabilidad exclusiva de RLS
(`worker_id = current_worker_id()`), verificado ahora mismo con 23
aserciones pgTAP por tabla, ambas en verde contra Supabase local. El
aislamiento entre semestres es responsabilidad del filtro
`.eq("semester_id", ...)` y de la query key
(`["my-schedule", "assignments"/"activities", authUserId, workerId,
semesterId]`), nunca de RLS (por diseño: todas las filas del propio
trabajador, en cualquier semestre, son igualmente suyas). Ningún hook o
consulta administrativa (`useScheduleAssignments`, `useScheduleTeachers`,
`apiScheduleAssignments.ts`, `apiScheduleTeachers.ts`) es importado por el
módulo del trabajador.

## What Changes

- Restaurar `src/pages/MySchedule.tsx` para que renderice `<MyScheduleView />`
  en vez del heading placeholder. Ningún otro archivo del módulo
  (`WorkerScheduleGrid.tsx`, `WorkerScheduleAgenda.tsx`,
  `workerScheduleEntry.ts`, `workerScheduleQuery.ts`, `apiWorkerSchedule.ts`,
  la migración RLS) se modifica.
- Recrear `src/features/semesters/semesterDisplayLabel.ts`
  (`formatFriendlySemesterPeriod`/`formatSemesterPeriodWithCode`, construida
  y luego perdida en una sesión anterior) y usarla en el `<select>` de
  semestre de `MyScheduleView.tsx` (opciones y encabezado del periodo
  seleccionado), reemplazando el código crudo actual
  (`semester.semester` + `school_year`).
- Añadir únicamente las pruebas que realmente faltan: la utilidad de
  etiqueta recreada, y una prueba de que `MySchedule.tsx` monta la vista
  real (no el placeholder). El resto de la matriz de pruebas mínimas ya
  existe y pasa (aislamiento worker A/B en ambas fuentes, no mezcla de
  semestre, query keys con semestre+identidad, sin controles
  administrativos, sin reuso de sesión anterior, mobile sin scroll
  horizontal — cubierto por `workerScheduleQuery.test.ts`,
  `schedule_assignments_ownership_rls.test.sql`,
  `schedule_teachers_ownership_rls.test.sql`,
  `WorkerScheduleGrid.test.tsx`, `WorkerScheduleAgenda.test.tsx`).

## Non-goals

- No modificar `apiWorkerSchedule.ts`, `workerScheduleQuery.ts`,
  `workerScheduleEntry.ts`, `WorkerScheduleGrid.tsx`,
  `WorkerScheduleAgenda.tsx`, `WorkerScheduleLegend.tsx`,
  `WorkerScheduleUnspecified.tsx`, `schoolDayBlocks.ts`, ni la migración
  RLS ya aplicada.
- No reutilizar hooks ni consultas administrativas
  (`useScheduleAssignments`, `useScheduleTeachers`,
  `apiScheduleAssignments.ts`, `apiScheduleTeachers.ts`).
- No añadir ningún control de crear/editar/eliminar/arrastrar — la vista
  permanece estrictamente de solo lectura.
- No corregir en este cambio el riesgo de escritura abierta en
  `schedule_assignments`/`schedule_teachers` (ver "Riesgo pendiente"
  abajo) — es una decisión explícita, no un olvido.
- No ejecutar operaciones contra Supabase remoto ni archivar este cambio.

## Riesgo pendiente (documentado, no corregido aquí)

Las políticas INSERT/UPDATE/DELETE de `schedule_assignments` y
`schedule_teachers` siguen siendo `TO public USING (true)` /
`WITH CHECK (true)` — sin comprobación de propiedad. Cualquier sesión
autenticada (incluida una `worker`) puede insertar, editar o borrar filas
de cualquier otro trabajador vía el cliente Supabase directo, sin pasar
por `/my-schedule` (que es solo-lectura y no ejercita este camino). La
propia migración `20260716215631` lo deja documentado como deuda
intencional ("hardening them is a separate, definite follow-up"), heredada
del cambio archivado `2026-07-17-add-worker-schedule-and-profile`
("Fixed Follow-ups #3"). Requiere su propio cambio OpenSpec (full lane,
por tocar RLS/autorización), fuera del alcance de `complete-worker-schedule`.

## Capabilities

### Modified Capabilities

- `worker-schedule-viewing`: sin cambios de requisitos — el spec vigente
  (`openspec/specs/worker-schedule-viewing/spec.md`) ya describe el
  comportamiento objetivo con precisión; este cambio hace que el código ya
  conforme a ese spec sea efectivamente alcanzable en `/my-schedule`.

## Impact

- Código: `src/pages/MySchedule.tsx`,
  `src/features/schedules/MyScheduleView.tsx`,
  `src/features/semesters/semesterDisplayLabel.ts` (nuevo),
  `src/features/semesters/semesterDisplayLabel.test.ts` (nuevo),
  `src/pages/MySchedule.test.tsx` (nuevo).
- Base de datos: ninguna migración nueva; la ya aplicada
  (`20260716215631`) no se toca.
- Riesgo: bajo. Es una re-habilitación de código ya auditado más una
  utilidad de presentación pura, sin tocar autorización, RLS, ni consultas.
