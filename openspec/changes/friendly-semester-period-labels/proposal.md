## Why

En "Documentos por semestre" (expediente de trabajador) el selector de
semestre y el encabezado del periodo seleccionado muestran el código interno
crudo (p. ej. `24A - 2023 - 2024`), que no es entendible para el personal
docente. El código sigue siendo necesario internamente (id de fila,
`semester_id` enviado a las consultas), pero la presentación debe traducirse
a un periodo legible.

## What Changes

- Agregar una utilidad reutilizable (`src/features/semesters/semesterDisplayLabel.ts`)
  que formatea un código de semestre (`24A`, `2024-A`, etc.) a un periodo
  legible (`Febrero–julio 2024`, `Agosto 2024 – enero 2025`), reutilizando el
  parseo ya existente de `nextSemesterCode.ts`. Incluye una segunda función
  que agrega el código interno como referencia secundaria
  (`Febrero–julio 2024 · 24A`).
- Usar esa utilidad en el selector de semestre, el encabezado del periodo
  seleccionado y el PDF de reporte de `WorkerDocumentsView.tsx`, eliminando
  la función `getSemesterLabel` duplicada en ambos archivos.
- Aclarar el texto del campo del selector a "Periodo académico" y agregar un
  texto de ayuda corto debajo del selector.
- No se modifica el identificador interno (`semester`, `semester_id`,
  ordenamiento, consultas) ni ninguna otra pantalla que muestre semestres
  (páginas de administración de semestres, horarios) — cambio de
  presentación, acotado a esta sección.

## Capabilities

### New Capabilities

- `worker-document-semester-period-label`: presentación legible del periodo
  académico en la sección de documentos por semestre del expediente de
  trabajador (selector, encabezado y PDF), preservando el código interno sin
  alterarlo.

### Modified Capabilities

Ninguna.

## Impact

- Código: `src/features/semesters/semesterDisplayLabel.ts` (nuevo),
  `src/features/workers/documents/WorkerDocumentsView.tsx`,
  `src/features/workers/documents/generateWorkerDocumentReportPdf.ts`.
- Riesgo: bajo. Cambio de presentación puro, sin tocar tablas, RLS,
  ordenamiento de semestres ni otras pantallas.
