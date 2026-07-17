# Design: Finish JavaScript-to-TypeScript Migration

## Context

This repo has been migrated to TypeScript incrementally, one bounded
OpenSpec change at a time (workers, worker documents, Supabase type
regeneration, pages, schedules, PDF exporters, and more). 117 `.ts`/`.tsx`
files exist today. This change targets the last 59 `.js`/`.jsx` files.

A full importer audit (every file read, every import site grepped across
`src/`) found the 59 files are not one homogeneous group —
**50 active + 4 generated + 5 confirmed-dead = 59**:

- **50 active files** — real code with live render/call paths.
- **4 generated jsPDF font-registration files** — pure base64 data plus a
  side-effect registration call, never containing application logic.
- **5 confirmed-dead files with zero live importers anywhere in `src/`** —
  the 3 previously-known orphaned schedule files, plus 2 authentication
  forms — already part of this same 59-file inventory, not files added from
  outside it — newly discovered during this audit to be dead: they import a
  hook (`useUpdateUser`) which does not exist anywhere in this codebase.

This document treats each group differently, rather than converting
everything uniformly.

## Goals

- Convert all 50 active files to TypeScript, preserving exact behavior.
- Reach **zero active untyped application source files** as this migration's
  final state.
- Explicitly disposition every file that is not a straightforward
  "convert as-is" candidate (font files, dead files), rather than silently
  converting or silently ignoring them.
- Apply the same `isLoading`→`isPending` TanStack Query v5 mutation-hook fix
  already applied throughout this migration, wherever it still appears.

## Non-Goals

- No new user-facing functionality.
- No redesign of any component's markup, styling, or layout.
- No changes to `services/` query/mutation *behavior* (only typing/file
  extension).
- No Supabase migrations, no changes to generated types, no
  `package.json`/`tsconfig.json`/`eslint.config.js` changes, no new
  dependencies.
- No resolution of any *other* stale code found incidentally (e.g. the
  `apiUtilities.js` "Utilies"/"Utily" exported-name typo, or
  `apiScheduleAssignments.js`'s unvalidated `createScheduleAssignments`
  export) beyond what's explicitly authorized in Closed Decisions below —
  these are noted for awareness, not fixed, to keep this change focused.

## Closed Decisions

**1. What to do with the 4 Montserrat font JS files?**
**Leave as `.js`.** Each of `src/styles/Montserrat-{Bold-bold,BoldItalic-bolditalic,Italic-italic,Regular-normal}.js`
is a 7-line file: an `import { jsPDF } from "jspdf"`, one large base64 font
string, a `callAddFont` function that calls `this.addFileToVFS(...)` /
`this.addFont(...)`, and a `jsPDF.API.events.push(['addFonts', callAddFont])`
side-effect registration. There is no exported value, no application logic,
and nothing for TypeScript to meaningfully type — converting would only
change the file extension and require updating all 16 call sites that
dynamically import them (`await import(".../Montserrat-*.js")`, always with
an explicit `.js` extension, from `ScheduleGroupPDF.tsx`, `ScheduleTeacherPDF.tsx`,
`TeacherAssignmentPDF.tsx`, and `WorkerSheetSemester.tsx` — 4 imports each).
This is a real, demonstrated-safe conversion path (not a blocker), but it
provides zero type-safety benefit for a pure side-effect data file, so it is
out of scope for this change. Rationale is documented here per the
requirement that this disposition not be left ambiguous.

**2. What to do with the 3 orphaned schedule files?**
**Delete**, each independently re-confirmed to have zero live importers:
- `src/features/schedules/CreateScholarSchedule.jsx` — zero importers
  anywhere in `src/` (confirmed via full-tree grep, excluding substring
  collisions with `CreateEditScholarSchedule`). Fully superseded by the
  already-converted `CreateEditScholarSchedule.tsx`.
- `src/features/schedules/EditScholarSchedule.jsx` — its only textual
  "importer," `src/features/schedules/HourScheduleSubjectGroup.tsx` line 6
  (`import CreateScholarSchedule from "./EditScholarSchedule";`), is a dead,
  never-referenced local binding — that component instead renders a
  *different* import (`CreateEditScholarSchedule.tsx`, aliased separately).
  Additionally this file itself would throw at runtime if ever reached: it
  renders `<Spinner />` with no `Spinner` import, and calls hooks after an
  early conditional return (a Rules-of-Hooks violation) — further evidence
  it has never actually executed in production.
- `src/features/schedules/RowTeacherAssignment.jsx` — a 5-line placeholder
  stub (`return <div>RowTeacherAssignment</div>;`), zero importers anywhere.

This reverses the "always defer" disposition every prior change in this
migration gave these same 3 files (schedules migration's Decision 1, PDF
exporters migration's Decision 7) — those changes deliberately deferred
because resolving them wasn't their focus. This change's Phase 0 *is*
dedicated, explicit research into exactly this question, so deletion is
authorized here, gated on the re-confirmation step in Phase 6 (see Phase
Breakdown) immediately before each deletion.

**3. Should services be migrated in one phase or split?**
**One phase.** All 15 files (14 `api*.js` + `supabase.js`) share an
identical structural pattern (thin async wrappers around `.from(table)...`
calls, Spanish user-facing error strings, no TanStack usage) and have zero
interdependencies among each other beyond all 14 `api*.js` files importing
`supabase.js`. Splitting would only add process overhead. The two largest
files, `apiWorkerDocuments.js` (521 lines) and `apiWorkers.js` (255 lines),
need the most careful type-authoring (several nested option-object shapes
worth turning into named interfaces) but do not need their own phase.

**4. Should authentication hooks/forms be migrated together or split?**
**Together, as one phase — but excluding the 2 dead forms**, which are
handled in the dead-file-deletion phase instead of the conversion phase.
The 10 live authentication files (6 hooks, `LoginForm.jsx`, `Logout.jsx`, and
the 2 already-identified-live forms) have a shallow, well-understood
dependency chain (`apiAuth.js`/`apiProfiles.js` → hooks → components) that
converts cleanly in one pass. Splitting further would fragment a naturally
cohesive unit and this is also the single highest-scrutiny area of the whole
change (governs every route's access).

**5. Are TanStack Query v5 `isLoading`→`isPending` fixes authorized in
remaining mutation hooks?**
**Yes**, exactly as in every prior phase of this migration. Confirmed sites
(all `useMutation`, all destructuring the pre-v5 `isLoading` name instead of
v5's `isPending`):
- `src/features/authentication/useLogin.js` (line 10, returned as `isLoading`)
- `src/features/authentication/useLogout.js` (line 9, returned as `isLoading`)
- `src/features/stateRoles/useEditStateRole.js` (line 8, renamed locally to
  `isEditing`)
- `src/features/otherData/useEditUtilities.js` (line 8, renamed locally to
  `isEditing`)
All four are `useMutation` (mutation-only rename needed); every `useQuery`
call in scope (`useProfile.js`, `useUser.js`, `useStateRoles.js`,
`useUtilities.js`) already correctly uses `isLoading` (v5's `useQuery` keeps
that name — only `useMutation` renamed it) and needs no change. The 2
mutation hooks inside the deleted dead files (`CreateScholarSchedule.jsx`,
`EditScholarSchedule.jsx`) also have this bug but it is moot since those
files are deleted, not fixed.

**6. Does `src/main.jsx` become `src/main.tsx`?**
**Yes.** It is a 12-line entry point (`ReactDOM.createRoot(...).render(...)`
inside `StrictMode`/`ErrorBoundary`) with zero remaining `.jsx` dependencies
— it already imports `./App.tsx` and `./ui/ErrorBoundary.tsx` with explicit
`.tsx` extensions (both already converted). This is one of the lowest-risk
conversions in the whole change.

**7. Does `supabase.js` become `supabase.ts`?**
**Yes.** It exports the Supabase client (both `export const supabase` and
`export default supabase`), reading `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` (falling back to `VITE_SUPABASE_KEY`) from
`import.meta.env`. It currently has only a JSDoc comment referencing
`./types/supabase`'s `Database` type as a hint, not an enforced generic. This
change authorizes making that real: `createClient<Database>(...)`. This adds
compile-time safety to every one of the 14 `api*.js`→`.ts` service files that
import it, without changing any runtime behavior (env var names, fallback
order, and the thrown-on-missing-env-var behavior stay exactly as-is).

**8. Do the helper JS files become TS in one phase?**
**Yes.** All 5 (`calculateSemesterGroup.js`, `capitalizeFirstLetter.js`,
`constants.js`, `detectScheduleConflict.js`, `sortWorkersBySurname.js`) are
small, framework-free, pure-function modules with zero interdependencies
among each other and zero Supabase/TanStack usage — the lowest-risk group in
this change, converted together in Phase 2.

**9. Should import extensions be dropped where TypeScript requires it?**
**Yes, following the exact precedent from the PDF exporters migration**: an
explicit `.ts`/`.tsx` extension in an import specifier is rejected by `tsc`
(`TS5097`) once the *importing* file itself becomes type-checked, unless
`allowImportingTsExtensions` is set (it is not, and this change does not set
it). The audit found this pattern is **not** widespread in this batch:
every one of the 50 active files' callers already uses extension-less
relative imports (confirmed for `Form.jsx`, `RoleGate.jsx`, `DarkModeToggle.jsx`,
`AppLayout.jsx`, `WorkerAppLayout.jsx`, `useOutsideClick.js`, and all
service/hook/component pairs within this batch). The **only** place explicit
extensions are hardcoded is the 16 Montserrat `.js` dynamic-import call
sites — moot, since Decision 1 keeps those files as `.js` (`.js` extensions
are always permitted, no `TS5097` risk).

**10. What is the final target?**
**Zero active untyped application JS/JSX source files.** After this change:
`find src -type f \( -name "*.js" -o -name "*.jsx" \)` returns exactly the 4
Montserrat font files and nothing else — every other file in `src/` is
`.ts`/`.tsx`. The 5 dead files are removed entirely (not "remaining," not
converted).

**11. (Additional finding, not in the original 10) What to do with the 2
newly-discovered dead authentication forms?**
**Delete**, same as Decision 2's schedule files, and for an even clearer
reason:
- `src/features/authentication/UpdatePasswordForm.jsx` and
  `src/features/authentication/UpdateUserDataForm.jsx` — zero importers
  anywhere in `src/` (confirmed via full-tree grep). Both import
  `useUpdateUser` from a `./useUpdateUser` module that **does not exist
  anywhere in this codebase** (confirmed via grep — the only two files ever
  mentioning `useUpdateUser` are these two forms themselves). Both also use
  bare, non-relative, non-aliased import specifiers (`'ui/Button'`,
  `'ui/Form'`, `'features/authentication/useUser'`, etc.) with no
  `baseUrl`/path-alias configuration anywhere in this repo (`vite.config.*`,
  `tsconfig.json` — neither configures one), so these imports would fail to
  resolve even if the files were ever reached. This is leftover boilerplate
  from the original template this app was built from ("The Wild Oasis"
  course project), never wired into this app's real auth flow (which uses
  `useSetPassword.js` + the already-converted `SetPassword.tsx` instead).
  Raises the total dead-file count in this batch from 3 to 5.

## File Inventory (grouped by domain)

### Active — Context/hooks/entry/styles/UI shell (10 files)
| File | Notes |
|---|---|
| `src/main.jsx` | Entry point; deps already `.tsx` |
| `src/context/DarkModeContext.jsx` | Provider + `useDarkMode`; depends on `useLocalStorageState` |
| `src/hooks/useLocalStorageState.js` | Generic localStorage-synced state hook |
| `src/hooks/useOutsideClick.js` | Ref + outside-click hook; used by already-converted `Menus.tsx`/`Modal.tsx` |
| `src/styles/GlobalStyles.js` | `createGlobalStyle` CSS reset, no logic |
| `src/ui/AppLayout.jsx` | Staff shell layout; only referenced via lazy dynamic import in `App.tsx` |
| `src/ui/WorkerAppLayout.jsx` | Worker shell layout; only referenced via lazy dynamic import in `App.tsx` |
| `src/ui/DarkModeToggle.jsx` | Toggle button; depends on `DarkModeContext` |
| `src/ui/Form.jsx` | Shared `<form>` primitive; widest fan-out of any file in this batch (9+ callers, all extension-less) |
| `src/ui/RoleGate.jsx` | Route guard; depends on `useProfile` |

### Active — Helpers (5 files)
`calculateSemesterGroup.js`, `capitalizeFirstLetter.js`, `constants.js`,
`detectScheduleConflict.js`, `sortWorkersBySurname.js` — all pure,
framework-free, zero interdependencies.

### Active — Services (15 files)
`supabase.js` (client factory) + 14 `api*.js` files: `apiAuth`, `apiDegrees`,
`apiGroups`, `apiProfiles`, `apiRoles`, `apiScheduleAssignments`,
`apiScheduleTeachers`, `apiSemesters`, `apiStateRoles`, `apiStudyPrograms`,
`apiSubjects`, `apiUtilities`, `apiWorkerDocuments`, `apiWorkers`. All import
only `supabase.js` (in-list) plus, in the case of `apiWorkerDocuments.js`/
`apiWorkers.js`, no other in-list files — no interdependencies among the 14.

### Active — Authentication (10 files, excludes the 2 dead forms)
`LoginForm.jsx`, `Logout.jsx`, `useCreateWorkerAccount.js`,
`useLinkWorkerAccount.js`, `useLogin.js`, `useLogout.js`, `useProfile.js`,
`useResendWorkerAccessLink.js`, `useSetPassword.js`, `useUser.js`.

### Active — stateRoles + otherData (10 files)
`CreateEditStateRoleForm.jsx`, `StateRoleRow.jsx`, `StateRoleTable.jsx`,
`useEditStateRole.js`, `useStateRoles.js`, `CreateEditOtherForm.jsx`,
`OtherRow.jsx`, `OtherTable.jsx`, `useEditUtilities.js`, `useUtilities.js` —
two structurally-identical CRUD-table feature pairs (`otherData` maps to the
`utilities` Supabase table; there is no `other_data` table).

### Generated/static — Font assets (4 files, left as `.js`)
`Montserrat-Bold-bold.js`, `Montserrat-BoldItalic-bolditalic.js`,
`Montserrat-Italic-italic.js`, `Montserrat-Regular-normal.js` — see Closed
Decision 1.

### Dead/orphaned — deleted, not converted (5 files)
`CreateScholarSchedule.jsx`, `EditScholarSchedule.jsx`,
`RowTeacherAssignment.jsx`, `UpdatePasswordForm.jsx`, `UpdateUserDataForm.jsx`
— see Closed Decisions 2 and 11.

## Active vs Generated/Static vs Orphaned Classification

```
59 files total
├── 50 Active        → convert to .ts/.tsx (this change's main work)
├── 4  Generated      → leave as .js (Decision 1)
└── 5  Dead/orphaned  → delete (Decisions 2, 11) — all 5 were already part
                          of the original 59-file inventory; 2 of them
                          (the authentication forms) just weren't
                          previously known to be dead until this audit
```

## Exact Target Files

**Convert (50):**
```
src/main.jsx
src/context/DarkModeContext.jsx
src/hooks/useLocalStorageState.js
src/hooks/useOutsideClick.js
src/styles/GlobalStyles.js
src/ui/AppLayout.jsx
src/ui/WorkerAppLayout.jsx
src/ui/DarkModeToggle.jsx
src/ui/Form.jsx
src/ui/RoleGate.jsx
src/helpers/calculateSemesterGroup.js
src/helpers/capitalizeFirstLetter.js
src/helpers/constants.js
src/helpers/detectScheduleConflict.js
src/helpers/sortWorkersBySurname.js
src/services/supabase.js
src/services/apiAuth.js
src/services/apiDegrees.js
src/services/apiGroups.js
src/services/apiProfiles.js
src/services/apiRoles.js
src/services/apiScheduleAssignments.js
src/services/apiScheduleTeachers.js
src/services/apiSemesters.js
src/services/apiStateRoles.js
src/services/apiStudyPrograms.js
src/services/apiSubjects.js
src/services/apiUtilities.js
src/services/apiWorkerDocuments.js
src/services/apiWorkers.js
src/features/authentication/LoginForm.jsx
src/features/authentication/Logout.jsx
src/features/authentication/useCreateWorkerAccount.js
src/features/authentication/useLinkWorkerAccount.js
src/features/authentication/useLogin.js
src/features/authentication/useLogout.js
src/features/authentication/useProfile.js
src/features/authentication/useResendWorkerAccessLink.js
src/features/authentication/useSetPassword.js
src/features/authentication/useUser.js
src/features/stateRoles/CreateEditStateRoleForm.jsx
src/features/stateRoles/StateRoleRow.jsx
src/features/stateRoles/StateRoleTable.jsx
src/features/stateRoles/useEditStateRole.js
src/features/stateRoles/useStateRoles.js
src/features/otherData/CreateEditOtherForm.jsx
src/features/otherData/OtherRow.jsx
src/features/otherData/OtherTable.jsx
src/features/otherData/useEditUtilities.js
src/features/otherData/useUtilities.js
```

**Delete (5):**
```
src/features/schedules/CreateScholarSchedule.jsx
src/features/schedules/EditScholarSchedule.jsx
src/features/schedules/RowTeacherAssignment.jsx
src/features/authentication/UpdatePasswordForm.jsx
src/features/authentication/UpdateUserDataForm.jsx
```

**Leave as `.js` (4):**
```
src/styles/Montserrat-Bold-bold.js
src/styles/Montserrat-BoldItalic-bolditalic.js
src/styles/Montserrat-Italic-italic.js
src/styles/Montserrat-Regular-normal.js
```

## Files Explicitly Out of Scope

- `src/pdf/**` (already fully converted in the prior `stabilize-and-convert-pdf-exporters` change).
- `src/features/schedules/**` other than the 3 dead files listed above
  (already converted).
- `src/features/workers/**` (already converted).
- `src/services/apiWorkers.js`'s and `apiScheduleAssignments.js`'s noted
  pre-existing rough edges (see Non-Goals) — flagged, not fixed.
- `supabase/**`, `src/types/supabase.ts`, `package.json`, `tsconfig.json`,
  `eslint.config.js` — no changes.

## Risk Analysis

- **Highest risk: authentication group.** `RoleGate.jsx`, `useProfile.js`,
  `useUser.js`, `LoginForm.jsx`, `Logout.jsx`, and the mutation hooks gate
  every route in the app. A mistake here could lock out or misroute every
  user. Mitigated by: converting this group as one cohesive phase (Decision
  4), preserving exact redirect targets, and requiring manual smoke checks
  of login/logout/redirect behavior before this phase is considered done.
- **Medium risk: `apiWorkerDocuments.js`/`apiWorkers.js` typing complexity.**
  These are the two largest, most option-heavy services. Mitigated by
  reusing `src/types/supabase.ts`'s `Database` types throughout and by not
  attempting to "fix" the two noted pre-existing rough edges (out of scope,
  Non-Goals).
- **Medium risk: the 5 file deletions.** Deletion is the only
  irreversible-without-git-history action in this change. Mitigated by: each
  deletion is (a) independently re-confirmed zero-importer immediately
  before deletion (Phase 6), (b) an individually-authorized `tasks.md` task
  (never a blanket "delete orphaned files" task), and (c) fully reversible
  via git history regardless.
- **Low risk: helpers, context/hooks/UI shell, stateRoles/otherData.** Small,
  well-understood, already-precedented conversions matching patterns used
  throughout every prior phase of this migration.
- **Low risk: font files.** Not converted (Decision 1) — zero risk
  introduced.

## Phase Breakdown

See `tasks.md` for the authoritative, checkbox-tracked phase list. Summary:
- **Phase 0**: Inventory/importer audit and decision confirmation (this
  document's own research, re-verified against the live tree before
  implementation begins).
- **Phase 1**: Entry/context/hooks/styles/UI shell (10 files).
- **Phase 2**: Helpers (5 files).
- **Phase 3**: Services (15 files, one phase per Decision 3).
- **Phase 4**: Authentication — the 10 live files only, per Decision 4.
- **Phase 5**: stateRoles + otherData (10 files).
- **Phase 6**: Dead-file disposition — re-confirm and delete all 5 files
  (3 orphaned schedules + 2 dead auth forms), per Decisions 2 and 11.
- **Phase 7**: Generated font asset decision — no conversion (Decision 1);
  this phase only records that the decision was reviewed and stands.
- **Phase 8**: Final verification and full manual smoke pass.

## Verification Plan

After each phase:
- `bun run typecheck`
- `bun run build`
- `bun run lint` (report exact before/after counts)
- Grep for any remaining explicit reference to a file renamed in that phase.

After all phases:
- `bunx @fission-ai/openspec validate finish-js-to-ts-migration --type change --strict`
- `find src -type f \( -name "*.js" -o -name "*.jsx" \) | sort` — expect
  exactly the 4 Montserrat files.
- Full manual smoke pass (see below).

## Manual Smoke-Check Plan

Using the running dev app against local Supabase:
1. **Login/logout**: log in with a valid account, confirm redirect to the
   correct route for that role; log out, confirm return to `/login`.
2. **Password set/recovery**: exercise `/set-password` with a valid
   invite/recovery link (or confirm the "invalid/expired" state renders
   correctly with no link).
3. **Worker account linking**: from a worker row, trigger "create account"
   and "resend access link," confirm the expected toast/error messaging.
4. **Role-based redirect**: confirm a worker-role session redirects away
   from a staff route to `/my-documents`, and a no-profile session lands on
   `/pending-access`.
5. **Dark mode toggle**: toggle dark mode, reload the page, confirm the
   preference persisted.
6. **State roles / Other data CRUD**: create/edit one row in each of the
   State Roles and Others (utilities) tables, confirm the table refreshes
   correctly.
7. **PDF exporters unaffected**: generate at least one PDF (e.g.
   `ScheduleGroupPDF`) to confirm the Montserrat font files (left as `.js`)
   still load correctly with no import errors.
8. Record pass/fail per item in `tasks.md`'s Verification Results, matching
   the documentation style used throughout this migration's prior changes.

## Rollback / Cancel Criteria

- If any phase's `bun run build` or `bun run typecheck` fails and cannot be
  resolved without touching an out-of-scope file (services behavior,
  generated types, config), halt and re-scope rather than expanding this
  change's boundaries without approval.
- If Phase 6's immediate-pre-deletion re-confirmation finds a live importer
  for any of the 5 files that this document's research missed, halt that
  file's deletion, convert it instead (or defer it, matching this
  migration's established fallback), and document the discrepancy.
- If manual verification reveals any authentication or redirect behavior
  changed, halt and revert that phase's conversion rather than proceeding.
