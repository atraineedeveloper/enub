# Design

Use the existing GitHub Actions CI with read-only contents permission. The audit job uses the current Bun release to support audit and is initially report-only; it does not install packages or alter lockfiles. Do not treat a green workflow as an absence of vulnerabilities. Review actual audit output. Pin an exact verified Bun version before final release. Locked baseline: jspdf 2.5.2, jspdf-autotable 3.8.4, dompurify 2.5.8, vite 5.4.19, esbuild 0.21.5, rollup 4.34.3. DOMPurify advisories GHSA-v8jm-5vwx-cfxm and GHSA-v2wj-7wpq-c8vv affect the baseline. No manual lockfile edits.
