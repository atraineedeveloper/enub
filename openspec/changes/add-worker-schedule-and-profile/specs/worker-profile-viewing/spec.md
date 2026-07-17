## ADDED Requirements

### Requirement: Worker profile route access is gated by the shared, role-aware route gate
The route `/my-profile` SHALL render the worker's own profile information only for an authenticated session with `role = 'worker'` and a valid linked `worker_id`, using the same shared gate as `/my-documents` and `/my-schedule`: `admin`/`staff` redirected to the administrative dashboard; an unrecognized role, a missing profile, or an invalid/missing worker link all redirected to the pending-access page.

#### Scenario: Worker with a valid link sees their profile
- **WHEN** an authenticated `worker`-role session with a valid `worker_id` visits `/my-profile`
- **THEN** their own profile information renders

#### Scenario: Staff/admin redirected away
- **WHEN** an authenticated `staff`- or `admin`-role session visits `/my-profile`
- **THEN** they are redirected to the administrative dashboard

#### Scenario: Unrecognized role, missing profile, or invalid link denied
- **WHEN** an authenticated session has an unrecognized role, no `profiles` row, or `role = 'worker'` with an invalid/missing `worker_id`
- **THEN** the session is redirected to the pending-access page

### Requirement: Only the explicit safe field allow-list is displayed
The profile view SHALL display only the following fields from `public.workers`: name, email, phone, worker type, status (translated to a human-readable label), specialty, function performed, and profile picture. It MUST NOT display the raw worker id, RFC, address fields, administrative observations, or the row's creation timestamp.

#### Scenario: Only allow-listed fields render
- **WHEN** the profile view renders a worker with every field populated
- **THEN** exactly the allow-listed fields appear as content, and RFC, address, observations, id, and created_at are not displayed anywhere on the page

### Requirement: The profile field projection is an API/UI minimization, not a database confidentiality boundary
The service function backing this page SHALL request only the allow-listed columns from `workers`. This projection SHALL be documented, everywhere it is described, as limiting what this application requests and renders — not as a guarantee that the worker's authenticated client is incapable of reading other columns of their own `workers` row, since the underlying row-level security authorizes the row, not individual columns.

#### Scenario: Documentation does not overstate the guarantee
- **WHEN** this capability's data-fetching approach is described in project documentation
- **THEN** it is described as request/response minimization, with an explicit note that true column-level confidentiality is a separate, unimplemented follow-up

### Requirement: Status is mapped to an exact, closed set of human-readable labels
The profile view SHALL translate the `status` field using exactly this mapping: `1` → `"Activo"`; `0` → `"Inactivo"`; any other numeric value, `null`, `undefined`, or a non-numeric/malformed value → `"Estado desconocido"`. The raw numeric code MUST NOT be displayed.

#### Scenario: Active status
- **WHEN** the worker's `status` value is `1`
- **THEN** the page displays "Activo"

#### Scenario: Inactive status
- **WHEN** the worker's `status` value is `0`
- **THEN** the page displays "Inactivo"

#### Scenario: Unrecognized status value
- **WHEN** the worker's `status` value is any value other than `0` or `1`, including `null`, `undefined`, or a non-numeric value
- **THEN** the page displays "Estado desconocido", never a guessed "Activo" or "Inactivo"

### Requirement: Missing optional fields render with field-specific human-readable placeholders
Each allow-listed field that is null or empty SHALL render its own documented placeholder text, distinguishing "not on file" from "not specified" where the underlying meaning differs.

#### Scenario: Missing email, phone, specialty, or function performed
- **WHEN** the worker's email, phone, specialty, or function performed is null or empty
- **THEN** the page shows "No registrado" in that field's place

#### Scenario: Missing or unspecified worker type
- **WHEN** the worker's `type_worker` is null or empty
- **THEN** the page shows "Tipo no especificado", not the generic "No registrado" text used for the other optional fields

### Requirement: Profile picture uses the existing Avatar fallback pattern
The profile view SHALL render the worker's profile picture using the existing Avatar component's fallback order (image, then initials, then a generic icon), consistent with its use elsewhere in the application.

#### Scenario: Valid profile picture
- **WHEN** the worker has a valid stored profile picture
- **THEN** it is displayed via the existing Avatar component

#### Scenario: Missing or broken profile picture
- **WHEN** the worker has no profile picture, or the stored image fails to load
- **THEN** the Avatar component's existing initials-then-icon fallback is used, never a broken-image icon

### Requirement: The page is read-only
The profile view SHALL NOT include any control to edit worker information, change the profile picture, or submit a correction request.

#### Scenario: No editing affordance exists
- **WHEN** the profile view is rendered
- **THEN** no input field, edit button, upload control, or correction-request action is present anywhere on the page

### Requirement: Distinct loading, missing-profile, and error states
The profile view SHALL render visually and textually distinct states for: data loading, a missing linked worker row (the profile lookup returns no row despite a valid link), and a query error.

#### Scenario: Loading state
- **WHEN** the profile data is still being fetched
- **THEN** a loading indicator is shown, with no profile content or empty-state message yet

#### Scenario: Missing worker row
- **WHEN** the worker's `worker_id` is valid but the corresponding `workers` row lookup returns no row
- **THEN** a distinct Spanish message states that no worker information was found and to contact an administrator

#### Scenario: Query error
- **WHEN** the profile data query fails
- **THEN** a distinct Spanish error message is shown, separate from the missing-profile state

### Requirement: Long text and mobile layout do not overflow
Long values in any allow-listed field (in particular name and email) SHALL wrap or truncate without causing horizontal page overflow, on both desktop and mobile.

#### Scenario: Long name or email
- **WHEN** the worker's name or email is unusually long
- **THEN** the value wraps or is truncated within its container, and the page does not scroll horizontally as a result

#### Scenario: Mobile section stacking
- **WHEN** the profile view is rendered at a mobile viewport width
- **THEN** its sections stack in a single readable column with no horizontal scrolling required
