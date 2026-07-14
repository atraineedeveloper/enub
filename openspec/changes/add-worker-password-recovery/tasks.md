## 1. Login entry point

- [ ] 1.1 Add a "¿Olvidaste tu contraseña?" link/button to `LoginForm.tsx` that navigates to the new `/forgot-password` route, without changing any existing field, validation, or submit behavior on the login form.
- [ ] 1.2 Register the new public `/forgot-password` route in `src/App.tsx`, alongside `/login` and `/set-password`, outside `ProtectedRoute`.

## 2. Recovery request page

- [ ] 2.1 Create `src/pages/ForgotPassword.tsx` (or equivalent) with an email input, submit action, and a "volver a iniciar sesión" navigation action back to `/login`.
- [ ] 2.2 Add a `requestPasswordRecovery(email)` function to `src/services/apiAuth.ts` calling `supabase.auth.resetPasswordForEmail` with the current browser origin plus `/set-password` as `redirectTo` (equivalent to `` `${window.location.origin}/set-password` ``). Do not introduce a `VITE_` copy of the server-only `WORKER_INVITE_REDIRECT_URL` and do not expose any service-role credential.
- [ ] 2.3 Add a hook (e.g. `useRequestPasswordRecovery.ts`) wrapping the above as a `useMutation`, disabling the submit control while `isPending` to prevent duplicate submissions.
- [ ] 2.4 Show one single neutral success message on completion regardless of whether the Supabase call reports the email as found or not found; do not branch UI copy on the result content.
- [ ] 2.5 On an unexpected/network-level error, show a generic client-safe error message; do not render `error.message` or any raw Supabase/internal error content.

## 3. `/set-password` copy update

- [ ] 3.1 Reword `SetPassword.tsx`'s heading/body copy to be link-type-neutral (e.g. "Establece tu contraseña" instead of "Activar cuenta"), so the same text is accurate whether the session came from an invitation or a recovery link.
- [ ] 3.2 Reword the invalid/expired-link error state to be generic enough to cover both invitation and recovery links, without referencing "invitación" specifically.
- [ ] 3.3 Confirm (by reading the current implementation, not by changing it) that the post-success navigation destination is unchanged, and that the invitation flow through this page still works exactly as it does today.

## 4. Password length consistency

- [ ] 4.1 Confirm the canonical minimum password length is 8 (matching the current client-side `MIN_PASSWORD_LENGTH` in `SetPassword.tsx`).
- [ ] 4.2 Update `minimum_password_length` in `supabase/config.toml` from 6 to 8 (local config only).
- [ ] 4.3 Document the human-owned deployed prerequisites: set the hosted Supabase Auth minimum password length to 8, allow-list the deployed `${origin}/set-password`, and confirm the existing Edge Function `WORKER_INVITE_REDIRECT_URL` targets that same URL. Do not run a remote-changing command without explicit approval.

## 5. Documentation

- [ ] 5.1 Note the new `/forgot-password` route, current-origin redirect derivation, deployed allow-list requirement, hosted 8-character minimum prerequisite, and shared 2/hour email limit in the existing auth/route documentation. Do not include changes from `finish-js-to-ts-migration`, `scope-group-grade-to-selected-semester`, or any other planned initiative.

## 6. Verification

- [ ] 6.1 Run `bun run typecheck`.
- [ ] 6.2 Run `bun run lint`.
- [ ] 6.3 Run `bun run build`.
- [ ] 6.4 Start local Supabase (`bunx supabase start` / `bun run supabase:start`) and confirm status is healthy.
- [ ] 6.5 Manually verify `/login` shows the new "¿Olvidaste tu contraseña?" action and that existing login still works unchanged.
- [ ] 6.6 Manually submit the recovery form for a known worker email and confirm a recovery email arrives in local Mailpit, linking to `/set-password`.
- [ ] 6.7 Manually submit the recovery form for an unknown/non-existent email and confirm the exact same neutral success message is shown as in 6.6.
- [ ] 6.8 Follow the recovery email link and confirm a new password can be set successfully on `/set-password`, landing on the expected post-success destination.
- [ ] 6.9 Re-run the existing invitation flow (`create-worker-account` → invite email → `/set-password`) end to end and confirm no regression in copy correctness or behavior.
- [ ] 6.10 Manually verify separately that an expired recovery link and a reused recovery link each show the generic invalid/expired state on `/set-password`; also verify a malformed/no-session link does so without invite-specific copy.
- [ ] 6.11 Manually verify the recovery request page and updated `/set-password` copy on a mobile viewport and via keyboard-only navigation (tab order, focus states, submit via Enter).
- [ ] 6.12 Exhaust the shared local email-send allowance using invite/admin-resend/recovery requests and confirm recovery shows only the generic client-safe error, while documenting that one flow can throttle the others.
- [ ] 6.13 Verify local recovery uses the active Vite origin plus `/set-password`; before deployed acceptance, verify the deployed URL is allow-listed, the Edge Function invitation redirect matches it, and hosted Supabase enforces the 8-character minimum.
