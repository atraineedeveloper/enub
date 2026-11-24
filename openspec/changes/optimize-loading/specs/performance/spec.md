# Performance

## ADDED Requirements
### Requirement: On-demand PDF engine
PDF generation SHALL load engine and embedded fonts only when requested by a user, while retaining existing export output and error handling.
#### Scenario: Open schedule or document route
- WHEN the user opens a schedule or document route without exporting
- THEN its static dependency closure SHALL exclude the PDF engine and embedded fonts.
### Requirement: Reproducible measurement
The build SHALL provide a manifest-based report of static route bytes, gzip bytes and largest assets.
#### Scenario: CI build
- WHEN production build completes
- THEN CI SHALL report dependency sizes and check the audited routes for eager PDF assets.
