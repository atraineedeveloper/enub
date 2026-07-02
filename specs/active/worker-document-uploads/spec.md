# Feature Spec: Worker Document Uploads

## Status

Draft

## User request

La directora de la institución quiere que cada trabajador pueda subir documentos organizados por apartados: Datos personales, Docencia, Tutoría, Asesoría e Investigación.

## Problem

Actualmente Enub permite gestionar trabajadores, pero no cuenta con un expediente documental donde cada trabajador pueda cargar archivos requeridos por la institución.

## Goal

Permitir que cada trabajador tenga un expediente digital con documentos organizados por categoría y tipo de documento.

## Confirmed stakeholder decisions

- Los trabajadores subirán sus propios documentos.
- Dirección podrá revisar los documentos.
- Los documentos se aprobarán automáticamente al subirse.
- Se aceptarán PDF, Word, Excel e imágenes.
- El tamaño máximo recomendado para MVP será 10 MB por archivo.
- Todos los documentos serán opcionales.
- Los documentos de tipo Evidencias permitirán múltiples archivos.
- Datos personales serán documentos permanentes del trabajador.
- Docencia, Tutoría, Asesoría e Investigación serán documentos por semestre.
- No habrá fechas límite en el MVP.
- Se necesita descargar un reporte del estado documental del trabajador.

## Document scopes

### Worker-level permanent documents

The following category is permanent and not tied to a semester:

- Datos personales

### Semester-level documents

The following categories are tied to a semester:

- Docencia
- Tutoría
- Asesoría
- Investigación

## Scope - MVP

- Mostrar una pantalla de documentos por trabajador.
- Agregar ruta `/workers/:id/documents`.
- Agregar acción “Documentos” desde la tabla o vista de trabajadores.
- Mostrar los apartados:
  - Datos personales
  - Docencia
  - Tutoría
  - Asesoría
  - Investigación
- Mostrar los tipos de documentos requeridos en cada apartado.
- Permitir subir archivos para cada tipo de documento.
- Permitir reemplazar documentos de archivo único.
- Permitir múltiples archivos para tipos de Evidencias.
- Permitir abrir o descargar archivos subidos.
- Mostrar estado visual:
  - Pendiente
  - Cargado
- Permitir seleccionar semestre para documentos de Docencia, Tutoría, Asesoría e Investigación.
- Permitir descargar un reporte del estado documental del trabajador.

## Out of scope

- Aprobación/rechazo manual de documentos.
- Historial de versiones.
- Comentarios de revisión.
- Fechas límite.
- Notificaciones.
- Firma digital.
- Validación institucional avanzada.
- Reportes globales por todos los trabajadores.
- Dashboard administrativo de cumplimiento documental.

## File validation

Accepted file extensions:

- `.pdf`
- `.doc`
- `.docx`
- `.xls`
- `.xlsx`
- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

Maximum file size:

- 10 MB per file

## Data requirements

The implementation must support:

- Document categories
- Document types
- Worker document uploads
- Worker-level documents
- Semester-level documents
- Multiple files for evidence document types
- File metadata:
  - original file name
  - storage path
  - MIME type
  - file size
  - uploader
  - upload date

## UX requirements

The worker document page should show:

- Worker identity/name
- Permanent documents section
- Semester selector for semester-level documents
- Category sections
- Document rows
- Status badge:
  - Pendiente
  - Cargado
- Upload action
- Replace action for single-file documents
- View/download action for uploaded documents
- Report download action

## Verification plan

Before marking the feature as complete:

- Run `bun run lint`
- Run `bun run build`
- Run `bunx supabase db reset`
- Run `bunx supabase db lint`
- Manually verify `/workers/:id/documents`
- Verify upload for accepted file types
- Verify file size validation
- Verify multiple uploads for Evidencias
- Verify replacement for single-file document types
- Verify report download
- Verify documents remain organized by category and semester
