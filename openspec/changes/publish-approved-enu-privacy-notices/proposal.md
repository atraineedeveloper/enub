# Change: Publish approved ENU privacy notices

## Why

ENU processes personal data for worker administration, authentication, schedules, worker documents, and academic support records. The current application has no public privacy-notice route and the worker data-entry surfaces do not present a simplified privacy notice before collection.

Tabasco's current personal-data law requires the responsible public body to make an integral and a simplified privacy notice available, and requires the simplified notice to be provided before data is collected directly from the data subject. The notice cannot be treated as approved until the institution validates the legal responsible entity, responsible/Transparency Unit addresses, purposes, legal bases, transfer map, ARCO channel, and approval authority.

## What changes

This change is intentionally split into two stages.

### Stage 1 — approval package

- Inventory the personal-data treatments evidenced by the application and production schema without copying any real personal-data rows.
- Prepare integral and simplified notice drafts with every unresolved institutional field marked explicitly.
- Record the institutional approval checklist and legal-source baseline.
- Define the application integration points and acceptance criteria for eventual publication.

### Stage 2 — publication after institutional approval

- Replace all approval placeholders with institutionally validated text.
- Add a public integral privacy-notice route.
- Surface the simplified notice before direct worker/document collection and provide privacy links on public authentication/recovery surfaces.
- Add regression coverage for public availability and collection-point notice presentation.

## Impact

Stage 1 changes documentation only and does not modify production data, database policy, authentication, or the deployed UI. Stage 2 is blocked until the required institutional facts and final notice text are approved.
