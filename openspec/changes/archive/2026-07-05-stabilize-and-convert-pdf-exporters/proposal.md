# Proposal: Stabilize and Convert PDF Exporters

## Why

`src/pdf/**` contains four PDF export components (`ScheduleGroupPDF.jsx`,
`ScheduleTeacherPDF.jsx`, `TeacherAssignmentPDF.jsx`, `WorkerSheetSemester.jsx`)
that remain untyped `.jsx` after the rest of the schedules and pages TypeScript
migrations completed. Two of them contain a real, reproducible runtime bug:
`ScheduleGroupPDF.jsx` and `ScheduleTeacherPDF.jsx` both index `roles[1]` and
`stateRoles[0]`/`stateRoles[1]` directly with no bounds checking. `supabase/seed.sql`
seeds exactly one row into `roles` (id=1) and exactly one row into `state_roles`
(id=1), so `roles[1]` and `stateRoles[1]` are always `undefined` in this
environment. This deterministically reproduces the reported failure:
`Uncaught (in promise) TypeError: Cannot read properties of undefined (reading
'role')` at `ScheduleTeacherPDF.jsx:351`. The same construct in
`ScheduleGroupPDF.jsx` would crash identically the first time its export button
is used.

A working, in-repo reference pattern already exists: `WorkerSheetSemester.jsx`
consumes the exact same `useRoles()` data source defensively (keyword search,
`??` fallback chains, optional chaining, hardcoded fallback text) and does not
crash under the same seed data. This change repairs the two broken exporters
using that proven pattern, then converts all four PDF files to TypeScript,
matching the type-safety bar already applied to `src/features/schedules/**`,
`src/features/workers/**`, and `src/pages/**`.

This is a stabilization and type-safety change, not a feature change. No new
PDF, button, or user-facing capability is introduced.

## What Changes

- Diagnose and document the exact failure mode of `ScheduleTeacherPDF.jsx` and
  confirm whether `ScheduleGroupPDF.jsx` shares it (Phase 0, no code changes).
- Repair the two PDF exporters that unsafely index `roles`/`stateRoles` so they
  degrade gracefully (matching `WorkerSheetSemester.jsx`'s established pattern)
  instead of throwing, when fewer than two rows exist in either source table.
- Convert `ScheduleGroupPDF.jsx`, `ScheduleTeacherPDF.jsx`,
  `TeacherAssignmentPDF.jsx`, and `WorkerSheetSemester.jsx` to `.tsx`, reusing
  existing generated/feature types (`Database["public"]["Tables"]["state_roles"]["Row"]`,
  `Role` from `useRoles.ts`, `ScheduleAssignment`, `ScheduleTeacher`, `Worker`)
  and the established jsPDF/`autoTable`/`lastAutoTable` typing patterns.
- Preserve all existing PDF visual output exactly: filenames, table structure,
  column order, labels, margins, fonts, and date formatting are unchanged
  except where the documented bug fix requires a minimal, explicit fallback
  value in place of a crash.
- Leave the three orphaned schedule files (`CreateScholarSchedule.jsx`,
  `EditScholarSchedule.jsx`, `RowTeacherAssignment.jsx`) untouched; this change
  does not migrate, fix, or delete them (see Closed Decisions in `design.md`).
- No changes to `services/`, Supabase queries/migrations, generated types,
  `package.json`, `tsconfig.json`, or `eslint.config.js`.

## Capabilities

**New Capabilities:**
- `pdf-exporter-safety` — Covers preserving and stabilizing existing PDF
  exporter behavior while repairing documented pre-existing PDF failures and
  migrating PDF exporters to TypeScript.

**Modified Capabilities:**
(none — no existing user-facing requirements change)

## Impact

- Affected code: `src/pdf/Schedules/ScheduleGroupPDF.jsx`,
  `src/pdf/Schedules/ScheduleTeacherPDF.jsx`,
  `src/pdf/Schedules/TeacherAssignmentPDF.jsx`, `src/pdf/WorkerSheetSemester.jsx`,
  and their helper modules (`filterHour.js`, `filterHourGroup.js`,
  `filterHourActivity.js`) if a type-only cast is required at their call
  boundary.
- Affected call sites (read-only impact; call sites are already `.tsx` and are
  not expected to require changes beyond possibly removing a now-unnecessary
  cast): `src/features/schedules/ShowScholarSchedule.tsx`,
  `src/features/schedules/ShowTeacherSchedule.tsx`,
  `src/features/schedules/TeacherAssignment.tsx`, `src/pages/ScheduleDashboard.tsx`.
- No database, service, or API changes.
- No new dependencies.
- Risk is concentrated in the repair phase (Phase 1): the fix must not change
  visible PDF output for the common case (≥2 roles/state_roles rows) and must
  only change behavior for the currently-crashing case (fewer than 2 rows).
