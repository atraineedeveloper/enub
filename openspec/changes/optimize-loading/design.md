# Design

Use dynamic imports inside existing export handlers. Load independent font registrations concurrently before jsPDF construction. Document report keeps existing download fallback if asynchronous loading blocks popup. Vite manifest enables static dependency closure audit (not a network trace). Keep precache unchanged until manual offline validation; do not change query freshness or access scope without evidence. Images unchanged pending format/dimension inspection and visual checks.
