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

## 11. Access model for MVP

This MVP is staff-facing only, matching the current Enub architecture.

Any authenticated internal user may upload or view documents for any worker. There is no per-worker login and no ownership-based restriction in this phase.

Reason:

- The app has no mapping between `auth.users` and `workers`, and no role tiers (all authenticated users are treated equally today). Building that is a materially larger change than worker document uploads.

Future follow-up (separate spec, not part of this feature):

- `auth.users` to `workers` mapping.
- Worker self-service portal (workers log in and manage only their own documents).
- Dirección/admin role tier, distinct from general staff.
- Ownership-based RLS policies once the above exist.

## 12. Data-integrity triggers

Database triggers (not just app-layer checks) enforce the following invariants on `worker_documents`:

- Permanent-category documents must have `semester_id = null`.
- Semester-category documents must have `semester_id` not null.
- Non-multiple document types reject a second active row for the same `worker_id` + `document_type_id` + `semester_id` scope.

Reason:

- These are correctness invariants that must hold regardless of which client writes the row (app, Studio, future scripts), not just the current UI.

Replacement for single-file document types stays app-layer: `apiWorkerDocuments.js` deletes the old storage object and row, then inserts the replacement. The trigger's job is to reject accidental duplicates, not to perform the replace.

## 13. Storage bucket privacy

The `worker_documents` bucket is created with `public = false`.

View/download uses `createSignedUrl`. `getPublicUrl` is not used for worker documents.

Reason:

- These files include CURP, INE/credencial de elector, constancia fiscal, and similar personal identity documents — more sensitive than the existing public `profile_pictures` bucket.

## 14. `profile_pictures` bucket migration gap

Out of scope for this feature. The existing `profile_pictures` bucket has no migration and is not reproducible via local `db reset`.

A separate follow-up note/spec should address making `profile_pictures` reproducible locally.

For this feature, `worker_documents` must be created via migration so it doesn't repeat the same gap.

## 15. `uploaded_by` semantics

`uploaded_by` records the authenticated internal/staff user who performed the upload, not the worker the document belongs to.

`worker_id` identifies the worker the document is about.

`uploaded_by` should not be made to equal the worker until worker self-service accounts exist (see [[decisions#11-access-model-for-mvp]]).
