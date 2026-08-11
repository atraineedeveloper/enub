# Tasks

## Stage 1 — approval package

- [x] Verify the current federal and Tabasco privacy-notice requirements from official sources.
- [x] Inspect current ENU routes and personal-data collection surfaces.
- [x] Inventory production schema fields and configured worker document types without reading personal-data rows.
- [x] Identify third-party/student-data risk inside academic and tutoring uploads.
- [x] Prepare integral and simplified notice drafts with institutional placeholders.
- [x] Prepare the institutional approval checklist.
- [ ] Confirm whether an existing approved SETAB notice already covers ENU's worker/document system.
- [ ] Confirm the exact legal Responsible, Responsible address, and Transparency Unit ARCO address/channel.
- [ ] Confirm final purposes, purpose-specific legal bases, transfer/remission map, and any consent-dependent treatment.
- [ ] Classify the actual content expectations for academic/tutoring uploads, including whether sensitive personal data is expected or prohibited.
- [ ] Obtain institutional/legal approval and record the approved version/date.

## Stage 2 — publication (blocked until Stage 1 approval)

- [ ] Replace every `PENDIENTE DE VALIDACIÓN INSTITUCIONAL` marker with approved content.
- [ ] Add a public integral privacy-notice route.
- [ ] Present the approved simplified notice before direct worker/document collection.
- [ ] Add privacy links to login/recovery surfaces and other relevant collection points.
- [ ] Add route and collection-point regression tests.
- [ ] Run `bun run typecheck`, `bun run lint`, relevant tests, and `bun run build`.
- [ ] Deploy only after confirming the published text matches the approved institutional version.
