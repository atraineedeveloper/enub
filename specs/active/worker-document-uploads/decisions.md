# Decisions - Worker Document Uploads

## 1. Who uploads documents?

Workers upload their own documents.

## 2. Who reviews documents?

Direction/admin users can review uploaded documents.

## 3. Approval flow

Documents are automatically approved after upload.

No manual approval/rejection flow is included in the MVP.

## 4. Accepted file types

The system accepts:

- PDF: `.pdf`
- Word: `.doc`, `.docx`
- Excel: `.xls`, `.xlsx`
- Images: `.jpg`, `.jpeg`, `.png`, `.webp`

## 5. Maximum file size

MVP limit: 10 MB per file.

Reason:

- It is enough for most institutional PDFs, Word/Excel files, and compressed images.
- It reduces storage abuse.
- It can be increased later if the institution needs larger scanned files.

## 6. Required vs optional documents

All documents are optional in the MVP.

The system should show document status but should not block users if documents are missing.

## 7. Multiple files

Evidence-related document types allow multiple files:

- Docencia / Evidencias
- Tutoría / Evidencias de actividades
- Asesoría / Evidencias

All other document types allow one active file per worker and period.

## 8. Document period model

Documents use two scopes:

### Permanent worker-level documents

Datos personales documents are permanent and are not tied to a semester.

Examples:

- Acta de nacimiento
- CURP
- Curriculum Vitae actualizado
- Credencial de elector
- Constancia de situación fiscal SAT
- Nombramiento

### Semester-level documents

Docencia, Tutoría, Asesoría, and Investigación documents are tied to a semester.

Reason:
These documents represent work, evidence, reports, or academic activity for a specific academic period.

## 9. Deadlines

No deadlines are required in the MVP.

## 10. Report

The system must allow downloading a report of the worker document status.

MVP report should include:

- Worker name
- Selected semester when applicable
- Categories
- Document types
- Uploaded/pending status
- Upload date when available
- File name when available
