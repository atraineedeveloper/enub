# Tasks

- [x] Baseline from run 45319508470: main JS 443.33 kB / gzip 136.99 kB; PDF engine 422.55 kB / gzip 138.65 kB; fonts 1069.15 kB; PWA 67 entries, 2541.27 KiB.
- [x] Defer engine and document report; parallelize font imports; memoize worker filter.
- [x] Add build manifest and static dependency audit in CI.
- [ ] Validate CI, compare manifest sizes and preview PDF output.
- [ ] Assess image optimization, query redundancy, and PWA precache changes separately using evidence; keep current behavior until offline and authorization regression tests are available.

- [x] First performance CI passed (45319916146), 55 test files; static PDF engine excluded on three audited routes. Initial closure 443316 bytes / gzip 138251; login 447578, MyDocuments 499060, ScheduleDashboard 555321. Precache 71 entries / 2543 KiB.
- [x] Memoize schedule/dashboard derivations, compute surname keys once, index document transforms, parallelize independent report reads after access check; include administrative WorkerDocuments route in audit.
- [ ] Validate final batch and compare measured sizes. Manual PDF, offline PWA, and browser profiling deferred; keep precache and image assets unchanged, no unmeasured query freshness changes.
