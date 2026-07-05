# Tasks: Finish JavaScript-to-TypeScript Migration

## 0. Phase 0 — Inventory/importer audit and decision confirmation

- [ ] Re-run a full-tree grep for every one of the 59 originally-listed files
      to confirm current importer counts still match `design.md`'s findings
      (repo state may have shifted slightly since this document was written).
- [ ] Re-confirm `src/features/authentication/UpdatePasswordForm.jsx` and
      `UpdateUserDataForm.jsx` still have zero importers and still reference
      a non-existent `useUpdateUser` module (the newly-discovered dead files,
      Closed Decision 11).
- [ ] Re-confirm all 3 orphaned schedule files still have zero live
      importers (Closed Decision 2).
- [ ] Re-confirm the 4 Montserrat font files' 16 dynamic-import call sites
      are unchanged (still 4 files × 4 call sites each, all hardcoding a
      `.js` extension).
- [ ] Record all confirmations in this file's Verification Results section
      before starting Phase 1.

## 1. Phase 1 — Entry/context/hooks/styles/UI shell

- [ ] Convert `src/main.jsx` → `src/main.tsx`.
- [ ] Convert `src/context/DarkModeContext.jsx` → `.tsx`.
- [ ] Convert `src/hooks/useLocalStorageState.js` → `.ts`.
- [ ] Convert `src/hooks/useOutsideClick.js` → `.ts`.
- [ ] Convert `src/styles/GlobalStyles.js` → `.ts`.
- [ ] Convert `src/ui/AppLayout.jsx` → `.tsx`.
- [ ] Convert `src/ui/WorkerAppLayout.jsx` → `.tsx`.
- [ ] Convert `src/ui/DarkModeToggle.jsx` → `.tsx`.
- [ ] Convert `src/ui/Form.jsx` → `.tsx`.
- [ ] Convert `src/ui/RoleGate.jsx` → `.tsx`.
- [ ] Audit every caller of these 10 files for import-path breakage;
      fix only what `tsc`/the bundler would otherwise reject.
- [ ] Manually verify: app loads, dark mode toggles and persists across
      reload, staff/worker layouts render correctly, role-based redirect
      still works.
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] `bun run lint` (record before/after counts)

## 2. Phase 2 — Helpers

- [ ] Convert `src/helpers/calculateSemesterGroup.js` → `.ts`.
- [ ] Convert `src/helpers/capitalizeFirstLetter.js` → `.ts`.
- [ ] Convert `src/helpers/constants.js` → `.ts`.
- [ ] Convert `src/helpers/detectScheduleConflict.js` → `.ts`.
- [ ] Convert `src/helpers/sortWorkersBySurname.js` → `.ts`.
- [ ] Audit every caller for import-path breakage.
- [ ] Manually verify one call site per helper still produces the same
      output (e.g. a schedule PDF's semester-group label, a worker name's
      capitalization, a schedule-conflict warning).
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] `bun run lint` (record before/after counts)

## 3. Phase 3 — Services

- [ ] Convert `src/services/supabase.js` → `.ts`, typing the client as
      `createClient<Database>(...)` (Closed Decision 7); no change to env
      var names, fallback order, or the thrown-on-missing-env-var behavior.
- [ ] Convert `src/services/apiAuth.js` → `.ts`.
- [ ] Convert `src/services/apiDegrees.js` → `.ts`.
- [ ] Convert `src/services/apiGroups.js` → `.ts`.
- [ ] Convert `src/services/apiProfiles.js` → `.ts`.
- [ ] Convert `src/services/apiRoles.js` → `.ts`.
- [ ] Convert `src/services/apiScheduleAssignments.js` → `.ts`.
- [ ] Convert `src/services/apiScheduleTeachers.js` → `.ts`.
- [ ] Convert `src/services/apiSemesters.js` → `.ts`.
- [ ] Convert `src/services/apiStateRoles.js` → `.ts`.
- [ ] Convert `src/services/apiStudyPrograms.js` → `.ts`.
- [ ] Convert `src/services/apiSubjects.js` → `.ts`.
- [ ] Convert `src/services/apiUtilities.js` → `.ts`.
- [ ] Convert `src/services/apiWorkerDocuments.js` → `.ts` (largest/most
      complex file in this batch; author named interfaces for its nested
      option shapes rather than inlining).
- [ ] Convert `src/services/apiWorkers.js` → `.ts`.
- [ ] Verify every `.from(table)`, `.select(...)`, `.rpc(...)`, and
      `supabase.functions.invoke(...)` call is byte-identical to the
      pre-conversion source (table names, column selections, payload keys).
- [ ] Audit every caller (hooks in authentication/stateRoles/otherData plus
      every already-converted `.ts` hook) for import-path breakage.
- [ ] Manually verify at least one read and one write per domain still
      succeeds (e.g. fetch degrees, create a group, upload a worker
      document).
- [ ] `bun run typecheck`
- [ ] `bun run build`
- [ ] `bun run lint` (record before/after counts)

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

- Phase 0 inventory/importer re-confirmation: _pending_
- Phase 1 code conversion + manual check: _pending_
- Phase 2 code conversion + manual check: _pending_
- Phase 3 code conversion + manual check: _pending_
- Phase 4 code conversion + manual check: _pending_
- Phase 5 code conversion + manual check: _pending_
- Phase 6 dead-file re-confirmation + deletion: _pending_
- Phase 7 font-asset decision re-review: _pending_
- Final manual smoke pass (all items): _pending_
- Final lint count (before → after): _pending_
- Final `find src -type f \( -name "*.js" -o -name "*.jsx" \)` output: _pending_
