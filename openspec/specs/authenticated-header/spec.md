# authenticated-header Specification

## Purpose
TBD - created by archiving change modernize-authenticated-header. Update Purpose after archive.
## Requirements
### Requirement: Shared header across authenticated layouts
The authenticated header SHALL be a single shared `Header` component rendered by both the staff/admin layout (`AppLayout`) and the worker/teacher layout (`WorkerAppLayout`), with role-aware content resolved from authenticated application data rather than from the layout that renders it.

#### Scenario: Admin layout renders the shared header
- **WHEN** an authenticated staff/admin user views any route under the admin layout
- **THEN** the shared `Header` component is rendered with the sidebar/menu toggle visible

#### Scenario: Worker layout renders the shared header
- **WHEN** an authenticated worker/teacher user views any route under the worker layout
- **THEN** the same shared `Header` component is rendered, without a sidebar/menu toggle, and with worker identity/role content instead of admin content

### Requirement: Header identity sourced from authenticated data
The header SHALL derive display name, role label, and profile picture exclusively from authenticated application data (the current session's role and, when applicable, the linked worker record), and MUST NOT infer role or identity from the URL, the rendering layout, or a hard-coded component prop.

#### Scenario: Role resolved from profile data, not route
- **WHEN** the header renders under either authenticated layout
- **THEN** the displayed role label reflects the current user's `role` value as resolved from the user's profile data, independent of which route or layout is currently active

### Requirement: Exact three-way role label mapping
The header SHALL display exactly one of three visible role labels, derived from the current user's `profiles.role` value, with `staff` and `admin` never merged into a shared label. The `worker` value SHALL remain the internal role identifier used in code and gating logic; `Docente` SHALL be used only as UI-visible terminology.

#### Scenario: Admin role label
- **WHEN** the current user's resolved role is `admin`
- **THEN** the header displays the role label "Administrador"

#### Scenario: Staff role label
- **WHEN** the current user's resolved role is `staff`
- **THEN** the header displays the role label "Personal administrativo", distinct from the `admin` label

#### Scenario: Worker role label
- **WHEN** the current user's resolved role is `worker`
- **THEN** the header displays the role label "Docente"

#### Scenario: Unrecognized role value
- **WHEN** the current user's resolved role is a non-null value other than `admin`, `staff`, or `worker`
- **THEN** the header does not display any role label and renders the minimal authenticated header (denied state)

### Requirement: Discriminated identity-state model
`useCurrentIdentity()` SHALL expose an explicit, exhaustive identity state with exactly these values: `loading`, `ready`, `incomplete`, `denied`, `profile-error`, `worker-error`. Every consumer of identity data SHALL branch on this state rather than inferring readiness from ad hoc combinations of loading/error flags.

#### Scenario: Loading state
- **WHEN** the authenticated user's session, profile, or (when applicable) worker-gated lookup has not finished resolving
- **THEN** the identity state is `loading`, and no name, role, or initials are exposed to the header

#### Scenario: Ready state
- **WHEN** the profile query has succeeded, the resolved role is `admin` or `staff`, or the resolved role is `worker` with a valid `workerId` whose lookup has resolved (row found, or successfully found no row)
- **THEN** the identity state is `ready` and exposes display name, role label, avatar, and initials

#### Scenario: Incomplete state — no profile row
- **WHEN** the profile query has succeeded but the current user has no `profiles` row (`role` is `null`)
- **THEN** the identity state is `incomplete`

#### Scenario: Incomplete state — worker role with an invalid or missing worker linkage
- **WHEN** the profile query has succeeded, the resolved role is `worker`, and `workerId` is missing, zero, negative, non-integer, `NaN`, or infinite (fails the worker-query gating check)
- **THEN** the identity state is `incomplete`, not `ready` — no worker lookup is attempted and no fallback identity is exposed, because the profile's worker claim has no valid linkage to resolve it from

#### Scenario: Denied state
- **WHEN** the profile query has succeeded and returns a non-null `role` value that is not `admin`, `staff`, or `worker`
- **THEN** the identity state is `denied`

#### Scenario: Profile-error state
- **WHEN** the profile query itself fails (network, RLS, or database error), as opposed to succeeding with no row
- **THEN** the identity state is `profile-error`, distinct from `incomplete`

#### Scenario: Worker-error state
- **WHEN** the resolved role is `worker`, the worker lookup was gated on (per the worker-query gating requirement), and that lookup fails at the transport/RLS/database level (as opposed to succeeding with no matching row)
- **THEN** the identity state is `worker-error`, distinct from a missing worker record

### Requirement: Minimal authenticated header for non-ready, non-loading states
When the identity state is `incomplete`, `denied`, `profile-error`, or `worker-error`, the header SHALL render only the ENUB brand, the theme toggle, and a direct, always-focusable logout control. It MUST NOT render an identity/account trigger, a display name, a role label, initials, or an avatar placeholder that implies identity resolution will succeed.

#### Scenario: Incomplete state renders minimal header
- **WHEN** the identity state is `incomplete`
- **THEN** the header shows the ENUB brand, the theme toggle, and a direct logout control, and shows no account trigger, name, role, or avatar

#### Scenario: Worker role with invalid linkage renders minimal header, not a fallback identity
- **WHEN** the identity state is `incomplete` because a `worker`-role profile has an invalid or missing `workerId`
- **THEN** the header shows only the ENUB brand, theme toggle, and direct logout control, and does not display the "Docente" role label, the email-local-part fallback identity, initials, or an avatar

#### Scenario: Worker-error state renders minimal header
- **WHEN** the identity state is `worker-error`
- **THEN** the header shows the same minimal set of controls as the incomplete/denied/profile-error states, never a guessed identity derived from partial data

### Requirement: Loading state renders a neutral placeholder only
While the identity state is `loading`, the header SHALL continue to show the ENUB brand, the theme toggle, and the direct logout control, and SHALL render a neutral, non-interactive structural placeholder in place of the account control. It MUST NOT display, during this state: a guessed display name, a guessed role label, initials, an avatar image, or the account popover trigger.

#### Scenario: Placeholder during loading
- **WHEN** the identity state is `loading`
- **THEN** the header shows the ENUB brand, the theme toggle, and the direct logout control, plus a neutral placeholder shape with no name, role text, or initials, and shows no avatar image and no account popover trigger

#### Scenario: Placeholder is not an interactive account trigger
- **WHEN** the identity state is `loading`
- **THEN** the neutral placeholder is not focusable or clickable as an account control — there is nothing to open until identity resolves

#### Scenario: Loading resolves without an incorrect flash
- **WHEN** the identity state transitions from `loading` to `ready`
- **THEN** the header renders the correct name, role, and avatar for the resolved user directly, without first rendering any other user's or a guessed identity

### Requirement: Display name resolution and fallback
The header SHALL display the linked worker's name for `worker` sessions with a resolved worker row, and MUST NOT display a raw UUID or the full email address as the primary display name. When no name-bearing record is available — including all `admin`/`staff` sessions, and `worker` sessions with a missing or invalid worker link — the header SHALL fall back to the local part of the authenticated user's email address (the text before `@`), and this fallback SHALL be treated as an explicit, documented, temporary behavior.

#### Scenario: Worker display name from linked worker record
- **WHEN** the current user's resolved role is `worker` and the gated worker lookup finds a row with a non-empty name
- **THEN** the header displays that worker's name as the display name

#### Scenario: No name-bearing record available
- **WHEN** no worker record or other name field is available for the current user (staff/admin sessions, or a worker session with a missing/invalid worker link)
- **THEN** the header displays the local part of the user's email address (before the `@`) as the display name, and never the full email address or the user's UUID

### Requirement: Worker query gated strictly by profile success, role, and a valid worker id
The worker-record lookup underlying `useCurrentIdentity()` SHALL be enabled only when all of the following hold: the profile query succeeded, the resolved role is exactly `worker`, and `workerId` is a finite, positive integer. For `admin` and `staff` sessions, the worker lookup SHALL always be disabled, regardless of any `workerId` value present.

#### Scenario: Admin never triggers a worker fetch
- **WHEN** the current user's resolved role is `admin`
- **THEN** the worker-record lookup is never enabled or invoked

#### Scenario: Staff never triggers a worker fetch
- **WHEN** the current user's resolved role is `staff`
- **THEN** the worker-record lookup is never enabled or invoked

#### Scenario: Worker with missing id does not fetch
- **WHEN** the current user's resolved role is `worker` and `workerId` is null or undefined
- **THEN** the worker-record lookup is not enabled

#### Scenario: Worker with a non-positive or non-integer id does not fetch
- **WHEN** the current user's resolved role is `worker` and `workerId` is zero, negative, `NaN`, or not an integer
- **THEN** the worker-record lookup is not enabled

#### Scenario: Worker with a valid id fetches exactly once
- **WHEN** the current user's resolved role is `worker` and `workerId` is a finite positive integer
- **THEN** the worker-record lookup is enabled and executes for that id

### Requirement: Missing worker record distinguished from worker query failure and from an invalid link
The system SHALL distinguish three outcomes for a `worker`-role profile: (1) an invalid or missing `workerId` (no lookup attempted — resolves to `incomplete`, per the discriminated identity-state model), (2) a *valid* `workerId` whose lookup succeeds with no matching row (resolves to `ready` using the email-local-part fallback identity), and (3) a *valid* `workerId` whose lookup fails due to a transport, RLS, or database error (resolves to `worker-error`). A query failure MUST NOT be silently treated as the ordinary missing-name fallback, and neither missing-row nor query-failure outcomes apply when the `workerId` itself was never valid enough to gate a lookup.

#### Scenario: Valid workerId, worker row not found resolves to a safe fallback identity
- **WHEN** the `workerId` is valid (finite positive integer) and the gated worker lookup completes successfully but finds no matching worker row
- **THEN** the identity state is `ready`, using the email-local-part fallback as the display name, "Docente" as the role label, and initials derived from that fallback

#### Scenario: Valid workerId, worker query failure is distinguished from a missing row
- **WHEN** the `workerId` is valid (finite positive integer) and the gated worker lookup fails due to a transport, RLS, or database error
- **THEN** the identity state is `worker-error`, not `ready`, and the header does not present any fallback name as if the lookup had merely found no row

#### Scenario: Invalid workerId is distinguished from both a missing row and a query failure
- **WHEN** `workerId` is missing, zero, negative, non-integer, `NaN`, or infinite
- **THEN** no worker lookup is attempted at all, the identity state is `incomplete` (not `ready` and not `worker-error`), and no fallback identity is shown

### Requirement: Identity reflects only the currently authenticated account
Identity output SHALL be derived directly from the current authenticated user and profile query state on every render, without retaining derived identity fields in component-local state. When the authenticated user changes, the header SHALL immediately stop displaying the previous user's name, role, and avatar and enter a neutral loading or minimal state until the new profile resolves. Worker-query output SHALL be treated as authoritative only when the authenticated user id, the successfully resolved profile, and the exact valid `workerId` active in the current render are the same inputs that produced that worker-query result; the identity resolver SHALL reject or ignore worker data whenever the authenticated user id has changed, the profile is still loading, the profile belongs to a different user generation than the worker result, the current profile no longer gates that exact `workerId`, or the worker result on hand is otherwise a stale prior-account snapshot. This invariant does not require the worker query's cache key to include the authenticated user id.

#### Scenario: Successful logout followed by a different user login
- **WHEN** user A logs out successfully and user B subsequently authenticates
- **THEN** the header shows no residual data from user A at any point, and reflects a loading state until user B's identity resolves

#### Scenario: Failed logout preserves the current identity
- **WHEN** a logout attempt for user A fails
- **THEN** the header continues to display user A's identity, since no account change actually occurred

#### Scenario: Underlying query state changes to a different account
- **WHEN** the cached authenticated-user/profile query state changes to reflect a different account id
- **THEN** the header's identity output updates to match the new account without reusing any field derived from the previous account

#### Scenario: Reused worker id across different authenticated users
- **WHEN** two different authenticated users are, in sequence, linked to the same numeric `workerId`
- **THEN** the header resolves the currently authenticated user's role and worker link from that user's own fresh profile query before using the shared `workerId` to display worker-record data, never reusing a previous user's identity resolution

#### Scenario: Cached worker data ignored when the current user has changed
- **WHEN** cached worker-query data exists in memory but the authenticated user id active in the current render differs from the user id that produced that cached data
- **THEN** the identity resolver does not use the cached worker data to render an identity for the current render

#### Scenario: Stale worker result ignored while the new profile is still unresolved
- **WHEN** a worker-query result from a prior account is still present and the current profile query has not yet resolved (is still loading)
- **THEN** the identity state is `loading`, and the prior account's worker result is not rendered in its place

#### Scenario: Worker result rejected once the current profile no longer gates that worker id
- **WHEN** a previously produced worker-query result exists for a given `workerId`, but the current profile's own gating (role and `workerId`) no longer matches that result's originating `workerId`
- **THEN** the identity resolver does not treat that worker-query result as belonging to the current identity

### Requirement: Avatar fallback order and trusted image source
The header's user avatar SHALL follow this fallback order: (1) a successfully loaded profile picture obtained through the existing trusted profile-picture URL helper, (2) initials derived from the resolved display name, (3) a generic accessible user icon. The avatar MUST NOT derive an image URL from arbitrary identity text (such as a name or email) and MUST NOT display a broken-image icon at any point.

#### Scenario: Valid profile picture available
- **WHEN** a worker/teacher session has a valid profile-picture URL obtained through the trusted helper
- **THEN** the avatar renders that image

#### Scenario: Profile picture fails to load
- **WHEN** a profile picture URL is set but the image fails to load
- **THEN** the avatar immediately falls back to initials derived from the display name instead of showing a broken-image icon

#### Scenario: Image error state resets when the source changes
- **WHEN** a previously failed image is replaced with a new, different image source
- **THEN** the avatar attempts to load the new source rather than remaining permanently on the initials fallback from the earlier failure

#### Scenario: No profile picture available
- **WHEN** no profile picture is available for the current user
- **THEN** the avatar renders initials derived from the resolved display name

#### Scenario: No usable name for initials
- **WHEN** the resolved display name is empty, whitespace-only, or otherwise unusable for initials
- **THEN** the avatar renders a generic accessible user icon instead of blank or malformed initials

### Requirement: Initials generation is Unicode-safe, bounded, and email-domain-free
Initials generation SHALL support both one-word and multi-word names, SHALL preserve accented Unicode letters, SHALL be bounded to one or two characters, and SHALL remain safe for empty or malformed name input. When the display name originates from an email-fallback, the email's domain SHALL never appear in the computed initials because the local part is extracted before initials generation runs.

#### Scenario: Multi-word name
- **WHEN** the display name contains two or more words
- **THEN** the initials shown are the first letter of the first word and the first letter of the last word, uppercased

#### Scenario: One-word name
- **WHEN** the display name contains a single word
- **THEN** the initials shown are a single character derived from that word

#### Scenario: Accented characters preserved
- **WHEN** the display name contains accented Unicode letters (for example "Ángel" or "Muñoz")
- **THEN** the computed initials use the correctly uppercased accented letters rather than stripping or misrendering them

#### Scenario: Empty or malformed name
- **WHEN** the display name is empty, undefined, or contains no usable letter characters
- **THEN** initials generation does not throw and the avatar falls back to the generic user icon rather than rendering empty or invalid initials

#### Scenario: Email fallback never leaks the domain
- **WHEN** the display name originates from the email-local-part fallback
- **THEN** the computed initials are derived only from the local part and never contain any character from the email's domain

### Requirement: Route-based page context via most-specific pattern matching
The header SHALL display a compact, current-page context label resolved by a centralized route-context resolver that matches the current location against an ordered set of route patterns (supporting exact and parameterized/nested patterns), preferring the most specific matching pattern. The resolver MUST NOT display a raw URL segment and MUST return a safe, defined fallback label for any authenticated route with no matching pattern.

#### Scenario: Exact route matches
- **WHEN** the current route is `/dashboard`
- **THEN** the context label is "Inicio"

#### Scenario: Workers list route matches
- **WHEN** the current route is `/workers`
- **THEN** the context label is "Trabajadores"

#### Scenario: Most specific parameterized route wins over a less specific one
- **WHEN** the current route is `/workers/:id/documents` (e.g. `/workers/42/documents`)
- **THEN** the context label is "Documentos del trabajador", not the label for `/workers/:id` or `/workers`

#### Scenario: Parameterized detail route matches when no deeper segment is present
- **WHEN** the current route is `/workers/:id` (e.g. `/workers/42`) with no further path segments
- **THEN** the context label is "Detalle del trabajador"

#### Scenario: Semesters list route matches
- **WHEN** the current route is `/semesters`
- **THEN** the context label is exactly "Semestres"

#### Scenario: Semester-detail route matches its exact label
- **WHEN** the current route is `/semesters/:id` (e.g. `/semesters/7`)
- **THEN** the context label is exactly "Horario del semestre", never the raw id segment

#### Scenario: Semester-detail pattern wins over the semesters list pattern
- **WHEN** the current route is `/semesters/7`
- **THEN** the resolver matches the more specific `/semesters/:id` pattern ("Horario del semestre") rather than the less specific `/semesters` pattern ("Semestres")

#### Scenario: My documents route matches
- **WHEN** the current route is `/my-documents`
- **THEN** the context label is "Mis documentos"

#### Scenario: Unknown authenticated route falls back safely
- **WHEN** the current authenticated route does not match any entry in the route-context pattern list
- **THEN** the context label is "ENUB", never a raw URL segment

#### Scenario: Navigating updates the context label
- **WHEN** the authenticated user navigates from one matched route to another
- **THEN** the header's context label updates to match the new route's most specific match without a full header remount

### Requirement: Accessible account popover
The header SHALL expose an accessible account popover — triggered from the avatar/name/role control when identity is `ready` — using disclosure-pattern semantics rather than full ARIA application-menu (`role="menu"`) semantics. The popover SHALL contain, at minimum, the authenticated user's full display name, their visible role label, and a "Cerrar sesión" button. It SHALL NOT include actions for capabilities that do not currently exist in the application (notifications, global search, profile editing, messaging, settings, change-password).

#### Scenario: Trigger uses button and disclosure attributes
- **WHEN** the account popover trigger is rendered
- **THEN** it is a real `button` element with `aria-expanded` reflecting the popover's open state, `aria-controls` referencing the popover region, and an accessible name of the form "Abrir opciones de cuenta de {name}"

#### Scenario: Popover is a labeled region, not an ARIA menu
- **WHEN** the popover is open
- **THEN** its content is exposed as a labeled region or ordinary grouped content, not `role="menu"`, and its interactive items are not marked `role="menuitem"`

#### Scenario: Popover contents
- **WHEN** the account popover is open
- **THEN** it displays the authenticated user's full display name, their role label, and a "Cerrar sesión" action, and no unimplemented actions

#### Scenario: Ordinary tab order inside the popover
- **WHEN** the popover is open and the user presses Tab or Shift+Tab
- **THEN** focus moves through the popover's real interactive elements in normal document order, with no roving tabindex or arrow-key menu navigation

#### Scenario: Escape closes and returns focus to the trigger
- **WHEN** the popover is open and the user presses Escape (or dismisses it via any other keyboard interaction)
- **THEN** the popover closes and focus returns to the trigger button

#### Scenario: Outside click closes without forcing focus
- **WHEN** the popover is open and the user clicks outside it with the mouse
- **THEN** the popover closes and focus is not forcibly moved to the trigger or anywhere else

#### Scenario: Route navigation closes without returning focus to the old trigger
- **WHEN** the popover is open and a route navigation occurs
- **THEN** the popover closes rather than remaining open over the new route's content, and focus is not returned to the old trigger

#### Scenario: Logout activation does not attempt separate focus restoration
- **WHEN** the user activates "Cerrar sesión" from within the open popover
- **THEN** the existing logout flow runs (pending state, then navigation on success or the flow's existing error behavior on failure) without the popover's close-on-dismissal logic attempting any additional focus restoration during that navigation

#### Scenario: Popover not rendered in non-ready states
- **WHEN** the identity state is not `ready`
- **THEN** the account popover and its trigger are not rendered; the direct logout control is shown instead

### Requirement: Logout reuses the existing flow from both entry points
Both the account popover's "Cerrar sesión" action and the minimal-header's direct logout control SHALL call the same existing logout flow. Each SHALL reflect a pending/disabled state while logout is in progress, MUST prevent duplicate logout submissions while one is already pending, and MUST preserve the existing error behavior of that flow. No second logout implementation SHALL be introduced.

#### Scenario: Popover logout invokes the existing flow
- **WHEN** the user activates "Cerrar sesión" inside the account popover
- **THEN** the existing authenticated logout flow is invoked

#### Scenario: Minimal-header logout invokes the same existing flow
- **WHEN** the user activates the direct logout control shown in a non-ready identity state
- **THEN** the same existing authenticated logout flow is invoked, not a separate implementation

#### Scenario: Logout pending state prevents duplicate submission
- **WHEN** a logout request is in progress from either entry point
- **THEN** that entry point's logout control is shown as pending/disabled and cannot be activated again until the request completes

### Requirement: Worker-layout header alignment without a placeholder column
When no sidebar toggle is provided to the header (the worker/teacher layout), the header SHALL align the brand and context content naturally from the left and the theme/account controls from the right, without rendering an empty placeholder element to preserve symmetric centering.

#### Scenario: Worker layout aligns without a toggle
- **WHEN** the header renders without a sidebar toggle (`WorkerAppLayout`)
- **THEN** the brand and any subtitle/context content are left-aligned starting at the header's left edge, with no empty placeholder element occupying that space

#### Scenario: Admin layout retains toggle alignment
- **WHEN** the header renders with a sidebar toggle (`AppLayout`)
- **THEN** the toggle, brand, and context content are left-aligned in the same layout structure used by the worker layout, with the toggle simply present as the first element

### Requirement: Deterministic responsive collapse using fixed breakpoints
The header SHALL present a three-region layout (left: toggle/brand/subtitle; context; right: theme/account) that collapses deterministically using exactly two fixed viewport-width breakpoints — the existing `900px` mobile breakpoint and one new, documented intermediate threshold at `1100px` — implemented as ordinary `max-width` media queries. The header SHALL NOT use container queries or any other fluid/element-relative sizing technique to decide what to hide. The collapse order SHALL be: subtitle first, then the route-context label, then visible name/role text — with the avatar/account trigger persisting through all of these until the mobile breakpoint. The header MUST NOT produce horizontal overflow, unexpected wrapping that increases header height, or overlapping controls at any supported viewport width, and all interactive controls SHALL meet a minimum touch-target size of 44×44 CSS pixels.

#### Scenario: Wide desktop shows full header
- **WHEN** the viewport width is greater than `1100px`
- **THEN** the header shows the toggle (if applicable), brand, subtitle, route-context label, theme toggle, avatar, name, and role, with nothing truncated

#### Scenario: Intermediate tier hides the subtitle and allows route context to truncate
- **WHEN** the viewport width is between `901px` and `1100px` inclusive
- **THEN** the subtitle is hidden, the route-context label remains visible but may truncate with an ellipsis if space is insufficient, and the user's name, role, and avatar remain fully visible

#### Scenario: Mobile hides route context and name/role text, avatar trigger persists
- **WHEN** the viewport width is at or below `900px`
- **THEN** the header shows only the menu toggle (if the layout supports a sidebar), a compact brand mark, and the avatar/account trigger (when identity is `ready`) or the direct theme/logout controls (in non-ready states); the route-context label and the user's name and role text are hidden from the header row but the name and role remain available inside the opened popover

#### Scenario: No horizontal overflow or wrapping
- **WHEN** the header is rendered at any supported viewport width, including with a very long display name
- **THEN** the header does not cause horizontal page overflow, does not wrap in a way that increases header height, and no controls overlap

#### Scenario: Minimum touch target size
- **WHEN** any interactive header control is rendered at any supported viewport width
- **THEN** its hit area is at least 44×44 CSS pixels

