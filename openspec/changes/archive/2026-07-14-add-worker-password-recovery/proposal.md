## Why

A worker who forgets their password today has no self-service way to recover access. The `/login` page has no "forgot password" link, and the only recovery mechanism is an admin manually clicking "Reenviar enlace de acceso" on the worker's record. This creates unnecessary support burden on admins and blocks a worker's access until an admin happens to act. The underlying plumbing for recovery already exists (a `recovery` email template, a `resetPasswordForEmail` call, and a `/set-password` landing page that is already link-type agnostic) — it is just not exposed to the worker directly.

## What Changes

- Add a "¿Olvidaste tu contraseña?" action to `LoginForm.tsx` that navigates to a new, dedicated, public password-recovery request page (not an inline form on the login page itself). Login behavior is otherwise unchanged.
- Add a new public route/page where a worker submits an email address and calls the official Supabase client API (`supabase.auth.resetPasswordForEmail`) directly. The browser derives the same `/set-password` destination as `${window.location.origin}/set-password`: local development therefore uses the active Vite origin and a deployed build uses its deployed origin. This is the client-side counterpart of the Edge Functions' server-only `WORKER_INVITE_REDIRECT_URL`; that secret is not exposed to the browser. Both local and deployed URLs must be present in the corresponding Supabase Auth redirect allow-list. Reuse the existing `recovery` email template — no new Edge Function, no new email template, no service-role credential use anywhere in this flow.
- Always show the same neutral confirmation regardless of whether the submitted email matches an account, to prevent enumeration. Disable the submit action while the request is in flight to prevent accidental repeated submissions. Provide a way back to `/login`.
- Update `SetPassword.tsx` copy so it no longer assumes an invite-only framing (current text says "activar cuenta" / "invitación" even when the session came from a recovery link) — using neutral wording that correctly describes both flows, since the link type cannot be reliably determined once the Supabase client has already consumed the URL. The page's underlying mechanics (session-check + `updateUser({ password })`) and its post-success navigation destination do not change. The existing invitation flow through this page must continue to work exactly as it does today.
- Decide and document the canonical minimum password length (client currently enforces 8, local Supabase config enforces 6) and make the two consistent — see design.md for the decision.
- Keep and document the existing `auth.rate_limit.email_sent = 2` limit for this iteration. It is shared across invite, admin-triggered resend, and self-service recovery, so verification and rollout documentation must acknowledge possible cross-flow throttling. Do not change remote Supabase configuration automatically.

**BREAKING**: none. This is purely additive on the frontend (plus one local config value); no existing route, table, or Edge Function contract changes.

## Capabilities

### New Capabilities
- `worker-password-recovery`: self-service password recovery for workers — the login-page entry point, the new recovery-request page, and the shared `/set-password` completion flow's behavior when reached via a recovery link instead of an invite link.

### Modified Capabilities
(none — no existing `openspec/specs/*` capability covers authentication/recovery today)

## Impact

- `src/features/authentication/LoginForm.tsx` — add "¿Olvidaste tu contraseña?" navigation action; no change to existing login behavior.
- A new page/route (e.g. `src/pages/ForgotPassword.tsx`, route `/forgot-password`) plus its feature component, hook, and a `src/services/apiAuth.ts` function wrapping `resetPasswordForEmail` — public route, outside `ProtectedRoute`, alongside `/login` and `/set-password`.
- `src/pages/SetPassword.tsx` — copy update only; no change to its session/mutation logic, its invitation-flow behavior, or its post-success navigation.
- `supabase/config.toml` — no schema change; only the `minimum_password_length` value per the design decision. No remote/hosted Supabase configuration change.

## Out of Scope

- Bulk worker account creation.
- Any change to the `create-worker-account` Edge Function.
- Any change to the `link_worker_account` SQL function.
- Adding a database-level uniqueness constraint on `workers.email`.
- Worker seed data expansion.
- General ENUB/Enub branding consistency work.
- Public self-registration (`supabase.auth.signUp`) — worker accounts continue to originate only from the admin-controlled provisioning flow.
- Automated remote/hosted Supabase deployment or configuration changes. Before deployed acceptance, a human must verify the deployed `/set-password` URL is allow-listed and set the hosted Auth minimum password length to 8 through an approved Supabase configuration path.
- Adding any new dependency.
