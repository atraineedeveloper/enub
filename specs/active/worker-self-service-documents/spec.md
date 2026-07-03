# Feature Spec: Worker Self-Service Documents

## Status

Draft — revised after security review (see the revision note at the top of `decisions.md`).

## User request

Cada trabajador debe poder iniciar sesión con su propia cuenta de Supabase Auth y subir únicamente sus propios documentos institucionales.

## Problem

`worker-document-uploads` (feature previa) construyó el expediente documental pero fue explícitamente staff-facing: cualquier usuario autenticado podía ver o subir documentos de cualquier trabajador, porque no existe relación entre `auth.users` y `workers`, ni niveles de rol (`decisions.md` #11 de esa spec). Esta spec construye esa relación y el aislamiento por dueño que quedó pendiente.

## Goal

Permitir que un trabajador autenticado inicie sesión con su propia cuenta y vea, suba, reemplace, abra y descargue únicamente sus propios documentos — reutilizando la UI de expediente documental ya construida, sin duplicarla.

## Relationship to `worker-document-uploads`

Esta spec no reemplaza esa feature; la extiende. Se mantiene:

- El esquema `worker_document_categories` / `worker_document_types` / `worker_documents`.
- El bucket `worker_documents` y sus reglas de tipo/tamaño de archivo.
- La UI de expediente (`WorkerDocuments.jsx` y sus hooks), que se **refactoriza para reutilizarse**, no se reescribe.

Ver [[decisions#15-supersedes-uploaded_by-semantics-from-worker-document-uploads]] para el único punto donde esta spec corrige una decisión previa.

## Scope - MVP

- Crear tabla de mapeo `auth.users` ↔ `workers` con un modelo de rol de aplicación: `admin`, `staff`, `worker`.
- Crear funciones SQL auxiliares para resolver el rol y el `worker_id` del usuario autenticado.
- Crear funciones RPC `link_worker_account`, `unlink_worker_account`, y `grant_staff_role` (todas solo `admin`) para gestionar la vinculación de cuentas.
- Agregar acciones de administración ("Vincular cuenta", "Desvincular cuenta", "Grant staff access") en la UI de trabajadores para invocar esas funciones.
- Agregar ruta `/my-documents` para trabajadores y ruta `/pending-access` para cuentas autenticadas sin rol reconocido.
- Resolver `worker_id` desde el usuario autenticado, nunca desde la URL, para la vista de autoservicio.
- Reutilizar el módulo existente de documentos extrayendo una vista compartida parametrizada por `workerId`.
- Restringir acceso mediante RLS en `workers`, `worker_documents`, `profiles` y el bucket `worker_documents`, con un modelo **deny-by-default**: sin fila explícita en `profiles`, no hay acceso de ningún tipo (ver [[decisions#7-revised-no-profiles-row-means-no-access-default-deny]]).
- Migración de una sola vez (backfill) que otorga `role = 'staff'` explícito a cada cuenta `auth.users` preexistente, para no bloquear al personal actual.
- Mantener `/workers/:id/documents` para staff/admin, sin cambios de comportamiento visible.
- Redirigir automáticamente: `worker` → `/my-documents`; cualquier sesión autenticada sin rol reconocido → `/pending-access`. Nunca al revés (nunca tratar "no es worker" como sinónimo de acceso de staff).

## Out of scope

- Registro público / auto-registro de trabajadores (`supabase.auth.signUp`).
- Creación del usuario de Supabase Auth en sí (sigue siendo manual, vía Supabase Studio/Dashboard, por un admin). Ver [[decisions#3-provisioning-of-the-auth-account-itself]].
- Aprobación/rechazo manual de documentos (ya estaba fuera de alcance).
- Recuperación avanzada de contraseña / flujo de invitación por correo.
- Dashboard global de cumplimiento documental.
- Notificaciones.
- Firma digital.
- Cambiar la tabla `public.roles` existente ("Administrative college roles") — no tiene relación con el modelo de autorización de esta spec. Ver [[decisions#2-why-not-reuse-the-existing-public-roles-table]].
- Diferenciar permisos entre `staff` y `admin` más allá de quién puede vincular cuentas. Ambos conservan el mismo acceso amplio a expedientes que existe hoy.
- Hacer reproducible localmente el bucket `profile_pictures` (gap ya documentado en la spec anterior).

## Role model (summary)

**Deny by default: no `profiles` row means no access, in every case, with no exceptions.** This replaced an earlier draft of this spec that defaulted no-row accounts to `staff` — that was a privilege-escalation bug (a freshly created, not-yet-linked worker Auth account would have been full staff until someone linked it) and has been corrected. See `decisions.md` #7.

| Rol | Quién | Acceso |
|---|---|---|
| `worker` | Cuenta Auth con fila explícita `role = 'worker'` y `worker_id` no nulo en `profiles` | Solo su propio expediente, vía `/my-documents` |
| `staff` | Cuenta Auth con fila explícita `role = 'staff'` en `profiles` (vía la migración de backfill para cuentas preexistentes, o `grant_staff_role` para cuentas nuevas) | Todo lo que existe hoy: todas las rutas, todos los expedientes |
| `admin` | Cuenta Auth con fila explícita `role = 'admin'` en `profiles` | Igual que `staff`, más la capacidad de ejecutar `link_worker_account`, `unlink_worker_account`, y `grant_staff_role` |
| *(sin fila)* | Cualquier cuenta Auth sin fila en `profiles` — incluye cuentas de trabajador recién creadas en Studio pero aún no vinculadas | **Ninguno.** Aterriza en `/pending-access`. Nunca se trata como `staff`. |

Detalle completo en [[decisions]] y [[database-plan]].

## Acceptance criteria

- Un trabajador puede iniciar sesión con email/password usando el mismo formulario de login existente.
- Después de iniciar sesión, un trabajador con rol `worker` es redirigido a `/my-documents`.
- El sistema identifica automáticamente su `worker_id` a partir de su sesión, no de la URL.
- El trabajador ve, sube, reemplaza y descarga documentos únicamente de su propio expediente.
- El trabajador no puede ver el expediente de otro trabajador cambiando la URL o el `workerId` en una llamada directa a Supabase.
- Un trabajador que navega a una ruta de staff (`/workers`, `/degrees`, `/workers/:id/documents`, etc.) es redirigido a `/my-documents`.
- Staff/admin conservan acceso sin cambios a `/workers/:id/documents` para cualquier trabajador.
- Un usuario `admin` puede vincular una cuenta Auth existente a un trabajador desde la tabla de trabajadores.
- Un usuario `staff` (no admin) no puede ejecutar la vinculación, ni la desvinculación, ni otorgar rol de staff.
- Una cuenta Auth creada en Studio pero **no vinculada todavía** no obtiene acceso de staff ni de worker: aterriza en `/pending-access`.
- Toda cuenta `auth.users` que existía antes de esta feature conserva su acceso de staff después del despliegue, gracias a la migración de backfill — nadie legítimo queda bloqueado.
- `link_worker_account` rechaza vincular una cuenta que ya tiene rol `admin`/`staff`, o que ya está vinculada a otro trabajador, sin sobrescribir silenciosamente.
- No se puede eliminar una fila de `workers` mientras tenga una cuenta vinculada (`ON DELETE RESTRICT`); debe desvincularse explícitamente primero, y al desvincular la cuenta vuelve a "sin acceso", nunca a `staff`.
- RLS bloquea el acceso cruzado incluso si se llama a Supabase directamente (REST/consola), no solo desde la UI.
- La tabla `profiles` no es escribible directamente por `authenticated`; solo las funciones RPC (SECURITY DEFINER) escriben en ella.

## Verification plan

Ver [[verification-plan]].
