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
