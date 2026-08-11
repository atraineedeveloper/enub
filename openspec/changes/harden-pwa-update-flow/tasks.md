# Tasks

- [x] Audit current PWA registration/update behavior against current `vite-plugin-pwa` guidance.
- [x] Switch service-worker activation from `autoUpdate` to `prompt` with explicit registration.
- [x] Add a non-blocking update prompt with update-now and postpone actions.
- [x] Add periodic service-worker update checks for long-lived sessions.
- [x] Keep Supabase/data/document traffic outside Workbox runtime caching.
- [x] Add focused frontend tests for the prompt lifecycle.
- [x] Update PWA documentation to describe the release flow and online-only data boundary.
- [ ] Run typecheck, lint, tests and production build in CI.
- [ ] Perform or record the remaining manual post-deploy service-worker verification.
- [ ] Synchronize/archive the OpenSpec change after validation.
