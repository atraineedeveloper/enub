# Tasks

## 1. Etiqueta amigable de semestre (recreada)

- [x] 1.1 Recrear `src/features/semesters/semesterDisplayLabel.ts`
      (`formatFriendlySemesterPeriod`, `formatSemesterPeriodWithCode`),
      reutilizando `parseSemesterCode`/`formatSemesterCode` de
      `nextSemesterCode.ts` — sin identificador interno alterado.
- [x] 1.2 Cubrir con pruebas unitarias (términos A/B, formato legado
      `YYYY-A`, minúsculas, valores nulos/vacíos, código no parseable).
- [x] 1.3 Usar `formatSemesterPeriodWithCode` en las opciones del
      `<select>` y en el encabezado del periodo seleccionado de
      `MyScheduleView.tsx`, reemplazando `semester.semester`/`school_year`
      crudos.

## 2. Restaurar la página real

- [x] 2.1 `src/pages/MySchedule.tsx`: renderizar `<MyScheduleView />` en
      vez del heading placeholder.
- [x] 2.2 Confirmar que ningún otro archivo del módulo de horario del
      trabajador (`apiWorkerSchedule.ts`, `workerScheduleQuery.ts`,
      `workerScheduleEntry.ts`, `WorkerScheduleGrid.tsx`,
      `WorkerScheduleAgenda.tsx`, `WorkerScheduleLegend.tsx`,
      `WorkerScheduleUnspecified.tsx`, `schoolDayBlocks.ts`, la migración
      RLS) fue modificado.
- [x] 2.3 Añadir una prueba de que `MySchedule.tsx` monta `MyScheduleView`
      (no el placeholder anterior).

## 3. Verificación

- [x] 3.1 `bun run typecheck`
- [x] 3.2 `bun run lint`
- [x] 3.3 Pruebas enfocadas: `semesterDisplayLabel.test.ts`,
      `MySchedule.test.tsx`, `myScheduleViewState.test.ts`,
      `workerScheduleQuery.test.ts`, `workerScheduleEntry.test.ts`,
      `WorkerScheduleGrid.test.tsx`, `WorkerScheduleAgenda.test.tsx`.
- [x] 3.4 `bun test` (suite completa)
- [x] 3.5 `bun run build`
- [x] 3.6 `bun run supabase:lint`
- [x] 3.7 `bun run supabase:test` — confirmar que
      `schedule_assignments_ownership_rls.test.sql` y
      `schedule_teachers_ownership_rls.test.sql` siguen en verde (no se
      tocó la migración).
- [ ] 3.8 Verificación manual en navegador (requiere sesión real con al
      menos dos trabajadores vinculados y dos semestres — no disponible en
      este entorno; ver pasos exactos en el reporte final).
