## Why

La edición administrativa de un trabajador persiste primero `workers` y después reemplaza `sustenance_plazas` y `date_of_admissions`. Si una relación falla, queda una actualización parcial mientras la interfaz informa que toda la operación falló.

## What Changes

- Actualizar trabajador, plazas y fechas mediante una RPC PostgreSQL transaccional y autorizada para administradores/personal, restringiendo también las políticas de escritura relacionales actualmente abiertas a todo usuario autenticado.
- Reemplazar plazas o fechas sólo cuando el cliente solicite cambiar esa sección; una edición básica preservará ambas relaciones.
- Propagar errores útiles y sanitizados, registrando `code`, `message`, `details` y `hint` originales para diagnóstico.
- Añadir pruebas de regresión de atomicidad, preservación, reemplazo y mensajes de éxito/error.
- No cambiar rutas, dependencias, tablas existentes ni datos remotos.

## Capabilities

### New Capabilities

- `worker-admin-editing`: Edición administrativa coherente y atómica de datos básicos, plazas y fechas de admisión.

### Modified Capabilities

Ninguna.

## Impact

- Código: `apiWorkers.ts`, formulario/hook de edición y tipos generados de Supabase.
- Base de datos: nueva función RPC pública; usa las tablas existentes `workers`, `sustenance_plazas`, `date_of_admissions` y el rol de aplicación actual.
- Riesgo: medio por migración SQL y contrato RPC; mitigado con autorización explícita, transacción PostgreSQL y pruebas locales. No hay operaciones remotas.
