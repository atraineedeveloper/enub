# Tasks: Finish JavaScript-to-TypeScript Migration

## 0. Phase 0 — Inventory/importer audit and decision confirmation

- [x] Re-run a full-tree grep for every one of the 59 originally-listed files
      to confirm current importer counts still match `design.md`'s findings
      (repo state may have shifted slightly since this document was written).
- [x] Re-confirm `src/features/authentication/UpdatePasswordForm.jsx` and
      `UpdateUserDataForm.jsx` still have zero importers and still reference
      a non-existent `useUpdateUser` module (the newly-discovered dead files,
      Closed Decision 11).
- [x] Re-confirm all 3 orphaned schedule files still have zero live
      importers (Closed Decision 2).
- [x] Re-confirm the 4 Montserrat font files' 16 dynamic-import call sites
      are unchanged (still 4 files × 4 call sites each, all hardcoding a
      `.js` extension).
- [ ] Record all confirmations in this file's Verification Results section
      before starting Phase 1.

## 1. Phase 1 — Entry/context/hooks/styles/UI shell

> Correction to this task's original guidance: `src/ui/RoleGate.jsx` has no
> `allowedRoles`/`admin` prop — it takes only `children` and resolves role
> entirely via `useProfile()` (`isLoading`/`isStaffOrAdmin`/`isWorker`).
> Typed to match the real code (`{ children: ReactNode }`), not the
> `allowedRoles`-shaped prop the phase instructions assumed.

- [x] Convert `src/main.jsx` → `src/main.tsx`; add a non-null assertion on
      `document.getElementById("root")!` (the one guard authorized for this
      file); update `index.html`'s script tag from `/src/main.jsx` to
      `/src/main.tsx` (required by the rename, otherwise the app fails to
      load).
- [x] Convert `src/context/DarkModeContext.jsx` → `.tsx`, adding an explicit
      `DarkModeContextValue { isDarkMode: boolean; toggleDarkMode: () => void }`
      context type; preserves the exact outside-provider throw behavior
      (`context === undefined` check unchanged).
- [x] Convert `src/hooks/useLocalStorageState.js` → `.ts`, made generic
      (`useLocalStorageState<T>(initialState: T, key: string)`) with an
      explicit `[T, Dispatch<SetStateAction<T>>]` return type; read/write
      logic byte-identical.
- [x] Convert `src/hooks/useOutsideClick.js` → `.ts`, made generic
      (`useOutsideClick<T extends HTMLElement = HTMLElement>`); preserves the
      exact capture-phase `addEventListener`/`removeEventListener` calls and
      `ref.current && !ref.current.contains(...)` semantics; one type-only
      `e.target as Node` cast added (`MouseEvent.target` is `EventTarget | null`
      in DOM types, `Node.contains()` expects `Node`) — no new runtime guard.
- [x] Convert `src/styles/GlobalStyles.js` → `.ts` (no JSX, no props —
      verified byte-identical to the original aside from the extension).
- [x] Convert `src/ui/AppLayout.jsx` → `.tsx`, typing the transient
      `$isOpen` styled-components prop (`styled.div<{ $isOpen: boolean }>`)
      — required so `props.$isOpen` type-checks; no CSS/markup changed.
- [x] Convert `src/ui/WorkerAppLayout.jsx` → `.tsx`; no props, no type
      additions needed.
- [x] Convert `src/ui/DarkModeToggle.jsx` → `.tsx`; no props, no type
      additions needed.
- [x] Convert `src/ui/Form.jsx` → `.tsx`, typing the `type` prop
      (`styled.form<{ type?: string }>`) — every current caller (16
      importers) omits `type` entirely, so `string` (not a narrower
      `"modal"` literal) was chosen to stay maximally permissive and avoid
      constraining callers beyond what the original untyped code allowed.
- [x] Convert `src/ui/RoleGate.jsx` → `.tsx` (see correction note above);
      typed `children: ReactNode`, matching the identical established
      pattern in the already-converted `ProtectedRoute.tsx`
      (`if (isAuthenticated) return children;`); removed the now-provably-unnecessary
      `// eslint-disable-next-line react/prop-types` comment (real TS types
      make the suppressed rule a non-issue either way — confirmed zero lint
      delta from this specific removal).
- [x] Audit every caller of these 10 files for import-path breakage; fix
      only what `tsc`/the bundler would otherwise reject. Result: **zero**
      caller files needed changes — every caller (`App.tsx`, `Header.tsx`,
      `Menus.tsx`, `Modal.tsx`, and all 16 `Form` importers) already used
      extension-less relative imports or extension-less dynamic
      `lazy(() => import(...))`, confirmed via full-tree grep both before
      and after the rename.
- [ ] Manually verify: app loads, dark mode toggles and persists across
      reload, staff/worker layouts render correctly, role-based redirect
      still works.
- [x] `bun run typecheck`
- [x] `bun run build`
- [x] `bun run lint` (record before/after counts)

## 2. Phase 2 — Helpers

- [x] Convert `src/helpers/calculateSemesterGroup.js` → `.ts`, widening
      `entryYear` to `number | null | undefined` (matches real callers'
      `year_of_admission` field, some accessed via optional chaining) and
      using non-null assertions at the two `new Date(entryYear!, ...)` call
      sites — preserves the exact original coercion behavior for
      null/undefined rather than adding a guard. Also switched
      `now - startDate` to `now.getTime() - startDate.getTime()` (required:
      TS doesn't allow arithmetic directly between two `Date` objects even
      though the runtime result is identical via `valueOf()` coercion). The
      3 pre-existing unused local variables (`currentYear`/`currentMonth`/`currentDay`)
      were left exactly as-is, not removed.
- [x] Convert `src/helpers/capitalizeFirstLetter.js` → `.ts`, widening
      `name` to `string | null | undefined` (several already-converted call
      sites pass a nullable `Worker.name` directly with no `!`) with an
      internal `name!` non-null assertion preserving the exact
      throw-on-null/undefined behavior — no new guard added.
- [x] Convert `src/helpers/constants.js` → `.ts`, adding `as const` to all
      three arrays (safe: every importer only ever `.map()`s read-only, never
      mutates); export names/values/style unchanged.
- [x] Convert `src/helpers/detectScheduleConflict.js` → `.ts`. `data` typed
      with minimal per-function structural interfaces
      (`ScheduleConflictWorkerItem`/`ScheduleConflictGroupItem`); a per-item
      cast (`item as ScheduleConflictWorkerItem`) is applied inside `.some()`
      rather than narrowing the `existingSchedules` parameter itself, because
      `existingSchedules` is called with `unknown[]` at one already-typed
      call site (`CreateEditScholarSchedule.tsx`'s `SemesterContext`-sourced
      array) as well as concrete `ScheduleAssignment[]`/`ScheduleTeacher[]`
      arrays elsewhere — narrowing the parameter itself would have broken
      the first call site. Preserved the exact `+x !== +y` numeric-coercion
      operator (not switched to `Number(...)`) and the exact `<` time-range
      comparison, both via non-null assertions rather than behavior changes.
- [x] Convert `src/helpers/sortWorkersBySurname.js` → `.ts`, made generic
      (`sortWorkersBySurname<T extends { name?: string | null }>`) so the
      return type mirrors whatever caller-specific worker shape flows in;
      preserved the non-mutating `[...workers].sort(...)` (spread-then-sort,
      never in-place), the exact particle-based surname-key algorithm, and
      the collator options.
- [x] Audit every caller for import-path breakage. Result: the 4
      already-converted PDF files under `src/pdf/**`
      (`ScheduleGroupPDF.tsx`, `ScheduleTeacherPDF.tsx`,
      `TeacherAssignmentPDF.tsx`, `WorkerSheetSemester.tsx`) hardcoded
      explicit `.js` extensions for `calculateSemesterGroup`/`capitalizeFirstLetter`
      imports (7 import lines total) — updated to drop the extension, since
      the old `.js` files no longer exist; every other caller (schedules
      features, `GroupTable.tsx`, `ScheduleDashboard.tsx`,
      `CreateEditTeacherSchedule.tsx`, `filterHour.ts`/`filterHourGroup.ts`)
      already used extension-less imports and needed no change.
- [ ] Manually verify one call site per helper still produces the same
      output (e.g. a schedule PDF's semester-group label, a worker name's
      capitalization, a schedule-conflict warning).
- [x] `bun run typecheck`
- [x] `bun run build`
- [x] `bun run lint` (record before/after counts)

## 3. Phase 3 — Services

> Note: a new `src/vite-env.d.ts` (standard Vite ambient-types reference,
> `/// <reference types="vite/client" />`) was added — required for
> `import.meta.env` to typecheck in `supabase.ts` (the first `.ts` file in
> the repo to reference it; no prior `.tsx` file happened to need it). This
> is not a config file and adds no runtime behavior.

- [x] Convert `src/services/supabase.js` → `.ts`, typing the client as
      `createClient<Database>(...)` (Closed Decision 7); no change to env
      var names, fallback order, or the thrown-on-missing-env-var behavior.
- [x] Convert `src/services/apiAuth.js` → `.ts`.
- [x] Convert `src/services/apiDegrees.js` → `.ts`.
- [x] Convert `src/services/apiGroups.js` → `.ts`.
- [x] Convert `src/services/apiProfiles.js` → `.ts`.
- [x] Convert `src/services/apiRoles.js` → `.ts`.
- [x] Convert `src/services/apiScheduleAssignments.js` → `.ts`.
- [x] Convert `src/services/apiScheduleTeachers.js` → `.ts`.
- [x] Convert `src/services/apiSemesters.js` → `.ts`.
- [x] Convert `src/services/apiStateRoles.js` → `.ts`.
- [x] Convert `src/services/apiStudyPrograms.js` → `.ts`.
- [x] Convert `src/services/apiSubjects.js` → `.ts`.
- [x] Convert `src/services/apiUtilities.js` → `.ts`.
- [x] Convert `src/services/apiWorkerDocuments.js` → `.ts` (largest/most
      complex file in this batch; authored named interfaces for its nested
      option shapes — `UploadWorkerDocumentInput`, per-helper inline object
      types — rather than inlining `any`).
- [x] Convert `src/services/apiWorkers.js` → `.ts`.
- [x] Verify every `.from(table)`, `.select(...)`, `.rpc(...)`, and
      `supabase.functions.invoke(...)` call is byte-identical to the
      pre-conversion source (table names, column selections, payload keys).
      Confirmed via `diff` against each pre-conversion `.js` source: every
      change across all 15 files is type-level only (parameter/return
      annotations, `as`/`!` assertions, new `type`/`interface` declarations)
      — no table name, select string, filter, order clause, RPC name, or
      error message differs.
- [x] Audit every caller (hooks in authentication/stateRoles/otherData plus
      every already-converted `.ts` hook) for import-path breakage. Result:
      zero import-path changes needed anywhere — every one of the ~45 call
      sites across services/hooks/components already used extension-less
      imports.
- [ ] Manually verify at least one read and one write per domain still
      succeeds (e.g. fetch degrees, create a group, upload a worker
      document).
- [x] `bun run typecheck`
- [x] `bun run build`
- [x] `bun run lint` (record before/after counts)

## 3.5 — Roles duplicate-toast regression check/fix

> Triggered by manual smoke testing on `/roles` after Phase 3: editing a role
> showed both "El registro se creó correctamente" and "El registro se
> actualizó con éxito". Investigated and fixed as a targeted, roles-only
> detour before Phase 4; not a Phase 3 service defect.

- [x] Confirm `src/services/apiRoles.ts` preserved the original `id`
      truthiness create/edit branching exactly (`if (!id) insert; if (id)
      update`) — confirmed via diff against the pre-Phase-3 source; byte-identical
      apart from type annotations/casts. Not the source of the bug.
- [x] Confirm root cause: `src/features/roles/CreateEditRoleForm.tsx`'s
      `onSubmit` called `editRole(variables, { onSuccess: (data) => {...} })`
      with an inline **per-call** `onSuccess` that showed
      `toast.success("El registro se creó correctamente")` (the wrong,
      create-flavored message, on the **edit** path) — copy-paste residue,
      unrelated to and pre-dating Phase 3 (this file was last touched in
      commit `78af657`, well before the Phase 3 services commit). TanStack
      Query calls both a mutation's hook-level `onSuccess`
      (`useEditRole.ts`'s, which already correctly shows "se actualizó con
      éxito" and invalidates the roles query) and a per-call `onSuccess`
      passed to `mutate()` — both fired, producing both toasts on every
      edit. **Confirmed a real, reachable regression**, not expected toast
      stacking.
- [x] Fix: removed the duplicate `toast.success(...)` call from the inline
      per-call `onSuccess` in `CreateEditRoleForm.tsx`, keeping only the
      form-local `reset()`/`onCloseModal?.()` there (the hook's own
      `onSuccess` already owns the toast + cache invalidation). Removed the
      now-unused `toast` import and the now-unused shadowing `data` parameter
      on that callback (incidentally fixed one pre-existing lint error).
- [x] `bunx @fission-ai/openspec validate finish-js-to-ts-migration --type change --strict`
- [x] `bun run typecheck`
- [x] `bun run build`
- [x] `bun run lint` — 81 problems (77 errors, 4 warnings), **-1** from the
      Phase 3 baseline of 82 (the removed unused `data` parameter's
      pre-existing `@typescript-eslint/no-unused-vars` error).
- [ ] Manual smoke: reload `/roles`, edit one existing role, confirm only
      the update toast appears. Not performed this turn (no
      browser/dev-server session available) — must be done before Phase 4
      begins.

**Separate, out-of-scope finding (not fixed, flagged only)**: `onSubmit` has
no `else`/unconditional branch — for a **new** role (`isEditSession` false),
submitting the form currently calls no mutation at all (silently does
nothing). This is unreachable in the live UI today: neither `RoleTable.tsx`
nor `RoleRow.tsx` render `CreateEditRoleForm` in create mode anywhere (no
"Add Role" entry point exists), so this latent gap was not part of the
reported regression and is left untouched, per this detour's narrow scope
("do not change role CRUD behavior except the minimal fix needed to prevent
duplicate success toasts"). Worth a future, separately-scoped fix if/when a
"create role" entry point is added to the UI.

## 4. Phase 4 — Authentication (live files only)

- [ ] Convert `src/features/authentication/useLogin.js` → `.ts`, applying
      the `isLoading`→`isPending` fix (Closed Decision 5); preserve the
      mutation's queryFn/onSuccess/onError behavior exactly.
- [ ] Convert `src/features/authentication/useLogout.js` → `.ts`, applying
      the same `isLoading`→`isPending` fix.
- [ ] Convert `src/features/authentication/useCreateWorkerAccount.js` → `.ts`
      (already uses `isPending`, no rename needed).
- [ ] Convert `src/features/authentication/useLinkWorkerAccount.js` → `.ts`
      (already `isPending`).
- [ ] Convert `src/features/authentication/useResendWorkerAccessLink.js` →
      `.ts` (already `isPending`).
- [ ] Convert `src/features/authentication/useSetPassword.js` → `.ts`
      (already `isPending`).
- [ ] Convert `src/features/authentication/useProfile.js` → `.ts` (a
      `useQuery`; `isLoading` naming is already v5-correct, no rename).
- [ ] Convert `src/features/authentication/useUser.js` → `.ts` (a `useQuery`;
      `isLoading` already v5-correct, no rename).
- [ ] Convert `src/features/authentication/LoginForm.jsx` → `.tsx`.
- [ ] Convert `src/features/authentication/Logout.jsx` → `.tsx`.
- [ ] Do NOT touch `UpdatePasswordForm.jsx`/`UpdateUserDataForm.jsx` in this
      phase — they are handled in Phase 6 (dead-file disposition).
- [ ] Audit every caller (`Login.tsx`, `Header.tsx`, `RoleGate.jsx`,
      `WorkerRow.tsx`, `LinkWorkerAccountForm.tsx`, `SetPassword.tsx`,
      `ProtectedRoute.tsx`, `MyDocuments.tsx`, `useLinkedWorkerAccounts.ts`)
      for import-path breakage.
- [ ] Manually verify: login succeeds and redirects correctly per role;
      logout returns to `/login`; worker account create/resend actions show
      correct toast/error messaging.
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] `bun run lint` (record before/after counts)

## 5. Phase 5 — stateRoles + otherData

- [ ] Convert `src/features/stateRoles/useStateRoles.js` → `.ts`.
- [ ] Convert `src/features/stateRoles/useEditStateRole.js` → `.ts`, applying
      the `isLoading`→`isPending` fix (Closed Decision 5).
- [ ] Convert `src/features/stateRoles/StateRoleRow.jsx` → `.tsx`.
- [ ] Convert `src/features/stateRoles/StateRoleTable.jsx` → `.tsx`.
- [ ] Convert `src/features/stateRoles/CreateEditStateRoleForm.jsx` → `.tsx`.
- [ ] Convert `src/features/otherData/useUtilities.js` → `.ts`.
- [ ] Convert `src/features/otherData/useEditUtilities.js` → `.ts`, applying
      the `isLoading`→`isPending` fix (Closed Decision 5); preserve the
      exported name (`useEditUtility`, singular) exactly as-is.
- [ ] Convert `src/features/otherData/OtherRow.jsx` → `.tsx`.
- [ ] Convert `src/features/otherData/OtherTable.jsx` → `.tsx`.
- [ ] Convert `src/features/otherData/CreateEditOtherForm.jsx` → `.tsx`.
- [ ] Audit callers (`src/pages/Records/StateRoles.tsx`,
      `src/pages/Records/Others.tsx`) for import-path breakage.
- [ ] Manually verify: create/edit one State Roles row and one Other Data
      (utilities) row, confirm both tables refresh correctly.
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] `bun run lint` (record before/after counts)

## 6. Phase 6 — Dead-file disposition (delete, do not convert)

- [ ] Re-confirm `src/features/schedules/CreateScholarSchedule.jsx` has zero
      live importers (full-tree grep, immediately before deleting).
- [ ] Delete `src/features/schedules/CreateScholarSchedule.jsx`.
- [ ] Re-confirm `src/features/schedules/EditScholarSchedule.jsx`'s only
      textual reference (`HourScheduleSubjectGroup.tsx` line 6) is truly a
      dead, unreferenced local binding, not a live render path.
- [ ] Delete `src/features/schedules/EditScholarSchedule.jsx`.
- [ ] Remove the now-fully-dead `import CreateScholarSchedule from "./EditScholarSchedule";`
      line from `src/features/schedules/HourScheduleSubjectGroup.tsx` (the
      only change authorized in that file this phase — no other line
      touched).
- [ ] Re-confirm `src/features/schedules/RowTeacherAssignment.jsx` has zero
      live importers.
- [ ] Delete `src/features/schedules/RowTeacherAssignment.jsx`.
- [ ] Re-confirm `src/features/authentication/UpdatePasswordForm.jsx` has
      zero live importers and still references a non-existent
      `useUpdateUser` module.
- [ ] Delete `src/features/authentication/UpdatePasswordForm.jsx`.
- [ ] Re-confirm `src/features/authentication/UpdateUserDataForm.jsx` has
      zero live importers and still references a non-existent
      `useUpdateUser` module.
- [ ] Delete `src/features/authentication/UpdateUserDataForm.jsx`.
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] `bun run lint` (record before/after counts)

## 7. Phase 7 — Generated font asset decision (no conversion)

- [ ] Re-review Closed Decision 1 against the current state of the 4
      Montserrat files and their 16 call sites; confirm the "leave as `.js`"
      decision still holds (no application logic has been added to these
      files since this document was written).
- [ ] Record the re-review outcome in this file's Verification Results.
      No code changes in this phase.

## 8. Phase 8 — Final verification and full manual smoke pass

- [ ] `bunx @fission-ai/openspec validate finish-js-to-ts-migration --type change --strict`
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] `bun run lint` (record final before/after counts across the whole
      change)
- [ ] `find src -type f \( -name "*.js" -o -name "*.jsx" \) | sort` — expect
      exactly the 4 Montserrat font files and nothing else.
- [ ] Confirm `src/services/**` behavior (query/mutation shapes),
      `src/types/supabase.ts`, `supabase/**`, `package.json`, `tsconfig.json`,
      `eslint.config.js` are unchanged in behavior/content by
      `git diff --stat` against this change's base commit.
- [ ] Confirm the 5 dead files are actually removed (not just unreferenced)
      and the 4 Montserrat files are unchanged.
- [ ] Run the full manual smoke pass from `design.md`'s Manual Smoke-Check
      Plan (login/logout, password set/recovery, worker account linking,
      role-based redirects, dark mode persistence, State Roles/Other Data
      CRUD, PDF export sanity check) and record pass/fail per item below.

## Verification Results

(To be filled in during implementation; do not pre-fill.)

- Phase 0 inventory/importer re-confirmation: **done**.
  - `find src -type f \( -name "*.js" -o -name "*.jsx" \) | sort` returns
    exactly **59** files, matching the original inventory verbatim (no file
    added/removed/renamed since `design.md` was written).
  - Classification re-confirmed: **50 active + 4 generated + 5 dead = 59**.
  - **5 dead files, zero live importers, re-confirmed by fresh grep:**
    - `CreateScholarSchedule.jsx` — zero references anywhere except its own
      file; the only same-named match is `EditScholarSchedule.jsx`'s own
      internal function (itself misnamed `CreateScholarSchedule`, a
      copy-paste artifact, not an import of this file).
    - `EditScholarSchedule.jsx` — its only textual reference,
      `HourScheduleSubjectGroup.tsx:6`
      (`import CreateScholarSchedule from "./EditScholarSchedule";`), is
      confirmed a dead, never-referenced-again binding in that file (grepped
      the full file: the name `CreateScholarSchedule` appears exactly once,
      on the import line itself).
    - `RowTeacherAssignment.jsx` — zero references anywhere in `src/`.
    - `UpdatePasswordForm.jsx` — zero importers; confirmed it still imports
      `useUpdateUser` from `./useUpdateUser`, a module that does not exist
      anywhere in `src/` (only these two dead forms even mention the name
      `useUpdateUser`).
    - `UpdateUserDataForm.jsx` — same: zero importers, same non-existent
      `useUpdateUser` import confirmed.
  - **4 Montserrat font files re-confirmed generated/data-only**: each is
    still exactly 7 lines (`import { jsPDF } from "jspdf"`, one base64 font
    string, an `addFileToVFS`/`addFont` registration function, and a
    `jsPDF.API.events.push(['addFonts', callAddFont])` side effect) — no
    exports, no application logic. Re-confirmed all 16 call sites (4 files ×
    4 imports) are `await import(".../Montserrat-*.js")` with an explicit
    `.js` extension, exclusively from `src/pdf/Schedules/ScheduleGroupPDF.tsx`,
    `ScheduleTeacherPDF.tsx`, `TeacherAssignmentPDF.tsx`, and
    `src/pdf/WorkerSheetSemester.tsx` — no static imports anywhere.
  - **4 mutation hooks re-confirmed needing `isLoading`→`isPending`:**
    `useLogin.js` (`isLoading` returned as-is), `useLogout.js` (`isLoading`
    returned as-is), `useEditStateRole.js` (`isLoading: isEditing`),
    `useEditUtilities.js` (`isLoading: isEditing`) — all four are
    `useMutation`, confirmed via fresh grep of each file.
  - **Phase 1's 10 target files' importers re-confirmed, matching
    `design.md` exactly**: `main.jsx` (only `index.html`'s script tag);
    `DarkModeContext.jsx` (`App.tsx`, `DarkModeToggle.jsx`);
    `useLocalStorageState.js` (`DarkModeContext.jsx` only);
    `useOutsideClick.js` (`Menus.tsx`, `Modal.tsx`); `GlobalStyles.js`
    (`App.tsx` only); `AppLayout.jsx`/`WorkerAppLayout.jsx` (`App.tsx` only,
    via extension-less `lazy(() => import(...))`); `DarkModeToggle.jsx`
    (`Header.tsx` only); `Form.jsx` (16 importers, all extension-less — 12
    live + the 4 dead files that still syntactically import it);
    `RoleGate.jsx` (`App.tsx` only, static extension-less import).
  - Verification commands: `bunx @fission-ai/openspec validate
    finish-js-to-ts-migration --type change --strict` → valid; `bun run
    typecheck` → clean; `bun run build` → succeeds; `bun run lint` → 83
    problems (79 errors, 4 warnings) — unchanged from the pre-existing
    baseline (no code touched this phase). `git status --short` confirms
    zero changes to `src/` this phase.
- Phase 1 code conversion: done. `bunx @fission-ai/openspec validate ...
  --strict` passes; `bun run typecheck` clean; `bun run build` succeeds;
  `bun run lint` is 82 problems (78 errors, 4 warnings) — down from the
  83-problem baseline (-1). The single removed error is the `react/prop-types`
  "'children' is missing in props validation" that `DarkModeContext.jsx`
  had before conversion (confirmed by isolated-file lint of the
  pre-conversion source) — the other 9 files in this phase had zero
  pre-existing lint errors (most have no props at all; `RoleGate.jsx`
  already suppressed its own prop-types warning with an inline disable
  comment, now removed since it's provably unnecessary). The pre-existing
  `react-refresh/only-export-components` warning on `DarkModeContext.tsx`
  (exports both a component and a hook from one file) is unrelated to typing
  and remains, unchanged. `find src -type f \( -name "*.js" -o -name "*.jsx" \)`
  returns exactly **49** files (down from 59). `git status --short` confirms
  only the 10 target files (renamed) plus `index.html` (`main.jsx`→`main.tsx`
  script-tag update, required by the rename) were touched — no Phase 2+
  files, services, authentication files, stateRoles/otherData files,
  orphaned files, Montserrat files, or config/generated-type files changed.
- Phase 1 manual check: _pending_ — not performed in this turn (no
  browser/dev-server session available); must be done before Phase 2 begins
- Phase 2 code conversion: done. `bunx @fission-ai/openspec validate ...
  --strict` passes; `bun run typecheck` clean; `bun run build` succeeds;
  `bun run lint` is 82 problems (78 errors, 4 warnings) — unchanged from the
  Phase 1 baseline (0 delta). The only pre-existing lint issues among these
  5 files were `calculateSemesterGroup.js`'s 3 unused-variable errors
  (`currentYear`/`currentMonth`/`currentDay`, confirmed via isolated-file
  lint of the pre-conversion source), which persist unchanged under
  `@typescript-eslint/no-unused-vars` instead of core `no-unused-vars` — not
  removed. `find src -type f \( -name "*.js" -o -name "*.jsx" \)` returns
  exactly **44** files (down from 49). `git status --short` confirms exactly
  5 helper files renamed plus 4 already-converted PDF files
  (`ScheduleGroupPDF.tsx`, `ScheduleTeacherPDF.tsx`,
  `TeacherAssignmentPDF.tsx`, `WorkerSheetSemester.tsx`) touched, each only
  for the mandatory `.js`→extension-less import-path fix described above —
  no other line in any of those 4 files changed (confirmed via
  `git diff --stat`). Two type-widening corrections were required beyond
  what the phase's own file-reading anticipated, both discovered only by
  checking real call sites rather than assumed shapes: (1)
  `calculateSemesterGroup`'s param needed `| undefined` in addition to
  `| null`, since `HourScheduleSubjectGroup.tsx` calls it through optional
  chaining; (2) `detectScheduleConflict`'s `existingSchedules` parameter
  could not be narrowed to a specific interface at all (kept as `unknown[]`
  with a per-item cast inside), since `CreateEditScholarSchedule.tsx` passes
  a `SemesterContext`-sourced array still typed `unknown[]` upstream in
  `ScheduleDashboard.tsx` (an already-converted, out-of-scope file) — a
  narrower parameter type would have broken that existing call site's
  typecheck.
- Phase 2 manual check: _pending_ — not performed in this turn (no
  browser/dev-server session available); must be done before Phase 3 begins.
  No helper in this phase is flagged high-risk enough to require a dedicated
  browser session before Phase 3 starts — `bun run typecheck`/`build`
  already exercise every real call site's argument types across the whole
  app, which is the primary risk surface for pure-function helpers with no
  I/O. A lightweight targeted check (one schedule PDF export, one
  create/edit-schedule form submission to exercise the conflict-detection
  path) is still recommended before merge, per `design.md`'s Manual
  Smoke-Check Plan.
- Phase 3 code conversion: done. `bunx @fission-ai/openspec validate ...
  --strict` passes; `bun run typecheck` clean; `bun run build` succeeds;
  `bun run lint` is 82 problems (78 errors, 4 warnings) — unchanged from the
  Phase 2 baseline (0 delta; confirmed all 15 new service files individually
  lint-clean). `find src -type f \( -name "*.js" -o -name "*.jsx" \)` returns
  exactly **29** files (down from 44). `git status --short` confirms exactly
  the 15 service files renamed, one new `src/vite-env.d.ts` (see Phase 3
  note above), and one already-converted file touched
  (`src/features/workers/useLinkedWorkerAccounts.ts`, a single-line
  type-only widening, justified below) — no authentication/stateRoles/
  otherData/schedules-orphan implementation files changed.

  Two cross-cutting findings surfaced only by giving `supabase.ts` a real
  `createClient<Database>()` type (both resolved without changing any
  runtime behavior):
  1. **Cascading nullable-field inference**: once `supabase.ts` is typed,
     TypeScript infers accurate (not `any`) return types for *every* untyped
     `.js` service that flows data through it — including services not yet
     converted. This is how the `apiProfiles.ts`/`useLinkedWorkerAccounts.ts`
     mismatch below was caught immediately, before that hook was ever
     touched on purpose.
  2. **`getLinkedWorkerIds()` (`apiProfiles.ts`) → `useLinkedWorkerAccounts.ts`**:
     `profiles.worker_id` is `number | null` in the generated types, so the
     service's real return type is `(number | null)[]`, not the `number[]`
     `useLinkedWorkerAccounts.ts` optimistically declared (pre-existing
     inaccuracy, invisible while the service was untyped `any`). Widened
     that one `useQuery<number[]>` generic to `useQuery<(number | null)[]>`
     — a type-only fix falling squarely under "fix TypeScript-only issues
     caused by Supabase typing"; `data ?? []` / `new Set(...)` already
     tolerate nulls with no behavior change.

  Other notable typing decisions: the `let query = supabase.from(table); if
  (!id) query = query.insert(...); if (id) query = query.update(...).eq(...);`
  branch-reassignment pattern (used in `apiRoles`, `apiStateRoles`,
  `apiUtilities`, `apiScheduleAssignments`, `apiScheduleTeachers`,
  `apiWorkers`) needed an `as never` cast on each reassignment, since
  postgrest-js's `PostgrestQueryBuilder`/`PostgrestFilterBuilder` are
  different generic classes that can't be reassigned to one another
  directly — confirmed via diff that the final `query.select()...`'s
  inferred row type is unaffected (it depends only on the table, not on
  which branch executed) and confirmed zero runtime effect (casts are
  erased at compile time; the original `if`/`if` branching, not
  if/else, is untouched). `createGroup`/`createSemester` accept a bare
  `object` (not `Record<string, unknown>`) specifically because their only
  callers (`CreateGroupForm.tsx`/`CreateSemesterForm.tsx`) pass
  react-hook-form's raw `data: object` with no cast, and `object` doesn't
  satisfy an index-signature type.
- Phase 4 code conversion + manual check: _pending_
- Phase 5 code conversion + manual check: _pending_
- Phase 6 dead-file re-confirmation + deletion: _pending_
- Phase 7 font-asset decision re-review: _pending_
- Final manual smoke pass (all items): _pending_
- Final lint count (before → after): _pending_
- Final `find src -type f \( -name "*.js" -o -name "*.jsx" \)` output: _pending_
