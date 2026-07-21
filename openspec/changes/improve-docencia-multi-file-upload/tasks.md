# Tasks

## 1. Migración de catálogo

- [x] 1.1 `supabase/migrations/20260721010000_docencia_active_types_allow_multiple.sql`:
      `UPDATE` guardado por precondición (conjunto exacto de 7 tipos
      activos de Docencia, por nombre) y postcondición (exactamente 6
      filas actualizadas; los 2 tipos retirados permanecen sin cambios).
      Scope garantizado por construcción vía `category_id` resuelto del
      nombre único `Docencia`.
- [x] 1.2 No se modifica ningún trigger ni el RPC de reemplazo — ambos ya
      son genéricos sobre `allows_multiple`.
- [x] 1.3 Aplicar localmente (`supabase db reset`) y confirmar que corre
      sin excepciones (las precondiciones/postcondiciones pasan).

## 2. Pruebas pgTAP

- [x] 2.1 `worker_documents_seed.test.sql` (10→17 aserciones): conteo
      `allows_multiple = true` 3→9; los 7 tipos activos de Docencia sin
      `allows_multiple = false`; los 2 retirados sin cambio; Datos
      personales/Tutoría/Asesoría/Investigación sin cambio.
- [x] 2.2 `worker_documents_triggers.test.sql` (11→23 aserciones): 6
      bloques nuevos, uno por tipo recién volteado, cada uno insertando 3
      archivos (1º/2º/3º) para el mismo worker/semestre y confirmando que
      los 3 persisten. Las aserciones existentes (incluida el rechazo de
      duplicados sobre CURP/Datos personales) no requirieron reapuntarse
      — usaban un tipo fuera de Docencia desde el principio.
- [x] 2.3 `worker_document_replacement_rpc.test.sql` (18→20 aserciones):
      los 5 fixtures de tipo single-file se reapuntaron de Docencia (ya
      no queda ninguno single-file activo) a Investigación (mismo scope
      `semester`, sin cambios de forma en las llamadas). Se añadió
      cobertura nueva: el RPC rechaza (P0001) el reemplazo para un tipo de
      Docencia recién volteado (Rúbricas), dejando `worker_documents` sin
      cambios.
- [x] 2.4 `worker_document_type_lifecycle.test.sql`: sin cambios — solo
      referencia `Evidencias bimestrales`, que ya tenía
      `allows_multiple = true` antes de este cambio.
- [x] 2.5 `bunx supabase test db --local` — 33 archivos, 601 pruebas, PASS.

## 3. Módulo compartido de límites

- [x] 3.1 `src/services/workerDocumentUploadLimits.ts` (nuevo): extensiones
      permitidas, mapa MIME, límite de 10 MB, máximo de 10 archivos por
      lote, string `accept` del input, y el texto en español de tipos
      permitidos.
- [x] 3.2 `apiWorkerDocuments.ts` consume el módulo compartido en lugar de
      sus propias constantes duplicadas.

## 4. Hook de lote

- [x] 4.1 `useUploadWorkerDocuments.ts` (nuevo): `addFiles`,
      `uploadQueuedFiles`, `retryItem`, `removeItem`, `clearQueue`; núcleo
      puro exportado (`buildQueueItem`, `updateQueueItem`,
      `removeQueueItem`, `getPendingItems`, `getDiscardableItems`,
      `removeCompletedItems`, `canStartUpload`, `buildBatchSummary`,
      `runUploadQueue`), siguiendo el patrón núcleo-puro/hook-delgado ya
      establecido (`useCurrentIdentity.ts`).
- [x] 4.2 Subida secuencial (nunca paralela); sin RPC batch nuevo; sin
      transacción entre archivos.
- [x] 4.3 Invalidación de caché una sola vez al asentarse el lote
      completo, no una vez por archivo.
- [x] 4.4 Manejo explícito de éxito total / parcial / error total —
      `buildBatchSummary`, nunca una afirmación falsa de éxito u error
      total ante un resultado mixto.
- [x] 4.5 Reintentar un archivo individual reutiliza `runUploadQueue`
      contra un arreglo aislado de un solo elemento (nunca vuelve a
      barrer otros archivos aún pendientes en la cola).
- [x] 4.6 `getDiscardableItems` (`preparado` + `error`, nunca `completado`
      ni `subiendo`) es el único predicado de "qué se perdería al
      descartar"; `removeCompletedItems` barre los `completado` de la
      cola inmediatamente después de que un lote o un reintento se
      asienta, para que un lote 100% exitoso termine con la cola vacía.
      Corrige un hallazgo real: el guard de cierre usaba antes
      `items.length > 0`, que contaba también los `completado`, así que
      cerrar el drawer justo después de una subida totalmente exitosa
      abría incorrectamente la confirmación de descarte.

## 5. Deduplicación y validación de selección

- [x] 5.1 `resolveFileSelection.ts` (nuevo): valida extensión/tamaño,
      deduplica por nombre + tamaño + `lastModified` (contra la cola
      existente y dentro de la misma selección), aplica el máximo de 10
      archivos por lote — todo antes de que un archivo llegue a la cola.
      Un archivo inválido no bloquea la aceptación de los demás en la
      misma selección.

## 6. Componentes UI

- [x] 6.1 `DocumentSummary`: resumen de progreso global (N de M requisitos
      activos con archivos, barra/porcentaje), combinando todas las
      categorías activas.
- [x] 6.2 `DocumentCategoryTabs`: `role="tablist"`/`role="tab"` en
      escritorio/tablet (scroll horizontal propio, nunca fuerza scroll
      horizontal de la página), `<select>` nativo equivalente en móvil —
      ambos controlados por el mismo `selectedCategoryId`.
- [x] 6.3 `DocumentFilters`: chips de estado (Todos/Pendientes/Con
      archivos, `role="group"`) + búsqueda por nombre (`type="search"`,
      `aria-label`).
- [x] 6.4 `DocumentRequirementList` / `DocumentRequirementRow`: una fila
      compacta por tipo de documento (icono de estado por forma, nunca
      solo color; nombre como botón; línea de metadatos; botón de acción
      con la etiqueta exacta según estado — "Subir archivo(s)"/"Agregar
      archivos"/"Reemplazar archivo"/"Ver archivos") — nunca una tarjeta
      por requisito.
- [x] 6.5 `DocumentDetailDrawer`: panel lateral (fijo a la derecha,
      ancho acotado, página detrás visible) en escritorio/tablet,
      pantalla completa (`100dvh`) por debajo de 640px; `role="dialog"`,
      `aria-modal`, `aria-labelledby`, foco inicial, focus trap, Escape,
      scroll lock del body con cleanup, restauración de foco al cerrar;
      cede el manejo de Escape a un `Modal.Window` abierto encima de él
      (p. ej. la confirmación de "Eliminar" de un archivo) en vez de
      cerrarse él mismo. Compone `UploadedFileList`/`UploadedFileRow`
      (archivos ya cargados), `UploadDropzone` (compartido entre tipos
      single- y multi-file), `PendingUploadList`/`PendingFileRow` (cola
      local pendiente) y `UploadFooter` (contador + Cancelar/Confirmar).
      Instancia sus propias mutaciones por sesión de apertura (ver
      design.md Decisión 8).
- [x] 6.6 `UploadDropzone`: input real `type="file"` (con `multiple`
      cuando aplica), siempre presente y operable por teclado (botón
      visible + `ref.click()`); drag-and-drop como mejora adicional,
      nunca la única vía; muestra tipos permitidos y límite de tamaño de
      forma proactiva.
- [x] 6.7 `PendingUploadList` / `PendingFileRow`: estado por archivo
      (preparado/subiendo/completado/error), retirar y reintentar;
      `aria-live="polite"`.
- [x] 6.8 `UploadFooter`: contador de archivos seleccionados + botón
      "Subir N archivos"/"Reemplazar archivo" + Cancelar, deshabilitado
      mientras hay una subida en curso.
- [x] 6.9 `UploadedFileList` / `UploadedFileRow`: icono por tipo, nombre,
      tamaño, fecha, acciones ver/descargar/eliminar independientes por
      archivo (eliminar pasa por un `Modal.Window` + `ConfirmDelete` con
      accesibilidad real, ver sección 9).
- [x] 6.10 `FileTypeIcon`: icono decorativo por extensión (`aria-hidden`,
      nunca la única señal del tipo de archivo).

## 7. `WorkerDocumentsDashboard.tsx` / `WorkerDocumentsView.tsx`

- [x] 7.1 `WorkerDocumentsView.tsx` queda reducido a shell de
      datos/carga/error (sin cambios en esa responsabilidad); toda la
      lógica de UI/interacción (categoría, requisito, filtros, búsqueda,
      drawer) vive en la nueva `WorkerDocumentsDashboard.tsx`.
- [x] 7.2 El `<Table>` de 4 columnas es reemplazado por resumen + tabs de
      categoría + filtros + lista compacta + drawer de detalle (nunca una
      grilla de tarjetas) — sin lógica responsive de colapso de columnas,
      porque ya no hay columnas.
- [x] 7.3 Un único embudo de transición (`decideDrawerTransition`, puro)
      para los 6 disparadores de cierre/navegación (X, Escape, overlay,
      cambiar de requisito, cambiar de categoría, cambiar de semestre):
      cerrado → siempre corre; abierto + `block` (subida en curso) →
      ignora la solicitud; abierto + `allow` → corre; abierto + `confirm`
      (selección local sin confirmar) → difiere la acción y abre la
      confirmación de descarte (`getDrawerCloseGuard`,
      `decideDrawerTransition` en `documentRequirementSummary.ts`).
- [x] 7.4 La confirmación de descarte usa `discardableCount`
      (`preparado + error`, nunca `completado`) para su texto y para
      decidir si se activa — ver sección 4.6 y design.md Decisión 10.
      Cancelar la confirmación limpia explícitamente la transición
      diferida (nunca ejecuta una intención obsoleta).
- [x] 7.5 Sin cambios de comportamiento fuera de Docencia: los tipos
      single-file conservan exactamente su lógica de subir-o-reemplazar
      previa.
- [x] 7.6 Compartida sin cambios entre admin (`Records/WorkerDocuments.tsx`)
      y autoservicio (`MyDocuments.tsx`) — ninguna rama nueva por rol.

## 8. Pruebas unitarias y de render (frontend)

- [x] 8.1 `useUploadWorkerDocuments.test.ts`: `buildQueueItem`,
      `updateQueueItem`/`removeQueueItem` (transformaciones puras, sin
      mutación), `getPendingItems`, `getDiscardableItems`,
      `removeCompletedItems`, `canStartUpload` (incluye "doble clic no
      duplica"), `buildBatchSummary` (éxito total/parcial/error total),
      `runUploadQueue` (secuencial, transiciones por archivo, un archivo
      rechazado no detiene el resto, solo se suben los `preparado`), y el
      ciclo completo éxito total/parcial/error total combinando
      `runUploadQueue` + `removeCompletedItems`.
- [x] 8.2 `documentRequirementSummary.test.ts`: agrupación por tipo,
      etiquetas de conteo/acción por estado, orden por recencia, filtros
      de estado/búsqueda, resumen de progreso, `getDrawerCloseGuard`
      (`isBusy` → `block`; selección pendiente → `confirm`; si no,
      `allow`), `applyCategoryChange`, `decideDrawerTransition` (las 4
      combinaciones abierto/cerrado × guard).
- [x] 8.3 `resolveFileSelection.test.ts`: cero/uno/varios archivos;
      selección repetida del mismo archivo (duplicado exacto vs. mismo
      nombre con contenido distinto); archivo inválido no bloquea el
      resto; límite de 10 archivos por lote (cola parcialmente llena y
      selección que por sí sola excede el máximo).
- [x] 8.4 `workerDocumentDisplay.test.ts`: extensión, formato de tamaño
      (bytes/KB/MB, casos límite en 0 y 1024).
- [x] 8.5 `workerDocumentTypeVisibility.test.ts`: la regla de unión (tipo
      visible si está activo, o si el trabajador ya tiene al menos un
      documento cargado bajo él).
- [x] 8.6 `workerDocumentUploadLimits.test.ts`: el `accept` del input y el
      mapa MIME se derivan de la misma lista de extensiones, sin
      duplicación manual.
- [x] 8.7 `WorkerDocumentsView.test.tsx`, `WorkerDocumentsDashboard.test.tsx`,
      `DocumentDetailDrawer.test.tsx` (render estático,
      `renderToStaticMarkup`): estado vacío exacto; input real `multiple`
      presente cuando corresponde; tipos permitidos y límite de tamaño
      visibles de forma proactiva; estados de carga/error; etiquetas de
      acción correctas por estado.
- [x] 8.8 `generateWorkerDocumentReportPdf.test.ts` (nuevo): regresión
      explícita — un tipo de Docencia con 3 archivos produce 3 filas, no
      1 colapsada; un tipo sin archivos produce exactamente 1 fila
      "Pendiente".
- [x] 8.9 `ui/Modal.test.tsx` (DOM real, `happy-dom`): `role="dialog"` +
      `aria-modal`; `aria-labelledby` con título / `aria-label` de
      respaldo sin título; foco inicial dentro del diálogo; Tab/Shift+Tab
      no se escapan (focus trap); Escape cierra; restauración de foco
      (incluyendo cuando el elemento que abrió el modal ya no está en el
      DOM); listeners de `keydown` balanceados en cada ciclo abrir/cerrar
      sin fugas; `Modal.Open`/`onCloseModal`/botón X/click-fuera siguen
      funcionando sin cambios en la API pública.
- [x] 8.10 `WorkerDocumentsDashboard.dom.test.tsx` (DOM real, `happy-dom`,
      solo mockea el límite de red `services/apiWorkerDocuments.ts` —
      hooks y lógica reales): abrir/cerrar el drawer; Escape; overlay;
      focus trap; restauración de foco; scroll lock y su cleanup;
      selección pendiente exige confirmación; subida activa bloquea el
      cierre; confirmar descarte ejecuta la transición diferida; varias
      solicitudes de transición sucesivas nunca ejecutan una intención
      obsoleta; cambio de categoría; cambio de semestre; un tipo
      multi-file nunca llama a `replaceWorkerDocument`; un tipo
      single-file con documento existente sí lo usa; la invalidación de
      caché no escala con el tamaño del lote (una vez por lote, nunca una
      vez por archivo).

## 9. Accesibilidad de `ui/Modal.tsx`

- [x] 9.1 `Modal.Window`: `role="dialog"`, `aria-modal="true"`,
      `aria-labelledby` apuntando a un título visualmente oculto opcional
      (prop `title`), con respaldo a `aria-label={name}` cuando no se
      pasa título — nunca queda sin nombre accesible.
- [x] 9.2 Foco inicial dentro del diálogo al abrir; focus trap real
      (Tab/Shift+Tab con envoltura) sobre el mismo contenedor que ya usaba
      `useOutsideClick`.
- [x] 9.3 Escape cierra únicamente el modal actualmente abierto (por
      construcción, `Modal` solo mantiene un `openName` a la vez).
- [x] 9.4 Restauración de foco al cerrar, guardada contra el caso donde el
      elemento que abrió el modal ya no está conectado al DOM
      (`isConnected`).
- [x] 9.5 Listener de `keydown` correctamente añadido/removido en cada
      ciclo de apertura/cierre — sin fugas tras desmontar con el modal
      abierto.
- [x] 9.6 `useModal` extraído a `ui/useModal.ts` (contexto en
      `ui/ModalContext.ts`) para eliminar el warning
      `react-refresh/only-export-components` de `Modal.tsx` — sin más
      cambios a la API pública de `Modal`/`Modal.Open`/`Modal.Window` que
      la nueva prop opcional `title` en `Modal.Window`.

## 10. Verificación

- [x] 10.1 `git diff --check`
- [x] 10.2 `bunx openspec validate improve-docencia-multi-file-upload --strict`
- [x] 10.3 `bun run typecheck`
- [x] 10.4 `bun run lint`
- [x] 10.5 `bun test src/features/workers/documents src/ui src/services/apiWorkerDocuments.test.ts src/services/workerDocumentUploadLimits.test.ts`
- [x] 10.6 `bun test` (suite completa)
- [x] 10.7 `bun run build`
- [x] 10.8 `bun run supabase:lint`
- [x] 10.9 `bun run supabase:test`
- [ ] 10.10 Verificación manual en navegador: subir varios archivos a la
      vez en un tipo de Docencia (éxito total, parcial y error total);
      retirar un archivo de la cola antes de subir; reintentar un archivo
      fallido; confirmar que un tipo fuera de Docencia sigue mostrando
      "Reemplazar archivo" sin control de selección múltiple; confirmar
      en un viewport móvil que el drawer ocupa pantalla completa y que no
      hay scroll horizontal en la lista de requisitos; confirmar
      visualmente el focus trap y la restauración de foco con teclado
      real (no solo con eventos sintéticos) — no disponible en este
      entorno; pasos exactos en el reporte final.
