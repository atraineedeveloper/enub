# Design

Keep the existing SPA rewrite. Do not introduce a strict CSP until asset, Supabase, font, PWA and blob PDF behavior have been inventoried. No new dependencies. The current lockfile is untouched; no claim of vulnerability remediation is made by these configuration changes. Explicit trusted host configuration may be needed for remote development. Check preview authentication and permitted redirect origins without changing production.
