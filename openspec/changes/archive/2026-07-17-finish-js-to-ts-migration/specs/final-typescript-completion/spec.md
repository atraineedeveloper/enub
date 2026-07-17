# final-typescript-completion Specification

## ADDED Requirements

### Requirement: Existing app behavior remains unchanged
The system SHALL preserve all existing application behavior — rendered
output, routing, redirects, form validation, and data flow — across every
file converted in this change, with no user-visible difference before and
after conversion.

#### Scenario: A converted feature behaves identically post-conversion
- **WHEN** any of the 50 active files targeted by this change is converted
  from `.js`/`.jsx` to `.ts`/`.tsx`
- **THEN** the resulting UI, data fetched, and user-facing behavior are
  identical to the pre-conversion behavior, except for the specific,
  documented `isLoading`→`isPending` fixes explicitly authorized in
  `design.md`

### Requirement: Remaining active JS/JSX source files are converted to TS/TSX
The system SHALL convert every remaining active (reachable, imported, and
rendered or called) JavaScript/JSX source file identified in `design.md`'s
file inventory to TypeScript/TSX, reusing existing generated and
feature-level types rather than inventing new ones where a suitable type
already exists.

#### Scenario: All active files reach TypeScript
- **WHEN** this change is complete
- **THEN** every file in `design.md`'s "Active" classification list has been
  converted to `.ts`/`.tsx`, and `find src -type f \( -name "*.js" -o -name "*.jsx" \)`
  returns only the files explicitly authorized to remain JavaScript (the
  Montserrat font files) or nothing at all if those are also converted

### Requirement: Generated and static font JS files are handled explicitly
The system SHALL either leave the `src/styles/Montserrat-*.js` font
files as JavaScript with documented rationale, or convert them to TypeScript
only if a safe, low-risk conversion path is demonstrated in `design.md` —
this change SHALL NOT leave their disposition undecided.

#### Scenario: Font files are explicitly dispositioned
- **WHEN** `design.md`'s Closed Decisions section is read
- **THEN** it states plainly whether each Montserrat font file remains `.js`
  or is converted to `.ts`, with the reasoning for that choice, and if
  conversion is chosen, every one of the 16 call sites that dynamically
  imports them is updated consistently

### Requirement: Orphaned and dead files are handled explicitly, not left ambiguous
The system SHALL delete a file identified as having zero live importers only
after this change's own research independently re-confirms zero importers
immediately before deletion; otherwise the file SHALL be left unconverted
and unconverted-but-undeleted, deferred to a future change with that
deferral explicitly recorded.

#### Scenario: The three orphaned schedule files are dispositioned
- **WHEN** `design.md`'s Closed Decisions section addresses
  `CreateScholarSchedule.jsx`, `EditScholarSchedule.jsx`, and
  `RowTeacherAssignment.jsx`
- **THEN** each file's importer count is stated explicitly (confirmed zero
  for all three, per this change's research), and `tasks.md` contains an
  explicit, individually-authorized deletion task for each file rather than
  a blanket or implicit deletion

#### Scenario: Files newly discovered to be dead are not silently converted
- **WHEN** a file already part of the current 59-file inventory is found
  during this change's Phase 0 audit to have zero live importers, even
  though it was not previously known to be dead (e.g.
  `UpdatePasswordForm.jsx`/`UpdateUserDataForm.jsx`, both part of the
  original 59-file inventory, found during this audit to import a
  non-existent hook and have zero importers)
- **THEN** it is dispositioned with the same rigor as the three previously-known
  orphaned schedule files — its zero-importer status is documented in
  `design.md`, and its deletion (if authorized) is an explicit, individual
  `tasks.md` task, never bundled silently into an unrelated conversion task

### Requirement: Services preserve Supabase query and mutation behavior exactly
The system SHALL preserve every `src/services/api*.js` file's exact Supabase
query/mutation calls, table names, selected columns, RPC names, and
Edge Function invocation payloads when converting each file to TypeScript.

#### Scenario: A converted service issues the identical Supabase call
- **WHEN** a service file (e.g. `apiWorkers.js`, `apiWorkerDocuments.js`,
  `apiProfiles.js`) is converted to `.ts`
- **THEN** every `.from(table)`, `.select(...)`, `.rpc(...)`, and
  `supabase.functions.invoke(...)` call in the converted file matches the
  original exactly — table names, column selections, and payload shapes are
  unchanged

### Requirement: Authentication behavior is fully preserved
The system SHALL preserve login, logout, password-set/recovery, worker
account linking/resending, session resolution, and role-based
redirect behavior exactly when converting
`src/features/authentication/**` and `src/ui/RoleGate.jsx`.

#### Scenario: Role-based redirects are unchanged
- **WHEN** `src/ui/RoleGate.jsx` is converted to `.tsx`
- **THEN** staff/admin sessions still reach staff routes, worker sessions are
  still redirected to `/my-documents`, and sessions with no resolvable role
  are still redirected to `/pending-access`, exactly as before conversion

#### Scenario: Login/logout/password flows are unchanged
- **WHEN** `LoginForm.jsx`, `Logout.jsx`, `UpdatePasswordForm.jsx`'s
  functional successor (`useSetPassword.js`-backed `SetPassword.tsx`, already
  converted), `useLogin.js`, `useLogout.js`, `useCreateWorkerAccount.js`,
  `useLinkWorkerAccount.js`, `useResendWorkerAccessLink.js`, `useProfile.js`,
  and `useUser.js` are converted
- **THEN** authenticating, logging out, setting a password, linking a worker
  account, and resending an access link all behave identically to before
  conversion, including error messages shown to the user

### Requirement: Context, hooks, UI shell, and helper behavior is preserved
The system SHALL preserve the exact behavior of `src/context/DarkModeContext.jsx`,
`src/hooks/**`, `src/ui/AppLayout.jsx`, `src/ui/WorkerAppLayout.jsx`,
`src/ui/DarkModeToggle.jsx`, `src/ui/Form.jsx`, `src/ui/RoleGate.jsx`,
`src/main.jsx`, and every file under `src/helpers/**` when each is converted.

#### Scenario: Dark mode persistence is unchanged
- **WHEN** `DarkModeContext.jsx` and `useLocalStorageState.js` are converted
- **THEN** the dark/light mode preference is still read from and written to
  `localStorage` under the same key, with the same default value

#### Scenario: Helper functions return identical values
- **WHEN** any file under `src/helpers/**` is converted
- **THEN** it returns byte-identical output for the same input as before
  conversion (e.g. `calculateSemesterGroup`, `capitalizeFirstLetter`,
  `detectScheduleConflict`, `sortWorkersBySurname` all preserve their exact
  computed results)

### Requirement: Import paths are audited after every rename
The system SHALL audit, after each phase that renames a file, every import
site across `src/` that references the renamed file, and update only the
import specifiers that would otherwise fail to resolve or that `tsc` would
reject (e.g. an explicit `.ts`/`.tsx` extension once the importing file
itself becomes type-checked).

#### Scenario: No stale or broken import remains
- **WHEN** a phase renames one or more files
- **THEN** a full-tree grep for the old filename(s) turns up no remaining
  live import statement referencing the old extension, and
  `bun run typecheck` and `bun run build` both succeed

### Requirement: Manual smoke checks are required before merge
This change SHALL require manual verification of the highest-risk affected
flows — login, logout, password set/recovery, worker account linking, dark
mode toggle, and at least one state-roles and one "other data" CRUD action —
before the change is considered complete.

#### Scenario: Manual smoke pass precedes completion
- **WHEN** implementation of a phase touching authentication, context, or a
  CRUD feature is complete
- **THEN** the affected flow is manually exercised in a running dev session
  and confirmed to behave as before, and the result is recorded in
  `tasks.md`'s Verification Results before that phase is considered done
