# Tasks

- [x] Baseline from run 45319508470: main JS 443.33 kB / gzip 136.99 kB; PDF engine 422.55 kB / gzip 138.65 kB; fonts 1069.15 kB; PWA 67 entries, 2541.27 KiB.
- [x] Defer engine and document report; parallelize font imports; memoize worker filter.
- [x] Add build manifest and static dependency audit in CI.
- [ ] Validate CI, compare manifest sizes and preview PDF output.
- [ ] Assess image optimization, query redundancy, and PWA precache changes separately using evidence; keep current behavior until offline and authorization regression tests are available.
