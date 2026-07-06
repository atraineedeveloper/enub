# Proposal: Finish JavaScript-to-TypeScript Migration

## Why

This repo has been migrated to TypeScript file-by-file across many prior
OpenSpec changes (workers, documents, schedules, pages, PDF exporters, and
more). 117 `.ts`/`.tsx` files exist today; 59 `.js`/`.jsx` files remain. This
change is the final phase: convert every remaining **active** JS/JSX source
file to TS/TSX, decide explicitly what happens to the handful of files that
are not straightforward "convert as-is" candidates (generated font assets,
confirmed-dead components), and leave the app behaving exactly as it does
today.

A full-repo importer audit (see `design.md`) found that the 59-file count
actually breaks down into three groups, not one — **50 active + 4 generated
+ 5 confirmed-dead = 59**:
- **50 active files** with real render/call paths — the bulk of this change.
- **4 generated jsPDF font-registration files** (`src/styles/Montserrat-*.js`)
  that are pure base64 data + a side-effect registration call, not app logic.
- **5 confirmed-dead files with zero live importers anywhere in `src/`**: the
  3 previously-known orphaned schedule files
  (`CreateScholarSchedule.jsx`, `EditScholarSchedule.jsx`,
  `RowTeacherAssignment.jsx`) plus two authentication forms
  (`UpdatePasswordForm.jsx`, `UpdateUserDataForm.jsx`) newly discovered
  during this audit to be dead — both were already part of the original
  59-file inventory, just not previously known to be unreachable — that
  import a hook (`useUpdateUser`) which does not exist anywhere in the
  codebase and use bare, unaliased import specifiers that would fail to
  resolve if the files were ever reached.

Treating all 59 files as one undifferentiated "convert to TS" bucket would be
wrong: converting dead or generated-data files provides no real type-safety
benefit and either wastes effort (the font files) or risks papering over
already-broken code with new types instead of removing it (the 5 dead
files). This proposal calls out each group explicitly.

This is also the first change in the whole migration with room to reach
**zero active untyped application source files** — a natural, meaningful
stopping point for this multi-change effort.

## What Changes

- Convert all 50 active remaining `.js`/`.jsx` files to `.ts`/`.tsx`,
  preserving exact runtime behavior: same exports, same Supabase
  queries/mutations, same rendered output, same routing/redirect behavior,
  same TanStack Query keys/cache behavior.
- Apply the same, already-established TanStack Query v5 `isLoading` →
  `isPending` mutation-hook fix wherever still present (4 confirmed sites:
  `useLogin.js`, `useLogout.js`, `useEditStateRole.js`, `useEditUtilities.js`),
  matching the fix already applied throughout every prior phase of this
  migration.
- Leave the 4 `src/styles/Montserrat-*.js` files as `.js`, with documented
  rationale (generated jsPDF font-registration data, not application logic;
  see Closed Decision 1 in `design.md`).
- Delete the 5 confirmed-dead files, each backed by a documented,
  independently-verified zero-live-importer finding (see Closed Decisions 2
  and 11 in `design.md`) — not converted, not left in an ambiguous
  "deferred" state, since this change's own research is what confirms they
  are unreachable.
- Audit every import path touched by a rename and fix only what breaks as a
  direct, mechanical consequence of a file being renamed (extension changes,
  including the 16 call sites that explicitly hardcode a `.js` extension when
  dynamically importing the Montserrat files from already-converted PDF
  files, if those files are ever converted in a later phase).
- No new user-facing functionality; no visual, routing, or data-contract
  changes.

## Capabilities

**New Capabilities:**
- `final-typescript-completion` — Covers completing the remaining
  JavaScript-to-TypeScript migration while preserving current app behavior.

**Modified Capabilities:**
(none — no existing user-facing requirements change)

## Impact

- Affected code: 50 active files across `src/context/`, `src/features/authentication/`,
  `src/features/otherData/`, `src/features/stateRoles/`, `src/helpers/`,
  `src/hooks/`, `src/services/`, `src/styles/GlobalStyles.js`, `src/ui/`, and
  `src/main.jsx`.
- Deleted: 5 confirmed-dead files (3 orphaned schedule components, 2 dead
  authentication forms).
- Left as `.js` (documented, not overlooked): 4 Montserrat font-registration
  files.
- No changes to `services/` query/mutation *behavior* (only file
  extension/typing), no Supabase migrations, no generated types, no
  `package.json`/`tsconfig.json`/`eslint.config.js`, no new dependencies.
- No route, redirect, or auth-flow behavior changes — this is the
  highest-scrutiny area of this change given `src/features/authentication/**`
  and `src/ui/RoleGate.jsx` gate access to the whole app.
- Risk is concentrated in: (1) the authentication group, since it governs
  login/logout/password-set/worker-account-linking/session redirects; (2) the
  two largest services (`apiWorkerDocuments.js`, `apiWorkers.js`), which have
  the most complex option shapes; (3) the deletion of 5 files, which is the
  only irreversible-without-git-history action in this change.
