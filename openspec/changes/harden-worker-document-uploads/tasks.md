# Tasks

- [x] Inspect the current client upload validation and production bucket restrictions.
- [x] Confirm the production bucket is private, capped at 10 MB and restricted to the existing MIME allowlist without reading document contents.
- [x] Review current Supabase Storage/Edge guidance and separate MIME/size restrictions from malware scanning.
- [ ] Add binary content-signature validation for every currently allowed extension.
- [ ] Apply the content validator to both upload and replacement before Storage writes.
- [ ] Add focused Bun tests for accepted signatures and extension/content mismatches.
- [ ] Add pgTAP regression coverage for bucket privacy, file-size ceiling and exact MIME allowlist.
- [ ] Run frontend typecheck/lint/tests/build.
- [ ] Run the complete local Supabase migration/lint/pgTAP CI job.
- [ ] Record the remaining quarantine/antimalware decision as separate follow-up work.
- [ ] Synchronize/archive this OpenSpec change after validation.