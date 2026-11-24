# Tasks

- [x] Compare main ddb5205 and validated performance f129445 against common base 845066e. Only two overlapping paths: worker form and table.
- [x] Reconcile typed form with approved responsive layout; retain main modal and styles TSX; preserve memoized worker search.
- [x] Run architecture and performance audits in standard CI after build.
- [ ] Verify full CI, including dependency audit log, local Supabase migrations and pgTAP, typecheck, lint, tests, build and inventories.
- [ ] Verify Vercel preview; manual desktop/mobile form navigation, read-only schedule/document routes, PDF export, PWA install/update and offline shell using non-production test data.
- [ ] Obtain approval before production merge. Defer PR55 and PR44; no remote database mutation.
