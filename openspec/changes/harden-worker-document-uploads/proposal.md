# Proposal: harden worker document uploads

## Why

ENU already restricts the private `worker_documents` bucket to 10 MB and a closed MIME allowlist, and the application rejects unsupported extensions. However, the frontend currently assigns the Storage `contentType` from the file extension. A renamed or malformed file can therefore present an allowed extension/MIME without its bytes matching the expected document format.

This change adds content-signature validation before the application uploads a file and adds database regression coverage for the bucket restrictions that form the server-side size/MIME boundary.

## What changes

- validate the binary signature/structure expected for PDF, JPEG, PNG, WEBP, legacy Office OLE files, DOCX and XLSX before upload;
- reject obvious extension/content mismatches with a controlled Spanish error;
- run the same validation for ordinary upload and replacement;
- add focused Bun tests for valid signatures and renamed/mismatched files;
- add pgTAP coverage proving the `worker_documents` bucket remains private, capped at 10 MB and restricted to the repository's approved MIME set;
- document the residual risk and a future quarantine/antimalware path without pretending content-signature checks are malware scanning.

## Out of scope

- changing the current allowed extensions or 10 MB limit;
- claiming that signature validation detects malware, macros, embedded objects or all polyglot files;
- selecting or integrating an antivirus vendor;
- uploading documents to a new quarantine bucket in this iteration;
- modifying existing stored documents.

## Impact

Normal valid uploads keep the same accepted formats and size limit. Files whose bytes do not match the extension selected by the user fail before any Storage object or metadata row is created.