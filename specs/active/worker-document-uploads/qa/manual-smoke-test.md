# Manual Smoke Test — Worker Document Uploads

## Date

2026-07-02

## Environment

- Local Supabase
- Local Vite app
- Browser:

## Automated checks

- [x] `bunx supabase db reset`
- [x] `bunx supabase test db --local`
- [x] `bunx supabase db lint`

## Browser flow

- [x] Worker documents route opens from Workers table
- [x] Worker identity is displayed
- [x] Datos personales renders without semester
- [x] Semester selector works
- [x] Semester-scoped categories render
- [x] PDF upload works
- [x] Image upload works
- [-] Word upload works
- [x] Excel upload works
- [x] Invalid extension is rejected
- [x] File over 10 MB is rejected
- [x] Single-file replacement works
- [x] Evidencias allows multiple uploads
- [x] View document works
- [-] Download document works
- [x] Report downloads
- [-] Report contents are correct

## Issues found

| Issue                                                             | Severity | Notes                                                    |
| ----------------------------------------------------------------- | -------- | -------------------------------------------------------- |
| Word upload does not work                                         | High     | Required supported file type                             |
| Download opens preview for PDF/images instead of forcing download | Medium   | View works, but Download behavior is unclear             |
| Report table overflows page layout                                | Medium   | Data exists, but PDF layout needs wrapping/column sizing |

## Phase 7C fix notes

- Word uploads: normalize storage `contentType` and saved metadata MIME from the validated file extension, so `.doc` and `.docx` do not depend on browser-provided MIME values.
- Download action: fetch the signed URL as a blob and trigger a temporary anchor download with the original file name; "Ver" still opens the signed URL directly.
- Report PDF: reduced table font/padding, tightened margins/column widths, and pre-wrapped long file names before rendering.
- Retest needed: `.doc`, `.docx`, PDF/image download behavior, Excel download behavior, and long-row report layout.
