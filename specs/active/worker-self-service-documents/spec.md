# Feature Spec: Worker Self-Service Documents

## Status

Draft — revised after security review, revised again to add server-side worker account provisioning by invitation, revised a third time to resolve the two open questions from that update, and revised a fourth time to add an admin "Reenviar enlace de acceso" action closing an operational gap found during Phase 11 local testing (see all four revision notes at the top of `decisions.md`). No open questions remain for this scope.

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
- **(nuevo)** Aprovisionamiento server-side de cuentas por invitación: un admin hace clic en "Crear cuenta de acceso" sobre un trabajador, y una Edge Function de Supabase (`create-worker-account`) invita (o vincula, si ya existe) la cuenta Auth usando `public.workers.email`, y la vincula a `public.profiles` reutilizando `link_worker_account` sin escribir SQL nuevo. Ver [[decisions#21-server-side-provisioning-by-invitation-an-edge-function-not-a-bigger-rpc]] y [[implementation-plan#11-server-side-worker-account-provisioning-by-invitation-new]].
- **(nuevo)** Página mínima "activar cuenta" (`/set-password`) para que el trabajador invitado establezca su contraseña — dependencia necesaria y antes no contemplada, ver [[decisions#27-a-minimal-accept-invitation--set-password-page-becomes-necessary--found-dependency-not-originally-in-scope]].
- El flujo manual "Vincular cuenta existente" (antes "Vincular cuenta") se mantiene como respaldo cuando la invitación no aplica (correo no confiable, cuenta ya creada por otra vía, etc.).
- **(nuevo)** Acción admin "Reenviar enlace de acceso" para un trabajador que **ya tiene** una cuenta vinculada (`profiles.role = 'worker'`): una Edge Function separada (`resend-worker-access-link`) reenvía un enlace de recuperación/activación de contraseña a `public.workers.email`, que lleva a la misma página `/set-password`. Cubre dos casos operativos encontrados durante las pruebas locales de la Fase 11: (1) el trabajador cerró la pestaña de invitación antes de establecer su contraseña y el enlace original ya no es válido (`create-worker-account` solo devuelve `already_linked` en ese caso, sin dar una salida); (2) un trabajador ya activo olvidó su contraseña después. Esta acción **no reemplaza** "Crear cuenta de acceso" ni **elimina** "Vincular cuenta existente" — las tres coexisten permanentemente. Ver [[decisions#30-reenviar-enlace-de-acceso-a-separate-edge-function-not-a-create-worker-account-branch-and-not-the-general-self-service-forgot-password-flow]] y [[implementation-plan#12-resendrecover-access-link-new-spec-only]].

## Out of scope

- Registro público / auto-registro de trabajadores (`supabase.auth.signUp`). Una invitación sigue siendo iniciada por un admin, nunca un formulario público.
- Creación manual del usuario de Supabase Auth vía Studio/Dashboard **como único camino** — ya no es el único, ver la nueva Edge Function arriba, pero sigue disponible como respaldo. Ver [[decisions#3-provisioning-of-the-auth-account-itself]] (parcialmente superada).
- Aprobación/rechazo manual de documentos (ya estaba fuera de alcance).
- **Recuperación de contraseña de autoservicio general** ("olvidé mi contraseña" iniciado por el propio trabajador, público, sin admin de por medio, para cualquier cuenta ya activa) — sigue fuera de alcance. Esto es distinto tanto de la página mínima "activar cuenta" (`/set-password`, ver arriba) como de la nueva acción admin **"Reenviar enlace de acceso"** (ver arriba y [[decisions#30-reenviar-enlace-de-acceso-a-separate-edge-function-not-a-create-worker-account-branch-and-not-the-general-self-service-forgot-password-flow]]) — esta última es admin-iniciada, admin-autenticada, y limitada a un `workerId` específico ya seleccionado por el admin en la UI; no es un formulario público de "olvidé mi contraseña".
- Contraseñas temporales generadas por el sistema como método de aprovisionamiento — se decidió invitación por correo en su lugar. Ver [[decisions#22-invitation-over-temporary-passwords]].
- Agregar una restricción de formato/unicidad a `public.workers.email` a nivel de base de datos — validado en la Edge Function en su lugar, ver [[database-plan#15-workersemail-data-quality-considered-deferred]].
- Un panel de administración de invitaciones (revocar, ver estado de invitaciones pendientes, vista masiva). **Reenviar el enlace para un trabajador puntual ya no está fuera de alcance** — ver la nueva acción "Reenviar enlace de acceso" arriba — pero revocar una invitación y una vista de invitaciones pendientes/masiva siguen fuera de alcance.
- Dashboard global de cumplimiento documental.
- Notificaciones (más allá del correo de invitación que Supabase Auth ya envía nativamente).
- Firma digital.
- Cambiar la tabla `public.roles` existente ("Administrative college roles") — no tiene relación con el modelo de autorización de esta spec. Ver [[decisions#2-why-not-reuse-the-existing-public-roles-table]].
- Diferenciar permisos entre `staff` y `admin` más allá de quién puede vincular/crear cuentas. Ambos conservan el mismo acceso amplio a expedientes que existe hoy.
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

### Nuevos criterios de aceptación: aprovisionamiento por invitación

- Un `admin` puede hacer clic en "Crear cuenta de acceso" sobre un trabajador con correo válido y sin cuenta vinculada, y el trabajador recibe una invitación por correo.
- Si el trabajador ya tiene una cuenta Auth con ese correo, no se crea una cuenta duplicada; se vincula la existente.
- Si `workers.email` está vacío, la acción se bloquea con un error claro antes de cualquier llamada a la API de Auth.
- Si `workers.email` no tiene un formato válido, la acción se bloquea con un error claro.
- Si el correo está duplicado entre varios trabajadores, la acción se bloquea con un error claro hasta corregir los datos.
- Si el trabajador ya tiene un perfil vinculado, la acción responde con un mensaje claro de "ya vinculado" sin invitar de nuevo ni fallar de forma confusa.
- Un usuario `staff` (no admin) que invoque la Edge Function directamente (sin pasar por la UI) es rechazado por la función `link_worker_account` subyacente, no solo por la UI oculta.
- Ninguna clave `service_role` aparece en `src/`, variables de entorno de Vite, código de frontend, ni en archivos versionados.
- El mismo código de la Edge Function funciona sin cambios contra Supabase local y remoto — la diferencia está en qué proyecto la ejecuta y en `WORKER_INVITE_REDIRECT_URL`, nunca en URLs escritas en el código.
- Ejecutar/probar la Edge Function localmente (`supabase functions serve`) nunca aprovisiona una cuenta real en el proyecto remoto.
- Provisionar en el proyecto remoto requiere un despliegue explícito (`supabase functions deploy`) y configuración explícita de secretos — nunca ocurre como efecto secundario de trabajo local.
- El flujo de invitación no está completo de extremo a extremo hasta que exista la página "activar cuenta" (`/set-password`) **y esté verificada** (invitación → sesión activa → contraseña establecida → cierre de sesión → inicio de sesión exitoso con la nueva contraseña). Ver [[decisions#27-revised-a-minimal-accept-invitation--set-password-page-is-required--provisioning-is-not-complete-without-it]] — esto es una condición de completitud (gate), no solo una dependencia documentada.
- `create-worker-account` nunca acepta un correo escrito manualmente como respaldo; solo usa `public.workers.email`. Si está vacío, inválido o duplicado, se bloquea — el admin debe corregir el dato del trabajador, no escribir un correo alterno en esa acción. Ver [[decisions#29-the-automatic-provisioning-flow-never-accepts-a-manually-typed-fallback-email]].
- Verificación de correo de invitación en local: no alcanza con que la llamada a la API tenga éxito — debe verificarse el contenido real del correo en el inbox local de Mailpit (destinatario, enlace válido, redirección a la URL local). En producción, la verificación debe hacerse contra un buzón real controlado, nunca contra Mailpit. Ver [[decisions#28-resolved-local-invite-email-testing-must-verify-content-not-just-api-success-production-must-not-rely-on-mailpit]].
- `/set-password` existe, cumple el alcance mínimo (lee la sesión de la invitación, permite establecer/actualizar contraseña, muestra estados claros de éxito/error, redirige a `/my-documents` al terminar, no implementa recuperación general, no expone `service_role`, no crea ni vincula perfiles), y está verificada de extremo a extremo antes de considerar completo el aprovisionamiento de cuentas.
- El flujo manual "Vincular cuenta existente" se mantiene disponible permanentemente después de que `create-worker-account` exista — no es una solución transitoria a eliminar más adelante.

### Nuevos criterios de aceptación: reenvío de enlace de acceso

- Un `admin` puede hacer clic en "Reenviar enlace de acceso" sobre un trabajador que **ya tiene** una cuenta vinculada (`profiles.role = 'worker'` para ese `worker_id`), y el trabajador recibe un nuevo correo con un enlace que lleva a `/set-password`.
- Esto cubre tanto al trabajador que nunca terminó de establecer su contraseña (el enlace de invitación original se perdió, cerró la pestaña, o expiró) como al trabajador que ya activó su cuenta antes y ahora olvidó su contraseña — un solo mecanismo para ambos casos operativos.
- Un trabajador **sin** cuenta vinculada (no existe fila en `profiles` para ese `worker_id`) no puede recibir este reenvío: la acción responde con un error claro indicando usar "Crear cuenta de acceso" primero, y no se envía ningún correo ni se toca `profiles`.
- La función servidor-side (`resend-worker-access-link`) recibe únicamente `{ workerId }`; nunca acepta ni acepta implícitamente un correo escrito manualmente — el correo siempre se resuelve desde `public.workers.email`, igual que `create-worker-account` (decisions.md #29, extendido a esta función).
- Un usuario `staff` (no admin) que invoque esta función directamente, sin pasar por la UI, es rechazado server-side, igual que para `create-worker-account`.
- Esta función nunca llama a `link_worker_account` ni a `unlink_worker_account`, y nunca escribe en `profiles` bajo ningún código de ejecución — solo envía un correo.
- Esta función no necesita ni usa la clave `service_role` en absoluto (a diferencia de `create-worker-account`, que sí la usa para `inviteUserByEmail`) — ver [[decisions#32-minimal-privilege-client-choice-resend-worker-access-link-never-reads-or-uses-the-service-role-key]].
- "Crear cuenta de acceso" y "Vincular cuenta existente" permanecen sin cambios de comportamiento después de agregar esta tercera acción.
- El enlace de reenvío usa el mismo `WORKER_INVITE_REDIRECT_URL` ya configurado para la invitación original — no se introduce una variable de entorno nueva (ver [[decisions#31-reused-redirect-target-worker_invite_redirect_url-covers-both-invite-and-resendrecovery-links-not-a-second-env-var]]).
- Verificación local del contenido real del correo reenviado (destinatario, enlace válido, redirección a `/set-password` local) sigue el mismo estándar que decisions.md #28 para la invitación original — no basta con que la llamada a la API no falle.

## Environment and secrets (summary)

Detalle completo en `decisions.md` #25–26 e `implementation-plan.md` §11.4. Resumen:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, y `SUPABASE_SERVICE_ROLE_KEY` los inyecta automáticamente la plataforma/CLI de Supabase para cualquier Edge Function, tanto local (`supabase functions serve`) como remoto (una vez desplegada) — nunca se escriben a mano ni se hardcodean URLs.
- El único secreto propio de esta feature es `WORKER_INVITE_REDIRECT_URL` (a dónde lleva el enlace de invitación) — distinto por entorno, configurado vía archivo `.env` local (`--env-file`, no comiteado) o `supabase secrets set` en remoto. La nueva Edge Function `resend-worker-access-link` reutiliza esta misma variable (mismo destino, `/set-password`) — no se agrega una segunda variable de entorno para el reenvío. Ver [[decisions#31-reused-redirect-target-worker_invite_redirect_url-covers-both-invite-and-resendrecovery-links-not-a-second-env-var]].
- El frontend nunca ve ni necesita la `service_role` key; solo llama `supabase.functions.invoke(...)` con el cliente anon-key que ya usa en todas partes.
- Desplegar a remoto es una acción explícita, separada, y aprobada por un humano — no ocurre por trabajar/probar localmente.

## Open questions

Ninguna pendiente para este alcance. Las dos preguntas abiertas de la revisión anterior quedaron resueltas:

- ¿Verificación local de correo por contenido real vs. solo éxito de API? **Resuelto:** contenido real en Mailpit es obligatorio en local; producción usa un buzón real controlado, nunca Mailpit. Ver [[decisions#28-resolved-local-invite-email-testing-must-verify-content-not-just-api-success-production-must-not-rely-on-mailpit]].
- ¿Alcance y necesidad de `/set-password`? **Resuelto:** es una dependencia obligatoria (gate) con alcance mínimo explícito, no opcional. Ver [[decisions#27-revised-a-minimal-accept-invitation--set-password-page-is-required--provisioning-is-not-complete-without-it]].

## Verification plan

Ver [[verification-plan]].
