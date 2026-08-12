# Worker document upload security

## Requirement: uploaded bytes match the selected document format

Before ENU uploads a worker document to Storage, the application MUST validate that the file bytes match the expected binary family for its extension.

### Scenario: valid PDF

- GIVEN a `.pdf` file within the configured size limit
- AND its bytes contain a valid PDF header
- WHEN the user uploads or replaces a document
- THEN content validation succeeds and the normal Storage flow may continue.

### Scenario: renamed file

- GIVEN a file named with an allowed extension
- BUT its bytes do not match that extension's expected format
- WHEN the user uploads or replaces a document
- THEN ENU rejects it before any Storage upload
- AND shows a controlled error that the file content does not match its extension.

## Requirement: all current allowed formats have a content check

The content validator MUST cover every extension in `ALLOWED_DOCUMENT_FILE_EXTENSIONS`: PDF, DOC, DOCX, XLS, XLSX, JPG/JPEG, PNG and WEBP.

The Office Open XML checks MUST distinguish Word and Excel containers using structural entry-name markers in addition to the ZIP signature.

## Requirement: Storage restrictions remain fail-closed

The `worker_documents` bucket MUST remain private, MUST enforce a 10 MB file-size limit and MUST retain exactly the approved MIME allowlist represented by the repository upload limits.

CI MUST include database assertions for these bucket properties.

## Requirement: signature validation is not represented as antimalware

User-facing or technical documentation MUST NOT claim that the binary checks prove a document is malware-free.

A future quarantine/antimalware implementation MUST be separately designed and approved before existing or newly uploaded personal documents are sent to an external scanning provider.