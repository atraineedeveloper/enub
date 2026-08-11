# Inventario técnico inicial de tratamientos de datos personales de ENU

**Estado:** evidencia técnica para revisión institucional. No sustituye el inventario formal del Responsable ni contiene valores reales de personas.

**Corte técnico:** 11 de agosto de 2026.

## 1. Expediente maestro de trabajadores

Evidencia estructurada en `workers` y relaciones asociadas.

| Categoría | Elementos evidenciados | Observación de clasificación |
| --- | --- | --- |
| Identificación | nombre, fotografía, RFC | RFC es además un identificador fiscal. |
| Contacto/domicilio | calle, colonia, código postal, ciudad, estado, teléfono, correo electrónico | Datos de contacto y localización. |
| Laborales/profesionales | especialidad, tipo de trabajador, función desempeñada, estatus, observaciones | `observations` es texto libre y requiere regla institucional para impedir datos excesivos o sensibles sin necesidad. |
| Plaza/adscripción | tipo de sostenimiento, clave de pago, plaza | Evidenciados por las relaciones del trabajador; clasificación final laboral/patrimonial a validar. |
| Antigüedad/ingreso | tipo y fecha de ingreso | Dato laboral. |

## 2. Identidad digital, roles y vinculación de cuenta

Evidencia en `profiles`, `roles`, `state_roles` y el sistema de autenticación.

Datos técnicos/administrativos evidenciados: UUID de cuenta, rol de aplicación, vínculo con `worker_id`, rol/cargo administrativo y marcas de tiempo.

Finalidad técnica observada: autenticar, vincular la identidad digital con el trabajador y aplicar autorización por rol. La finalidad jurídica definitiva debe ser aprobada institucionalmente.

## 3. Horarios y actividades

Evidencia en `schedule_assignments` y `schedule_teachers`.

Datos evidenciados: trabajador, semestre, día, horarios de inicio/fin, grupo, asignatura y/o actividad.

Clasificación preliminar: laboral/académica. La institución debe confirmar finalidades y conservación.

## 4. Repositorio de documentos del trabajador

Evidencia en `worker_documents` y Storage privado.

Metadatos evidenciados: trabajador, tipo de documento, semestre, nombre de archivo, ruta de almacenamiento, tipo MIME, tamaño, usuario que cargó y fecha de carga.

### Documentos personales configurados y activos

- Acta de nacimiento.
- CURP.
- Curriculum Vitae actualizado.
- Credencial de elector.
- Constancia de situación fiscal (SAT).
- Nombramiento.

Estos documentos pueden concentrar múltiples categorías de datos personales. La clasificación formal debe realizarse por tipo documental y por los campos efectivamente contenidos, no únicamente por el nombre del archivo.

## 5. Documentación académica, docente, de tutoría, asesoría e investigación

El sistema permite, entre otros, los siguientes tipos activos:

- planeación semestral, rúbricas, listas de cotejo, evidencias bimestrales, listas de asistencia, actas de evaluación y concentrados de calificaciones finales;
- planes e informes de tutoría, canalizaciones, evidencias de actividades y listas de asistencia;
- controles/bitácoras de asesoría, evidencias y documentos de titulación/dictámenes;
- artículos, ponencias, capítulos de libro, informes técnicos y otros productos académicos.

### Riesgo de datos de terceros

Aunque los archivos estén asociados al expediente de un trabajador, algunos pueden contener datos personales de estudiantes u otras personas. Ejemplos claros de posible presencia de terceros son listas de asistencia, actas de evaluación, concentrados de calificaciones, controles de asesoría y canalizaciones.

**No se afirma que todos estos documentos contengan datos sensibles.** Sin embargo, una canalización u otro documento de tutoría puede llegar a incluir información de salud, psicológica, familiar u otra categoría sensible según su contenido. La institución debe definir qué contenido se espera, qué contenido está prohibido, cuál es su fundamento, quién puede acceder y cuánto tiempo debe conservarse.

## 6. Corrección de correo para acceso

Evidencia en `worker_access_email_corrections`.

Datos evidenciados: trabajador, UUID de cuenta vinculada, correo solicitado, correo esperado del expediente, estado del trámite, UUID de quien reclama/gestiona, código de motivo y marcas de tiempo.

Finalidad técnica observada: resolver discrepancias de identidad/correo para vincular acceso. Deben validarse finalidad institucional, conservación y trazabilidad.

## 7. Datos que no deben inferirse como presentes sin evidencia

Este inventario no declara como recolectados de forma estructurada datos de salud, biométricos, origen étnico, religión, opiniones políticas, orientación sexual u otras categorías sensibles sólo por ser jurídicamente posibles. Si aparecen dentro de archivos cargados o texto libre, deberán clasificarse conforme al contenido real y a una finalidad legítima documentada.

## 8. Proveedores y flujo externo pendiente de validación

La aplicación utiliza infraestructura hospedada para frontend, autenticación, base de datos y almacenamiento. La institución debe documentar contractualmente qué proveedores actúan como encargados/remisiones, ubicación y condiciones del tratamiento, y distinguir esos flujos de las transferencias a terceros que deban declararse como tales en el aviso.

## 9. Decisiones institucionales pendientes

Antes de aprobar el aviso se requiere confirmar, para cada tratamiento: Responsable y área administradora; titulares afectados; finalidad; fundamento jurídico específico; origen de los datos; categorías exactas; datos sensibles esperados/prohibidos; usuarios con acceso; transferencias/remisiones; conservación y disposición; mecanismo ARCO; y vínculo con series documentales/archivo institucional.
