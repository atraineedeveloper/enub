# Tasks

## 1. Etiqueta amigable de semestre (recreada)

- [x] 1.1 Recrear `src/features/semesters/semesterDisplayLabel.ts`
      (`formatFriendlySemesterPeriod`, `formatSemesterPeriodWithCode`),
      reutilizando `parseSemesterCode`/`formatSemesterCode` de
      `nextSemesterCode.ts` — sin identificador interno alterado.
- [x] 1.2 Cubrir con pruebas unitarias (términos A/B, formato legado
      `YYYY-A`, minúsculas, valores nulos/vacíos, código no parseable).
- [x] 1.3 Usar `formatSemesterPeriodWithCode` en las opciones del
      `<select>` de `MyScheduleView.tsx`.

## 2. Restaurar la página real

- [x] 2.1 `src/pages/MySchedule.tsx`: renderizar `<MyScheduleView />` en
      vez del heading placeholder.
- [x] 2.2 Añadir una prueba de que `MySchedule.tsx` monta `MyScheduleView`
      (no el placeholder anterior).

## 3. Paridad estructural con el horario administrativo (revisión visual)

- [x] 3.1 Inspeccionar el DOM/CSS real de `HourScheduleSubject.tsx`,
      `HourScheduleSubjectGroup.tsx`, `HourScheduleTeacher.tsx`,
      `RowScholarSchedule.tsx`, `RowTeacherSchedule.tsx`,
      `ShowScholarSchedule.tsx`, `ShowTeacherSchedule.tsx` y documentar las
      8 diferencias concretas encontradas (encabezado/columna "Hora",
      alturas/bordes/fondos, tarjetas vs. texto plano, alineación,
      recesos, texto largo, fila 17:00–19:00 incondicional, ausencia de
      etiquetas "Clase"/"Actividad" en admin).
- [x] 3.2 Crear `src/features/schedules/scheduleTableLayout.tsx`
      (`ScheduleTable`, `ScheduleTableHeader`, `ScheduleBlockRow`,
      `ScheduleRecessRow`, `ScheduleDividerRow`, `ScheduleCell`) como
      tabla semántica real, estilada pixel-equivalente al
      `<div role="table">` que tenía el admin (mismos 6 anchos de columna
      iguales, paddings, bordes, alineación centrada, receso sin fondo
      especial, primera celda de encabezado visualmente vacía con "Hora"
      accesible vía texto visualmente oculto).
- [x] 3.3 Crear `src/features/schedules/scheduleCellContent.tsx`
      (`ScheduleEntryContent`) — presentación de contenido compartida:
      "Clase — MATERIA" (materia en mayúsculas, igual que el admin ya
      hacía) / "Actividad — texto", línea secundaria (grupo o maestro)
      igual en ambos modos, y una ranura `children` opcional solo para las
      acciones administrativas (el trabajador nunca la usa).
- [x] 3.4 `schoolDayBlocks.ts`: reemplazar la constante estática
      `WORKER_SCHEDULE_DAY_BLOCKS` por `getWorkerScheduleDayBlocks(entries)`
      — el bloque 17:00–19:00 solo se incluye cuando
      `entries.some(e => e.startTime === "17:00:00")`, igual que el
      `hasExtraHours` que ya usaba `RowTeacherSchedule.tsx`. Añadir
      `hasExtracurricularBlock(blocks)` para decidir el divisor "HORARIO
      EXTRACURRICULAR" en ambas vistas.
- [x] 3.5 Reescribir `WorkerScheduleGrid.tsx` para consumir los
      componentes compartidos; eliminar `EntryChip`/`CellEntries`/chips
      coloreados. Eliminar `WorkerScheduleLegend.tsx` (ya sin sentido, sin
      fondos de color que explicar) y su uso en `MyScheduleView.tsx`.
- [x] 3.6 Migrar `HourScheduleSubject.tsx`, `HourScheduleSubjectGroup.tsx`,
      `HourScheduleTeacher.tsx` a `ScheduleEntryContent` para el texto,
      conservando intactas sus mutaciones/hooks/`Modal`/`ActionButton`/
      `ConfirmDelete`.
- [x] 3.7 Migrar `RowScholarSchedule.tsx` y `RowTeacherSchedule.tsx` a
      `ScheduleBlockRow`/`ScheduleRecessRow`/`ScheduleDividerRow`,
      preservando la celda fija "Homenaje / Tutoria" (escolar) y la
      reserva "Homenaje / Tutoría" por `totalHours === 40` (maestro) sin
      cambios de comportamiento.
- [x] 3.8 Migrar `ShowScholarSchedule.tsx` y `ShowTeacherSchedule.tsx` a
      `ScheduleTable`/`ScheduleTableHeader`.
- [x] 3.9 Corregir `src/helpers/constants.ts`'s `WEEKDAYS` (`"Miercoles"`
      → `label: "Miércoles"`) — el admin mostraba el acento correcto de
      forma hardcodeada; la constante compartida no lo tenía, lo que
      habría introducido una regresión ortográfica visible al migrar el
      admin a consumirla.
- [x] 3.10 Actualizar `openspec/specs/worker-schedule-viewing/spec.md` vía
      delta (`specs/worker-schedule-viewing/spec.md` de este cambio):
      estructura presentacional compartida en escritorio, diferencia
      exclusiva de acciones, agenda móvil exenta, bloque extracurricular
      condicional, etiquetas de clase/actividad no dependientes del color.

## 4. Pruebas

- [x] 4.1 `scheduleTableLayout.test.tsx` — secuencia de días exacta,
      recesos (colSpan=5, sin fondo especial), fila divisora (colSpan=6),
      celda vacía sin contenido implícito, texto largo sin desbordamiento
      (`overflow-wrap: break-word` verificado vía `ServerStyleSheet` sobre
      CSS real, no solo el HTML).
- [x] 4.2 `scheduleCellContent.test.tsx` — "Clase —"/"Actividad —",
      mayúsculas solo en clase, línea secundaria opcional, `children`
      (acciones) solo quando se pasan explícitamente.
- [x] 4.3 `schoolDayBlocks.test.ts` — actualizado a
      `getWorkerScheduleDayBlocks`/`hasExtracurricularBlock`: 6 filas sin
      entrada a las 17:00, 7 filas con ella, orden cronológico en ambos
      casos.
- [x] 4.4 `WorkerScheduleGrid.test.tsx` — actualizado (mayúsculas en
      contenido de clase) + nuevas: bloque 17:00 condicional, etiquetas
      compartidas, múltiples entradas en una celda, árbol sin
      botón/formulario/palabras de acción administrativa.
- [x] 4.5 `RowScholarSchedule.test.tsx` (nuevo, regresión admin) — celda
      fija "Homenaje / Tutoria", recesos, secuencia de bloques, control
      "Agregar horario" intacto, celda ocupada con "Clase —" + editar/
      eliminar.
- [x] 4.6 `RowTeacherSchedule.test.tsx` (nuevo, regresión admin) — reserva
      "Homenaje / Tutoría" por `totalHours===40`, bloque 17:00 condicional
      con divisor, "Clase —"/"Actividad —" + editar/eliminar, múltiples
      asignaciones en una celda.
- [x] 4.7 `ShowSchedule.test.tsx` (nuevo, regresión admin, smoke) —
      `ShowScholarSchedule`/`ShowTeacherSchedule` renderizan selector +
      tabla compartida sin fallar.
- [x] 4.8 `scheduleAdminWorkerParity.test.tsx` (nuevo) — prueba directa de
      equivalencia estructural: renderiza `RowTeacherSchedule` (admin) y
      `WorkerScheduleGrid` (trabajador) con datos equivalentes y compara
      la salida real (conteo/colSpan de recesos, secuencia de bloques,
      aparición condicional del bloque extracurricular, formato exacto de
      "Clase — MATERIA").

## 5. Verificación

- [x] 5.1 `bun run typecheck`
- [x] 5.2 `bun run lint`
- [x] 5.3 Pruebas enfocadas: todo `src/features/schedules/`.
- [x] 5.4 `bun test` (suite completa)
- [x] 5.5 `bun run build`
- [x] 5.6 `bun run supabase:lint`
- [x] 5.7 `bun run supabase:test` — confirmar que
      `schedule_assignments_ownership_rls.test.sql` y
      `schedule_teachers_ownership_rls.test.sql` siguen en verde (no se
      tocó la migración).
- [x] 5.8 Verificación manual en navegador (requiere sesión real; ver
      pasos exactos en el reporte final): comparar visualmente
      `/my-schedule` contra `/semesters/:id` → "Horario del Maestro" a
      ancho de escritorio; confirmar en DevTools que ningún `<button>`/
      `<form>`/control admin existe en el árbol del trabajador; confirmar
      que el admin sigue creando/editando/eliminando con normalidad;
      confirmar el bloque 17:00–19:00 aparece/desaparece según datos
      reales; confirmar texto largo no desborda horizontalmente.
