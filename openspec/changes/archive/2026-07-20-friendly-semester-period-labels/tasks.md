# Tasks

- [x] Añadir `formatFriendlySemesterPeriod`/`formatSemesterPeriodWithCode` en
      `src/features/semesters/semesterDisplayLabel.ts`, reutilizando
      `parseSemesterCode`/`formatSemesterCode` de `nextSemesterCode.ts`.
- [x] Cubrir la utilidad con pruebas unitarias (términos A/B, formato legado
      `YYYY-A`, minúsculas, valores nulos/vacíos, códigos no parseables).
- [x] Usar la utilidad en el `<option>` del selector y en el encabezado del
      periodo seleccionado de `WorkerDocumentsView.tsx`; eliminar el
      `getSemesterLabel` local duplicado.
- [x] Cambiar el texto del campo a "Periodo académico" y agregar un texto de
      ayuda corto debajo del selector.
- [x] Usar la misma utilidad en `generateWorkerDocumentReportPdf.ts`
      (línea "Semestre: ..." del PDF), eliminando su `getSemesterLabel`
      duplicado en favor de un delegado a la utilidad compartida.
- [x] Confirmar que no se tocó el identificador interno, el ordenamiento de
      semestres, ni otras pantallas (`SemesterRow.tsx`, `SemesterTable.tsx`,
      módulo de horarios).
- [x] Ejecutar `bun run typecheck`, `bun run lint`, `bun test` y
      `bun run build`.
- [x] Verificar manualmente el selector, el encabezado y el PDF descargado
      en la ruta de expediente documental del trabajador.
