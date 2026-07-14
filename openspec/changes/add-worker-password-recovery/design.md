## Context

Recovery already works end-to-end, but only when an admin triggers it. `resend-worker-access-link` (Edge Function) calls `resetPasswordForEmail`, which sends the already-configured `recovery` email template (`supabase/templates/recovery.html`) linking to `/set-password` via `WORKER_INVITE_REDIRECT_URL`. `/set-password` (`src/pages/SetPassword.tsx`) does not inspect the link type at all — the Supabase JS client's default `detectSessionInUrl` behavior consumes the URL fragment/`code` param before the page renders, and the page only checks `useUser().isAuthenticated`, then calls `supabase.auth.updateUser({ password })` on whatever session already exists. That means the completion half of self-service recovery needs no logic change — only the trigger half (an entry point a worker can use themselves) and copy are missing.

`/login` and `/set-password` are both public routes, outside `ProtectedRoute` (`src/App.tsx`). The new recovery-request page is a dedicated public route (`/forgot-password`) rather than an inline form embedded in `LoginForm.tsx` — `LoginForm.tsx` only gains a navigation action to it. This keeps the login form's own validation/submit logic untouched and isolates the new page's own loading/error/success states from it.

Constraints from existing config (`supabase/config.toml`):
- `auth.rate_limit.email_sent = 2` per hour, shared across invite + recovery + this new self-service trigger.
- `minimum_password_length = 6` server-side vs. `MIN_PASSWORD_LENGTH = 8` client-side in `SetPassword.tsx` — an existing inconsistency, not introduced by this change, but one this change touches adjacent code for and should resolve rather than compound.

## Goals / Non-Goals

**Goals:**
- Let a worker who forgot their password request a recovery email themselves from `/login`, with no admin involvement.
- Reuse the existing `recovery` email template, `resetPasswordForEmail` call, `/set-password` destination, and completion page — no new Edge Function or Supabase Auth email template.
- Avoid email enumeration: the UI must respond identically whether or not the entered email matches a worker/account.
- Make `/set-password`'s copy accurate for both an invite-originated session and a recovery-originated session.
- Resolve the client/server password-length mismatch so both sides enforce the same rule.

**Non-Goals:**
- No public self-registration (`supabase.auth.signUp`) — recovery only ever acts on an email that may already have an account; it never creates one. This preserves the existing `worker-self-service-documents` decision that account creation stays admin-initiated.
- No change to `create-worker-account`, `resend-worker-access-link`, or any Edge Function, schema, or RLS policy.
- No change to `auth.rate_limit.email_sent` numeric value as part of this change. The accepted value for this iteration is 2/hour, with its shared impact documented and manually verified.
- No account lockout / CAPTCHA / bot-protection mechanism — out of scope for this iteration.
- No bulk worker account creation, no change to `create-worker-account` or `link_worker_account`, no `workers.email` uniqueness constraint, no worker seed data expansion, no general ENUB/Enub branding work, and no automated remote/hosted Supabase configuration change. The human-owned hosted password-minimum and redirect allow-list deployment prerequisites are the only remote configuration considerations in this change.

## Decisions

**Call `supabase.auth.resetPasswordForEmail` directly from the client, not through a new Edge Function.**
`resetPasswordForEmail` is safe to call unauthenticated (GoTrue returns a uniform response regardless of match, per the same behavior `resend-worker-access-link` already relies on for anti-enumeration). It requires only the anon key — never the service role key — so no privileged credential is exposed to the client. Adding an Edge Function here would only add latency and a second thing to maintain for zero additional capability, since there's no privileged data path to protect (unlike `create-worker-account`, which must resolve `workers.email` server-side under RLS). Alternative considered: a new `request-password-recovery` Edge Function mirroring `resend-worker-access-link` — rejected as unnecessary indirection since no server-only data is involved, and the proposal explicitly asks to avoid a new privileged Edge Function unless strictly necessary.

**A dedicated `/forgot-password` page, not an inline form on `/login`.**
Keeps `LoginForm.tsx`'s existing validation/submit/error-toast logic completely untouched (it gains only a link/button), and gives the recovery flow its own isolated loading/success/error states and its own "back to login" affordance. Alternative considered: an inline collapsible form on the login page — rejected as it would complicate `LoginForm.tsx`'s existing state management for no benefit, and the proposal frames this as navigation to a page, not an in-place toggle.

**Always show the same neutral confirmation for known and unknown addresses.** GoTrue does not distinguish account existence in a successful `resetPasswordForEmail` response, and the UI must not add such a distinction either.

**Classify errors in the service layer by allow-listing only transport failures as distinguishable, rather than allow-listing specific "safe to silence" error codes.** An earlier version of this design maintained an explicit list of two rate-limit codes (`over_email_send_rate_limit`, `over_request_rate_limit`) to fold into the neutral success state, while every other `AuthApiError` produced a distinct `retry_later` state. That was still not fully closed: any *other* current or future Auth API error code — known or not yet released — could just as easily correlate with account existence (GoTrue's error surface is not something this codebase controls or can fully enumerate), and would have reopened the same class of enumeration bug the two-code list was meant to close. The corrected policy, implemented in `requestPasswordRecovery` (`src/services/apiAuth.ts`), inverts the allow-list to cover only what's provably *safe* to distinguish:
  - No error → outcome `"submitted"`.
  - Any `AuthApiError` — a real response from the Supabase Auth API, whether a known code (e.g. the rate-limit codes above) or an unrecognized/future one — → also outcome `"submitted"`. We do not match on specific codes or messages at all for this bucket; every actual Auth API response fails closed to the neutral outcome, because we cannot be confident an unfamiliar code doesn't depend on whether the address is registered.
  - Only `AuthRetryableFetchError` (checked via the SDK's own `isAuthRetryableFetchError` type guard, re-exported from the already-installed `@supabase/supabase-js` — no new dependency) → outcome `"retry_later"`. This is the SDK's stable marker for a transport-level failure — offline, network/DNS/connection error, or a 5xx before any per-account response body was read — which happens identically no matter which email was submitted, so it's the one case genuinely safe to surface distinctly.
  - The service function returns this classification as a typed result (`Promise<"submitted" | "retry_later">`) rather than throwing, so the hook and form consume a safe application-level outcome and never see `error.message`/`error.code` directly.
  - **Residual limitation, deliberately not solved with new infrastructure:** a thrown exception that is *not* an `AuthError` at all (i.e. bypasses GoTrue's own error wrapping entirely — in practice only a genuine bug, since GoTrue's `resetPasswordForEmail` already wraps every expected failure mode, including network errors, as an `AuthError` subtype before returning it) still propagates as a rejected promise and is shown as the `retry_later` state via the hook's `isError` flag. This is an accepted, documented gap rather than a new logging/observability system: there is no existing project mechanism (no Sentry/error-tracking service in this repo) to report it non-visibly, and adding one is out of scope for this change.

**Derive the browser redirect from the current app origin.** Repository research found no frontend `WORKER_INVITE_REDIRECT_URL` equivalent: that name is a server-only Edge Function secret and must not be exposed through a `VITE_` variable. The client SHALL pass `${window.location.origin}/set-password` as `redirectTo`. On local Vite this resolves to the origin actually serving the app (normally `http://localhost:5173` or `http://127.0.0.1:5173`); in a deployed build it resolves to the deployed app origin. `supabase/config.toml` already allow-lists both local `/set-password` URLs. Before deployed acceptance, the exact deployed `${origin}/set-password` URL must be added to the hosted Supabase Auth redirect allow-list, and the Edge Functions' `WORKER_INVITE_REDIRECT_URL` must target that same URL so invitation and recovery links remain compatible. No new client environment variable is introduced.

**`SetPassword.tsx` copy becomes link-type-neutral rather than branching on link type.** Since there is no reliable, already-established way to distinguish "this session came from an invite" vs. "this session came from a recovery" at the point `SetPassword` renders (the Supabase client already consumed the URL before React mounts, and GoTrue does not expose the original link type on the session object), the pragmatic fix is to reword the heading/body to work for either case (e.g. "Establece tu contraseña" instead of "Activa tu cuenta"), rather than attempting type detection. Alternative considered: parse `type=recovery|invite` from the URL hash before the Supabase client consumes it — rejected as fragile (requires disabling `detectSessionInUrl` and manually replicating its parsing, a much larger change for a copy-only problem) and unnecessary since one neutral message correctly describes both flows ("set your password to access your account").

**Canonical password length: adopt 8 characters on both sides.** The client already enforces 8 in `SetPassword.tsx`; raise `minimum_password_length` in `supabase/config.toml` from 6 to 8 to match, rather than lowering the client to 6. Rationale: 8 is the better security default and the client-side value is what workers actually experience today — lowering it would be a silent regression in effective password strength.

## Risks / Trade-offs

- **[Risk]** Exposing `resetPasswordForEmail` to an unauthenticated `/login` visitor increases traffic against the shared `auth.rate_limit.email_sent = 2`/hour limit, potentially causing an admin invite/resend action to be rate-limited by self-service requests. → **Mitigation/decision**: keep 2/hour for this iteration and document the cross-flow behavior. When this limit is hit, the request is classified as `"submitted"` (the same neutral success state as a real send, per the error-classification decision above) rather than a distinct error — showing a distinct error here would itself reveal that the address exists, since the limit is only ever consumed by a registered address. Any future limit change is a separate operational change.
- **[Risk]** A worker could spam the recovery form for an email they don't own, as a nuisance/probing vector. → **Mitigation**: rely on the existing rate limit as the only guard for this iteration; do not add new infrastructure (e.g. CAPTCHA) without explicit approval, per "do not add dependencies."
- **[Trade-off]** Not branching `SetPassword` copy by link type means the wording is generic ("set your password") rather than tailored ("welcome, activate your account" vs. "reset your password"). Accepted as the simpler, more robust option given no reliable signal exists to branch on.
- **[Risk]** Raising `minimum_password_length` server-side to 8 could reject a password for any pre-existing account whose password was set under the old 6-char minimum, on their *next* password change attempt only if they choose a new password shorter than 8 — it does not invalidate existing passwords. → **Mitigation**: none needed; this is expected, standard behavior for raising a minimum going forward.

## Migration Plan

1. Add the "¿Olvidaste tu contraseña?" navigation action to `LoginForm.tsx` and the new `/forgot-password` page with its `resetPasswordForEmail` trigger (additive, no flag needed).
2. Update `SetPassword.tsx` copy (additive text change, no behavior change to the mutation itself).
3. Raise `minimum_password_length` to 8 in `supabase/config.toml`. Before deployed acceptance, a human must set the hosted Auth minimum to 8 through an explicitly approved configuration action; otherwise the consistency requirement is satisfied locally but not in production.
4. No rollback complexity: every piece is additive UI/copy plus a single config value; reverting is a straightforward revert of the same commits.

## Open Questions

None. Shared email rate limiting remains 2/hour for this iteration. Hosted password length and redirect allow-list configuration are explicit human-owned deployment prerequisites, not implementation-time decisions.
