# Proposal: Convert Admin Catalog Features to TS

## Status

Draft — Phase 1 (degrees, subjects), Phase 2 (groups, semesters), and Phase 3
(studyPrograms, roles) all implemented. This is the final phase of the admin catalog
feature-module migration.

## Why

`convert-remaining-shared-ui-to-ts` finished every shared `src/ui/` component. This
change moves one level up: the first real **feature modules** (data fetching +
list/row UI, not just shared presentational components), split into 3 phases inside
one OpenSpec change so each can be reviewed independently. All three phases are now
implemented.

Phase 1 targets `src/features/degrees/*` and `src/features/subjects/*`: the two
simplest catalog features in the app — read-only listings (no create/edit form exists
for either today), one feed each from a single or lightly-joined Supabase query.
Chosen first for the same reason `ErrorMessage` was chosen first for UI components:
lowest blast radius, proves the feature-module conversion pattern (service → hook →
row → table) before tackling anything with mutations.

## What changes (Phase 1)

- `src/features/degrees/DegreeRow.jsx` → `.tsx`: `DegreeRowProps` (`degree: Degree`).
- `src/features/degrees/DegreeTable.jsx` → `.tsx`: no props (root feature component);
  `handleSearch` typed via `ChangeEventHandler<HTMLInputElement>`.
- `src/features/degrees/useDegrees.js` → `.ts`: exports `Degree` (type alias for
  `Database["public"]["Tables"]["degrees"]["Row"]`, reusing the already-generated
  Supabase schema type from `src/types/supabase.ts` rather than hand-rolling a
  parallel interface), and types the hook's `useQuery` call with it.
- `src/features/subjects/SubjectRow.jsx` → `.tsx`: `SubjectRowProps`
  (`subject: Subject`).
- `src/features/subjects/SubjectTable.jsx` → `.tsx`: same shape as `DegreeTable.tsx`.
- `src/features/subjects/useSubjects.js` → `.ts`: exports `Subject` (the generated
  `subjects` Row type, intersected with the two nested relations the query actually
  embeds: nullable singular `study_programs` and `degrees` rows, matching the real
  `.select("*, study_programs(*), degrees(*))")` call in `apiSubjects.js` and the
  nullable FK columns in `src/types/supabase.ts`).

## What does not change

- `src/services/apiDegrees.js`, `src/services/apiSubjects.js`, and
  `src/services/supabase.js` are **not** converted or modified — see `design.md`
  Section 1 for why these are treated as out of Phase 1 scope even though they're the
  data source for these two features.
- `src/hooks/usePagination.js` is not converted — outside `src/features/degrees|subjects/`,
  and not required for a clean typecheck (see `design.md` Section 4 for the one
  accepted, documented typing gap this leaves).
- No other feature module converted. `src/features/groups/*`, `semesters/*`
  (Phase 2), `studyPrograms/*`, `roles/*` (Phase 3) are explicitly deferred.
- No schedules, workers, PDF, page, or out-of-scope service file touched — including
  the several `.jsx` files elsewhere (`CreateGroupForm.jsx`,
  `CreateEditScholarSchedule.jsx`, `EditScholarSchedule.jsx`, `Dashboard.jsx`,
  `ScheduleDashboard.jsx`) that import `useDegrees`/`useSubjects` for dropdown data —
  all import extension-less already, so none need a change, and none are
  type-checked anyway (still `.jsx`).
- No React Query key, `staleTime`, or invalidation behavior changed — `["degrees"]`/
  `["subjects"]` query keys and `staleTime` values are byte-identical.
- No Supabase call changed — `apiDegrees.js`/`apiSubjects.js`'s `select("*")` and
  `select("*, study_programs(*), degrees(*))")` calls are untouched.
- No dependency added; `eslint.config.js`/`tsconfig.json`/`package.json` untouched.

## Impact (Phase 1)

- **Affected code:** 6 files renamed (4 `.jsx` → `.tsx`, 2 `.js` → `.ts`). No other
  file (see `design.md` for the explicit-extension-import grep result).
- **Affected lint baseline:** `react/prop-types` errors disappear for `DegreeRow` (4)
  and `SubjectRow` (12) — 16 total. `DegreeTable`/`SubjectTable` had 0 to begin with
  (no props). `useDegrees`/`useSubjects` had 0 (not React components).

## Why groups/semesters second

Phase 2 introduces the first **mutations** in this migration: both features have a
`Create*Form.jsx` (react-hook-form + `useMutation`), not just a read-only table. Both
also have a nullable-FK embedded relation (`groups` embeds `degrees(*)` via a nullable
`degree_id`), extending the Phase 1 pattern (established there for `subjects`) rather
than introducing a new one.

## What changes (Phase 2)

- `src/features/groups/useGroups.ts` — exports `Group` (generated `groups` Row
  intersected with a nullable embedded `degrees` Row, matching
  `apiGroups.js`'s `select("*, degrees(*)")` and the nullable `degree_id` FK).
  `useQuery<Group[]>`.
- `src/features/groups/GroupRow.tsx` — `GroupRowProps { group: Group }`; non-null
  assertion on `degrees!.code` (existing unconditional dereference, preserved).
- `src/features/groups/GroupTable.tsx` — no props; `handleSearch` typed; non-null
  assertions on `group.year_of_admission!`/`group.letter!` in the filters and on the
  pre-existing `groups!.filter(...)` ternary branch (see `design.md` Section 2).
- `src/features/groups/CreateGroupForm.tsx` — no props; reuses `Degree` from
  `../degrees/useDegrees` for the `degrees.map(...)` dropdown; non-null assertion on
  `degrees!.map(...)` (same pre-existing "assumed defined after `isLoading` check"
  pattern as `GroupTable`'s `groups!.filter(...)`).
- `src/features/semesters/useSemesters.ts` — exports `Semester` (plain generated
  `semesters` Row, no embedded relations). `useQuery<Semester[]>`.
- `src/features/semesters/SemesterRow.tsx` — `SemesterRowProps { semester: Semester }`.
- `src/features/semesters/SemesterTable.tsx` — no props; `handleSearch` typed;
  non-null assertions on `sem.semester!`/`sem.school_year!` in the filter.
- `src/features/semesters/CreateSemesterForm.tsx` — `CreateSemesterFormProps { onCloseModal?: () => void }`.

## What does not change (Phase 2, additional to the Phase 1 list)

- `src/services/apiGroups.js`, `apiSemesters.js` not converted — same "outside Phase
  2 scope" reasoning as Phase 1's `apiDegrees.js`/`apiSubjects.js` (`design.md`
  Section 1).
- `src/helpers/calculateSemesterGroup.js` (used by `GroupTable.jsx`'s semester-cutoff
  filter) and `src/ui/Form.jsx` (used by both create forms) are not converted —
  neither required a change for a clean typecheck.
- **Three pre-existing `react-hooks/rules-of-hooks` errors in `CreateSemesterForm.jsx`
  (already identified as real, must-not-touch defects in
  `openspec-ts-migration-foundation`'s original lint classification) are carried over
  unchanged** — not fixed, not restructured, not newly introduced. See `design.md`
  Section 6.
- No React Query key/`staleTime`/invalidation change — `["groups"]`/`["semesters"]`
  keys, `staleTime` values, and `invalidateQueries` calls are byte-identical.
- No Supabase call changed.

## Impact (Phase 2)

- **Affected code:** 8 files renamed (6 `.jsx` → `.tsx`, 2 `.js` → `.ts`). No other
  file.
- **Affected lint baseline:** `react/prop-types` errors disappear for `GroupRow` (6),
  `SemesterRow` (4), and `CreateSemesterForm` (1, `onCloseModal`) — 11 total.
  `CreateSemesterForm`'s 3 `react-hooks/rules-of-hooks` errors remain, unchanged.
  `GroupTable`/`useGroups`/`CreateGroupForm`/`SemesterTable`/`useSemesters` had 0 to
  begin with.

## Why studyPrograms/roles last

Both introduce **edit** (not just create) — `CreateEditStudyProgramForm.jsx`/
`CreateEditRoleForm.jsx` take an optional `programToEdit`/`roleToEdit` prop (default
`{}`) and branch their submit behavior on whether it's populated. `roles` also embeds
a nullable-FK `workers` relation (same pattern as `groups`/`degrees`, `subjects`/
`degrees`+`study_programs`), and `RoleRow.jsx`/`RoleTable.jsx` are the first files in
this migration that **don't** use the shared `src/ui/Table.tsx` compound component at
all — they define their own local, self-contained styled-components instead.

## What changes (Phase 3)

- `src/features/studyPrograms/useStudyPrograms.ts` — exports `StudyProgram`
  (plain generated `study_programs` Row, no embeds). `useQuery<StudyProgram[]>`.
- `src/features/studyPrograms/useEditStudyProgram.ts` — local
  `EditStudyProgramVariables { newProgram: Partial<StudyProgram>; id: number }` for
  the mutation's variables (react-hook-form's submitted `data` has no compile-time
  shape without a `useForm<Schema>()` generic, which isn't added — see `design.md`).
  Same `useMutation().isLoading`-doesn't-exist-in-v5 gap as Phase 2 (`design.md`
  Section P2.3) — typed with the same documented cast, not fixed.
- `src/features/studyPrograms/StudyProgramRow.tsx` — `StudyProgramRowProps { program: StudyProgram }`.
- `src/features/studyPrograms/StudyProgramsTable.tsx` — no props; `handleSearch`
  typed; non-null assertion on `program.name!.toLowerCase()`; local `Row` `type`-prop
  cast (same pattern as Phases 1–2).
- `src/features/studyPrograms/CreateEditStudyProgramForm.tsx` —
  `CreateEditStudyProgramFormProps { programToEdit?: Partial<StudyProgram>; onCloseModal?: () => void }`;
  non-null assertion on `editId!` at the one mutation call (matches the existing
  `isEditSession` guard, which TS can't see through); same `errors.message` cast as
  Phase 2.
- `src/features/roles/useRoles.ts` — exports `Role` (generated `roles` Row
  intersected with a nullable embedded `workers` Row, matching `apiRoles.js`'s
  `select("*, workers(*))")` and the nullable `worker_id` FK). `useQuery<Role[]>`.
- `src/features/roles/useEditRole.ts` — local
  `EditRoleVariables { newRole: Partial<Role>; id: number }`; same `isLoading` gap,
  same documented cast.
- `src/features/roles/RoleRow.tsx` — `RoleRowProps { role: Role }`; non-null
  assertions on `role.workers!.name` (embedded relation) — `role.role` needs no
  assertion (rendered directly as `ReactNode`, no method called on it).
- `src/features/roles/RoleTable.tsx` — no props; `handleSearch` typed; non-null
  assertions on `role.workers!.name!.toLowerCase()` in the filter; local `Row`
  `type`-prop cast.
- `src/features/roles/CreateEditRoleForm.tsx` —
  `CreateEditRoleFormProps { roleToEdit?: Partial<Role>; onCloseModal?: () => void }`;
  non-null assertion on `editId!`; same `errors.message` cast; pre-existing unused
  `data` parameter in the nested `onSuccess: (data) => {...}` callback preserved
  verbatim (already a real, classified `no-unused-vars` defect — not fixed).

## What does not change (Phase 3, additional to the Phase 1/2 list)

- `src/services/apiStudyPrograms.js`, `apiRoles.js` not converted — same "outside
  scope" reasoning as every prior phase's service files.
- `src/helpers/capitalizeFirstLetter.js` (used by `RoleRow.jsx`) and
  `src/features/workers/useWorkers.js` (used by `CreateEditRoleForm.jsx`, itself
  out-of-scope — a different feature) are not converted — neither required a change
  for a clean typecheck.
- `RoleRow.jsx`/`RoleTable.jsx`'s own local `TableRow`/`Table`/`TableHeader`/
  `TableFooter` styled-components (not the shared `src/ui/Table.tsx`) needed no cast
  or modification — they're plain native elements (`styled.div`/`styled.header`/
  `styled.footer`), and their `role="row"`/`role="table"` attributes are genuine,
  always-supported native ARIA attributes, not a shadowed custom prop like
  `GroupRow.jsx`'s Phase 2 `Table.Row role="row"` discovery.
- The previously-discovered `isLoading`/`isPending` gap (Phase 2, `design.md`
  P2.3) and `FormRow.tsx`'s single-child typing (Phase 2, `design.md` P2.5) are
  **not** fixed in this phase either — both recur here (see above) and are handled
  with the exact same documented, zero-behavior-change workaround, not touched at
  the root.
- No React Query key/`staleTime`/invalidation change — `["studyPrograms"]`/`["roles"]`
  keys, `staleTime` values, and `invalidateQueries` calls are byte-identical.
- No Supabase call changed.

## Impact (Phase 3)

- **Affected code:** 10 files renamed (6 `.jsx` → `.tsx`, 4 `.js` → `.ts`), plus 4
  out-of-scope PDF files (`TeacherAssignmentPDF.jsx`, `ScheduleGroupPDF.jsx`,
  `ScheduleTeacherPDF.jsx`, `WorkerSheetSemester.jsx`) each get one import path
  extension fixed (`useRoles.js` → `useRoles.ts`) — the only files besides the 10
  renames touched by this phase.
- **Affected lint baseline:** `react/prop-types` errors disappear for `StudyProgramRow`
  (5), `CreateEditStudyProgramForm` (2), `RoleRow` (6), and `CreateEditRoleForm` (2) —
  15 total. `CreateEditRoleForm`'s 1 pre-existing `no-unused-vars` (the unused `data`
  param) remains, unchanged (renamed to `@typescript-eslint/no-unused-vars` by the
  file-extension switch, same as `MainNav.tsx`'s `isActive` earlier in this
  migration). `StudyProgramsTable`/`useStudyPrograms`/`useEditStudyProgram`/
  `RoleTable`/`useRoles`/`useEditRole` had 0 to begin with.
