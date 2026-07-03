# Implementation Plan - Worker Self-Service Documents

**Revised after security review.** The main change throughout this plan: role resolution is now allow-list based (`role IN ('staff','admin')` or `role === 'worker'`), never "anything that isn't X." A new "pending access" state/page is introduced for authenticated sessions with no resolvable role. No code is written yet — this is the plan to implement against. Database changes are in [[database-plan]].

This plan follows the existing architecture pattern in `docs/ai/architecture.md` (`services/api*.js` → `features/domain/useX.js` → page components).

## 1. `src/services/apiProfiles.js` (new)

```js
export async function getCurrentProfile() {
  // selects from `profiles` where id = current user id
  // returns { role: 'staff' | 'admin' | 'worker' | null, workerId: number | null }
  // role is null when no row exists — this must NOT be coerced to 'staff'
  // or any other default. Mirrors current_app_role() returning NULL in the DB.
}

export async function linkWorkerAccount({ workerId, email }) {
  // supabase.rpc('link_worker_account', { worker_id: workerId, worker_email: email })
  // surfaces the RPC's exception message (e.g. "No auth account found for ...",
  // "This account already has role staff and cannot be linked...", etc.)
  // as a user-facing Error, same pattern as existing apiWorkerDocuments.js
}

export async function unlinkWorkerAccount({ workerId }) {
  // supabase.rpc('unlink_worker_account', { worker_id: workerId })
}

export async function grantStaffRole({ email }) {
  // supabase.rpc('grant_staff_role', { staff_email: email })
}
```

## 2. `src/features/authentication/useProfile.js` (new)

```js
export function useProfile() {
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: getCurrentProfile,
    enabled: isAuthenticated,
  });

  const role = profile?.role ?? null; // null, not "staff" — see decisions.md #7

  return {
    isLoading: isLoadingUser || (isAuthenticated && isLoadingProfile),
    role,
    workerId: profile?.workerId ?? null,
    isWorker: role === "worker",
    isStaffOrAdmin: role === "staff" || role === "admin", // allow-list, not `role !== "worker"`
    isAdmin: role === "admin",
    hasNoAccess: isAuthenticated && !isLoadingProfile && role === null,
  };
}
```

`hasNoAccess` is the explicit "authenticated but no recognized role" state — it is a first-class value here, not inferred by callers from the absence of the other flags. This is deliberate: it makes the "pending access" case impossible to miss in review, matching decisions.md #7/#11.

Kept separate from `useUser.js` rather than folding role resolution into it — `useUser` stays a thin wrapper over Supabase session state, unrelated to this feature's app-level role concept. Anything importing `useUser` today keeps working unmodified.

## 3. Mutation hooks (new)

- `src/features/authentication/useLinkWorkerAccount.js` — wraps `linkWorkerAccount`.
- `src/features/authentication/useUnlinkWorkerAccount.js` — wraps `unlinkWorkerAccount`.
- `src/features/authentication/useGrantStaffRole.js` — wraps `grantStaffRole`.

All three invalidate the `["profile", ...]` and `["workers", ...]` query keys on success, same pattern as `useUploadWorkerDocument.js`.

## 4. Pending-access state {#pending-access-state}

New `src/pages/PendingAccess.jsx`: shown to any authenticated session where `useProfile().hasNoAccess` is true. Content: a short message ("Tu cuenta no tiene acceso asignado todavía. Contacta a un administrador.") plus the existing `Logout` action. No data fetching, no attempt to guess a role.

This is the destination for:

- A worker's `auth.users` account created in Studio but not yet run through `link_worker_account` (the scenario the security review specifically flagged).
- Any other authenticated session with no `profiles` row for any reason (defensive default, not expected to be reachable once the backfill migration in `database-plan.md` §11 has run for pre-existing users).

## 5. Routing changes in `src/App.jsx` (REVISED — allow-list, not deny-list)

A new top-level role gate, `RoleGate` (or equivalent name), replaces the earlier "just check `isWorker`" sketch:

```jsx
function RoleGate({ children }) {
  const { isLoading, isStaffOrAdmin, isWorker, hasNoAccess } = useProfile();

  if (isLoading) return <SpinnerFullPage />;
  if (isStaffOrAdmin) return children; // staff routes
  if (isWorker) return <Navigate to="/my-documents" replace />;
  // hasNoAccess, or any other unrecognized state: never fall through to staff routes
  return <Navigate to="/pending-access" replace />;
}
```

Applied as: `<ProtectedRoute><RoleGate><AppLayout /></RoleGate></ProtectedRoute>` around every existing staff route (`degrees`, `subjects`, `groups`, `study-programs`, `state-roles`, `roles`, `others`, `semesters`, `workers`, `workers/:id/documents`, `semesters/:id`, `dashboard`).

Critical property (this is the actual fix for the reported issue): the staff branch is `if (isStaffOrAdmin) return children`, an **allow-list**. There is no `else return children` fallthrough — every other case (`worker`, no role, loading-but-something-went-wrong) is explicitly redirected. The original sketch (`if (isWorker) redirect, else allow`) is what would have let an unlinked worker account — or literally any other unrecognized session — through to full staff access; that shape is removed.

`ProtectedRoute.jsx` itself is unchanged — it still only answers "is there a Supabase session at all," which is a separate, correct concern from "what role does this session have." This plan avoids touching the file used by every existing route to keep blast radius minimal.

```jsx
<Route path="my-documents" element={<ProtectedRoute><MyDocuments /></ProtectedRoute>} />
<Route path="pending-access" element={<ProtectedRoute><PendingAccess /></ProtectedRoute>} />
```

## 6. `MyDocuments.jsx` (REVISED — allow-list, requires non-null `workerId`)

```jsx
function MyDocuments() {
  const { isLoading, role, workerId } = useProfile();

  if (isLoading) return <Spinner />;
  if (role === "worker" && workerId != null) {
    return <WorkerDocumentsView workerId={workerId} />;
  }
  if (role === "staff" || role === "admin") return <Navigate to="/dashboard" replace />;
  return <Navigate to="/pending-access" replace />;
}
```

Two things changed from the original sketch:

- The success condition is now `role === "worker" && workerId != null`, an explicit two-part check, not just `isWorker`. The `profiles_worker_role_consistency` DB constraint already guarantees a `worker` row always has a `worker_id`, but the app layer checks it anyway as defense in depth against a stale/partial client-side cache rather than trusting a single boolean derived elsewhere.
- Any non-staff, non-worker, non-loading state (i.e., no role) goes to `/pending-access`, not silently rendering nothing or erroring.

## 7. Layout for the worker route

`AppLayout` (used by all staff routes) renders the full sidebar/nav. The worker route needs its own minimal layout — a new `src/ui/WorkerAppLayout.jsx` (name tentative) reusing existing primitives (`Row`, `Heading`, the existing `Logout` component) but with no staff navigation. `MyDocuments.jsx` and `PendingAccess.jsx` render inside this layout instead of `AppLayout`.

## 8. Reuse: splitting `WorkerDocuments.jsx`

Unchanged from the original plan — this part wasn't affected by the security review. Per [[decisions#10-reuse-strategy-for-the-existing-workerdocuments-ui]]:

1. New `src/services/apiWorkers.js` addition: `getWorkerById(id)` — single-row `select().eq('id', id).single()`, replacing the current pattern (in the page) of fetching the full worker list and calling `.find()`.
2. New `src/features/workers/useWorker.js` — `useQuery` hook wrapping `getWorkerById`, `queryKey: ["worker", id]`.
3. Extract the current body of `src/pages/Records/WorkerDocuments.jsx` into `src/features/workers/documents/WorkerDocumentsView.jsx`, changed to:
   - Accept `workerId` as a prop instead of reading `useParams` internally.
   - Use the new `useWorker(workerId)` hook instead of `useWorkers({ fullDetails: false })` + `.find()`.
   - Everything else (semester selector, category sections, upload/replace/view/download, report download) is copied as-is — no behavior change.
4. `src/pages/Records/WorkerDocuments.jsx` becomes a thin wrapper:
   ```jsx
   function WorkerDocuments() {
     const { id } = useParams();
     return <WorkerDocumentsView workerId={Number(id)} />;
   }
   ```
5. `src/pages/MyDocuments.jsx` — see §6 above (revised).

This keeps `apiWorkerDocuments.js` and every existing document hook (`useUploadWorkerDocument`, `useReplaceWorkerDocument`, `useWorkerDocumentCatalog`, `useWorkerDocumentsBySemester`, `useWorkerDocumentReportData`) completely untouched — they already take `workerId` as a value, not a route param, so they work unmodified for both the staff and worker entry points.

## 9. Admin account management UI (expanded)

In `src/features/workers/WorkerTable.jsx` / `WorkerRow.jsx`: admin-only actions (visible only when `useProfile().isAdmin` is true):

- **"Vincular cuenta"**: email input, calls `useLinkWorkerAccount()`. Must surface the RPC's rejection messages clearly (already-staff, already-linked-elsewhere, worker-already-has-account) rather than a generic failure toast, since those are now expected, meaningful outcomes (decisions.md #16), not edge-case bugs.
- **"Desvincular cuenta"** (new — required to make the `ON DELETE RESTRICT` FK actually usable, decisions.md #19): shown when a worker row has a linked account, calls `useUnlinkWorkerAccount()`.

Separately, wherever staff account provisioning is handled (a small admin panel or reusing part of the same UI — exact placement is an implementation-time detail, not fixed here): a "Grant staff access" action taking an email, calling `useGrantStaffRole()`, for onboarding new hires after launch (decisions.md #17). This does not need to live on the Workers page specifically, since it's not worker-scoped.

Not building: a way to promote/demote `admin` role, or a bulk view of all linked accounts — deferred per decisions.md #5.

## 10. Login flow — no changes needed

`apiAuth.js`'s `login()` already works for any Supabase Auth account regardless of role; the same `/login` route and `LoginForm.jsx` serve staff, worker, and not-yet-linked accounts alike. Post-login routing is entirely handled by `RoleGate` (§5), `MyDocuments.jsx` (§6), and `PendingAccess.jsx` (§4) — no change to `Login.jsx` or `useLogin.js`.

## 11. Server-side worker account provisioning by invitation (new)

**No code is written yet — this section is a design, same as the rest of this document.** Adds the new primary provisioning flow from `decisions.md` #21–28, alongside the existing manual "Vincular cuenta existente" fallback (§9, kept as-is).

### 11.1 Edge Function: `supabase/functions/create-worker-account/index.ts` (new, not yet created)

Request: `POST`, invoked from the client as `supabase.functions.invoke('create-worker-account', { body: { workerId } })` — the anon-key client already used everywhere else; no new client-side credential.

Request body is `{ workerId }` **only** — no `email` field, ever (decisions.md #29). The function always resolves the email from `public.workers.email` for that `workerId`; there is no fallback path that accepts a caller-supplied email in this endpoint. (The manual "Vincular cuenta existente" flow, §9, is the place a caller-supplied email belongs — kept as a permanent, separate action, not merged into this one.)

Two Supabase clients constructed inside the function:

- A **user-scoped** client, built from the incoming request's forwarded `Authorization` header (the caller's own JWT) and `Deno.env.get("SUPABASE_URL")` / `Deno.env.get("SUPABASE_ANON_KEY")`. Used for every step that should be authorized exactly like the rest of the app: reading `workers`, reading `profiles`, calling `current_app_role()`, calling `link_worker_account`.
- A **service-role** client, built from `Deno.env.get("SUPABASE_URL")` / `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` (both auto-injected — decisions.md #25). Used **only** for `admin.inviteUserByEmail`.

Pseudocode (illustrative, not final implementation):

```ts
// supabase/functions/create-worker-account/index.ts (NOT YET IMPLEMENTED)
serve(async (req) => {
  const { workerId } = await req.json();
  const userClient = createUserScopedClient(req); // forwards caller's JWT
  const adminClient = createServiceRoleClient();  // service role, server-only

  // Fast-fail UX only -- NOT the security boundary (decisions.md #24, case 7).
  const { data: role } = await userClient.rpc("current_app_role");
  if (role !== "admin") return jsonError(403, "Solo un administrador puede crear cuentas de acceso");

  const { data: worker, error: workerError } = await userClient
    .from("workers").select("id, email").eq("id", workerId).single();
  if (workerError || !worker) return jsonError(404, "Trabajador no encontrado");

  const email = worker.email?.trim();
  if (!email) return jsonError(400, "Este trabajador no tiene correo registrado; actualiza su correo antes de continuar"); // case 3
  if (!isValidEmailFormat(email)) return jsonError(400, "El correo del trabajador no es válido"); // case 4

  const { count } = await userClient
    .from("workers").select("id", { count: "exact", head: true }).eq("email", email);
  if (count > 1) return jsonError(400, "Este correo está registrado en más de un trabajador; corrige los datos antes de continuar"); // case 5

  const { data: existingProfile } = await userClient
    .from("profiles").select("id").eq("worker_id", workerId).maybeSingle();
  if (existingProfile) return jsonSuccess({ message: "Este trabajador ya tiene una cuenta vinculada" }); // case 6

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: Deno.env.get("WORKER_INVITE_REDIRECT_URL"),
  });
  if (inviteError && !isAlreadyRegisteredError(inviteError)) {
    return jsonError(502, "No se pudo invitar la cuenta; intenta de nuevo");
  }
  // inviteError of the "already registered" kind = case 2 (existing user); no error = case 1 (new invite).

  const { error: linkError } = await userClient.rpc("link_worker_account", {
    worker_id: workerId,
    worker_email: email,
  });
  if (linkError) return jsonError(409, linkError.message); // case 7 (redundant real check), or a race-condition collision

  return jsonSuccess({ message: "Cuenta creada e invitación enviada" });
});
```

Config addition (to `supabase/config.toml`, not made in this pass): a `[functions.create-worker-account]` section with `verify_jwt = true` (the default — must not be set to `false`), so the platform itself rejects unauthenticated requests before the function body even runs, on top of the `current_app_role()`/`link_worker_account` checks inside it.

### 11.2 Frontend additions (not yet implemented)

- `src/services/apiProfiles.js`: add `createWorkerAccount({ workerId })`, calling `supabase.functions.invoke('create-worker-account', { body: { workerId } })` and surfacing the function's own error message as a thrown `Error`, same convention as `linkWorkerAccount`.
- `src/features/authentication/useCreateWorkerAccount.js` (new): mutation hook mirroring `useLinkWorkerAccount.js` — `react-hot-toast` success/error, invalidates `["workers"]`/`["profile"]`.
- `src/features/workers/WorkerRow.jsx`: add a new admin-only primary action **"Crear cuenta de acceso"** (calls `useCreateWorkerAccount`), alongside the existing **"Vincular cuenta"** action, relabeled **"Vincular cuenta existente"** to read as the fallback it now is. Both stay gated on `useProfile().isAdmin`.
- If `worker.email` is empty, disable "Crear cuenta de acceso" in the UI with a hint to fill in the email first — a convenience mirroring case 3's server-side block, not a substitute for it (the Edge Function blocks it either way).

### 11.3 New companion page: "activar cuenta" / set password (not yet implemented — see decisions.md #27, REVISED)

**Required, not optional — provisioning is not considered complete without this page working end-to-end (decisions.md #27's hard gate).** A minimal, one-time page, `src/pages/SetPassword.jsx` at route `/set-password`. Exact minimum scope (deliberately small; nothing beyond this list belongs on this page):

1. Route: `/set-password`.
2. Relies on the session Supabase's client already establishes automatically from the invite/recovery link's URL fragment (`detectSessionInUrl`, already enabled) — no new session-handling logic.
3. Presents a single password field + confirmation; lets the worker set/update their password.
4. Calls `supabase.auth.updateUser({ password })`.
5. Shows clear success and error states — not a silent no-op, not a raw error dump.
6. On success, redirects to **`/my-documents` specifically** (not `/dashboard`, not a generic post-login redirect) — the person completing this page is, by definition, a worker.
7. Does **not** implement general self-service forgot-password recovery — that stays out of scope (spec.md).
8. Does **not** touch, request, or expose the service role key — plain client-side page, same anon-key client as everywhere else.
9. Does **not** create or link any `profiles` row — that already happened via `link_worker_account` inside the Edge Function, before the invite was sent. This page only ever calls `updateUser`.
10. Does **not** introduce its own authorization logic — once the worker logs in with the new password, `RoleGate`/`MyDocuments`/RLS resolve access exactly as they do for any other worker session; this page doesn't participate in that beyond the one redirect in step 6.

This page is a **required companion** to §11.1 — the invite email is not usable end-to-end without it (decisions.md #27) — but is tracked as its own item in `tasks.md`, not bundled into the same implementation pass as the Edge Function itself. It must be built and verified (per `verification-plan.md`'s companion-page section) before Phase 11 is considered done.

### 11.4 Local vs. remote — how the same code runs in both

- **Local:** `supabase start` (already how this project runs) + `supabase functions serve` runs the function against the local stack; `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are the local ones, auto-injected. Invite emails land in the local Mailpit-compatible inbox already configured at `[local_smtp]` (port 54324) — zero extra setup. `WORKER_INVITE_REDIRECT_URL` for local comes from a local-only env file passed via `--env-file` (sketch in decisions.md #26 — not created as a real file in this pass).
- **Remote:** requires an explicit `supabase functions deploy create-worker-account --project-ref <remote-ref>` (human-approved, same class of action as `supabase db push` per `AGENTS.md`'s existing rules) and an explicit `supabase secrets set WORKER_INVITE_REDIRECT_URL=... --project-ref <remote-ref>`. Until both of those explicit steps happen, the function simply doesn't exist on the remote project — there is no accidental path to remote provisioning from local development.

### 11.5 Verification approach differs by environment (decisions.md #28, RESOLVED)

Not the same check in both places — this is deliberate, not an oversight:

- **Local:** verify the invite email's actual *content* in the Mailpit inbox (port 54324) — recipient matches `workers.email`, the invite link is valid, and clicking it redirects to the local `WORKER_INVITE_REDIRECT_URL` (never a production URL). "The API call didn't error" is not sufficient on its own.
- **Production:** Mailpit doesn't exist in production — there is nothing to inspect there. Verification instead uses a **controlled test worker email** (a real mailbox the team controls, never a real employee's email for the first smoke test), confirms the email actually arrives there, confirms the link redirects to the **production** `WORKER_INVITE_REDIRECT_URL`, and confirms the full loop — set password via `/set-password`, then log in.

Full acceptance criteria for both are in `verification-plan.md`'s "Server-side worker account provisioning by invitation" section.

## 12. Resend/recover access link (new, spec-only)

**No code is written yet — this section is a design, same as the rest of §11.** Adds a new admin action, **"Reenviar enlace de acceso"**, and a new Edge Function, `resend-worker-access-link`, closing the operational gap found during Phase 11 local testing (decisions.md #30–33): a worker whose invite link goes stale before setting a password, or who later forgets their password, currently has no way to get a working `/set-password` link again. This is additive — it does not replace `create-worker-account` (§11.1) or the manual "Vincular cuenta existente" fallback (§9); all three admin actions coexist.

### 12.1 Edge Function: `supabase/functions/resend-worker-access-link/index.ts` (new, not yet created)

Request: `POST`, invoked from the client as `supabase.functions.invoke('resend-worker-access-link', { body: { workerId } })` — same anon-key client convention as `create-worker-account`.

Request body is `{ workerId }` **only** — no `email` field, ever, same reasoning as decisions.md #29 (extended here, decisions.md #33). The function always resolves the email from `public.workers.email`.

Two clients constructed inside the function (decisions.md #32 — a strictly smaller privilege footprint than `create-worker-account`, since this function never needs the service role at all):

- A **user-scoped** client (the caller's forwarded `Authorization` header) — used for the admin check, the `workers.email` read, and the `profiles` linked-status read. Same pattern as §11.1's user-scoped client.
- A **plain anon-key client**, with no forwarded caller header — used only for `resetPasswordForEmail`, kept deliberately separate from the admin's own authenticated client.

Pseudocode (illustrative, not final implementation):

```ts
// supabase/functions/resend-worker-access-link/index.ts (NOT YET IMPLEMENTED)
serve(async (req) => {
  const body = await req.json();
  const bodyKeys = Object.keys(body);
  if (bodyKeys.length !== 1 || bodyKeys[0] !== "workerId") {
    return jsonError(400, "El cuerpo de la solicitud debe contener únicamente workerId.");
  }
  const { workerId } = body;

  const userClient = createUserScopedClient(req); // forwards caller's JWT
  const anonClient = createPlainAnonClient();      // no forwarded header, anon key only -- decisions.md #32

  // This check IS the real security boundary here (decisions.md #34) -- unlike
  // create-worker-account, there is no link_worker_account RPC to delegate to.
  // current_app_role() is SECURITY DEFINER and resolves from the caller's own
  // verified JWT, not a client-supplied claim, so a single call is sufficient.
  const { data: role } = await userClient.rpc("current_app_role");
  if (role !== "admin") return jsonError(403, "Solo un administrador puede reenviar el enlace de acceso");

  const { data: worker, error: workerError } = await userClient
    .from("workers").select("id, email").eq("id", workerId).single();
  if (workerError || !worker) return jsonError(404, "Trabajador no encontrado");

  // Precondition is the OPPOSITE of create-worker-account's case 6 (decisions.md #33):
  // this function requires an EXISTING linked worker profile, and never creates one.
  const { data: profile } = await userClient
    .from("profiles").select("id, role").eq("worker_id", workerId).maybeSingle();
  if (!profile || profile.role !== "worker") {
    return jsonError(409, "Este trabajador no tiene una cuenta vinculada todavía; usa 'Crear cuenta de acceso' primero");
  }

  const email = worker.email?.trim();
  if (!email) return jsonError(400, "Este trabajador no tiene correo registrado");

  const { error: resendError } = await anonClient.auth.resetPasswordForEmail(email, {
    redirectTo: Deno.env.get("WORKER_INVITE_REDIRECT_URL"), // reused, not a new env var -- decisions.md #31
  });
  if (resendError) return jsonError(502, "No se pudo reenviar el enlace; intenta de nuevo");

  // No profiles write here, ever -- this function only ever sends an email (decisions.md #33).
  return jsonSuccess({ message: "Enlace de acceso reenviado", workerId, email });
});
```

Config addition (to `supabase/config.toml`, not made in this pass): a `[functions.resend-worker-access-link]` section with `verify_jwt = true`, matching `create-worker-account`'s config (decisions.md #25's reasoning applies identically here).

### 12.2 Frontend additions (not yet implemented)

- `src/services/apiProfiles.js`: add `resendWorkerAccessLink({ workerId })`, calling `supabase.functions.invoke('resend-worker-access-link', { body: { workerId } })`, reusing the same `error.context` JSON-parsing convention already used by `createWorkerAccount` to surface the function's real error message.
- `src/features/authentication/useResendWorkerAccessLink.js` (new): mutation hook mirroring `useCreateWorkerAccount.js` — `react-hot-toast` success/error, no query invalidation strictly required (this function never changes `profiles`/`workers` data), though invalidating `["workers"]` is harmless if kept for consistency with the other two mutations.
- `src/features/workers/WorkerRow.jsx`: add a third admin-only action, **"Reenviar enlace de acceso"**, alongside (not replacing) "Crear cuenta de acceso" and "Vincular cuenta existente". Gated the same way (`useProfile().isAdmin`).
- Recommended (not mandatory) UX affordance, to be decided at implementation time: since this action is only meaningful for a worker who already has a linked account, consider showing it only when the row's known state indicates `profiles` already exists for that worker (mirroring the case-3 "disable when email empty" precedent from Phase 11B, itself not implemented due to `Menus.Button` lacking a `disabled` prop — see `tasks.md` Phase 11A/11B notes). Whether or not the UI conditionally shows/hides it, the Edge Function's own precondition check (decisions.md #33) remains the actual, non-bypassable enforcement.

### 12.3 Reuses `/set-password` as-is — no changes to that page

The resend/recovery email's link lands on the exact same `/set-password` page built in §11.3 (decisions.md #27). That page already only ever calls `supabase.auth.updateUser({ password })` against whatever session the arriving link established — it has no dependency on *how* that session was established (an original invite vs. a resend/recovery link use the same underlying GoTrue session-from-URL-fragment mechanism). No changes to `SetPassword.jsx`, `useSetPassword.js`, or `apiAuth.js` are anticipated for this addition.

### 12.4 Local vs. remote — same pattern as §11.4

- **Local:** `supabase functions serve resend-worker-access-link --env-file <path>` (or served alongside `create-worker-account` if both are served together), same `WORKER_INVITE_REDIRECT_URL` local env file, same local Mailpit inbox for verification.
- **Remote:** requires its own explicit `supabase functions deploy resend-worker-access-link --project-ref <remote-ref>` — a separate deploy from `create-worker-account`'s, since it's a separate function, though it reads the same already-configured `WORKER_INVITE_REDIRECT_URL` secret (no new remote secret to set).

Full acceptance criteria in `verification-plan.md`'s new "Resend/recover access link" subsection.

## Files touched/added summary

New:
- `src/services/apiProfiles.js`
- `src/features/authentication/useProfile.js`
- `src/features/authentication/useLinkWorkerAccount.js`
- `src/features/authentication/useUnlinkWorkerAccount.js`
- `src/features/authentication/useGrantStaffRole.js`
- `src/features/workers/useWorker.js`
- `src/features/workers/documents/WorkerDocumentsView.jsx`
- `src/pages/MyDocuments.jsx`
- `src/pages/PendingAccess.jsx`
- `src/ui/WorkerAppLayout.jsx` (or similar name)
- `src/ui/RoleGate.jsx` (or similar name — replaces the earlier "StaffRoute" sketch with an explicit allow-list gate)

Modified:
- `src/services/apiWorkers.js` (add `getWorkerById`)
- `src/pages/Records/WorkerDocuments.jsx` (thinned to a wrapper)
- `src/features/workers/WorkerTable.jsx` / `WorkerRow.jsx` (admin link/unlink actions)
- `src/App.jsx` (new routes, `RoleGate` wrapping)

Unmodified (confirmed safe to leave untouched):
- `src/ui/ProtectedRoute.jsx`
- `src/services/apiAuth.js`
- `src/services/apiWorkerDocuments.js`
- All existing `features/workers/documents/*` hooks

New, added by §11 (server-side provisioning by invitation — not yet implemented, this update is spec-only):
- `supabase/functions/create-worker-account/index.ts`
- `src/features/authentication/useCreateWorkerAccount.js`
- `src/pages/SetPassword.jsx` (the required companion page, decisions.md #27)

Modified, added by §11:
- `src/services/apiProfiles.js` (add `createWorkerAccount({ workerId })`)
- `src/features/workers/WorkerRow.jsx` (add "Crear cuenta de acceso"; relabel existing "Vincular cuenta" to "Vincular cuenta existente")
- `src/App.jsx` (add `/set-password` route, once `SetPassword.jsx` exists)
- `supabase/config.toml` (add a `[functions.create-worker-account]` section with `verify_jwt = true`)

New, added by §12 (resend/recover access link — not yet implemented, this update is spec-only):
- `supabase/functions/resend-worker-access-link/index.ts`
- `src/features/authentication/useResendWorkerAccessLink.js`

Modified, added by §12:
- `src/services/apiProfiles.js` (add `resendWorkerAccessLink({ workerId })`)
- `src/features/workers/WorkerRow.jsx` (add "Reenviar enlace de acceso", alongside — not replacing — "Crear cuenta de acceso" and "Vincular cuenta existente")
- `supabase/config.toml` (add a `[functions.resend-worker-access-link]` section with `verify_jwt = true`)

Unmodified by §12 (confirmed safe to leave untouched — see §12.3):
- `src/pages/SetPassword.jsx`
- `src/features/authentication/useSetPassword.js`
- `src/services/apiAuth.js`
- `supabase/functions/create-worker-account/index.ts` (unaffected by adding the new, separate function)
