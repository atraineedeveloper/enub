# Tasks

- [x] Inspect the current client upload validation and production bucket restrictions.
- [x] Confirm the production bucket is private, capped at 10 MB and restricted to the existing MIME allowlist without reading document contents.
- [x] Review current Supabase Storage/Edge guidance and separate MIME/size restrictions from malware scanning.
- [x] Add binary content-signature validation for every currently allowed extension.
- [x] Apply the content validator to both upload and replacement before Storage writes.
- [x] Add focused Bun tests for accepted signatures and extension/content mismatches.
- [x] Add pgTAP regression coverage for bucket privacy, file-size ceiling and exact MIME allowlist.
- [x] Run frontend typecheck/lint/tests/build in GitHub CI.
- [x] Run the complete local PostgreSQL 17 Supabase migration/lint/pgTAP CI job; 39 database test files / 663 pgTAP assertions passed, including `worker_documents_storage_limits.test.sql`.
- [x] Record the remaining server-side quarantine/antimalware decision as GitHub issue #49.
- [ ] Synchronize/archive this OpenSpec change after merge/review.
