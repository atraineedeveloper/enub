- [x] Inventory locked PDF and build dependencies.
- [x] Add non-blocking dependency audit job.
- [x] Confirm audit execution: Bun 1.4.5 reported 134 advisories (2 critical, 65 high, 54 moderate, 13 low).
- [ ] Select reviewed compatible versions (including jsPDF/AutoTable and Vite/PWA peer compatibility).
- [ ] Regenerate lockfile using Bun and review diff.
- [ ] Run frozen install, audit, typecheck, lint, tests, build and PDF/PWA preview regression.
- [ ] Establish blocking policy after triage; pin reviewed audit runtime.

- [x] Select initial PDF candidates: jsPDF 4.2.1, AutoTable 5.0.9, DOMPurify 3.5.0, fflate 0.8.3; run isolated candidate workflow without changing the tracked lockfile.
- [ ] Review candidate patch, verify transitive overrides and PDF API compatibility, commit actual generated package/lock changes, then remove temporary candidate workflow/script.
