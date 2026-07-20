## MODIFIED Requirements

### Requirement: Only the explicit safe field allow-list is displayed

The profile view SHALL display only the following fields and relations: from `public.workers` — name, RFC, email, phone, street, neighborhood, post code, city, state, worker type, specialty, function performed, status (translated to a human-readable label), and profile picture; from `public.sustenance_plazas` — sustenance, payment key, and plaza, for every row owned by the worker; from `public.date_of_admissions` — type and date of admission, for every row owned by the worker. It MUST NOT display the raw worker id, any relation row's id or worker_id, administrative observations, or any row's creation timestamp.

#### Scenario: Only allow-listed fields and relation columns render
- **WHEN** the profile view renders a worker with every field and every relation row populated
- **THEN** exactly the allow-listed `workers` fields and the allow-listed `sustenance_plazas`/`date_of_admissions` columns appear as content, and the worker's id, any relation row's id or worker_id, administrative observations, and any creation timestamp are not displayed anywhere on the page

### Requirement: The profile field projection is an API/UI minimization, not a database confidentiality boundary

The service function backing this page SHALL request only the allow-listed columns from `workers`, and only the allow-listed columns from each embedded `sustenance_plazas`/`date_of_admissions` relation — never `select("*")` at any level of the query. This projection SHALL be documented, everywhere it is described, as limiting what this application requests and renders — not as a guarantee that the worker's authenticated client is incapable of reading other columns of their own rows, since the underlying row-level security authorizes rows, not individual columns.

#### Scenario: Documentation does not overstate the guarantee
- **WHEN** this capability's data-fetching approach is described in project documentation
- **THEN** it is described as request/response minimization, with an explicit note that true column-level confidentiality is a separate, unimplemented follow-up

#### Scenario: No select("*") anywhere in the query
- **WHEN** the profile query is issued
- **THEN** neither the top-level `workers` selection nor either embedded relation's selection uses `select("*")` or otherwise requests an unbounded column set

### Requirement: Missing optional fields render with field-specific human-readable placeholders

Each allow-listed field or relation column that is null or empty SHALL render its own documented placeholder text, distinguishing "not on file" from "not specified" where the underlying meaning differs. No cell SHALL ever be left blank or show a literal `null`.

#### Scenario: Missing RFC, email, phone, or any domicile/work-information text field
- **WHEN** the worker's RFC, email, phone, street, neighborhood, post code, city, state, specialty, or function performed is null or empty
- **THEN** the page shows "No registrado" in that field's place

#### Scenario: Missing or unspecified worker type
- **WHEN** the worker's `type_worker` is null or empty
- **THEN** the page shows "Tipo no especificado", not the generic "No registrado" text used for the other optional fields

#### Scenario: A sustenance plaza with a missing sustenance, payment key, or plaza value
- **WHEN** a rendered plaza's `sustenance`, `payment_key`, or `plaza` value is null or empty
- **THEN** that specific field shows "No registrado" — the plaza itself is still shown, with its other, valid fields displaying their real values

#### Scenario: An admission date with a missing type
- **WHEN** a rendered admission date's `type` is null or empty
- **THEN** it shows "Tipo no especificado", the same wording used for a missing worker type

#### Scenario: An admission date with a missing or unparseable date value
- **WHEN** a rendered admission date's `date_of_admission` is null, empty, or does not match the exact `"YYYY-MM-DD"` shape
- **THEN** it shows "Fecha no registrada"

## ADDED Requirements

### Requirement: Administrative observations are deliberately excluded

The `public.workers.observations` column SHALL NOT be requested by the profile query or rendered by the profile view, under any condition. This is a deliberate product decision — observations are an internal administrative note about the worker, not the worker's own information — not an oversight or a security boundary (row-level security authorizes the row, not this specific column).

#### Scenario: Observations never appear, even if present on the fetched object
- **WHEN** the profile view receives worker data that happens to include an `observations` value (e.g. a future accidental widening of the query)
- **THEN** the rendered page does not display that value or any "Observaciones" label anywhere

### Requirement: Sustenance plazas and admission dates are scoped to the worker by row-level security, not a client-supplied filter

`public.sustenance_plazas` and `public.date_of_admissions` SELECT access SHALL be restricted, at the database level, to: every row for staff/admin sessions, and only rows whose `worker_id` matches the requesting worker's own `current_worker_id()` for worker sessions. `anon` sessions and authenticated sessions with no `profiles` row SHALL see zero rows from either table. A row whose `worker_id` is `NULL` SHALL be visible only to staff/admin sessions. The profile query MUST NOT filter either relation by an explicit client-supplied `worker_id` as an authorization mechanism — row-level security is the sole authority.

#### Scenario: A worker sees only their own plazas and admission dates
- **WHEN** an authenticated `worker`-role session's profile query embeds `sustenance_plazas`/`date_of_admissions`
- **THEN** only rows whose `worker_id` matches that session's own linked worker are returned, regardless of how many rows exist for other workers

#### Scenario: A worker cannot read another worker's relation rows
- **WHEN** a worker session's query (or a direct table query) requests rows filtered by a different worker's id
- **THEN** zero rows are returned, because row-level security — not the requested filter — determines ownership

#### Scenario: anon and no-profile sessions see nothing
- **WHEN** an unauthenticated (`anon`) session, or an authenticated session with no `profiles` row, queries either table
- **THEN** zero rows are returned

#### Scenario: staff/admin retain full read access
- **WHEN** a `staff`- or `admin`-role session queries either table
- **THEN** every row is returned, including rows whose `worker_id` is `NULL`

#### Scenario: Write policies are unaffected
- **WHEN** this capability's read access is evaluated
- **THEN** INSERT/UPDATE/DELETE policies on both tables remain exactly as they were (staff/admin only), unchanged by this requirement

### Requirement: Sustenance plazas and admission dates render in a deterministic order

The profile view SHALL sort a worker's `sustenance_plazas` by sustenance, then plaza, then payment key, and SHALL sort a worker's `date_of_admissions` chronologically ascending by date of admission (with a missing/unparseable date sorted last), then by type as a tie-break. Both orderings SHALL be computed client-side by a pure function and MUST NOT depend on the order rows were returned in by the database.

#### Scenario: Plaza order is independent of return order
- **WHEN** the same set of sustenance plazas is fetched in two different underlying row orders
- **THEN** the rendered order is identical both times

#### Scenario: Admission date order is independent of return order
- **WHEN** the same set of admission dates is fetched in two different underlying row orders
- **THEN** the rendered order is identical both times, chronologically ascending

#### Scenario: Zero, one, and multiple relation rows all render correctly
- **WHEN** a worker has zero, one, or multiple sustenance plazas or admission dates
- **THEN** every row is shown as its own card in a stacked list — never a horizontal table, never merged, never dropped

### Requirement: Admission dates render as Spanish civil dates without a timezone-induced day shift

An admission date's `date_of_admission` value ("YYYY-MM-DD", no time or timezone component) SHALL be formatted as a Spanish civil date in the exact shape `"D de <mes> de AAAA"` (e.g. "16 de agosto de 2024"), computed without ever constructing a `Date` object from the raw string — the formatting function MUST parse the year/month/day components directly, so no timezone interpretation can shift the displayed day.

#### Scenario: A date formats without shifting to the previous day
- **WHEN** an admission date of "2024-08-16" is rendered
- **THEN** the page shows exactly "16 de agosto de 2024", never "15 de agosto de 2024" or any other shifted value, regardless of the viewer's timezone

#### Scenario: Every month name is correct
- **WHEN** an admission date in any of the twelve months is rendered
- **THEN** the exact corresponding Spanish month name is shown
