# Tasks

## 1. Columna `description`

- [x] 1.1 `supabase/migrations/20260721020000_add_worker_document_type_description.sql`:
      `ALTER TABLE worker_document_types ADD COLUMN description text NULL`
      — schema-only, sin datos, mismo patrón que
      `20260716013828_add_worker_document_type_is_active.sql`.

## 2. Migración protegida de catálogo (Asesoría/Tutoría)

- [x] 2.1 `supabase/migrations/20260721030000_update_advising_tutoring_document_requirements.sql`:
      `DO $$ ... $$` con precondiciones explícitas por nombre exacto
      (categoría y tipo); falla ante nombre faltante, estado inesperado
      (`Informes`/`Relación de estudiantes tutorados` ya inactivos,
      descripciones ya asignadas, `Plan de Trabajo` ya existente).
- [x] 2.2 Desactiva exactamente `Asesoría / Informes` y `Tutoría /
      Relación de estudiantes tutorados` (`is_active = false`, nunca
      `DELETE`), reutilizando el mismo advisory lock compartido que
      `enforce_active_worker_document_type` y la migración de retiro de
      Docencia.
- [x] 2.3 Asigna `description = 'Bitácoras'` a `Asesoría / Control de
      asesorías` y `description = 'Dictamen'` a `Asesoría / Documentos de
      titulación` — sin tocar `is_active`/`allows_multiple`.
- [x] 2.4 Inserta `Tutoría / Plan de Trabajo` (activo, `allows_multiple =
      false`, `sort_order` calculado como `min(sort_order) - 5` de
      Tutoría — sin renumerar el resto de la categoría).
- [x] 2.5 Postcondiciones explícitas por cada efecto (nunca solo "no
      lanzó excepción"), incluida la verificación de que `Plan de
      Trabajo` tiene el `sort_order` estrictamente menor de toda la
      categoría (primero, sin empates).
- [x] 2.6 Alcance a Docencia/Investigación/Datos personales garantizado
      por construcción (cada `UPDATE`/`INSERT` referencia ids ya
      resueltos) — sin diff de snapshot en runtime, mismo criterio que
      `20260721010000_docencia_active_types_allow_multiple.sql`.
- [x] 2.7 No re-ejecutable por diseño — documentado explícitamente en el
      propio archivo de migración y en design.md Decisión 1; una segunda
      ejecución falla en la primera precondición que ya no se cumple.
- [x] 2.8 Aplicar localmente (`supabase db reset`) y confirmar estado
      resultante del catálogo consultando la BD directamente.
- [x] 2.9 Regenerar `src/types/supabase.ts` con
      `bunx supabase gen types typescript --local` (local, sin red);
      solo se incorpora la adición de `description` a
      `worker_document_types` (Row/Insert/Update), sin arrastrar otro
      drift preexistente no relacionado con este cambio.
- [x] 2.10 Tres familias de lock, con responsabilidades distintas y no
      intercambiables (corregido — una versión anterior afirmaba
      incorrectamente que el advisory lock por sí solo bastaba para
      excluir escritores concurrentes; documentado con precisión en
      design.md Decisión 10):
      - **`LOCK TABLE "public"."worker_document_categories",
        "public"."worker_document_types" IN SHARE ROW EXCLUSIVE MODE`**
        — adquirido primero, antes de cualquier `SELECT`/precondición, en
        ese orden fijo (categorías antes que tipos, para reducir riesgo
        de deadlock); esta es la protección REAL: permite `SELECT`
        ordinarios de cualquier otra sesión, pero excluye
        `INSERT`/`UPDATE`/`DELETE` concurrentes sobre ambas tablas
        durante toda la resolución de categorías, las precondiciones, el
        cálculo de `min(sort_order)`, las descripciones, las
        desactivaciones, la inserción y las postcondiciones.
      - **Advisory transaction lock**
        (`pg_advisory_xact_lock(hashtextextended('worker_document_catalog:update_advising_tutoring_requirements', 0))`)
        — se conserva, pero documentado correctamente como puramente
        cooperativo: solo serializa contra otra sesión que también tome
        este mismo advisory lock (otra ejecución concurrente de esta
        misma migración), nunca contra un escritor ordinario que no lo
        use.
      - **Advisory locks de ciclo de vida por tipo** (2.2) — protocolo
        aparte y preexistente, coordinan el retiro de un tipo con
        subidas/reemplazos concurrentes sobre ese mismo tipo; se
        conservan sin cambios.
      No cambia el resultado funcional de la migración (confirmado
      re-aplicando con `supabase db reset` y re-ejecutando la suite
      pgTAP completa).

## 3. Pruebas pgTAP

- [x] 3.1 `worker_document_type_lifecycle.test.sql`: conteo global de
      `is_active = false` actualizado de 2 a 4 (los 2 de Docencia + los 2
      nuevos de Asesoría/Tutoría).
- [x] 3.2 `worker_documents_seed.test.sql`: conteo global de
      `worker_document_types` actualizado de 29 a 30 (+ `Plan de
      Trabajo`).
- [x] 3.3 `update_advising_tutoring_document_requirements.test.sql`
      (25 aserciones): Informes/Relación inactivos; las 2 descripciones
      exactas; Control de asesorías/Documentos de titulación siguen
      activos y single-file; Plan de Trabajo existe, activo, single-file,
      `sort_order` estrictamente mínimo en Tutoría; sin empates de
      `sort_order` en Tutoría; conteos exactos por categoría (Tutoría 6,
      Asesoría 4, Docencia 9, Investigación 5, Datos personales 6 — sin
      cambio fuera de Asesoría/Tutoría); cada tipo no tocado conserva
      nombre/is_active/allows_multiple/description exactos; un documento
      histórico simulado sobre las filas reales (reactivar Informes →
      insertar → retirar de nuevo) sigue uniéndose correctamente al tipo
      ahora inactivo y no se pierde; una nueva carga contra el tipo
      retirado sigue siendo rechazada (WDT01).
- [x] 3.4 Reproducción de frontera dedicada (nunca solo la reactivación
      anterior, y nunca ejecutando el archivo de migración de producción
      dentro de pgTAP): un tipo aislado (`QA Retirement Boundary Type`,
      nunca `Informes`/`Relación de estudiantes tutorados`) se crea
      activo; se inserta un documento contra él (exactamente la secuencia
      real: subida ocurre mientras el tipo está activo); solo entonces se
      reproduce la forma exacta de la transición de retiro (un `UPDATE
      is_active = false` por id, no el archivo completo de migración).
      Confirma: la fila del documento existe antes (línea base); la misma
      fila (mismo id) sigue existiendo después, sin `DELETE` ni cascada;
      el conteo por id sigue siendo exactamente 1; el documento sigue
      consultable por id y se une correctamente a su tipo ahora inactivo.
- [x] 3.5 Prueba fiel del contrato de "no re-ejecutable" (corregida —
      la versión anterior reproducía una precondición posterior
      equivocada): captura un snapshot de las 5 filas relevantes
      (Informes, Relación de estudiantes tutorados, Control de asesorías,
      Documentos de titulación, Plan de Trabajo); ejecuta, dentro de
      `throws_ok`, una reproducción fiel — nunca el archivo de migración
      de producción, nunca modificado para acomodar la prueba — de TODAS
      las precondiciones desde la resolución de categorías, en el mismo
      orden exacto que la migración real, contra el catálogo ya migrado;
      confirma SQLSTATE `P0001` con el mensaje EXACTO correspondiente a
      `Asesoría / Informes` ya inactivo (la primera precondición
      realmente alcanzada en ese orden — nunca la de `Control de
      asesorías`); confirma que las 5 filas del snapshot quedan
      byte-a-byte sin cambios (descriptions, is_active, sort_order); y
      que no se insertó un segundo `Plan de Trabajo`.
- [x] 3.6 `bunx supabase test db --local` — 34 archivos, 626 pruebas,
      PASS.

## 4. Descripción editorial en el frontend

- [x] 4.1 `documentType.description` nunca se hardcodea por nombre en
      React — se lee tal cual de la fila/tipo recibido.
- [x] 4.2 `DocumentRequirementRow.tsx`: nueva línea bajo el nombre,
      renderizada solo si `description` es verdadero (nunca un espacio
      reservado ni una frase genérica para `null`/`""`).
- [x] 4.3 `DocumentDetailDrawer.tsx`: nueva línea bajo el título
      (`TypeDescription`), junto a — nunca en vez de — la regla
      funcional single/multiple, renombrada a `UploadRule` para evitar
      confundir ambos conceptos en el código.
- [x] 4.4 `description` se normaliza con `const description =
      documentType.description?.trim();` en ambos componentes antes de
      decidir si renderizar — `null`, `undefined`, `""`, y `"   "` (solo
      espacios) se tratan exactamente igual (nada renderizado); una
      descripción válida con espacios exteriores se muestra recortada.

## 5. Persistencia de `selectedCategoryId` entre periodos

- [x] 5.1 `useWorkerDocumentsBySemester.ts`: `placeholderData:
      keepPreviousData` — fix de raíz; evita que `isLoading` vuelva a
      `true` (y por tanto que `WorkerDocumentsView` desmonte el
      dashboard) en un refetch de periodo que ya tiene datos utilizables.
- [x] 5.2 `documentRequirementSummary.ts`: `resolveActiveCategoryId`
      (pura, testeada) — conserva la selección por id si sigue existiendo
      en el catálogo actual; cae a la primera categoría solo si la
      selección es `null` o ya no existe. Nunca pareada con un efecto que
      la reescriba de vuelta al estado.
- [x] 5.3 `WorkerDocumentsDashboard.tsx`: usa el id derivado
      (`activeCategoryId`) para todo lo que antes leía `selectedCategoryId`
      directamente (categoría activa, prop a `DocumentCategoryTabs`, el
      guard de "ya es la categoría activa" en `handleSelectCategory`);
      el estado crudo `selectedCategoryId` se simplifica a iniciar en
      `null` en vez de inicializarse perezosamente desde el catálogo.
- [x] 5.4 El funnel `requestDrawerTransition` existente ya enrutaba el
      cambio de semestre correctamente (bloquea durante upload, pide
      confirmación con selección descartable, cambia y cierra el drawer
      si no hay pendientes) — sin cambios de lógica, solo cobertura de
      prueba nueva.
- [x] 5.5 El filtro de estado (`documentFilter`) y la política de
      `searchTerm` (se limpia solo al cambiar de categoría, nunca al
      cambiar de semestre) ya eran correctos una vez resuelto el
      desmontaje — sin lógica nueva, solo cobertura de prueba.
- [x] 5.6 Tabs de escritorio y `<select>` móvil comparten el mismo
      `selectedCategoryId`/`onSelectCategory` — se benefician del fix por
      igual, sin rama de código separada.

## 6. Solo lectura durante el intervalo `isPlaceholderData`

Hallazgo crítico corregido: una versión anterior de este cambio permitía
que el drawer se abriera y las filas se interactuaran mientras
`documentsByType` aún reflejaba el periodo ANTERIOR (ventana de
`placeholderData`). Corregido con un estado explícito propagado de punta a
punta.

- [x] 6.1 `useWorkerDocumentsBySemester.ts`: retorna explícitamente
      `isPlaceholderData` e `isFetching` (antes solo `isLoading`).
- [x] 6.2 `WorkerDocumentsView.tsx`: `isUpdatingSemesterData =
      Boolean(selectedSemesterId) && isPlaceholderData` — deliberadamente
      NO derivado (ni siquiera parcialmente) de `isFetching` sin más,
      porque `isFetching` también se activa en refetches del mismo
      periodo ajenos al cambio de semestre (p. ej. la invalidación de
      caché que sigue a una subida exitosa), que no deben congelar la UI;
      `isPlaceholderData` es la señal precisa de "el dataset mostrado
      pertenece a una query key distinta a la seleccionada". Nueva prop
      `isUpdatingSemesterData` pasada a `WorkerDocumentsDashboard`.
- [x] 6.3 `WorkerDocumentsDashboard.tsx`: nueva prop requerida
      `isUpdatingSemesterData`; `aria-busy` en el contenedor raíz;
      `<select>` de periodo y botón "Descargar reporte" deshabilitados;
      `openRequirement` comprueba `canOpenDocumentRequirement({
      isUpdatingSemesterData })` (ver 6.7) y `handleSemesterChange`
      comprueba `isUpdatingSemesterData` directamente (defensa adicional
      junto a los controles deshabilitados); `handleSemesterChange`
      reordenado para cerrar el drawer ANTES de cambiar
      `selectedSemesterId` (documenta la secuencia exigida; ambos ya
      aterrizaban en el mismo commit por lotes, así que es una corrección
      de claridad, no de
      comportamiento). El dashboard nunca se oculta tras un spinner de
      página completa para este estado.
- [x] 6.4 `DocumentRequirementList.tsx` / `DocumentRequirementRow.tsx`:
      nueva prop `disabled` — atenúa visualmente la fila (`opacity`,
      `aria-disabled`) y deshabilita sus botones nativos, sin ocultarla.
- [x] 6.5 `DocumentSummary.tsx`: nueva prop `isUpdatingSemesterData` —
      atenúa los conteos (nunca los recalcula ni los presenta como
      definitivos del nuevo periodo) y añade el indicador visible
      "Actualizando periodo…" junto a ellos (una sola fuente del
      indicador, reutilizada para el requisito de UI general, no
      duplicada en otro lugar).
- [x] 6.6 Ninguna mutación puede ejecutarse durante esta ventana: toda
      mutación de este feature solo se dispara desde dentro del drawer, y
      el drawer no puede abrirse durante `isUpdatingSemesterData`
      (bloqueado por el botón deshabilitado y por el guard interno en
      `openRequirement`) — la garantía es estructural, no una
      convención de UI.
- [x] 6.7 `canOpenDocumentRequirement({ isUpdatingSemesterData })`
      (`documentRequirementSummary.ts`, pura) extraída y probada de forma
      independiente del atributo `disabled` del DOM — el control visual
      (`disabled` nativo) y el guard lógico interno (esta función) se
      confirman en dos niveles distintos: la prueba unitaria llama a la
      función directamente (equivalente a una vía programática que
      nunca pasa por un clic real en un botón habilitado), y las
      pruebas DOM existentes confirman el atributo `disabled` visible.

## 7. `DocumentSummary` sin porcentaje ni barra de progreso

- [x] 7.1 `documentRequirementSummary.ts`: `percentage` eliminado por
      completo de `DocumentProgressSummary` y de
      `computeDocumentProgressSummary` (confirmado sin otro consumidor
      antes de quitarlo).
- [x] 7.2 `DocumentSummary.tsx`: se elimina `ProgressTrack`/`ProgressFill`/
      `ProgressLabel`; solo queda el texto de conteos objetivos ("N
      requisitos · N con archivos · N pendientes") y el mensaje de cero
      requisitos activos, ambos sin cambios de redacción.
- [x] 7.3 Sin código muerto ni pruebas de porcentaje remanentes
      (`documentRequirementSummary.test.ts` actualizado; búsqueda
      confirma cero referencias funcionales a `percentage` fuera de
      comentarios de diseño y la aserción que prueba su ausencia).
- [x] 7.4 Pluralización corregida en `DocumentSummary.tsx`: "1 pendiente"
      / "0 pendientes" / "N pendientes" (antes siempre "pendientes",
      incluso para 1). Revisado también "requisito/requisitos" (ya
      correcto) y "con archivos" (frase fija, cuenta requisitos con
      archivos, no una cantidad de archivos — no requiere singular, sin
      cambios).

## 8. Pruebas unitarias y de render (frontend)

- [x] 8.1 `documentRequirementSummary.test.ts`: `computeDocumentProgressSummary`
      sin `percentage`; `resolveActiveCategoryId` (conserva por id,
      cae a la primera con `null` o id inexistente, nueva referencia de
      array con los mismos ids no reinicia, catálogo vacío resuelve a
      `null`); `canOpenDocumentRequirement` (`false` con
      `isUpdatingSemesterData: true`, `true` en caso contrario).
- [x] 8.2 `WorkerDocumentsDashboard.test.tsx`: descripción visible en la
      fila; `null`/`undefined`/`""`/`"   "` no dejan artefacto ni frase
      genérica (mismo trato que `null` en los cuatro casos); una
      descripción válida con espacios exteriores se muestra recortada;
      Informes/Relación de estudiantes tutorados no aparecen sin
      historial; un tipo inactivo con historial sí aparece con "Ver
      archivos" y sin contar en el resumen; Plan de Trabajo aparece
      primero en Tutoría (orden del catálogo, sin reordenar en cliente);
      pluralización de "pendiente(s)" en 0/1/N.
- [x] 8.3 `DocumentDetailDrawer.test.tsx`: descripción bajo el título,
      coexistiendo con la regla single/multiple; `null`/`undefined`/`""`/
      `"   "` no dejan artefacto; una descripción válida con espacios
      exteriores se muestra recortada.

## 9. Pruebas DOM reales (`bun test --isolate`)

- [x] 9.1 `WorkerDocumentsDashboard.dom.test.tsx`: cambiar de periodo con
      una selección pendiente en el drawer pide confirmación (mismo
      funnel `requestDrawerTransition`) en vez de cambiar de inmediato;
      el filtro de estado persiste al cambiar de periodo.
- [x] 9.2 `WorkerDocumentsView.dom.test.tsx`: carga inicial sin datos
      muestra spinner, no el expediente; tras la carga inicial el
      expediente se muestra; cambiar de periodo (refetch con datos
      previos) no desmonta el dashboard (mismo nodo del DOM, verificado
      por identidad de referencia, no solo por contenido); seleccionar
      Asesoría, cambiar de periodo, esperar el refetch, confirmar que
      Asesoría sigue seleccionada (tabs de escritorio); lo mismo para
      Tutoría; lo mismo a través del `<select>` de categoría móvil.
- [x] 9.3 `WorkerDocumentsView.dom.test.tsx` — suite dedicada al
      intervalo crítico (`describe("Intervalo crítico...")`), con la
      promesa de la segunda consulta (`getWorkerDocumentsBySemester` para
      el periodo B) controlada manualmente, nunca resuelta de inmediato:
      periodo A cargado con una categoría distinta de la primera
      seleccionada (Asesoría); se cambia a periodo B y se deja la
      respuesta pendiente; durante ese intervalo se confirma en un solo
      flujo: el dashboard conserva el mismo nodo del DOM; la categoría
      sigue seleccionada; aparece "Actualizando periodo…"; `aria-busy`
      está activo; el botón de la fila está deshabilitado; un clic en la
      fila no abre el drawer; "Descargar reporte" está deshabilitado;
      cero llamadas de upload/replace/delete; los datos mostrados siguen
      siendo los de A (nunca los de B, no resueltos aún). Al resolver B:
      desaparece el indicador, se muestran exclusivamente los documentos
      de B, las interacciones se reactivan, la categoría sigue
      seleccionada. Prueba adicional dedicada: un clic explícito en el
      nombre y en el botón de acción de la fila durante el intervalo
      nunca abre el drawer. Verificado que ambas pruebas fallan si se
      revierte el guardado (confirmado manualmente revirtiendo
      temporalmente los cambios y re-ejecutando).

## 10. Verificación

- [x] 10.1 `git diff --check`
- [x] 10.2 `bun run typecheck`
- [x] 10.3 `bun run lint`
- [x] 10.4 `bun test --isolate src/features/workers/documents src/ui`
- [x] 10.5 `bun test --isolate` (suite completa)
- [x] 10.6 `bun run build`
- [x] 10.7 `bun run supabase:test`
- [x] 10.8 `bun run supabase:lint`
- [x] 10.9 `bunx openspec validate update-advising-tutoring-document-requirements --strict`
- [ ] 10.10 Verificación manual en navegador, con un worker que tenga
      documentos históricos reales bajo `Informes` y/o `Relación de
      estudiantes tutorados`: confirmar que el tipo retirado se ve, sin
      control de carga, con sus archivos existentes visibles/descargables;
      confirmar visualmente que `Plan de Trabajo` aparece primero en
      Tutoría; confirmar que cambiar de periodo académico conserva la
      pestaña de categoría seleccionada, tanto en escritorio como en un
      viewport móvil (el `<select>` de categoría); con conexión real
      (limitada o simulada con throttling del navegador), confirmar
      visualmente el intervalo `isPlaceholderData`: "Actualizando
      periodo…" visible, filas atenuadas y no interactivas, imposible
      abrir el drawer o iniciar una subida durante ese instante, todo
      vuelve a la normalidad al resolver — no disponible en este entorno
      (sin datos históricos reales bajo estos 9 tipos en la BD local, y
      sin forma de introducir latencia de red real); pasos exactos en el
      reporte final.
