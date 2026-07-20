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

Diagnóstico confirmado: el aislamiento entre trabajadores es responsabilidad
exclusiva de RLS (`worker_id = current_worker_id()`), verificado con 23
aserciones pgTAP por tabla, ambas en verde contra Supabase local. El
aislamiento entre semestres es responsabilidad del filtro
`.eq("semester_id", ...)` y de la query key
(`["my-schedule", "assignments"/"activities", authUserId, workerId,
semesterId]`), nunca de RLS. Ningún hook o consulta administrativa
(`useScheduleAssignments`, `useScheduleTeachers`, `apiScheduleAssignments.ts`,
`apiScheduleTeachers.ts`) es importado por el módulo del trabajador.

### Revisión visual posterior

Una vez restaurada la página, una verificación visual encontró que el
horario del trabajador y el horario administrativo ("Horario del Maestro",
la pestaña equivalente porque ambas combinan clases y actividades de UN
trabajador) eran **dos estructuras visuales independientes**: contenedores,
encabezados, filas, celdas y presentación de contenido distintos, aun
compartiendo los mismos tokens de color institucionales. Compartir color no
era suficiente. Causa raíz: el módulo del trabajador se construyó desde
cero (mismo commit `0963e62`) sin comparar su resultado renderizado contra
el `<div role="table">`/CSS-grid propio del admin
(`ShowScholarSchedule.tsx`/`ShowTeacherSchedule.tsx`/
`RowScholarSchedule.tsx`/`RowTeacherSchedule.tsx`), que nunca tuvo
componentes de forma reutilizables — cada tabla admin duplicaba sus propios
`Table`/`TableHeader`/`TableRow`/`LongRow`.

## What Changes

- Restaurar `src/pages/MySchedule.tsx` para que renderice `<MyScheduleView />`.
- Recrear `src/features/semesters/semesterDisplayLabel.ts`
  (`formatFriendlySemesterPeriod`/`formatSemesterPeriodWithCode`) y usarla
  en el selector de semestre de `MyScheduleView.tsx`.
- **Extraer una fuente única real de estructura de tabla**
  (`src/features/schedules/scheduleTableLayout.tsx`:
  `ScheduleTable`/`ScheduleTableHeader`/`ScheduleBlockRow`/
  `ScheduleRecessRow`/`ScheduleDividerRow`/`ScheduleCell`) y de contenido de
  celda (`src/features/schedules/scheduleCellContent.tsx`:
  `ScheduleEntryContent`), implementada como una tabla semántica real
  (`<table>/<thead>/<th scope>/<td>`) pero estilada para verse
  pixel-equivalente al `<div role="table">` que el admin ya tenía —
  mismos anchos de columna, paddings, bordes, alineación y ausencia de
  fondo especial en receso.
- **Migrar los cuatro archivos administrativos que renderizan la tabla**
  (`RowScholarSchedule.tsx`, `RowTeacherSchedule.tsx`,
  `ShowScholarSchedule.tsx`, `ShowTeacherSchedule.tsx`) a esos componentes
  compartidos, eliminando sus `Table`/`TableHeader`/`TableRow`/`LongRow`/
  `LongRowComplete` locales y duplicados.
- **Migrar la presentación de contenido de las tres celdas CRUD**
  (`HourScheduleSubject.tsx`, `HourScheduleSubjectGroup.tsx`,
  `HourScheduleTeacher.tsx`) a `ScheduleEntryContent`, conservando sus
  `Modal`/`ActionButton`/`ConfirmDelete`/hooks de mutación exactamente
  como estaban — solo cambia cómo se pinta el texto, nunca la lógica de
  creación/edición/eliminación.
- **Reescribir `WorkerScheduleGrid.tsx`** para consumir los mismos
  componentes compartidos, eliminando `EntryChip`/`CellEntries`/
  `Caption`/columna "Hora" visible propias — y eliminar
  `WorkerScheduleLegend.tsx` (leyenda de color ya sin sentido: el
  contenido ya no usa fondos de color, solo texto "Clase —"/"Actividad —").
- **Bloque 17:00–19:00 condicional**: `schoolDayBlocks.ts` reemplaza la
  constante estática `WORKER_SCHEDULE_DAY_BLOCKS` por la función pura
  `getWorkerScheduleDayBlocks(entries)`, que solo incluye ese bloque
  cuando `entries.some(e => e.startTime === "17:00:00")` — el mismo
  criterio que ya usaba `RowTeacherSchedule.tsx`'s `hasExtraHours`. El
  divisor "HORARIO EXTRACURRICULAR" acompaña esa fila condicionalmente en
  ambas vistas, vía `hasExtracurricularBlock(blocks)`.
- **Etiquetas "Clase"/"Actividad" compartidas y no dependientes del
  color**: integradas discretamente en el texto (`"Clase — MATEMÁTICAS"`,
  `"Actividad — Guardia"`) por el mismo componente `ScheduleEntryContent`
  en ambas vistas — nunca solo un color de fondo.
- Corrección de una etiqueta de día incorrecta descubierta al migrar:
  `src/helpers/constants.ts`'s `WEEKDAYS` tenía `"Miercoles"` sin acento
  como `label` (visible); el admin lo mostraba correctamente acentuado
  ("Miércoles") de forma hardcodeada. Se corrige la constante compartida
  para no introducir una regresión ortográfica al migrar el admin a
  consumirla.

## Non-goals

- No modificar `apiWorkerSchedule.ts`, `workerScheduleQuery.ts`,
  `workerScheduleEntry.ts` (normalización/partición/orden), la migración
  RLS, ni `WorkerScheduleAgenda.tsx` (agenda móvil intacta: el admin no
  tiene alternativa móvil usable con la que igualar, así que la paridad
  estructural exacta aplica solo a escritorio).
- No reutilizar hooks ni consultas administrativas
  (`useScheduleAssignments`, `useScheduleTeachers`,
  `apiScheduleAssignments.ts`, `apiScheduleTeachers.ts`) desde el módulo
  del trabajador.
- No añadir ningún control de crear/editar/eliminar/arrastrar en el árbol
  del trabajador — ni oculto por CSS: `scheduleTableLayout.tsx` y
  `scheduleCellContent.tsx` solo renderizan `children`/`renderCell`, sin
  ninguna rama interna que pudiera producir un control; el árbol del
  trabajador nunca importa `Modal`/`ActionButton`/`ConfirmDelete`, así que
  no hay nada que ocultar.
- Los componentes CRUD administrativos (`HourScheduleSubject.tsx`,
  `HourScheduleSubjectGroup.tsx`, `HourScheduleTeacher.tsx`) conservan
  intactas sus mutaciones, hooks y reglas institucionales (receso fijo,
  "Homenaje/Tutoría" para `totalHours === 40`, validación de conflictos) —
  solo cambia cómo pintan su texto.
- No corregir en este cambio el riesgo de escritura abierta en
  `schedule_assignments`/`schedule_teachers` (ver "Riesgo pendiente"
  abajo).
- No ejecutar operaciones contra Supabase remoto ni archivar este cambio.

## Riesgo pendiente (documentado, no corregido aquí)

Las políticas INSERT/UPDATE/DELETE de `schedule_assignments` y
`schedule_teachers` siguen siendo `TO public USING (true)` /
`WITH CHECK (true)` — sin comprobación de propiedad. Cualquier sesión
autenticada (incluida una `worker`) puede insertar, editar o borrar filas
de cualquier otro trabajador vía el cliente Supabase directo, sin pasar
por `/my-schedule` (que es solo-lectura y no ejercita este camino).
Requiere su propio cambio OpenSpec (full lane, por tocar RLS/autorización),
fuera del alcance de `complete-worker-schedule`.

## Capabilities

### Modified Capabilities

- `worker-schedule-viewing`: se añade el requisito de que la presentación
  de escritorio comparta la estructura presentacional real con el horario
  administrativo (no solo "lenguaje visual" — contenedor, encabezado,
  filas de bloque, filas de receso, fila divisora y presentación de
  contenido son los mismos componentes, importados por ambas vistas), que
  la única diferencia entre ambos modos sean las acciones administrativas
  (ausentes por completo del árbol del trabajador, no ocultas), que la
  agenda móvil queda exenta de esa paridad por no existir un equivalente
  administrativo usable, y que el bloque 17:00–19:00 (con su divisor) sea
  condicional a la existencia de al menos una entrada que inicie a esa
  hora — nunca una fila fija. Ver
  `openspec/changes/complete-worker-schedule/specs/worker-schedule-viewing/spec.md`
  para el delta completo.

## Impact

- Código nuevo: `src/features/schedules/scheduleTableLayout.tsx`,
  `src/features/schedules/scheduleCellContent.tsx`,
  `src/features/semesters/semesterDisplayLabel.ts`.
- Código modificado — trabajador: `src/pages/MySchedule.tsx`,
  `src/features/schedules/MyScheduleView.tsx`,
  `src/features/schedules/WorkerScheduleGrid.tsx`,
  `src/features/schedules/schoolDayBlocks.ts`.
- Código modificado — administrador (solo forma/presentación, cero cambio
  de mutaciones/hooks/reglas institucionales):
  `src/features/schedules/RowScholarSchedule.tsx`,
  `src/features/schedules/RowTeacherSchedule.tsx`,
  `src/features/schedules/ShowScholarSchedule.tsx`,
  `src/features/schedules/ShowTeacherSchedule.tsx`,
  `src/features/schedules/HourScheduleSubject.tsx`,
  `src/features/schedules/HourScheduleSubjectGroup.tsx`,
  `src/features/schedules/HourScheduleTeacher.tsx`,
  `src/helpers/constants.ts` (corrección de acento en "Miércoles").
- Eliminado: `src/features/schedules/WorkerScheduleLegend.tsx` (leyenda de
  color obsoleta tras retirar los chips coloreados).
- Base de datos: ninguna migración nueva; la ya aplicada
  (`20260716215631`) no se toca.
- Riesgo: medio — toca 7 archivos administrativos en producción, mitigado
  con pruebas de regresión dedicadas (`RowScholarSchedule.test.tsx`,
  `RowTeacherSchedule.test.tsx`, `ShowSchedule.test.tsx`) y una prueba de
  paridad estructural directa admin↔trabajador
  (`scheduleAdminWorkerParity.test.tsx`) que renderiza ambas vistas con
  datos equivalentes y compara su salida real, no solo el código fuente.
