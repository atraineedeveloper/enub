## Context

### 1. Current architecture

Two authenticated layouts render the same `Header` component today:

- `src/ui/AppLayout.tsx` — staff/admin shell. CSS grid with a `Sidebar`, passes `onToggleSidebar` to `Header`, which renders the `HiBars3` menu button. Mounted behind `ProtectedRoute > RoleGate` for `isStaffOrAdmin` sessions (`src/App.tsx:57-83`).
- `src/ui/WorkerAppLayout.tsx` — worker/teacher shell. No sidebar, no `MainNav`; renders `<Header />` with no `onToggleSidebar`. Today `Header` fills that slot with an empty `<span />` purely to keep `justify-content: space-between` visually centering the logo (`Header.tsx:63-69`) — this fake-centering-via-empty-placeholder is the alignment problem called out in the revision and is removed in this design (§8). Mounted behind `ProtectedRoute` only (no `RoleGate`) for `my-documents` and `pending-access` (`src/App.tsx:85-94`).

`Header` itself (`src/ui/Header.tsx`) is a single `styled.header` holding three children: the optional menu button, a centered `<Logo>ENUB</Logo>`, and an `IconsContainer` with `DarkModeToggle` and `Logout`. It carries no identity, role, or page-context information. **Both layouts already share one `Header` implementation** — there is no duplication to reconcile, only content to add.

`DarkModeToggle` (`src/ui/DarkModeToggle.tsx`) reads `useDarkMode()` from `src/context/useDarkMode.ts` and renders a bare icon button with no `aria-label`. `Logout` (`src/features/authentication/Logout.tsx`) calls `useLogout()` (wraps `useMutation` around `apiAuth.logout`, exposes `{ logout, isLoading }`) and renders an icon-only `ButtonIcon`, also with no `aria-label`.

The breakpoint convention across the codebase is a single `max-width: 900px` mobile breakpoint (`AppLayout.tsx`, `WorkerAppLayout.tsx`, `Header.tsx`, `Sidebar.tsx`, `Table.tsx`, etc.). The root font-size is `62.5%` (`GlobalStyles.ts:129`), i.e. `1rem = 10px`, so the current `MenuButton` (`3.6rem` = **36px**) is below a 44×44 CSS px touch target — flagged and corrected in §9.

The repository **does** have a working test setup: `bun:test`, used today by `src/services/apiWorkerDocuments.test.ts` and `src/features/workers/documents/workerDocumentTypeVisibility.test.ts` for pure-logic unit tests (no DOM rendering, no `@testing-library`/`jsdom` dependency present). `AGENTS.md`'s "no test script" note refers to there being no `package.json` `test` script wired up and no DOM-testing capability — it does not mean no test framework exists at all. This design corrects that distinction (§13).

### 2. Identity/role data source and visible labels

No React auth context exists; identity is resolved through two composed TanStack Query hooks:

- `useUser()` (`src/features/authentication/useUser.ts`) → `supabase.auth.getUser()`. Returns the raw Supabase Auth user. Its `isAuthenticated` flag only means "has a Supabase session" — never an app-level role.
- `useProfile()` (`src/features/authentication/useProfile.ts`) → queries `profiles` (`role, worker_id`), exposing `{ isLoading, role, workerId, isWorker, isStaffOrAdmin, isAdmin, hasNoAccess }`. **This is the single source of truth for the app-level role.**

`profiles.role` is `null | "staff" | "admin" | "worker"`. The visible role label mapping is final and exact, with no merging of `staff` and `admin`:

| `profiles.role`                             | Visible label                                  |
| ------------------------------------------- | ---------------------------------------------- |
| `admin`                                     | `Administrador`                                |
| `staff`                                     | `Personal administrativo`                      |
| `worker`                                    | `Docente`                                      |
| anything else (unrecognized non-null value) | no label rendered — see `denied` state, §3     |
| `null` (no `profiles` row)                  | no label rendered — see `incomplete` state, §3 |

`worker` remains the only internal role identifier used in code, queries, and gating logic; `Docente` is strictly a UI string produced by the label-mapping function and never compared against or branched on.

Exact sources, per field:

| Field             | `admin` / `staff`                                                                                                                                                                                                                                                                  | `worker`                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Role label        | table above                                                                                                                                                                                                                                                                        | table above                                                                                                                                      |
| Display name      | **No staff/admin profile/name table exists.** Falls back to the local part of the Auth user's email (before `@`) — always, since there is no other source. This is an explicit, documented, temporary fallback (per proposal's Final Decisions), never the full email or the UUID. | `workers.name` when the worker row was found; otherwise the same email-local-part fallback (§3, §11)                                             |
| Profile picture   | None available today → always initials/icon fallback                                                                                                                                                                                                                               | `workers.profile_picture` → `getProfilePicturePublicUrl()` (`src/services/apiWorkers.ts:158`) when the worker row was found and the field is set |
| Initials fallback | Derived from the email-local-part fallback name                                                                                                                                                                                                                                    | Derived from `workers.name`, or the email-local-part fallback when the row is missing                                                            |

Role is never read from the URL, the layout component, or a hard-coded prop — `Header` calls `useCurrentIdentity()` itself, exactly like `RoleGate` and `WorkerRow` call `useProfile()` today.

### 3. Identity-state model

`useCurrentIdentity()` returns a discriminated union on a `status` field. This replaces the earlier single `isLoading` boolean with an explicit, exhaustive model so every render path is defined and testable:

```ts
type IdentityState =
  | { status: "loading" }
  | {
      status: "ready";
      role: "admin" | "staff" | "worker";
      roleLabel: string; // exact table in §2
      displayName: string;
      isNameFallback: boolean; // true when displayName came from the email local-part
      avatarUrl: string | null; // trusted URL only, see §10
      initials: string;
    }
  | { status: "incomplete" } // authenticated, profiles query succeeded, but role is null (no row / hasNoAccess) OR role is "worker" with no valid workerId linkage
  | { status: "denied" } // authenticated, profiles row exists, but role is a value other than admin/staff/worker
  | { status: "profile-error" } // the profiles query itself failed (network/RLS/db) — distinct from "no row"
  | { status: "worker-error" }; // role is worker, workerId is valid, but the worker-row query failed at the transport/RLS/db level (not "no row found")
```

State resolution, in order:

1. `useUser()`/`useProfile()` still loading → `loading`.
2. `useProfile()`'s underlying query errored → `profile-error`.
3. Profile succeeded, `role === null` (`hasNoAccess`) → `incomplete`.
4. Profile succeeded, `role` is a non-null value outside `{admin, staff, worker}` → `denied` (defensive; not expected in practice, but the schema does not constrain `role` to an enum today).
5. `role` is `admin` or `staff` → `ready` immediately (no worker query involved; `displayName`/`initials` always derived from the email-local-part fallback, `isNameFallback: true`, `avatarUrl: null`).
6. `role === "worker"`:
   - `workerId` fails the gating check in §4 (missing, zero, negative, `NaN`, infinite, non-integer) → **`incomplete`**, not `ready`. The profile explicitly claims a worker identity but carries no valid worker linkage to resolve it from — there is no safe display name, role badge, or avatar to show, so the header renders the same minimal authenticated header as any other `incomplete` session (ENUB brand, theme toggle, direct logout only). This is deliberately different from a _valid_ `workerId` whose lookup finds no row (next bullet), where the linkage itself is sound and only the row is absent.
   - `workerId` passes gating, worker query in flight → `loading`.
   - Worker query succeeded, row found → `ready` with `workers.name`/`workers.profile_picture` (`isNameFallback: false`).
   - Worker query succeeded, no row found for a _valid_ `workerId` (see §11) → `ready` with the email-local-part fallback identity (`isNameFallback: true`, visible role `Docente`, initials derived from that fallback) — "a missing worker record may use safe fallback identity derived from the authenticated account only if the profile itself is valid," per the revision's instruction. The linkage (`workerId`) was valid; only the row lookup came back empty.
   - Worker query failed at the transport/RLS/database level for a _valid_ `workerId` (see §11) → `worker-error`, **not** folded into the fallback-name path, so a real backend failure is never silently presented as an ordinary missing-name case.

Rendering contract per state:

- **`ready`**: may render name, role label, avatar, and the account popover (§6).
- **`loading`**: shows the baseline header — ENUB brand, theme toggle, direct logout control — plus a neutral, non-interactive structural placeholder only where the identity trigger will appear once resolved. It must not show: a guessed display name, a guessed role label, initials, an avatar image, or the account popover trigger. The placeholder is not itself an interactive/focusable element (there is nothing to open yet) and is not the account popover trigger in any form.
- **`incomplete`, `denied`, `profile-error`, `worker-error`**: all render the same minimal authenticated header — ENUB brand, theme toggle, and a direct, always-focusable logout control. They do **not** render: `Docente` or any other role label, the email-local-part identity, an avatar, initials, or the account popover/its trigger. This keeps the state machine simple (every non-`ready` state is either "still resolving" or "resolved to something we should not present as an identity"), and guarantees the user always has a way to log out regardless of which failure mode occurred.

### 4. Strict worker-query gating

`src/features/workers/useWorker.ts`'s `enabled` guard today is only `workerId != null`. This change replaces that with an explicit gate function, evaluated by `useCurrentIdentity()` before calling the worker hook:

```ts
function canFetchWorkerIdentity(input: {
  profileSucceeded: boolean;
  role: string | null;
  workerId: number | null;
}): boolean {
  if (!input.profileSucceeded) return false;
  if (input.role !== "worker") return false;
  if (typeof input.workerId !== "number") return false;
  if (!Number.isFinite(input.workerId)) return false;
  if (!Number.isInteger(input.workerId)) return false;
  if (input.workerId <= 0) return false;
  return true;
}
```

`admin` and `staff` sessions always pass a disabled/`null` `workerId` into the worker hook — the gate short-circuits on `role !== "worker"` before any numeric check, so no worker fetch is ever attempted for those roles regardless of what `workerId` happens to contain. This function is pure and exported for direct unit testing (§13), independent of React/TanStack Query, so gating correctness does not depend on rendering a component.

### 5. Stale-identity prevention across account changes

`useCurrentIdentity()` returns a value computed fresh from `useProfile()`/worker-query state on every render — it does **not** copy identity fields into `useState`/`useRef` at any point. This is the same pattern `useProfile()` itself already uses over `useUser()`. Because of this:

- The profile query is keyed by `["profile", user?.id]` (`useProfile.ts:9`) and the worker query is keyed by `["worker", workerId]`. When the authenticated user id changes (new login), the profile query key changes, so TanStack Query treats it as a distinct query with no stale data to show — the identity hook immediately reflects `loading` (or `profile-error`/`incomplete`/etc.) for the new session rather than continuing to render the previous user's derived fields.
- `useLogout()`'s existing `onSuccess` handler already calls `queryClient.removeQueries()` (`useLogout.ts:15`) before navigating to `/login` — this clears all cached profile/worker data on a **successful** logout, so a subsequent different-user login starts from a clean cache.
- On a **failed** logout, `removeQueries()` never runs (it's in `onSuccess` only) and no navigation occurs, so the current user's cached identity correctly remains displayed — this is the desired behavior (§ tests below), not a bug to fix.
- Because the worker query key is `["worker", workerId]` (keyed by worker id, not by auth user id), if two different authenticated users are ever linked to the same `workerId` in sequence, the cached row is a property of the **worker record**, not of the auth session — showing that worker's current row content for whichever authenticated account is presently linked to it is correct, not stale, as long as the _role and worker-id resolution_ for the new session comes from a fresh, user-id-keyed profile query (which it does). The invariant under test is: a new authenticated user id always forces a fresh profile fetch, and only a profile that actually resolves `role === "worker"` with a valid `workerId` for _that_ user ever triggers or reuses a worker-keyed query.

**Current-user/profile-generation binding invariant.** This is stated explicitly, beyond the cache-key reasoning above, because the identity _resolver_ (the plain function that turns query states into an `IdentityState`, independent of how TanStack Query happens to cache things) must never consume worker-query output on trust alone:

> Worker-query output may be treated as authoritative for the current render only when the current render's authenticated user id, its successfully-resolved profile, and its exact valid `workerId` are the _same inputs_ that caused that worker-query result to be produced. If the authenticated user id has changed, the profile is still loading, the profile belongs to a different user generation than the worker result, the current profile no longer gates that exact `workerId`, or the worker result on hand is otherwise a stale prior-account snapshot, the resolver rejects it — it does not render it as identity data.

This does **not** require adding the authenticated user id to the worker query's cache key (the existing `["worker", workerId]` key remains correct, per §11's reasoning that worker rows are a property of the worker record). The guard lives in the resolver's own logic, not in the cache key. Concretely, `useCurrentIdentity()` always recomputes `workerId` fresh from the _current_ `useProfile()` output on every render and passes that same, single value both into `canFetchWorkerIdentity()` (§4) and into the worker query call — it never reads a memoized/previous-render `workerId`, and it never renders `worker query.data` when the profile that would currently gate that data is still loading, errored, or resolves to a different `workerId`/role than the one the on-hand worker result was produced for.

To make this invariant independently testable without a full TanStack Query integration test, the resolver's core decision is expressed as a pure function over an explicit snapshot shape:

```ts
interface ProfileSnapshot {
  authUserId: string | null;
  status: "loading" | "error" | "success";
  role: "admin" | "staff" | "worker" | null | string; // raw value; label mapping happens elsewhere
  workerId: number | null; // as resolved by THIS profile snapshot only
}

interface WorkerQuerySnapshot {
  // The exact inputs active when this worker-query result was produced/observed.
  forAuthUserId: string;
  forWorkerId: number;
  status: "loading" | "success" | "error";
  data: { name: string; profile_picture: string | null } | null;
}

function resolveIdentityState(
  profile: ProfileSnapshot,
  worker: WorkerQuerySnapshot | null, // null when gating disallows a fetch this render
): IdentityState {
  // 1. Reject a worker snapshot that doesn't belong to this exact profile generation.
  const workerMatchesCurrentProfile =
    worker !== null &&
    worker.forAuthUserId === profile.authUserId &&
    worker.forWorkerId === profile.workerId;

  const effectiveWorker = workerMatchesCurrentProfile ? worker : null;

  // 2. Resolution then proceeds exactly as in the numbered list above,
  //    using `effectiveWorker` instead of `worker` — a mismatched
  //    snapshot is treated identically to "no worker result yet".
  // ...
}
```

A worker snapshot that fails the `workerMatchesCurrentProfile` check is treated exactly as if no worker-query result existed yet for this render — the resolver falls through to `loading` (if the current profile's gating would enable a fresh fetch) or to whichever non-worker state the current profile alone determines (`incomplete`, `profile-error`, etc.). It is never rendered as if it were valid data for an identity it does not belong to.

### 6. Account popover (not ARIA menu semantics)

`Menus.tsx` (used today for table row actions) has no `aria-haspopup`, `aria-expanded`, `role="menu"`, or Escape handling, and its fixed-position/portal math is tuned for per-row triggers. Rather than retrofit it — and rather than adopt full `role="menu"`/`role="menuitem"`/`aria-haspopup="menu"` semantics, which per the WAI-ARIA Authoring Practices obligate full arrow-key application-menu keyboard behavior this change does not implement — `AccountPopover.tsx` is a new, header-scoped, simpler disclosure pattern:

- Trigger: a real `<button>` with `aria-expanded={isOpen}`, `aria-controls="account-popover"`, and an accessible name (`Abrir opciones de cuenta de {name}` when identity is `ready`; see §9 for the exact string).
- Popover: an ordinary labeled region (`<div id="account-popover" role="region" aria-label="Cuenta">` or an equivalent labelled group — not `role="menu"`) containing plain, normally-focusable content: the display name, the role label, and a `Cerrar sesión` `<button>`.
- Navigation is ordinary `Tab`/`Shift+Tab` through the popover's real interactive elements — no roving `tabindex`, no arrow-key handling, because this is not an application menu.
- The logout button inside the popover uses normal button semantics and the same `useLogout()` hook as the minimal-header direct logout control (§7) — there is exactly one logout implementation, invoked from two possible locations depending on identity state.
- In every non-`ready` state, the popover is not rendered at all — the direct logout control (§3) takes its place.

**Dismissal-specific focus behavior.** Focus handling is not uniform across every way the popover can close — it depends on _why_ it closed:

| Dismissal cause                                   | Popover state                                                                                   | Focus behavior                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Escape` (or any other keyboard-driven dismissal) | closes                                                                                          | focus returns to the trigger button                                                                                                                                       |
| Mouse outside-click                               | closes                                                                                          | focus is **not** forcibly moved — wherever the click landed (or didn't land on a focusable element) is left alone                                                         |
| Route navigation while open                       | closes                                                                                          | focus is **not** returned to the old trigger — the trigger may no longer be the meaningful thing to focus once the route (and often the page's content) has changed       |
| Logout activation                                 | the existing logout flow runs (pending → success navigates to `/login`, or the mutation errors) | no focus-restoration is attempted during the resulting navigation; the logout flow's own behavior (§7) is authoritative and is not layered with popover-close focus logic |

Only the keyboard-dismissal path performs an explicit focus-return; the other three close the popover as a pure visibility change with no additional focus side effect.

### 7. Logout reuse

Both the popover's `Cerrar sesión` button and the minimal-header direct logout control call the same `useLogout()` hook (`{ logout, isLoading }`) — no second logout implementation is introduced. Both:

- disable themselves and show a pending affordance while `isLoading` is true, preventing duplicate submissions (same guard `Logout.tsx` already applies via `disabled={isLoading}`);
- preserve the existing error behavior (the mutation has no `onError` today beyond default React Query handling — unchanged);
- remain reachable and activatable via keyboard (both are real `<button>` elements).

### 8. Worker-layout alignment fix

The empty `<span />` placeholder in `Header.tsx` exists only to keep `justify-content: space-between` visually centering the logo when no sidebar toggle is present — this is the "fake centering through an empty placeholder" flagged in the revision. The rewritten `Header` replaces the single `space-between` row with three explicit flex regions that do not depend on a symmetric placeholder:

```
[ left: toggle? + brand + subtitle? ]  [ context: route label, flexible/collapsible ]  [ right: theme toggle + account control ]
```

- Left region: `flex: 0 0 auto`, its own internal `display:flex; gap` — renders the toggle button only when `onToggleSidebar` is provided (`AppLayout`), and simply omits it (no placeholder of any kind) when absent (`WorkerAppLayout`). Brand and subtitle sit immediately after, left-aligned.
- Context region: `flex: 1 1 auto; min-width: 0`, sits between left and right and left-aligns its own text right after the brand — it is not centered against the full header width, so it never depends on the left region's width matching the right region's width.
- Right region: `flex: 0 0 auto`, holds the theme toggle and the account control (popover trigger or direct logout), pinned to the end of the row by the context region's `flex: 1 1 auto` consuming the remaining space.

This single layout works unchanged for both `AppLayout` (toggle present) and `WorkerAppLayout` (toggle absent) — the left region's natural width simply differs; nothing elsewhere compensates for it, so there is no more coupling between "is there a placeholder" and "does the header look right."

### 9. Deterministic responsive behavior

Exactly two fixed viewport-width breakpoints, both implemented as ordinary `@media (max-width: …)` queries — the same technique already used throughout the codebase (`Header.tsx`, `AppLayout.tsx`, `WorkerAppLayout.tsx`, `Sidebar.tsx`, `Table.tsx`) — and **no container queries**, since the header always spans the full viewport width (`grid-column: 1 / -1` in `AppLayout`, full width in `WorkerAppLayout`), so a viewport media query is an accurate, sufficient proxy for "available header width" here:

- **`900px`** — the existing codebase mobile breakpoint, reused unchanged.
- **`1100px`** — one new, explicitly documented intermediate threshold introduced by this change. Rationale: it is not currently used anywhere else in the codebase; it is chosen conservatively between typical laptop/desktop viewport widths (~1280px and up, where the header has ample room) and the existing `900px` mobile cutoff, giving a distinct "narrow desktop/tablet" tier without inventing a second, unbounded set of breakpoints.

Three tiers, with a deterministic collapse order realized across these two breakpoints:

- **Wide desktop (`> 1100px`)**: toggle (when available), brand, subtitle, route context, theme toggle, avatar, name, role all fully visible, nothing truncated.
- **Narrow desktop/tablet (`901px`–`1100px`)**: the subtitle is hidden (`display: none`) — step 1 of the collapse order. The route-context label is not unconditionally hidden at this tier; it is given `flex-shrink: 1; min-width: 0` with `text-overflow: ellipsis`, so it only visually truncates ("collapses") once the remaining width after the toggle/brand and the name/role/avatar cluster is actually insufficient — step 2 of the collapse order, expressed as truncation rather than a third breakpoint. Name, role, and the avatar/account trigger remain fully visible at this tier.
- **Mobile (`≤ 900px`)**: the route-context label is now fully hidden (`display: none`) — completing step 2 — and the visible name/role text is hidden as well (`display: none`) — step 3. Only the menu toggle (when available), a compact "ENUB" mark, and the avatar/account trigger (or the direct theme/logout controls in non-`ready` states) remain — step 4, the avatar/account trigger never disappears once identity is `ready`. Name, role, and logout stay reachable inside the opened popover.

This keeps the documented four-step collapse order (subtitle → route context → name/role → avatar trigger persists) fully deterministic using only the two fixed breakpoints above, with no fluid/container-query-based sizing decision left ambiguous.

Additional deterministic rules:

- **Identity text max-width**: the name span has a fixed `max-width` (e.g. `16rem`/160px at the root 10px-per-rem scale) with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` — never wraps, so header height never grows from a long name. The full name is available via the `title` attribute and unabridged inside the popover.
- **No horizontal overflow**: all flexible regions use `min-width: 0` so text truncation (not overflow) is always the resolution for long content.
- **Touch targets**: every interactive header control (sidebar toggle, theme toggle, account/avatar trigger, direct logout control, popover buttons) has a minimum hit area of 44×44 CSS px, achieved via `min-width`/`min-height`/padding rather than shrinking the visual icon — the current `MenuButton` at `3.6rem`/36px (§1) is widened to meet this on all breakpoints, not just mobile.
- **Avatar/account trigger accessible name**: exactly `Abrir opciones de cuenta de {name}` where `{name}` is the resolved `displayName` (including the email-local-part fallback when applicable) — set on the trigger `button`'s `aria-label`, so the avatar image/icon inside it can be purely decorative (`aria-hidden="true"`, no redundant `alt` text competing with the button's own accessible name).

### 10. Avatar behavior

`Avatar.tsx` generalizes the `Img`/`Avatar` styled-element pattern from `WorkerRow.tsx` with these additional guarantees, none of which exist in the current inline implementation:

- **Trusted source only**: the `src` passed to `Avatar` must be the URL returned by the existing `getProfilePicturePublicUrl()` helper (or `null`) — never a string derived from `displayName`, email, or any other identity text. `useCurrentIdentity()` is the only place allowed to call `getProfilePicturePublicUrl()`, and it does so only in the "worker row found" branch of §3.
- **Fallback order**: (1) a successfully loaded profile image, (2) initials, (3) a generic accessible user icon.
- **Image-error state resets on `src` change**: the component's internal "did this image fail" flag is derived from/reset alongside the `src` prop (e.g. via a `key={src}` remount or an effect that clears the error flag when `src` changes), so a previously broken image does not permanently suppress a later, valid `src` for the same mounted component (e.g. after identity transitions from fallback to a resolved worker row).
- **No broken-image UI**: the `<img>`'s `onError` handler flips the display to the initials fallback before the browser's broken-image icon can render.
- **Unicode-safe initials**: initials are computed with a Unicode-letter-aware matcher (`\p{L}` under the `u` regex flag) so accented letters (á, é, ñ, ü, …) are preserved and correctly uppercased via `toLocaleUpperCase()`, not stripped by an ASCII-only assumption.
- **One-word vs multi-word**: a single-word name yields one initial (its first letter); a multi-word name yields two initials, the first letter of the first word and the first letter of the last word (skipping to the first actual letter character in each, so stray leading punctuation doesn't produce a blank initial).
- **Local-part extraction before initials**: when the identity is in the email-local-part fallback (`isNameFallback: true`), the email's local part is extracted and its separator characters (`.`, `_`, `+`, `-`) are normalized to spaces _before_ the string reaches the initials function — the domain is discarded at extraction time, so it is structurally impossible for it to appear in the initials output.
- **Decorative when the trigger already names it**: inside `AccountPopover`'s trigger button, the avatar element is `aria-hidden="true"` (no competing `alt`/label), because the surrounding button already carries the full accessible name (§9). A standalone `Avatar` used outside that context (if ever) takes its own `name`/`alt`.

Both the initials function and the picture/initials/icon fallback decision are implemented as pure, side-effect-free helpers so they are directly unit-testable without rendering (§13).

### 11. Distinguishing missing worker from worker-query failure

`getWorkerById()` (`src/services/apiWorkers.ts:192-199`) uses `.select("*").eq("id", id).single()`. Supabase's `.single()` throws (via a returned `error`) both when zero rows match _and_ when a genuine transport/RLS/database error occurs — the existing function collapses both into one thrown `Error`, which is exactly the ambiguity the revision flags. `getWorkerById()` itself is left unchanged, because its other callers (`WorkerDocuments.tsx`, `CreateEditWorkerForm.tsx` editing an existing worker, etc.) correctly want "throw if the specific worker id doesn't exist" behavior — changing its underlying query method would alter behavior for those unrelated call sites, which the revision explicitly warns against.

Instead, this change adds a small, separate function scoped to the identity path:

```ts
// src/services/apiWorkers.ts
export async function getWorkerIdentityById(id: number) {
  const { data, error } = await supabase
    .from("workers")
    .select("name, profile_picture")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new Error("El perfil del trabajador no pudo cargarse");
  }

  return data; // null when no row was found; a genuine error still throws above
}
```

`.maybeSingle()` returns `data: null` (no `error`) when no row matches, and still surfaces `error` for real failures — so the identity hook can cleanly branch:

- `data` present → worker row found → `ready` with real name/picture (§3).
- `data === null`, no thrown error → worker row missing → `ready` with the email-local-part fallback (§3).
- thrown error → `worker-error` (§3) — never silently treated as the ordinary missing-name fallback path.

This is the minimal, unrelated-behavior-safe way to satisfy the revision's requirement to distinguish the three outcomes, and it keeps `getWorkerById()`'s existing throw-on-missing contract intact for its current callers.

### 12. Dark mode verification

All new elements (`Avatar`, `AccountPopover`, route-context label, the widened touch-target buttons) use only existing CSS custom properties, which already redefine themselves under `.dark-mode` (`GlobalStyles.ts`). Explicit verification is required (captured in tasks.md and the manual matrix) for each of the following in both light and dark mode:

- header surface (`--color-grey-0`),
- popover background (`--color-grey-0`) and its shadow (`--shadow-md`),
- border (`--color-grey-100`/`--color-grey-200`),
- primary text (`--color-grey-700`/`--color-grey-900`),
- secondary text — role label, subtitle, route context (`--color-grey-500`/`--color-grey-600`),
- focus ring (visible outline color against both surfaces — verify existing focus-visible convention, if any, or define one using `--color-brand-500`/`--color-brand-600`),
- avatar fallback background/text (`--color-brand-100`/`--color-brand-700`, matching `WorkerRow.tsx`'s existing convention),
- hover/focus states on all interactive controls,
- disabled logout state (reduced opacity, matching `Menus.tsx`'s existing `&:disabled { opacity: 0.5 }` convention).

No new dark-mode-specific values are introduced.

### 13. Automated and manual verification

The repository has a working `bun:test` setup (§1) used today for pure-logic tests with no DOM dependency. Without adding any dependency (no `@testing-library/react`, no `jsdom`), this change adds **focused, DOM-free automated tests** for every piece of logic that can be expressed as a pure function or a hook-state resolution table:

- role-label mapping (`admin`/`staff`/`worker`/unrecognized/`null` → exact label or no label);
- worker-query gating (`canFetchWorkerIdentity`): admin never fetches, staff never fetches, missing `workerId` doesn't fetch, zero/negative/`NaN`/non-integer/infinite `workerId` doesn't fetch, a valid positive integer `workerId` does gate a fetch;
- identity-state resolution table (§3), explicitly including the corrected invalid-link behavior:
  - `role: "worker"` + missing `workerId` → `incomplete`;
  - `role: "worker"` + `workerId: 0` → `incomplete`;
  - `role: "worker"` + negative `workerId` → `incomplete`;
  - `role: "worker"` + non-integer `workerId` → `incomplete`;
  - `role: "worker"` + `NaN`/`Infinity` `workerId` → `incomplete`;
  - `role: "worker"` + valid `workerId` + worker lookup succeeds with no row → `ready` with the email-local-part fallback;
  - `role: "worker"` + valid `workerId` + worker lookup fails (transport/RLS/db) → `worker-error`;
  - plus `loading`, `profile-error`, `denied`, `ready-admin`, `ready-staff`, and `ready-worker-found`;
- the `loading` state's exact rendered/not-rendered contract (brand + theme toggle + direct logout shown; guessed name, role, initials, avatar image, and the account popover trigger all absent);
- the current-user/profile-generation guard (`resolveIdentityState`'s snapshot-matching logic, §5): current user changes while cached worker data exists → stale snapshot rejected; the same `workerId` reused across two different user snapshots → not trusted until regenerated for the new user; an old worker result supplied alongside a still-loading profile → resolver yields `loading`, ignoring the stale worker snapshot entirely; a failed logout leaves the current identity's snapshot (and therefore its resolved state) unchanged; a successful account change yields a neutral/loading state until the new profile resolves — all expressed as resolver/state-snapshot tests over hand-constructed `ProfileSnapshot`/`WorkerQuerySnapshot` inputs, not full TanStack Query integration tests;
- email local-part fallback extraction (domain stripped before any initials computation);
- initials generation (accented Unicode, one-word, multi-word, empty/malformed input, domain-never-present);
- route-context most-specific matching (`/workers/:id/documents` wins over `/workers/:id` wins over `/workers`; `/semesters/:id` resolves to exactly `"Horario del semestre"` and wins over `/semesters` → `"Semestres"`; nested/parameterized patterns resolve correctly);
- unknown-route fallback (`ENUB`);
- avatar fallback decision helper (`resolveAvatarDisplay`): image vs. initials vs. icon, including the "image errored" input.

DOM-heavy interaction (popover open/close via real clicks, actual Tab-order traversal, real Escape/outside-click event dispatch, real focus-return verification) stays in the manual browser verification matrix (§14 / `tasks.md`) — the repository has no DOM-testing capability today (`jsdom`/`@testing-library`) and adding one is out of scope ("do not add dependencies without explicit approval").

### 14. Manual browser verification matrix

- admin desktop / admin mobile
- staff desktop / staff mobile
- teacher (worker) desktop / teacher mobile
- light mode / dark mode
- keyboard-only interaction (toggle → theme → account trigger → popover items → Escape closes and returns focus to trigger)
- outside-click close (popover closes; focus is not forcibly moved)
- route-change close (popover closes; focus is not returned to the old trigger)
- long display name (ellipsis, no wrap, `title` attribute)
- missing profile image (initials shown)
- broken/failing profile image (falls back to initials, no broken-image icon)
- `pending-access`/no-access minimal header (no identity trigger, direct logout present)
- worker-role account with an invalid or missing `workerId` (minimal header — `incomplete` — no `Docente` label, no fallback identity, no avatar)
- logout pending (disabled, no duplicate submission), from both the popover and the minimal-header direct control
- worker layout without sidebar toggle (left-alignment verified, no leftover placeholder gap)
- narrow desktop/tablet width between `901px` and `1100px` (subtitle hidden, route context truncating/ellipsizing as needed, name/role still visible)
- semester-detail route (`/semesters/:id`) shows exactly "Horario del semestre", distinct from `/semesters`'s "Semestres"

### 15. Migration impact

None expected. `Header`'s exported prop contract (`onToggleSidebar?`) is unchanged, so `AppLayout.tsx` and `WorkerAppLayout.tsx` need no call-site changes. No route, Supabase table, or query shape changes — `getWorkerById()` is untouched; only a new, additive `getWorkerIdentityById()` function is introduced. No new dependency.

## Goals / Non-Goals

**Goals:**

- Give `admin`, `staff`, and `worker` sessions distinct, correctly-labeled identity (name, role, avatar) and page context in the shared header, on desktop and mobile.
- Define an explicit, exhaustive identity-state model so no render path can show a guessed or stale identity.
- Gate the worker lookup strictly enough that `admin`/`staff` sessions can never trigger it and invalid worker links fail safe.
- Replace the ambiguous icon-only logout with an accessible account popover using disclosure-pattern semantics, not full ARIA menu semantics.
- Keep one shared `Header` implementation, role-aware via real auth/profile data, correctly aligned whether or not a sidebar toggle is present.

**Non-Goals:**

- Notifications, global search, messaging, account settings, profile editing, change-password UI, sidebar IA redesign, or any other scope-excluded item from the proposal.
- A new design system, new component library, or new dependency (including no DOM-testing library).
- Adding a staff/admin profile table or any new Supabase schema — this change only reads what `profiles` and `workers` already expose, via one additive service function.
- Full ARIA `role="menu"` application-menu keyboard behavior (arrow-key navigation, roving tabindex, type-ahead) — explicitly out of scope; the account control is a simpler popover/disclosure.
- Retrofitting `Menus.tsx` globally with ARIA semantics — only the new header-scoped `AccountPopover.tsx` gets the popover pattern described here.

## Decisions

1. **Composed hook (`useCurrentIdentity`) returning a discriminated union, over a new context or a boolean-flag hook.** Matches the app's existing pattern of composed TanStack Query hooks (`useProfile` over `useUser`), and makes every render path explicit and testable as a state-resolution table (§3, §13) rather than an ad hoc combination of booleans.
2. **New `AccountPopover.tsx` instead of extending `Menus.tsx`, and a disclosure pattern instead of `role="menu"`.** `Menus.tsx` is shared by table-row actions with different positioning needs; more importantly, `role="menu"`/`aria-haspopup="menu"` semantics carry an implied contract (arrow-key navigation) this change does not implement, so adopting them would itself be an accessibility defect. A labeled-region popover with ordinary Tab order is the correct, honest semantic for this control.
3. **Gate function (`canFetchWorkerIdentity`) as a pure, exported helper** rather than inlined `enabled` logic, so gating correctness is unit-testable independent of React Query/rendering (§13).
4. **New `getWorkerIdentityById()` using `.maybeSingle()`, leaving `getWorkerById()` (`.single()`) untouched.** Directly satisfies the revision's instruction to distinguish "missing row" from "query failure" without altering behavior for `getWorkerById()`'s existing, unrelated callers.
5. **Route-context via an ordered, most-specific-first pattern list matched with `react-router-dom`'s `matchPath`**, not first-segment string matching and not new `handle` metadata on every `<Route>` in `App.tsx`. Keeps the change additive and header-scoped while still correctly resolving parameterized/nested routes and never displaying a raw segment. The pattern list, most specific first:

   ```ts
   const ROUTE_CONTEXT_PATTERNS: { pattern: string; label: string }[] = [
     { pattern: "/workers/:id/documents", label: "Documentos del trabajador" },
     { pattern: "/workers/:id", label: "Detalle del trabajador" },
     { pattern: "/workers", label: "Trabajadores" },
     { pattern: "/semesters/:id", label: "Horario del semestre" },
     { pattern: "/semesters", label: "Semestres" },
     { pattern: "/dashboard", label: "Inicio" },
     { pattern: "/degrees", label: "Licenciaturas" },
     { pattern: "/subjects", label: "Materias" },
     { pattern: "/groups", label: "Grupos" },
     { pattern: "/study-programs", label: "Programas de estudio" },
     { pattern: "/state-roles", label: "Roles estatales" },
     { pattern: "/roles", label: "Roles" },s
     { pattern: "/others", label: "Otros" },
     { pattern: "/my-documents", label: "Mis documentos" },
     { pattern: "/pending-access", label: "Acceso pendiente" },
   ];

   function resolveRouteContextLabel(pathname: string): string {
     for (const { pattern, label } of ROUTE_CONTEXT_PATTERNS) {
       if (matchPath({ path: pattern, end: true }, pathname)) return label;
     }
     return "ENUB";
   }
   ```

   The list is authored most-specific-first and checked in order, so `/workers/:id/documents` is tried (and can match) before the more general `/workers/:id`, which is tried before `/workers` — this is what "prefer the most specific matching route" means in practice here, since `matchPath` itself does not rank patterns by specificity. `/semesters/:id` resolves to the exact label `"Horario del semestre"`, distinct from `/semesters` → `"Semestres"`; an unmatched authenticated route (e.g. `PageNotFound`) falls back to `"ENUB"`, never a raw segment.

6. **Three-region flex layout replacing `space-between` + empty-span centering.** Directly removes the alignment coupling between "is a sidebar toggle present" and "does the header look correct" (§8) — a structural fix, not a cosmetic one.
7. **Email-local-part fallback for display name when no name field exists**, finalized (no longer an open question): admins/staff have no name-bearing table today; a _valid_ worker link whose row lookup finds nothing degrades to the same fallback. An _invalid or missing_ worker link, by contrast, resolves to `incomplete` (§3) rather than a fallback identity — the profile's claim of a worker role is itself unverifiable in that case, so the header shows the minimal authenticated state instead of inventing an identity for a link that was never established.
8. **Generation-guarded resolver over trusting cache-key matching alone (§5).** TanStack Query's `["worker", workerId]` key is sufficient for correctness in the common case, but the resolver explicitly re-validates that any worker-query result it is about to render belongs to the current render's profile-derived `authUserId`/`workerId` before using it, expressed as a small pure function (`resolveIdentityState` over `ProfileSnapshot`/`WorkerQuerySnapshot`) so the invariant is enforced by code structure and independently unit-testable, not merely an emergent property of how the query key happens to be constructed.
9. **Exactly two fixed, viewport-width breakpoints (`900px` existing, `1100px` new) instead of container queries or a third breakpoint.** Satisfies "use fixed media queries... do not use container queries... one explicit intermediate threshold" precisely, while still realizing the four-step collapse order (subtitle → route context → name/role → avatar persists) via a mix of `display: none` steps and, at the intermediate tier, `flex-shrink`/ellipsis truncation on the route-context label rather than a third hard breakpoint.
10. **Dismissal-specific focus rules (§6) instead of a single "always return focus" rule.** Returning focus to a trigger that navigated away with the page (route change) or that the user never keyboard-focused in the first place (outside click) would fight the browser's/user's own focus expectations; only the keyboard-dismissal path (Escape) gets an explicit focus-return, matching standard disclosure-widget conventions.

## Risks / Trade-offs

- **[Risk]** No staff/admin profile/name table exists, so `admin`/`staff` sessions only ever get the email-local-part fallback name. → **Mitigation**: documented as a final, explicit decision (not silent); `isNameFallback` is part of the identity contract so any future UI can distinguish real vs. fallback names if needed.
- **[Risk]** A bespoke `AccountPopover` duplicates some outside-click/portal-adjacent logic instead of reusing `Menus.tsx` wholesale. → **Mitigation**: both share the same underlying `useOutsideClick` hook; the duplication is limited to trigger/positioning markup and semantics, which intentionally differ (disclosure popover vs. application menu).
- **[Risk]** Static route-label pattern list can drift from `App.tsx`'s actual route list if routes are added later without updating it. → **Mitigation**: unmatched routes render the documented `ENUB` fallback (fail-safe, never a raw segment or a crash); listed as a maintenance note in tasks.md.
- **[Risk]** `workers.name` is a single free-text field, so initials/truncation logic must handle arbitrary Unicode input safely. → **Mitigation**: Unicode-aware (`\p{L}`) initials logic with explicit unit tests (§13) covering accented characters, one-word names, and malformed input.
- **[Risk]** Widening interactive controls to a 44×44 CSS px minimum changes existing visual sizing (e.g. `MenuButton` grows from 36px). → **Mitigation**: achieved via padding/`min-width`/`min-height`, not by enlarging icon glyphs, keeping the visual density close to today's design while meeting the touch-target requirement.
- **[Risk]** A `worker` profile with an invalid/missing `workerId` now renders the minimal header (`incomplete`) rather than a fallback identity, which is a stricter/less permissive behavior than the previous revision. → **Mitigation**: this is the explicit, intended correction from the revision — a worker-role profile with no usable linkage has nothing safe to identify the user by, so failing to the minimal header (still fully usable: brand, theme, logout) is preferred over presenting an unverified identity.

## Migration Plan

Not applicable as a deployment/rollback concern — this is a single-PR UI change to one shared component with no data migration, no route change, and no feature flag. Standard PR review + the manual verification matrix (§14) before merge; rollback is a plain revert if an issue surfaces.

## Open Questions

None remaining — all prior open questions are resolved and recorded as Final Decisions in `proposal.md`.
