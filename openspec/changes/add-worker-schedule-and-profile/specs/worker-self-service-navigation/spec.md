## ADDED Requirements

### Requirement: Worker navigation lists all three self-service sections
The worker-facing layout (`WorkerAppLayout`) SHALL render a navigation control listing exactly three entries, in order: `Mis documentos`, `Mi horario`, `Mi información`, linking to `/my-documents`, `/my-schedule`, and `/my-profile` respectively.

#### Scenario: Worker sees all three entries
- **WHEN** an authenticated worker with a valid worker link views any worker self-service page
- **THEN** the navigation shows exactly three entries, in the order Mis documentos, Mi horario, Mi información

### Requirement: Current navigation item is indicated accessibly
The active navigation entry SHALL be indicated with `aria-current="page"` and SHALL be visually distinguishable without relying on color alone.

#### Scenario: Active route is marked
- **WHEN** the worker is on `/my-schedule`
- **THEN** the "Mi horario" navigation entry has `aria-current="page"` and a non-color visual indicator (e.g. distinct weight, underline, or background) distinguishing it from the other two entries

### Requirement: Worker navigation is not exposed to staff/admin sessions
The worker self-service navigation SHALL only render within the worker layout and MUST NOT appear in the administrator layout or be reachable by staff/admin sessions.

#### Scenario: Admin session never sees worker navigation
- **WHEN** an authenticated staff or admin session uses the application
- **THEN** the worker self-service navigation (Mis documentos / Mi horario / Mi información) is never rendered anywhere in their session

### Requirement: Worker navigation is keyboard and touch accessible
Every navigation entry SHALL be a real, keyboard-focusable link with a visible focus indicator and a touch target of at least 44×44 CSS pixels, reachable on both desktop and mobile without depending on hover.

#### Scenario: Keyboard-only traversal
- **WHEN** a worker navigates using only the keyboard
- **THEN** all three navigation entries are reachable via Tab/Shift+Tab, each shows a visible focus indicator, and activation (Enter) navigates to the corresponding route

#### Scenario: Mobile navigation remains discoverable
- **WHEN** the worker layout is viewed at a mobile viewport width
- **THEN** all three navigation entries remain visible or reachable without requiring a hover interaction, and any horizontal scrolling needed for the navigation bar itself is contained within the bar, never the full page

### Requirement: Worker navigation does not conflict with the header's account and theme controls
The worker navigation SHALL be a distinct element from the shared `Header`, positioned so it never overlaps, visually competes with, or interferes with the header's account popover trigger or theme toggle.

#### Scenario: Navigation renders below the header as its own row
- **WHEN** the worker layout renders both the shared header and the worker navigation
- **THEN** the navigation appears as a separate row beneath the header, and the header's account popover and theme toggle remain fully visible and operable independent of the navigation's state

#### Scenario: Opening the account popover does not disturb the navigation
- **WHEN** the worker opens the header's account popover
- **THEN** the navigation bar's layout and active-route indication are unaffected

### Requirement: Route-context labels for worker self-service routes
The centralized route-context resolver (`src/ui/routeContext.ts`) SHALL resolve `/my-documents` to "Mis documentos", `/my-schedule` to "Mi horario", and `/my-profile` to "Mi información", using the existing most-specific-first pattern matching, and SHALL continue to fall back to "ENUB" for any unmatched authenticated route.

#### Scenario: Mi horario context label
- **WHEN** the current route is `/my-schedule`
- **THEN** the header's route-context label is "Mi horario"

#### Scenario: Mi información context label
- **WHEN** the current route is `/my-profile`
- **THEN** the header's route-context label is "Mi información"

#### Scenario: Existing labels and fallback are unaffected
- **WHEN** the current route is `/my-documents`, or any route with no matching pattern
- **THEN** the label remains exactly "Mis documentos", respectively the existing "ENUB" fallback, unchanged by this addition
