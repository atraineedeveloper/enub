# Design: safer PWA updates

## Decisions

### Prompt instead of auto-update

ENU contains forms and file workflows. A new service worker must therefore wait until the user chooses to reload instead of forcing activation while work may be unsaved.

`vite-plugin-pwa` will use `registerType: "prompt"`. Automatic injection is disabled with `injectRegister: null`, and ENU registers the worker explicitly through `virtual:pwa-register`.

### Registration adapter

The Vite virtual-module dependency is isolated in `src/pwa/registerPwa.ts`. Shared UI does not import the virtual module directly. This keeps the update prompt testable with an injected registrar and avoids introducing `workbox-window` as a direct project dependency.

### Update prompt behavior

When a waiting release is detected, ENU shows a non-blocking fixed prompt explaining that the user should save current work before updating.

Actions:

- **Actualizar ahora**: activate the waiting service worker and reload the page.
- **Más tarde**: hide the prompt for 30 minutes, then show it again if the same update is still waiting.

The prompt does not claim that dynamic application data is available offline.

### Periodic checks

After successful service-worker registration, ENU asks the registration to check for updates once per hour while the application remains open. Registration/update errors are logged without preventing ENU from functioning as a normal web application.

### Cache boundary

No runtime cache is added. The generated service worker continues to precache the build/application shell and configured static assets only. Supabase API traffic, authentication calls, uploads/downloads and worker documents are not intentionally added to Workbox runtime caching.

## Verification

- TypeScript typecheck and ESLint.
- Bun unit tests for prompt, postpone and apply-update behavior using an injected fake registrar.
- Production Vite build to ensure the PWA virtual module and generated worker compile.
- Manual post-deploy verification remains required for the browser service-worker lifecycle.