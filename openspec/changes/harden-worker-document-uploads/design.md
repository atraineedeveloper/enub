# Design: layered worker document upload validation

## Current boundary

The private `worker_documents` bucket is configured with `file_size_limit = 10485760` and an allowlist for PDF, Word, Excel, JPEG, PNG and WEBP MIME types. The frontend also checks extension and size before calling Storage.

The missing control is binary-format validation: `apiWorkerDocuments.ts` currently derives the upload `contentType` from the extension, so the application can label malformed bytes with an allowed MIME.

## Decision 1: validate bytes before Storage

Add a pure, testable content validator in the frontend service layer. Both `uploadWorkerDocument` and `replaceWorkerDocument` MUST call it after the existing extension/size validation and before generating/uploading a Storage object.

The validator checks conservative signatures:

- PDF: `%PDF-` header;
- JPEG: JPEG SOI marker;
- PNG: standard 8-byte PNG signature;
- WEBP: RIFF container with `WEBP` form type;
- `.doc` / `.xls`: Compound File Binary (OLE) header;
- `.docx`: ZIP container plus Office content markers including `[Content_Types].xml` and `word/`;
- `.xlsx`: ZIP container plus Office content markers including `[Content_Types].xml` and `xl/`.

A mismatch fails with one controlled user-facing error and no upload attempt.

## Decision 2: preserve the existing server boundary

This change does not broaden the bucket. The bucket must remain private, capped at exactly 10 MB and restricted to the same eight MIME values already versioned by `20260702145901_worker_documents_storage_bucket.sql`.

Add pgTAP assertions against `storage.buckets` so future migrations cannot silently make the bucket public, remove the size limit or broaden the MIME allowlist without failing CI.

## Decision 3: no false claim of malware scanning

Magic/signature checks reject obvious renamed or structurally mismatched files but do not establish that a file is safe. In particular, they do not detect malicious PDF content, Office macros/embedded objects, exploit payloads or every possible polyglot.

A later malware-control iteration should use a server-controlled quarantine workflow: receive/upload into a non-user-visible quarantine location, scan with an institutionally approved engine/service, promote only clean objects to the final private bucket, and retain only minimal scan status/error metadata. The final design depends on provider, cost, privacy/contractual review and acceptable failure behavior, so no vendor is selected here.

## Decision 4: do not inspect existing production documents

Validation applies prospectively. Existing objects are not downloaded or reclassified by this change. Any future retrospective scan must be a separately approved operation because it would process stored personal documents.

## Verification

- Bun unit tests cover each accepted binary family and representative mismatches/renamed executable-like content.
- Existing upload/replacement service tests continue to pass.
- pgTAP verifies bucket privacy, exact size ceiling and exact MIME allowlist.
- GitHub CI runs frontend validation plus the full local Supabase migration/lint/pgTAP job.