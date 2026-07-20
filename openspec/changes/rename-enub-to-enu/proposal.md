# Change: Rename the visible product brand from ENUB to ENU

## Why

The product must present a single, consistent public name: **ENU**. The current name **ENUB/Enub** appears in the authenticated interface, browser metadata, PWA installation data, generated PDFs, authentication emails and development-facing documentation. A partial replacement would leave users seeing different names depending on the surface.

## What changes

- Replace user-visible `ENUB` and `Enub` branding with `ENU`.
- Update browser title and PWA `name`/`short_name`.
- Update the authenticated header, generated PDF headings and Supabase email templates.
- Update current documentation where it describes the product name.
- Add or adjust focused tests where branding output is already covered.

## Non-goals

- Do not rename the GitHub repository, package identifier, asset filenames, database objects, environment variables or internal technical keys merely because they contain `enub`.
- Do not rewrite archived OpenSpec changes or historical decision records.
- Do not redesign logos or replace image assets in this change.

## Verification

- A repository search finds no remaining user-facing `ENUB` or `Enub` references outside explicitly excluded historical or technical locations.
- `bun run typecheck`, `bun run lint`, relevant tests and `bun run build` pass.
- The header, installed PWA metadata, authentication emails and representative PDFs display `ENU`.