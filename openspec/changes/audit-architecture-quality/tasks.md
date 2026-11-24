# Tasks

- [x] Review AGENTS and previous refactor-code-quality proposal/tasks.
- [x] Establish branch atop validated security commit 0ee5e20.
- [x] Add report-only architecture inventory using installed TypeScript.
- [x] Run audit and review metrics, cycles and priorities (45317029740). Baseline 247 app files, 22861 lines, 163 assertions, 119 non-null, one type-only cycle.
- [x] Batch focused changes: semester type boundary; shared assignment grouping; form styles; drawer view; storage filename helper; obsolete PDF casts.
- [ ] Review remaining form types, service boundaries, PDF visual regression and dead-code evidence; do not claim exhaustive cleanup.
- [x] Automated typecheck, lint, tests, build and inventory passed for three implementation batches; manual preview review remains below.
- [ ] Keep phase 3 SQL work in PR #55 and privacy publication in PR #44 deferred; integrate only after approval.

- [x] First batch verified: run 45318081464, 54 test files, no import cycles, 22818 application lines and 161 assertions; preview READY.
- [x] Second batch: remove unsafe never assertions from three catalog mutations; use existing schedule identity type guard without assertions; extract and test worker-sheet text helpers; narrow semester code without assertions.
- [x] Validate second batch in CI and preview. Preserve identity gating, query keys, API projections and PDF formatting.

- [x] Second batch CI passed (45318397341); 141 assertions; preview READY.
- [x] Third batch: shared typed worker mutation options and form values; extract document transforms; consolidate lazy Montserrat registration; add report-only unreferenced-module candidates.
- [x] Verify third batch CI (45318957367): 55 test files, 122 assertions, 118 non-null assertions, zero cycles; Vercel READY.
- [x] Inspect candidate list: App.tsx uses lazy dynamic imports for pages/layouts; main.tsx is the entry point. Preserve these. Improve auditor to detect literal dynamic imports and exclude main from candidate list.
- [ ] Verify remaining candidate references across source and tooling before deleting anything; retain uncertain public exports.
- [ ] Manual preview review of forms, documents and PDF appearance; no remote writes required.
