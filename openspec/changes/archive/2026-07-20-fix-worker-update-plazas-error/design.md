## Context

`createEditWorkers` ejecuta tres peticiones independientes: confirma `workers`, borra/reinserta plazas y luego borra/reinserta fechas. El esquema local actual permite las cuatro operaciones RLS sobre ambas relaciones y la reproducción como administrador funciona; por ello el error original del entorno afectado no puede recuperarse del toast, que descartó los campos de Supabase. La secuencia sí demuestra el defecto de consistencia y expone el mismo riesgo en fechas.

## Goals / Non-Goals

**Goals:**

- Hacer atómica la edición de las tres secciones.
- Preservar una relación cuando esa sección no cambió.
- Autorizar explícitamente sólo `admin`/`staff` y conservar diagnóstico estructurado.

**Non-Goals:**

- Cambiar tablas, rutas, creación de trabajadores o datos remotos.
- Ocultar fallos relacionales o mostrar éxito parcial.

## Decisions

- Crear `update_worker_with_relations(bigint,jsonb,jsonb,jsonb)` como `SECURITY INVOKER`. PostgreSQL ejecuta toda la función en una transacción; cualquier excepción revierte trabajador y relaciones. Se prefiere sobre la alternativa B porque el flujo ya cruza tres tablas y la atomicidad es el requisito central.
- `NULL` en un argumento relacional significa “sección sin cambios”; un arreglo vacío significa “eliminar todas”. El formulario enviará `NULL` usando el estado dirty de React Hook Form, evitando reemplazos innecesarios.
- La RPC comprobará `current_app_role()` y validará que los JSON relacionales sean arreglos. Las políticas `INSERT`/`UPDATE`/`DELETE` de ambas relaciones se restringirán de `authenticated USING (true)` a `admin`/`staff`; la lectura existente no cambia.
- El cliente registrará sólo los campos diagnósticos estándar (`code`, `message`, `details`, `hint`) y mostrará un mensaje seguro que afirma que no se guardaron cambios. El éxito sólo se emitirá tras resolver la RPC.

## Risks / Trade-offs

- [El entorno observado puede diferir del esquema local y su error original sigue desconocido] → conservar telemetría estructurada y documentar el diagnóstico local exacto.
- [Comparación dirty depende del formulario] → pruebas unitarias para payload omitido/vacío/modificado y pruebas SQL para semántica/rollback.
- [Fotos viven fuera de PostgreSQL] → la carga previa y limpieza compensatoria existente se conservan; la atomicidad cubre únicamente datos relacionales.
