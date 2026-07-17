## Context

### 1. Current architecture

`WorkerAppLayout.tsx` is the worker-facing counterpart to the admin `AppLayout.tsx`: same shared `Header` (with the account popover from the header-modernization change), no `Sidebar`/`MainNav` — its own comment states "workers never see staff navigation," but there is currently **no worker navigation at all**, staff or otherwise. The only worker route today is `my-documents` (plus `pending-access`), reached only by whatever link brought the worker to the app; there is no in-app way to move between worker pages. `MyDocuments.tsx` is the existing pattern for a worker self-service page: it resolves `workerId` from `useProfile()` (never the URL), redirects staff/admin to `/dashboard` and anyone without a valid worker link to `/pending-access`, then hands `workerId` to a presentational view (`WorkerDocumentsView`).

`src/App.tsx` centralizes routing; the worker route group is `<ProtectedRoute><WorkerAppLayout /></ProtectedRoute>` with no `RoleGate` (unlike the admin group) — role-appropriateness is currently enforced per-page (as `MyDocuments.tsx` does), not at the layout level.

`src/ui/routeContext.ts` (added in the header-modernization change) is a `matchPath`-based, most-specific-first route→label resolver already listing `/my-documents` → "Mis documentos" and `/pending-access` → "Acceso pendiente", with an `"ENUB"` fallback for unmatched routes.

Identity/role resolution already goes through `useProfile()` (`{ role, workerId, isWorker, isStaffOrAdmin, hasNoAccess, isLoading }`) and, for richer header identity, `useCurrentIdentity()`. Both resolve `workerId` exclusively from `profiles.worker_id` — never from the URL, props, or client state.

### 2. Actual schedule data model

Two tables hold schedule data, both with a direct, nullable `worker_id` foreign key to `workers` — no indirection through an assignment/junction table:

- **`schedule_assignments`**: `id, worker_id, subject_id, group_id, semester_id, weekday, start_time, end_time, created_at`. Represents a specific class. **No `room` column exists anywhere in the schema.**
- **`schedule_teachers`**: `id, worker_id, semester_id, weekday, start_time, end_time, activity` (free text), `created_at`. Represents a worker's other scheduled activities.

Both are queried today (admin-side) via `getScheduleAssignments(semesterId)` / `getScheduleTeachers(semesterId)`, already filtered **at the query level** by `semester_id` (per the archived `schedule-semester-scoped-queries` spec). `getScheduleAssignments` embeds `workers(id, name), subjects(id, name), groups(id, year_of_admission, letter, degrees(id, code, name)), semesters(id, school_year)`; `getScheduleTeachers` embeds **`workers(*)`** (the full row) `, semesters(*)`.

**One class may have exactly one teacher** — `schedule_assignments.worker_id` is a single nullable FK, not a join table.

**Existing admin schedule module**: `ScheduleDashboard.tsx` (route `/semesters/:id`) has two tabs — "Horario Escolar" (`ScholarSchedule`, group-centric, editable) and "Horario del Maestro" (`TeacherSchedule` → `ShowTeacherSchedule`, worker-centric, editable, worker `<Select>`, PDF export). **Not safely reusable wholesale**: it is full CRUD, its cell components (`HourScheduleSubject.tsx`, `RowTeacherSchedule.tsx`, etc.) render either read content *or* an inline add/edit/delete action, tightly coupling presentation to admin authorization and mutation — there is no clean seam to reuse those specific cell components read-only without either forking their conditional-action logic or leaving dead admin-only code paths reachable from a worker session. Its data loading is also unsafe to imitate directly: `ShowTeacherSchedule.tsx` fetches **the entire semester's rows for every worker** and filters to one worker **client-side** (`scheduleTeachers.filter(schedule => schedule.worker_id === +workerId)`) — safe today only because the caller is already staff/admin with legitimate access to everyone's data; wrong to reuse as a pattern for a worker session at any point, RLS-tightened or not, since there is no reason for a worker's own client to ever receive another worker's rows.

**Visual language worth reusing**: the two tabs use a shared grid shell (`Table`/`TableHeader`, `display: grid; grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;`, `--color-grey-*` header styling, `--border-radius-md`-equivalent `7px`/`--color-grey-200` border) and a per-context accent color already established in `ScheduleDashboard.tsx`'s `tabAccents` (`--color-gold-700` for "Horario Escolar" / scholar-class context, `--color-gov-green-700` for "Horario del Maestro" / teacher-activity context). These two tokens are the only existing "schedule colors" in the codebase and are already semantically tied to exactly the class/activity distinction this change needs — reused directly (§8), not reinvented.

**Duplicate/conflicting rows are possible**: `detectScheduleConflict.ts` exists precisely because the schema does not prevent two assignments overlapping in the same weekday/time block for the same worker — the read view must render both, never merge or drop one (§9's normalized contract makes this an explicit rule).

**Canonical time blocks**: `scheduleBlocks.ts` (`SCHEDULE_BLOCKS`, 4 blocks) and `teacherScheduleBlocks.ts` (`TEACHER_SCHEDULE_BLOCKS`, +1) are the single source of truth for valid intervals, reused for both the grid's row labels and the "invalid time data" handling. **Weekday values are free-text**, no CHECK constraint; `src/helpers/constants.ts`'s `WEEKDAYS` (`Lunes, Martes, Miercoles, Jueves, Viernes`) is the existing canonical list, reused as-is.

### 3. Actual worker fields and sensitivity classification

`public.workers` columns, classified:

| Column | Classification | Included in "Mi información"? |
|---|---|---|
| `name`, `email`, `phone`, `type_worker`, `specialty`, `function_performed`, `profile_picture` | safe, useful | **Yes** |
| `status` | internal code — safe once translated | **Yes, translated (§10)** |
| `id` | raw internal identifier | No |
| `RFC` | sensitive PII, no stated product need | No |
| `city`, `neighborhood`, `post_code`, `state`, `street` | full home address, not requested | No |
| `observations` | private administrative notes | No |
| `created_at` | database timestamp, not product-relevant | No |

Final allow-list (8 fields): `name, email, phone, type_worker, status (translated), specialty, function_performed, profile_picture`.

### 4. Ownership and authorization model

```
auth.uid() → public.profiles.id → profiles.role, profiles.worker_id → public.workers.id
```

Two existing `SECURITY DEFINER STABLE` SQL functions are the single source of truth for every ownership check in this change — no new helper function is added:

- `current_app_role()` — returns `profiles.role`, or `NULL` if no `profiles` row exists. `NULL IN ('staff','admin')` is `NULL` (deny), so a missing profile denies by default.
- `current_worker_id()` — returns `profiles.worker_id` **only when `role = 'worker'`**, else `NULL`. This is the exact mechanism that prevents an admin account that also carries a stale `worker_id` from using it as a secondary identity: a non-`worker` role never gets a non-null value here, regardless of what `worker_id` is stored.

The client never supplies a worker id as an authorization input to any query in this change. Whether a worker page renders at all is decided once, at the route-branch level, by `WorkerRouteGate` (§11) — not by `MySchedule.tsx`/`MyProfile.tsx` themselves, which contain no authorization logic of their own. Once past that gate, `MyScheduleView`/`MyProfileView` independently resolve their own `authUserId`/`workerId` from the same `useUser()`/`useProfile()` path, but only as **account-generation-safe query identity inputs** (§16) — never as a second, page-level authorization decision. The schedule queries (§6) carry **no worker filter at all** — RLS supplies it — and the profile query's `.eq("id", workerId)` value is independently re-verified by RLS against `current_worker_id()`, so a tampered value simply matches zero rows.

### 5. Whether database migrations are needed

**Yes, one migration**, scoped to `schedule_assignments` and `schedule_teachers` SELECT policies only. Audit result:

| Table | Current SELECT policy | Safe today? | Action |
|---|---|---|---|
| `workers` | own-row + staff/admin-all (`20260703002454`) | Yes | None |
| `profiles` | own-row + admin-all (`20260703002452`) | Yes | None |
| `worker_documents` | own-row + staff/admin-all (`20260703002456`) — the correct reference pattern | Yes | None |
| `schedule_assignments` | `"Enable read access for all users" USING (true)`, no `TO` clause | **No** | **Tighten** |
| `schedule_teachers` | Same | **No** | **Tighten** |
| `semesters`, `subjects`, `groups`, `degrees` | Same open pattern | Contains no worker-owned data; needed by every role to interpret schedule joins | Not touched (§ Follow-ups #1) |

This is **not** a purely additive change — it removes a currently-relied-upon-by-nobody-but-still-live open-read grant. §7 specifies the migration's exact preconditions, drop/create steps, and postconditions.

### 6. Exact query/RPC/view strategy

**Schedule — new, narrow, worker-specific service functions, not a reuse of the admin functions.** `getScheduleTeachers()`'s existing embed is `workers(*)` — the full worker row, including RFC/address/observations — returned inside every schedule-teacher row. Reusing it unchanged for a worker session, even after RLS is tightened, would still transmit that full embedded row on every request, which is unnecessary surface for a read-only self-service view. Two new functions are added instead (e.g. `src/services/apiWorkerSchedule.ts`):

```ts
export async function getMyScheduleAssignments(semesterId: number) {
  const { data, error } = await supabase
    .from("schedule_assignments")
    .select("id, weekday, start_time, end_time, subjects(name), groups(letter, year_of_admission, degrees(code, name))")
    .eq("semester_id", semesterId);
  if (error) { console.error(error); throw new Error("Tu horario no pudo cargarse"); }
  return data;
}

export async function getMyScheduleTeacherActivities(semesterId: number) {
  const { data, error } = await supabase
    .from("schedule_teachers")
    .select("id, weekday, start_time, end_time, activity")
    .eq("semester_id", semesterId);
  if (error) { console.error(error); throw new Error("Tu horario no pudo cargarse"); }
  return data;
}
```

Neither embeds `workers` at all — the worker already knows who they are (identity comes from `useCurrentIdentity`, not from an embedded row), and neither returns RFC, address, observations, timestamps, or any field beyond what the normalized contract (§9) needs. `semesterId` is accepted purely as a **filter** (which semester's rows to look at), never as an authorization input — RLS independently re-derives and enforces ownership on every row regardless of what `semesterId` is requested, exactly as it already does for the existing, unchanged, semester-scoped admin queries. The admin `getScheduleAssignments`/`getScheduleTeachers`/`useScheduleAssignments`/`useScheduleTeachers` are **entirely unchanged** and continue to serve `ScheduleDashboard.tsx` exactly as before.

**Profile — direct RLS on `workers` (already correct, §5), fetched via a new, narrow, explicit-column function**, added next to the existing `getWorkerIdentityById` in `apiWorkers.ts`:

```ts
export interface MyWorkerProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  type_worker: string | null;
  status: number | null;
  specialty: string | null;
  function_performed: string | null;
  profile_picture: string | null;
}

export async function getMyWorkerProfile(id: number): Promise<MyWorkerProfile | null> {
  const { data, error } = await supabase
    .from("workers")
    .select("name, email, phone, type_worker, status, specialty, function_performed, profile_picture")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error(error); throw new Error("La información no pudo cargarse"); }
  return data;
}
```

**Honest scope of what this projection achieves (§10 expands on this):** the explicit `.select()` list is an **API/UI minimization** — it keeps the network payload and the frontend's data model limited to exactly what the page renders, and it is a stable, self-documenting contract. It is **not** database-level column confidentiality. `workers` RLS ("Workers can read own worker row") authorizes the *row*, not individual *columns* — nothing prevents a worker's own authenticated client from issuing a direct `select("*")` against their own row today and receiving RFC/address/observations back, since Postgres RLS operates at row granularity. This change does not claim otherwise anywhere, and records true column-level confidentiality (a restricted view or SECURITY INVOKER function with a database-enforced column allow-list) as a separate, real follow-up (§ Follow-ups #4) — not solved by this `.select()` list.

### 7. RLS migration: preconditions, transactional steps, exact postconditions

Applied identically to `schedule_assignments` and `schedule_teachers`, inside **one migration file**, each table's block wrapped in its own `DO $$ ... $$` precondition/postcondition guard so a drift failure on one table does not silently proceed to alter the other:

1. **Precondition — verify the expected policy exists with the expected shape**: assert exactly one `SELECT` policy named `"Enable read access for all users"` exists with `qual = 'true'`. If not exactly one, `RAISE EXCEPTION` and abort — the migration must never assume the policy it's about to drop is the one it thinks it is.
2. **Precondition — detect drift**: assert there is no *other* `PERMISSIVE` `SELECT` policy on the table besides the one in step 1. If any exist, `RAISE EXCEPTION` and abort — an unnoticed second permissive policy would silently preserve global read access even after the intended one is dropped and replaced (permissive policies are OR'd together in Postgres RLS).
3. **Drop** the verified `"Enable read access for all users"` policy.
4. **Create** `"Staff and admin can read all schedule assignments/teachers"` — `FOR SELECT TO authenticated USING (current_app_role() IN ('staff','admin'))`.
5. **Create** `"Workers can read own schedule assignments/teachers"` — `FOR SELECT TO authenticated USING (worker_id = current_worker_id())`.
6. **Leave INSERT/UPDATE/DELETE policies on both tables completely untouched** — out of scope for this read-only change; recorded as a separate hardening follow-up (§ Follow-ups #3) precisely because they remain just as open as the SELECT policy was before this migration. §7a specifies how this "untouched" claim is itself verified, not merely assumed.
7. **Postcondition — verify each intended `SELECT` policy individually, by name, on every dimension**: for each of the two newly-created policies, look the row up by exact `policyname` in `pg_policies` and assert all of the following simultaneously — `cmd = 'SELECT'`; `permissive = 'PERMISSIVE'`; `roles` is exactly `{authenticated}` (no more, no fewer entries); and the normalized `qual` text matches the exact expected normalized string for that policy (normalization strategy below). A mismatch on any single dimension for either policy is a full postcondition failure, not a partial pass.
8. **Postcondition — verify no anonymous/public SELECT access**: assert zero `SELECT` policies exist with `'anon'` or `'public'` in `roles`.
9. **Postcondition — verify no unrestricted predicate remains under any name**: assert zero `SELECT` policies (permissive or restrictive) exist with a `qual` that normalizes to an unconditionally-true predicate (`'true'`, `'(true)'`, etc., after normalization).
10. **Postcondition — verify the exact final policy catalog, positively, not just by absence**: assert the total `SELECT` policy count for the table is exactly 2, and that both existing rows are exactly the two policies verified individually in step 7 — i.e., no unexpected additional `PERMISSIVE` **or** `RESTRICTIVE` `SELECT` policy of any name exists beyond those two.

**Predicate normalization strategy (so harmless Postgres formatting differences never cause a false failure)**: the `qual`/`with_check` text `pg_policies` returns is Postgres's own reconstruction of the stored expression via `pg_get_expr()`, not the literal `CREATE POLICY` source text — it commonly differs from what was typed even when semantically identical (for example, `IN ('staff', 'admin')` is very likely reconstructed as `= ANY (ARRAY['staff'::text, 'admin'::text])`, and function references are schema-qualified in the stored form, e.g. `current_app_role()` becomes `public.current_app_role()`). Rather than authoring an expected string by hand and hoping it matches Postgres's reconstruction, **the expected strings are derived empirically**: the exact `CREATE POLICY` statements this migration issues are run once against a local scratch database ahead of writing the migration, and the resulting `pg_policies.qual` values are captured verbatim as the "expected" constants baked into the postcondition checks. The postcondition comparison itself then only needs to absorb *incidental* formatting variance (not full SQL semantic equivalence) — both the captured-expected string and the live value at verification time are normalized identically before comparison: lowercased, all runs of whitespace collapsed to a single space, and leading/trailing whitespace trimmed. This is sufficient and correct specifically because the expected value already reflects Postgres's own canonical reconstruction of the same statement, not an independently-authored approximation of it — the normalization only needs to survive whitespace/formatting noise between two runs of the same underlying expression, not bridge two genuinely different-but-equivalent expressions.

11. **Failure is total**: any `RAISE EXCEPTION` in any precondition or postcondition check aborts the entire migration transaction — Supabase's migration runner applies each migration file as a single transaction, so a failed check leaves the database in exactly its prior state, with no partial policy change ever visible to any session. The deployment either fully succeeds in the exact verified end state, or fully fails with zero effect, never a half-applied intermediate state.
12. **These checks run inside the migration itself, not only afterward in pgTAP.** pgTAP (§7a, §13) provides independent, repeatable regression coverage for CI and future changes, but it runs *after* a migration has already been applied — it cannot prevent a bad migration from ever reaching that state. The `RAISE EXCEPTION` postconditions in steps 7–10 are what make the deployment itself fail closed, at the moment it runs, before any session (including the migration's own follow-on statements) can observe an incorrect policy catalog.

**This is explicitly not described as merely additive** — it is drop-then-recreate with verification at both ends specifically because the removed policy is a real, currently-effective access grant, not dead code.

### 7a. Write-policy regression verification (proving, not approving, unchanged behavior)

This migration touches `SELECT` policies only. To prove — not merely assert — that `INSERT`/`UPDATE`/`DELETE` on both tables remain exactly as they were, both migration-adjacent tooling and the test suite carry structural **and** behavioral coverage:

- **Structural**: for each of `schedule_assignments`/`schedule_teachers` × {`INSERT`, `UPDATE`, `DELETE`}, a `pg_policies` assertion capturing `policyname`, `roles`, `qual`, `with_check`, and `permissive`/`restrictive` mode, compared against the known pre-migration values (the existing base-schema policies — `"Enable create access for all users"`, `"Enable delete access for all users"`, `"Enable update access for all users"`, all `USING(true)`/`WITH CHECK(true)`, no `TO` clause). These run both immediately after the migration (as part of local verification, task 1.9) and as permanent pgTAP coverage (§13).
- **Behavioral**: one representative write per command per table — six cases total (`schedule_assignments` INSERT/UPDATE/DELETE, `schedule_teachers` INSERT/UPDATE/DELETE) — executed under the same authenticated-session condition the current policies already permit (any authenticated role, since the existing write policies carry no role or ownership restriction today), asserting the write still succeeds exactly as before. **This does not certify the current write policies as secure** — they remain exactly as broadly open as they were, which is precisely Follow-up #3's point; these tests exist only to prove this change's `SELECT`-only migration did not accidentally narrow, widen, or otherwise alter them.

### 8. Final schedule presentation decision

**Desktop and wide tablet (`> 900px`, the existing project mobile breakpoint, reused rather than inventing a new one)**: a read-only weekly timetable/grid visually aligned with the administrator schedule's institutional language — time-block rows (labels from `SCHEDULE_BLOCKS`/`TEACHER_SCHEDULE_BLOCKS`), weekday columns (`WEEKDAYS` order), class/activity entries inside their cell, using the existing `--color-gold-700` (class) / `--color-gov-green-700` (activity) accent tokens already tied to this exact distinction in `ScheduleDashboard.tsx`, plus a text label in every cell so meaning never depends on color alone, a semester `<Select>` above the grid, and a small legend explaining the two colors/labels. Below the grid, a "Horario no especificado" section (§9a) shows every authorized entry that could not be placed in a grid cell. **No** edit, add, delete, drag-and-drop, or any administrative control anywhere on the page.

**Shared visual primitives strategy — new, not code-shared with admin CRUD components.** The admin grid shell (`Table`/`TableHeader` in `ShowScholarSchedule.tsx`/`ShowTeacherSchedule.tsx`) is genuinely pure/stateless and a literal extraction was considered; it was rejected in favor of new worker-scoped components that reuse the same **CSS values and tokens** (grid columns, border/radius, header styling) and the same **canonical data sources** (`WEEKDAYS`, `SCHEDULE_BLOCKS`/`TEACHER_SCHEDULE_BLOCKS`, the gold/gov-green accents) without importing or modifying the admin files at all. Reasoning: every admin *cell* component (`HourScheduleSubject.tsx`, `RowTeacherSchedule.tsx`, etc. — the parts that would need extracting alongside the shell to be useful) is tightly coupled to inline CRUD modals with no read-only seam, so a "shared primitive" would either (a) require refactoring already-shipped, tested admin components to add a read-only mode — real risk to a working feature for a benefit (a few dozen lines of shared CSS) this change does not need — or (b) only extract the shell and still duplicate every cell, which is barely less duplication than duplicating the shell too. New, small, worker-scoped presentational components (grid shell, weekday header row, time-block row label, schedule cell, legend) achieve the required visual alignment (same tokens, same canonical time/weekday sources) with zero admin-file changes and zero regression risk to the admin schedule module. Role-specific queries, authorization, and loading states live exclusively in `MySchedule.tsx`/the worker service layer (§6), never inside these presentational components, which receive only the normalized entry array (§9) as props.

**Mobile (`≤ 900px`)**: the same normalized data (§9), rendered as a day-grouped agenda/card list — weekday sections in `WEEKDAYS` order, entries within a day sorted chronologically (§9b's grid/agenda sort), each showing explicit start–end time, the class/activity text label, and subject/group or activity content. Below the agenda, the same "Horario no especificado" section (§9a) — here containing exactly the `unplaceable` set, since mobile placement doesn't require canonical-block alignment. This is the same data model presented two ways, not two schedule implementations — the grid, the agenda, and both viewports' "Horario no especificado" sections all consume the identical `WorkerScheduleEntry[]` array (§9) and the identical `partitionWorkerSchedule` result (§9a); only the rendering differs by breakpoint.

**Intermediate widths and overflow behavior**: the transition happens at exactly `900px`, the codebase's one existing, already-established mobile breakpoint (per `AppLayout.tsx`/`Header.tsx`/`WorkerAppLayout.tsx`'s own convention) — no new breakpoint is introduced. Above `900px`, as width narrows toward the threshold, the grid container uses `overflow-x: auto` **within its own bounded container** (never the page) as a safety net, with a `min-width` per weekday column sized to the longest realistic cell content (a subject name plus group label) so that text truncates with an accessible `title` attribute as a last resort rather than clipping silently or wrapping unpredictably into an unreadable cell. At and below `900px` the grid is not rendered at all — the agenda list takes over completely, which has no horizontal-fit concern by construction (§9's mobile requirement).

### 9. Normalized schedule contract

A single explicit, stable type the desktop grid, the mobile agenda, and the shared "Horario no especificado" section all consume — defined once, computed once per page load, never separately re-derived per presentation. **Every authorized row is normalized and represented, with no exceptions** — including rows with a null start/end time, malformed time, or a weekday that doesn't match the canonical list. Nothing is discarded at the normalization step; placement (§9a) decides *where* an entry is shown, never *whether* it is shown.

```ts
export type NormalizedWeekday =
  | "Lunes" | "Martes" | "Miercoles" | "Jueves" | "Viernes" | "Otro";

export type WorkerScheduleEntry =
  | {
      kind: "class";
      id: string;               // `assignment-${row.id}` -- prefixed so it can
                                 // never collide with a schedule_teachers id,
                                 // since the two tables have independent id
                                 // sequences
      weekday: NormalizedWeekday;
      startTime: string | null; // null when the source row's start_time is
                                 // null/malformed -- never a thrown error
      endTime: string | null;
      subject: string;          // "Materia no especificada" when the joined
                                 // subject name is missing
      group: string;            // "Grupo no especificado" when the joined
                                 // group/degree data is missing
    }
  | {
      kind: "activity";
      id: string;                // `activity-${row.id}`
      weekday: NormalizedWeekday;
      startTime: string | null;
      endTime: string | null;
      activity: string;          // "Actividad no especificada" when the
                                  // source row's activity text is missing
    };
```

Rules, all implemented as pure functions (unit-tested, §13):

- **Origin is preserved**: `kind` distinguishes a `schedule_assignments` row from a `schedule_teachers` row through every downstream step; the two are never coerced into a shared generic shape that loses which table a row came from.
- **Every authorized row is preserved**: normalization never drops a row for any reason — a null/malformed time or an unrecognized weekday changes where the entry is *placed* (§9a), never whether it exists in the normalized array at all.
- **Overlapping records are never merged**: two rows occupying the same weekday/time slot (a real possibility per `detectScheduleConflict.ts`) both appear as separate entries; a cell (grid) or a day section (agenda) renders a list, never assumes one entry per slot.
- **Malformed `weekday` → `"Otro"`**: any stored value not exactly matching `WEEKDAYS` is normalized to the literal `"Otro"` bucket internally, displayed as the exact text "Día no especificado" wherever a weekday label is rendered for such an entry — never silently dropped and never guessed into an incorrect real day.
- **Malformed time never crashes**: a null or unparseable `start_time`/`end_time` becomes `startTime`/`endTime: null` in the normalized entry, not a thrown error; wherever a time is rendered for such an entry, the exact text "Hora no especificada" is shown.
- **Exact fallback text per field**, used only for the specific missing/malformed sub-field, never blanking the whole entry: `startTime`/`endTime` → "Hora no especificada"; `weekday` display when `"Otro"` → "Día no especificado"; `subject` → "Materia no especificada"; `group` → "Grupo no especificado"; `activity` → "Actividad no especificada". An entry with, for example, a known subject but an unrecognized weekday still shows its real subject text — only the weekday field uses the fallback.
- **No room field**: never part of the type and never rendered, because no `room` column exists in the schema.

### 9a. Placement: which entries appear in the grid, the agenda, and "Horario no especificado"

An entry's *placement* (not its existence — every entry always exists per §9) is determined by a pure `partitionWorkerSchedule` function:

```ts
interface CanonicalBlockLookup {
  isCanonicalClassBlock: (start: string, end: string) => boolean;    // SCHEDULE_BLOCKS
  isCanonicalActivityBlock: (start: string, end: string) => boolean; // TEACHER_SCHEDULE_BLOCKS
}

function partitionWorkerSchedule(
  entries: WorkerScheduleEntry[],
  scheduleBlocks: CanonicalBlockLookup
): {
  desktopPlaceable: WorkerScheduleEntry[];
  mobilePlaceable: WorkerScheduleEntry[];
  unplaceable: WorkerScheduleEntry[];
};
```

Placement rules:

- **`mobilePlaceable`**: `weekday !== "Otro"` (recognized) **and** `startTime`/`endTime` both non-null and syntactically valid — the time does **not** need to align with a canonical `SCHEDULE_BLOCKS`/`TEACHER_SCHEDULE_BLOCKS` row. A syntactically valid but noncanonical interval is still mobile-placeable.
- **`desktopPlaceable`**: everything in `mobilePlaceable` **and additionally** `isCanonicalClassBlock(startTime, endTime)` (for `kind: "class"`) or `isCanonicalActivityBlock(startTime, endTime)` (for `kind: "activity"`) — i.e. `desktopPlaceable ⊆ mobilePlaceable` always; the grid's rows only exist for the configured canonical blocks, so an entry must align with one to have a cell to render in.
- **`unplaceable`**: every entry not in `mobilePlaceable` — malformed/missing time, or an unrecognized weekday. By construction, `unplaceable` and `mobilePlaceable` are disjoint and together cover every entry.

Rendering, per presentation:

- **Desktop**: the grid renders `desktopPlaceable`. The "Horario no especificado" section renders every entry *not* in `desktopPlaceable` — i.e. `mobilePlaceable \ desktopPlaceable` (valid time, recognized day, but not a configured block) unioned with `unplaceable` (malformed/missing time or unrecognized day). Every entry appears exactly once across the two.
- **Mobile**: the agenda renders `mobilePlaceable`. The "Horario no especificado" section renders exactly `unplaceable`. Every entry appears exactly once across the two.
- **No entry is ever lost**: every normalized entry is in exactly one visible region per viewport (grid-or-leftover on desktop; agenda-or-leftover on mobile), never zero and never counted twice within the same viewport.

"Horario no especificado" is a real, always-labeled section (not a warning banner, not a count) showing the actual authorized entries with their available content — a teacher can identify exactly which class or activity is affected, using the exact fallback text (§9) only for the specific field that's actually missing or malformed.

### 9b. Sorting within "Horario no especificado"

Entries placed in the grid or the agenda use the original deterministic sort below (unchanged). Entries inside "Horario no especificado" use a **separate**, purpose-built comparator, since the primary sort's weekday/start-time ordering isn't meaningful for a section that exists precisely because those fields are missing or non-canonical for at least some of its members:

- **Grid/agenda placement sort** (`compareWorkerScheduleEntries`, unchanged): (1) `weekday` per `WEEKDAYS` order with `"Otro"` last, (2) `startTime` ascending with `null` sorted after every non-null time, (3) `kind`, `"class"` before `"activity"`, (4) `id` (string comparison) — a total order, no ties possible.
- **"Horario no especificado" sort** (`compareIncompleteScheduleEntries`, new): (1) entries with a recognized weekday (`weekday !== "Otro"`) before entries with `"Otro"`, (2) entries with a non-null `startTime` before entries with a null `startTime`, (3) `kind`, `"class"` before `"activity"`, (4) `id` (string comparison) — also a total order, no ties possible, but deliberately coarser on tiers 1–2 (recognized-or-not, valid-or-not) rather than the actual weekday/time value, since this section's members are exactly the ones where those values are least reliable.

### 10. Profile field allow-list and exact mappings

Allow-list: §3. Exact, final label/fallback text (all implemented as pure, individually-tested functions, §13):

| Field | Value | Displayed as |
|---|---|---|
| `status` | `1` | `"Activo"` |
| `status` | `0` | `"Inactivo"` |
| `status` | any other number, `null`, `undefined`, or a non-numeric/malformed value | `"Estado desconocido"` — not silently coerced to either "Activo" or "Inactivo" |
| `email`, `phone`, `specialty`, `function_performed` | missing/empty | `"No registrado"` |
| `type_worker` | missing/empty | `"Tipo no especificado"` — distinct wording from the generic "No registrado" fallback, since "type not specified" and "not on file" read as different situations to a teacher |
| `profile_picture` | missing, or the image fails to load | the existing `Avatar` component's built-in initials-then-icon fallback (unchanged, reused as-is) |

### Semester selection: deterministic ordering and edge cases

`findLatestSemester` (`nextSemesterCode.ts`, unchanged) already **skips** (with a `console.warn`) any semester whose code doesn't parse — sufficient for its one existing caller (`CreateSemesterForm.tsx`, which only needs to know the single latest *valid* code to compute the next one), but not sufficient for a selector that must present *every* semester row, including malformed ones, in a stable, fully-specified order. This change adds a new, separate, pure comparator/selector layer (§13's helpers) on top of the existing parsing functions, without changing `findLatestSemester` itself:

- **Total order, valid semesters first**: every semester with a code that parses via `parseSemesterCode` sorts before every semester whose code does not parse, regardless of raw string content or row id.
- **Valid semesters, newest first**: ordered by the same term-index comparison `findLatestSemester` uses internally (`year * 2 + (letter === "A" ? 0 : 1)`), descending.
- **Stable tie-break for equivalent parsed codes**: if two rows parse to the exact same `{year, letter}` (a data-quality anomaly the duplicate check in `createSemester` is meant to prevent, but not a database constraint, so it remains theoretically possible), they are ordered by `id` ascending as the final, deterministic tie-break — never by array/query order.
- **Malformed semesters, deterministic order after all valid ones**: rows whose code does not parse are appended after every valid row, themselves ordered by `id` ascending (their only remaining stable, deterministic key, since there is no parseable code to compare).
- **Default selection — latest valid, or first malformed if no valid semester exists**: the default selected semester is the first item in the total order above. If at least one semester parses, this is always a valid, chronologically-latest semester — never a malformed one. If **every** semester row is malformed (parses for none), the default is the first malformed item by the tie-break above, not a "no semesters" empty state — a semester row genuinely exists; its code being malformed is a data-quality problem to surface (e.g. an unparseable code shown as-is in the selector), not a reason to pretend none exists.
- **No semesters exist at all** (`semesters` resolves to an empty array): the distinct "no semesters registered" empty state (§11 table) — this is the only condition that produces it; a malformed-only list does not.
- **Selected semester disappears** (e.g. was the default, but a refetch no longer includes its id — deleted, or a stale client cache): re-run the same default-selection algorithm against the current `semesters` array (latest valid, or first malformed if none valid, or the empty state if none remain at all) rather than rendering a selection pointing at a semester that no longer exists.
- **Latest semester exists but has zero entries for this worker**: the distinct "no schedule for this semester" state (§11 table), never conflated with "no semesters."
- **Historical semesters remain selectable** at any point in the total order above via the `<Select>`, independent of which one is currently the computed default.

### 11. Worker route gating

**Final, approved architecture** (this is the current, normative description; the per-page shape it replaced is recorded below purely as historical context — see §16 for why it changed, and do not implement that shape):

A single `WorkerRouteGate.tsx` component wraps the entire worker `<Route>` group in `App.tsx`, above `WorkerAppLayout`, as a layout route. The exact route construction is extracted into `buildWorkerRouteBranch`/`buildPendingAccessBranch` (`src/ui/workerRouteBranch.tsx`), called directly by `App.tsx`: `buildWorkerRouteBranch` returns `<Route element={<WorkerRouteGate />}><Route element={<WorkerAppLayout />}>...`, with the three worker pages as its `<Route>` children; `buildPendingAccessBranch` returns a separate, sibling `<Route>` tree under `PendingAccessLayout`. `WorkerRouteGate` renders a full-page loading state while `role`/`worker_id` resolve, a `<Navigate>` on denial, or an `<Outlet />` on success. Because `WorkerAppLayout` — and therefore `Header`, `WorkerNav`, and every worker page's content — only exists inside that `<Outlet />`, none of it can mount before the gate resolves; this is a structural guarantee of the route tree, not a per-page convention each page has to individually honor, and it is proven directly (not merely asserted) by rendering `buildWorkerRouteBranch`/`buildPendingAccessBranch` through a real `MemoryRouter` via `react-dom/server`'s `renderToStaticMarkup` (`workerRouteBranchRender.test.tsx`), for every denial case and the success case alike. `MyDocuments.tsx`, `MySchedule.tsx`, and `MyProfile.tsx` therefore contain no authorization logic of their own — none of the three wraps or imports `WorkerRouteGate` — they are thin page components rendered only once the gate has already allowed the branch to mount. `/pending-access` — the gate's own denial target — is necessarily outside this branch, rendered under a separate, minimal `PendingAccessLayout` (header only, no `WorkerNav`) so it retains a way to log out without being nested inside the gate that denies access to it.

In every case, access is denied identically: `admin`, `staff`, unknown/unrecognized role, missing `profiles` row, and `worker`-role with an invalid or missing `worker_id` — using the shared, strict `isValidWorkerId` validator (finite, integer, positive), not a weaker ad hoc check.

**Superseded evaluation (historical context only — do not implement this shape):** The original design considered wrapping `WorkerRouteGate` *around each page's content* individually, via a render-prop handing the session-derived `workerId` down to that page, evaluated against `MyDocuments.tsx`'s pre-existing inline gating logic (loading spinner → staff/admin redirect → invalid-link redirect → render) as the precedent for extracting a shared component at all — copy-pasting that logic a third time for `MySchedule.tsx`/`MyProfile.tsx` was judged worse than one shared component, mirroring the admin `RoleGate.tsx` precedent. That per-page shape shipped first, including a refactor of `MyDocuments.tsx` to adopt it directly, then was found to have two problems during a later audit: `WorkerAppLayout` could mount before the gate resolved (the gate lived inside the layout, not above it), and the render-prop's `workerId != null` validity check admitted `0`/negative/non-integer/`NaN`/`Infinity` as "valid," weaker than the check used elsewhere. Both are fixed by the branch-level architecture described above; no page adopts, wraps itself with, or imports `WorkerRouteGate` anymore, including `MyDocuments.tsx`.

### 12. Responsive and accessibility behavior

Covered in the delta specs; summarized: `NavLink`'s built-in `aria-current="page"` plus a non-color active-state indicator, semantic heading structure on both new pages, weekday/time/subject/activity always exposed as real text, the existing global `button:focus` outline convention applies automatically to all new interactive elements, 44×44 CSS px minimum touch targets, no page-level horizontal scroll at any breakpoint (the grid's `overflow-x: auto`, §8, is scoped to its own container). The worker nav bar sits below the shared `Header` and never overlaps or competes with the header's own account popover/theme toggle — it is a separate, second row, not an addition to the header itself.

### 13. Automated and manual verification

See tasks.md. Summary: pure `bun:test` coverage for the normalized-entry mapper (kind preservation, no rows ever dropped, no-merge, malformed weekday → `"Otro"`, malformed/null time → `null`, every exact fallback-text case), the `partitionWorkerSchedule` placement rules (desktop vs. mobile placement including the noncanonical-but-valid-time case, no entry lost, no duplicate within one viewport), both comparators (`compareWorkerScheduleEntries` for the grid/agenda, `compareIncompleteScheduleEntries` for "Horario no especificado", each including their full tie-break chain), the exact profile mapping table (§10, every status/field case individually), semester ordering/default-selection including malformed-code handling (§ Semester behavior below), route-context labels, and nav config. pgTAP coverage for the RLS migration's full pre/postcondition-verified `SELECT` behavior *and* the structural+behavioral write-policy regression matrix (§7a). Manual verification against local Supabase with **two** distinct linked worker accounts (to prove cross-worker denial) and **at least two semesters, one with a malformed code**, per the enumerated matrix in tasks.md.

### 14. Deployment considerations

One migration, one transaction, fail-closed on any precondition/postcondition mismatch (§7) — deployment either fully succeeds in the verified end state or has zero effect. **Rollback is not "restore `USING (true)`."** If a genuine post-deployment rollback is ever needed, the correct action is a new migration that removes/hides the two new frontend routes (a pure frontend change, instantly effective, no data or access implication) — reverting the RLS tightening back to open, unauthenticated-readable schedule data is a break-glass action requiring explicit incident-level sign-off, never a routine or recommended rollback step, and is not documented here as one. No environment variable changes, no new Edge Function, no new Storage bucket.

### 15. Fixed follow-ups (definite, separate changes — not open questions)

1. **Harden the remaining anonymously-readable catalog tables** (`semesters`, `subjects`, `groups`, `degrees`, and any other table still on the base-schema `USING (true)` policy with no `TO authenticated` clause) — pre-existing, broader than this change's ownership requirement, deliberately not expanded into here.
2. **Fix `WorkerDocumentsView.tsx`'s unordered `semesters[0]` default-semester selection** — identified in §1/this change's own semester-selection design as the exact anti-pattern avoided here; **not modified in this change**.
3. **Audit and harden the broad INSERT/UPDATE/DELETE policies** on `schedule_assignments`/`schedule_teachers` (and any table with a similar gap) — this change only tightens `SELECT`; the write side remains exactly as open as it was before, a real, separate security-hardening item.
4. **Design true column-level worker-profile confidentiality** (a restricted view or `SECURITY INVOKER` function with a database-enforced column allow-list for `workers`) — the current `getMyWorkerProfile` `.select()` list (§6/§10) is API/UI minimization only, not a database-level guarantee; a worker's own authenticated client can still request every column of their own row today.
5. **Extract a single shared recess-block constant used by both the worker schedule (§18) and the admin schedule module** — the admin grid (`RowScholarSchedule.tsx`, `RowTeacherSchedule.tsx`) and both PDF exports (`ScheduleGroupPDF.tsx`, `ScheduleTeacherPDF.tsx`) each independently hard-code the same two recess times/label inline, with no shared constant even among themselves; §18's `schoolDayBlocks.ts` deliberately does not retrofit any of those four admin call sites, to avoid touching shipped, tested admin schedule/PDF code for this presentation-only worker-schedule change. A real, separate follow-up, not solved here.

The previously-open "should the unknown-weekday bucket alert admins" question is resolved, not deferred: **out of scope**. The worker page displays the affected entries in the "Horario no especificado" section (§9a) and nothing more; no admin-facing signal is added by this change.

## Goals / Non-Goals

**Goals:**
- Let a worker view their own schedule (grid on desktop, agenda on mobile, one shared normalized data model, with every authorized entry always visible somewhere — never silently dropped) and their own basic profile information, read-only, with a database-enforced, verified ownership guarantee.
- Close the actual, currently-open RLS gap on `schedule_assignments`/`schedule_teachers`, deployed with explicit, per-policy, per-dimension postcondition verification (exact `cmd`/`permissive`/`roles`/normalized `qual` for each intended policy, plus an exact final catalog check) — not an unverified drop-and-recreate, and not a check deferred entirely to after-the-fact pgTAP.
- Prove, structurally and behaviorally, that this `SELECT`-only migration leaves `INSERT`/`UPDATE`/`DELETE` on both tables exactly as they were — without endorsing those write policies as secure.
- Add narrow, worker-specific schedule/profile queries that never return more than the normalized contract or the profile allow-list needs — no `workers(*)` embed, no RFC/address/observations in any new query this change adds.
- Add the first real worker self-service navigation and a shared route gate, small and additive, not a redesign of any admin component.

**Non-Goals:**
- Editing, correcting, or requesting correction of any worker or schedule data.
- Any admin-facing scheduling change — `ScheduleDashboard`/`ShowTeacherSchedule`/`ScholarSchedule` and their existing queries/components are untouched; the RLS migration does not change their behavior (verified, task 1.7).
- Redesigning `Sidebar.tsx`/`MainNav.tsx`.
- Fixing `WorkerDocumentsView.tsx`'s `semesters[0]` defect (Follow-up #2).
- Locking down the broader catalog-table anon-read gap (Follow-up #1) or the schedule write-side gap (Follow-up #3).
- True database column-level profile confidentiality (Follow-up #4) — this change ships API/UI minimization only, documented honestly as such.
- Multi-teacher-per-class support, room display, PDF export, or any field/feature not already present in the schema.
- A new dependency of any kind.

## Decisions

1. **New, narrow worker-schedule service functions instead of reusing `getScheduleAssignments`/`getScheduleTeachers`.** `getScheduleTeachers()`'s `workers(*)` embed is more than a self-service read view needs to transmit on every request; new functions with an explicit projection (§6) avoid it entirely while still relying on RLS, not a client-supplied filter, for ownership.
2. **RLS migration is verified drop-and-recreate, not unverified additive.** A silent policy-shape mismatch or an unnoticed second permissive policy would leave global read access in place under a different name; explicit pre/postcondition `RAISE EXCEPTION` guards (§7) make that impossible to deploy unnoticed.
3. **New, worker-scoped presentation primitives, visually aligned via shared tokens/data sources but not shared code with admin CRUD cell components.** The admin cell components have no read-only seam; extracting one would mean refactoring shipped, tested admin code for a benefit this change doesn't need (§8).
4. **900px, the existing mobile breakpoint, is the grid↔agenda transition — no new breakpoint.** Matches "use existing project breakpoints where possible" and the codebase's one established convention.
5. **A single explicit `WorkerScheduleEntry` normalized type, computed once, consumed by both presentations, with every authorized entry always represented and placed somewhere visible.** Prevents the grid, the agenda, and "Horario no especificado" from silently drifting into inconsistent sorting/fallback/placement behaviors over time, and prevents any authorized row from ever being silently hidden (§9/§9a).
6. **A single branch-level `WorkerRouteGate`, not a per-page component any page adopts.** Evaluated against the precedent of `RoleGate.tsx` on the admin side, which wraps the entire admin route group the same way; three independent copies of identical redirect logic (or three pages each individually wrapping themselves in a shared component) was judged worse than one gate wrapping the whole worker route branch once, above `WorkerAppLayout` — removing `MyDocuments.tsx`'s prior inline gating entirely rather than refactoring it to hold its own copy (§11, §16).
7. **The profile field projection is documented as minimization, not confidentiality.** Overclaiming security a mechanism doesn't provide is worse than not building the mechanism at all; the real column-level guarantee is recorded as Follow-up #4, not implied to already exist.
8. **Four fixed follow-ups recorded as definite separate changes, not open questions.** Each is real, identified during this change's own investigation, and out of this change's scope by size or by not being required for its stated goal.
9. **Postcondition qual strings are captured empirically from Postgres, not hand-authored.** Writing an expected SQL string independently and comparing it against Postgres's `pg_get_expr()` reconstruction risks false failures from harmless rewriting (e.g. `IN (...)` → `= ANY(ARRAY[...])`, schema-qualification); capturing the real output once, locally, and normalizing only for whitespace/case, is both simpler and more correct than attempting general SQL-equivalence logic (§7).
10. **A three-way partition (`desktopPlaceable`/`mobilePlaceable`/`unplaceable`), not a boolean "complete/incomplete" split.** Desktop's stricter canonical-block requirement and mobile's looser valid-time-only requirement are genuinely different placement criteria (a noncanonical-but-valid-time entry is mobile-placeable but not desktop-placeable); a single boolean couldn't express that difference (§9a).
11. **"Horario no especificado" shows real entries, never a count or banner.** A teacher needs to identify *which* class or activity is affected, not just be told something is wrong; showing the actual authorized rows (with per-field fallback text only where a field is genuinely missing) is strictly more useful and no less safe than a summary notice (§9a).

## Risks / Trade-offs

- **[Risk]** The RLS migration removes a currently-live (if unintentional) open-read grant on two tables — any as-yet-undiscovered code path relying on unauthenticated or cross-worker schedule reads would break. → **Mitigation**: repository-wide search (task 1.8) confirms `ScheduleDashboard.tsx` (admin-only, `RoleGate`-gated) is the only current consumer; the new worker-specific functions (§6) are the only other consumer this change adds, and both are re-verified against the tightened policies before merge (tasks 1.7, 2.8).
- **[Risk]** New worker-scoped presentation primitives duplicate some CSS values already present in the admin grid shell instead of sharing code. → **Mitigation**: deliberate, documented trade-off (§8/Decision 3) favoring zero risk to shipped admin code over a small amount of CSS duplication; the shared *tokens* (colors) and *data sources* (`WEEKDAYS`, block lists) are still reused, limiting drift.
- **[Risk]** The profile projection's "minimization, not confidentiality" distinction (§6/§10) could be misread by a future contributor as "this is already secure." → **Mitigation**: stated explicitly and repeatedly in this document and the delta spec, with a named, concrete follow-up (#4) rather than a vague caveat.
- **[Risk]** Wrapping the entire worker route branch in `WorkerRouteGate` above `WorkerAppLayout` (Decision 6, §16), rather than gating each page individually, could let `WorkerAppLayout`/`Header`/`WorkerNav`/a page's content mount outside the gate's control if the route tree were ever nested incorrectly, or could regress `MyDocuments.tsx`'s prior redirect behavior now that its inline gating has been removed rather than duplicated. → **Mitigation**: the route construction itself is extracted into `buildWorkerRouteBranch`/`buildPendingAccessBranch` (§11, `src/ui/workerRouteBranch.tsx`) — the same functions `App.tsx` calls — and rendered directly by a real-render test (`workerRouteBranchRender.test.tsx`, via `react-dom/server`'s `renderToStaticMarkup`) proving nothing worker-facing mounts before authorization resolves, for every denial case (admin, staff, unrecognized role, missing profile, invalid worker link) as well as the success case — not merely asserted or compared by inspection.
- **[Risk]** The empirically-captured expected `qual` strings (§7, Decision 9) could go stale if a future Postgres/Supabase upgrade changes how it reconstructs expressions via `pg_get_expr()`, causing the migration's own postconditions to fail on a re-run against a fresh database even though the intended policy is correct. → **Mitigation**: this is the fail-closed property working as intended, not a defect — a mismatch (for any reason) blocks deployment rather than silently accepting a possibly-wrong policy; the expected strings would simply need to be recaptured against the new Postgres version, the same one-time local step used to derive them originally.
- **[Risk]** The three-way schedule placement partition (§9a) and its two distinct comparators (§9b) add real complexity relative to a simpler "show it or don't" model. → **Mitigation**: the complexity directly reflects a real product requirement (never discard an authorized row; desktop and mobile genuinely have different placement criteria) rather than incidental design overhead; both comparators and the partition function are pure and independently unit-tested (§13), keeping the complexity verifiable rather than merely asserted.

## Migration Plan

Single migration file, one transaction, fail-closed (§7/§14). Standard PR review plus the manual verification matrix (tasks.md, task group 12) before merge. No rollback-by-reopening-access; see §14 for the correct rollback shape if one is ever needed.

## Open Questions

None remaining that require a product decision before implementation — all four items previously listed as open questions are now recorded as Fixed Follow-ups (§15), and the unknown-weekday admin-alert question is resolved as explicitly out of scope.

## 16. Post-implementation audit corrections (supersedes §6/§11 as originally written)

A Codex implementation audit (see tasks.md §14) found that this document's original §6 and §11 described a shape that was not account-generation-safe and not fully fail-closed at the route level. Both were corrected; this section is the authoritative description of the corrected behavior, not §6/§11's original text.

- **Query keys are account-generation-safe, not just semester-scoped.** `getMyScheduleAssignments`/`getMyScheduleTeacherActivities`/`getMyWorkerProfile` (§6) themselves are unchanged, but the query layer wrapping them is not the plain `useQuery({ queryKey: ["my-schedule-assignments", semesterId] })` shape §6 originally implied. Each query key now carries the authenticated user id and the validated worker id alongside the domain-specific id(s): `["my-schedule", "assignments" | "activities", authUserId, workerId, semesterId]` and `["my-worker-profile", authUserId, workerId]`. Every fetch captures its `authUserId`/`workerId`/(`semesterId`) as plain function arguments before its `await`, tags the resolved snapshot from those captured values, and the consuming hook discards (treats as still-loading) any snapshot whose tag doesn't match the current render's identity. This mirrors `useCurrentIdentity.ts`'s existing, already-shipped pattern (`buildWorkerIdentityQueryOptions`/`fetchWorkerIdentitySnapshot`/the generation guard in `resolveIdentityState`) rather than inventing a new one. See `src/features/schedules/workerScheduleQuery.ts` and `src/features/workers/workerProfileQuery.ts`.
- **Route gating happens above the layout, not per-page inside it.** §11's shared `WorkerRouteGate` originally wrapped each page's content (a render-prop handing `workerId` down), with `WorkerAppLayout` — and therefore `Header`/`WorkerNav` — mounting before that gate resolved. `WorkerRouteGate` is now a layout route wrapping the entire worker `<Route>` branch, above `WorkerAppLayout`: `<Route element={<WorkerRouteGate />}><Route element={<WorkerAppLayout />}>...`. Nothing worker-facing renders until authorization resolves. `/pending-access` — the gate's own denial target — is necessarily a sibling of this branch, not nested inside it; it now renders under a small dedicated `PendingAccessLayout` (header only, no worker nav) instead of `WorkerAppLayout`, so it doesn't lose its header/logout affordance by moving out from under it.
- **`workerId` is resolved inside each view, not handed down by the gate.** Because the gate no longer has a render-prop channel to a specific page, `MyScheduleView`/`MyProfileView` resolve their own `authUserId`/`workerId` internally (`useUser()`/`useProfile()`), the same authenticated-session path the gate itself checks, never a prop. `MyDocuments.tsx` is the one exception, since `WorkerDocumentsView.tsx` still requires an explicit `workerId` prop and was intentionally not modified (Follow-up scope) — it uses a small shared `useGatedWorkerId()` hook instead of the old render-prop value.
- **The worker-link validity check is a single shared function**, `isValidWorkerId` (`src/features/authentication/workerLinkValidation.ts`) — finite, integral, positive — used by `useCurrentIdentity`, `WorkerRouteGate`, and both query-builder layers, replacing what were previously independent (and, in the route gate's case, weaker: `workerId != null`) checks.

None of this changes §5's authorization model (`current_app_role()`/`current_worker_id()` remain the sole source of truth; RLS remains authoritative) or §9/§9a/§10's data contracts — it only changes how identity reaches the query layer and when the worker layout is permitted to mount.

## 17. Migration guard: execution-level test strategy (final audit)

A second audit found that §7's migration preconditions, while individually correct, were only proven by a pgTAP file that re-typed the same `pg_policies` queries the migration used — real coverage of "does this exact query return the right count," but no proof that the actual migration guard, run end to end, fails closed and leaves zero trace of a partial replacement under drift. Fixing this required deciding how a pgTAP test can exercise a migration's own logic at all, since Supabase applies `.sql` migration files directly (there is no "invoke this migration's guard function" entry point) and pgTAP tests run *after* migrations have already been applied to the local database.

**Decision: extract the guard + drop/create/verify sequence into one private SQL function, called identically by the migration and by the tests — not duplicated in either direction.**

`public._replace_schedule_ownership_select_policy(target_table, admin_staff_policy_name, worker_policy_name)` (defined in `20260716215631_schedule_ownership_rls_policies.sql`, before it is first called) now contains the *entire* precondition → `DROP POLICY` → `CREATE POLICY` ×2 → postcondition sequence from §7, parameterized by table name and the two new policy names so the identical logic serves both `schedule_assignments` and `schedule_teachers`. The migration itself is now just two `SELECT public._replace_schedule_ownership_select_policy(...)` calls — no inlined `DO $$...$$` guard logic remains duplicated per table. `supabase/tests/database/schedule_ownership_rls_migration_drift.test.sql` calls this *exact* function directly, against a deliberately reconstructed pre-migration policy state, for seven independent drift scenarios per table (policy renamed, cmd differs, permissive mode differs, roles differ, predicate differs, an extra permissive SELECT policy exists, an extra restrictive SELECT policy exists) plus one success-path call per table — the same function reference in every case, so a real change to the guard's logic is automatically exercised by this test file the next time it runs, with no second copy of the logic to keep in sync or let drift silently.

This decision replaces the prior, weaker `schedule_ownership_rls_migration_preconditions.test.sql` (deleted), which asserted the same *queries* the migration ran without ever calling the migration's own code.

**Why a function is safe here, and how it stays fail-closed and off the client API surface:**

- **DDL inside a function is still transactional.** `DROP POLICY`/`CREATE POLICY` inside a plpgsql function are ordinary DDL statements; Postgres includes them in the enclosing transaction exactly as if they were inlined. Calling the function from inside the migration's own (Supabase-managed, single-transaction) apply, or from inside a pgTAP file's `BEGIN...ROLLBACK`, behaves identically to the un-extracted `DO $$...$$` blocks this replaced — atomicity is unchanged.
- **Fail-closed is unchanged.** Every precondition check still runs to completion, via `RAISE EXCEPTION`, before the first DDL statement (`EXECUTE format('DROP POLICY ...')`) executes. A precondition failure aborts the function (and, transitively, the calling transaction) with zero DDL ever having run — proven directly by the drift tests' "catalog unchanged after the failed call" assertions.
- **No production client API surface.** `SECURITY DEFINER` with `SET search_path = pg_catalog, public` (fixed, so it cannot be redirected by a caller's own `search_path`), and explicit `REVOKE ... FROM PUBLIC, anon, authenticated`. This project's Supabase instance grants `EXECUTE` on every function in the `public` schema to `anon`/`authenticated` by default (confirmed empirically — `current_app_role()`/`current_worker_id()` carry the same default, which is correct for *those* functions since RLS predicates must be callable by the querying role) — `REVOKE ... FROM PUBLIC` alone left `anon`/`authenticated` still able to call it; the explicit per-role revokes were required and are what the local-verification step (task 14→Item 1) caught before this shipped.
- **A fixed, small internal allow-list, not dynamic-table DDL.** `target_table` is checked against `IN ('schedule_assignments', 'schedule_teachers')` before any `EXECUTE format(...)` runs — the function is not a general "replace any table's policy" primitive a caller could point at an arbitrary table, even though it is already unreachable by any client role.
- **The policy names are allow-listed too, not just the table.** A follow-up audit found `target_table` alone didn't constrain what the function actually did with `admin_staff_policy_name`/`worker_policy_name` — those were free-form strings, safely quoted (`format(..., %I, ...)`) but not restricted to any particular value. A second check, immediately after the `target_table` check, enumerates the two approved `(target_table, admin_staff_policy_name, worker_policy_name)` triples explicitly and rejects anything else — an arbitrary name, the admin/staff and worker names swapped, or a name pair that's valid for the *other* table — before any precondition query or DDL runs. `schedule_ownership_rls_migration_drift.test.sql` covers all four rejection shapes for both tables (8 scenarios), run directly against each table's real, already-correctly-migrated catalog, confirming both that the call raises and that the real catalog is unaffected.
- **Intentionally retained after this migration runs, not dropped.** The execution-level drift tests need a stable, callable target across every future `supabase db reset`/CI run, not just the one deployment that first created it. This is a deliberate exception to "drop transitional migration helpers": the function is the *authoritative*, load-bearing implementation of the guard, not scaffolding left over from writing it.

## 18. Static recess periods (presentation-only)

The school has two fixed recess periods — `08:50:00–09:20:00` and `13:00:00–13:10:00`, both labeled `"RECESO"` — that are institutional facts about the school day, not teacher/worker data. This section documents where they live and, more importantly, where they deliberately do *not*: they are **never** persisted (no Supabase table, no column, no row), **never** returned by `getMyScheduleAssignments`/`getMyScheduleTeacherActivities` (§6, unmodified), **never** a `WorkerScheduleEntry` (§9, unmodified), and **never** passed through `normalizeWorkerSchedule`/`partitionWorkerSchedule` (§9a, unmodified) — so they carry no ownership/RLS implication whatsoever and cannot affect `resolveMyScheduleViewState`'s empty-schedule detection (§ Semester behavior), which depends solely on the count of normalized entries derived from the two authorized queries.

**Source of the constants — worker-schedule-scoped, not shared with the admin schedule module.** A new `src/features/schedules/schoolDayBlocks.ts` defines a `SchoolDayBlock` discriminated type (`{ kind: "schedule"; startTime; endTime }` for a teachable block, `{ kind: "recess"; startTime; endTime; label: "RECESO" }` for a fixed recess period), the two exact recess times, `WORKER_SCHEDULE_DAY_BLOCKS` (the full chronological desktop-grid row sequence — `TEACHER_SCHEDULE_BLOCKS` interleaved with both recess periods), a `formatSchoolDayBlockLabel` helper matching the existing hand-written `SCHEDULE_BLOCKS`/`TEACHER_SCHEDULE_BLOCKS` label convention exactly (verified against every existing label), and `mergeRecessIntoDayEntries` for the mobile agenda. The admin schedule module already renders `"RECESO"` at these same two times independently, in four separate, hard-coded locations (`RowScholarSchedule.tsx`, `RowTeacherSchedule.tsx`, `ScheduleGroupPDF.tsx`, `ScheduleTeacherPDF.tsx`) with no shared constant even among themselves — retrofitting all four to consume `schoolDayBlocks.ts` would touch shipped, tested admin schedule/PDF code for a benefit this presentation-only worker-schedule change doesn't need. This duplication is deliberate and recorded as Fixed Follow-up #5 (§15), not silently accepted.

**Desktop (`WorkerScheduleGrid.tsx`):** the row sequence is now `WORKER_SCHEDULE_DAY_BLOCKS` (7 rows: 5 teachable blocks + 2 recess periods, in chronological order) instead of `TEACHER_SCHEDULE_BLOCKS` alone. A recess row renders its time range in the `<th scope="row">` row header (same convention as every other row), then exactly one `<td colSpan={5}>` spanning all five weekday columns with `"RECESO"` centered — never per-weekday cells, never populated via `selectCellEntries`, never an entry chip. Contrast is verified in both the light and `.dark-mode` custom-property sets already defined in `GlobalStyles.ts`; the `"RECESO"` text itself (not a color alone) conveys meaning, consistent with §12's existing "no color-only dependency" requirement. No edit/add/delete control exists on a recess row, same as every other row in this read-only view.

**Mobile (`WorkerScheduleAgenda.tsx`):** each already-displayed day (i.e. a weekday `groupWorkerScheduleByWeekday` produced with at least one real entry) additionally shows both fixed recess periods as static, non-card separators (`mergeRecessIntoDayEntries`), positioned chronologically among that day's real entries by `startTime`, never as a `"Clase"`/`"Actividad"` card. A day with zero entries is skipped *before* recess is ever considered — recess is never the sole reason a day section renders — matching the existing "no otherwise-empty day" behavior the agenda already had before this addition.

**Interaction with "Horario no especificado" (§9a):** unaffected. That section is computed exclusively from `partitionWorkerSchedule`'s output over the normalized entry array, which recess periods never enter — they cannot appear there, structurally, not by an added exclusion check.
