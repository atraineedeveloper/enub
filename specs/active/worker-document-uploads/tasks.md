# Tasks - Worker Document Uploads

## Phase 1: Spec and database planning

- [x] Confirm stakeholder decisions in `decisions.md`.
- [x] Update `spec.md` with permanent vs semester document scope.
- [x] Create `database-plan.md`.
- [x] Create `verification-plan.md`.
- [x] Confirm existing workers table name and primary key type.
- [x] Confirm existing semesters table name and primary key type.
- [x] Confirm current Supabase setup.

## Phase 2: Supabase schema

- [x] Create migration for worker document categories.
- [x] Create migration for worker document types.
- [x] Create migration for uploaded worker documents.
- [x] Add support for worker-level and semester-level document scopes.
- [x] Add support for multiple files in evidence document types.
- [x] Add indexes.
- [x] Add RLS policies.
- [x] Add storage bucket setup if safely representable in SQL.
- [x] Add seed data for categories and document types.
- [x] Add trigger function for permanent vs semester scope consistency.
- [x] Add trigger function for single-file enforcement when `allows_multiple = false`.

## Phase 3: Data access layer

- [x] Create `src/services/apiWorkerDocuments.js`.
- [x] Implement function to fetch document categories and types.
- [x] Implement function to fetch uploaded documents by worker.
- [x] Implement function to fetch uploaded documents by worker and semester.
- [x] Implement upload function using Supabase Storage.
- [x] Implement replace function for single-file document types.
- [x] Implement download/view URL function.
- [x] Implement report data function.

## Phase 4: React Query hooks

- [ ] Create worker document query hook.
- [ ] Create document upload mutation hook.
- [ ] Create document replace mutation hook.
- [ ] Create document download URL hook or helper.
- [ ] Invalidate related queries after upload/replace.

## Phase 5: UI

- [ ] Add route `/workers/:id/documents`.
- [ ] Add “Documentos” action in workers UI.
- [ ] Create worker document page.
- [ ] Show worker information.
- [ ] Show Datos personales section.
- [ ] Add semester selector for semester-level categories.
- [ ] Show Docencia, Tutoría, Asesoría, and Investigación sections.
- [ ] Show pending/uploaded status.
- [ ] Add upload controls.
- [ ] Add replace controls.
- [ ] Add view/download controls.
- [ ] Add report download action.

## Phase 6: Report

- [ ] Define report format.
- [ ] Generate worker document status report.
- [ ] Include worker name.
- [ ] Include semester when applicable.
- [ ] Include categories and document types.
- [ ] Include uploaded/pending status.
- [ ] Include upload dates and file names when available.

## Phase 7: Verification

- [ ] Run `bunx supabase db reset`.
- [ ] Run `bunx supabase db lint`.
- [ ] Run `bun run lint`.
- [ ] Run `bun run build`.
- [ ] Manually verify upload flow.
- [ ] Manually verify replacement flow.
- [ ] Manually verify multiple evidence files.
- [ ] Manually verify report download.
- [ ] Confirm no `.env` or secrets were committed.

## Follow-up (separate future spec, not part of this feature)

Deferred by the staff-facing access-model decision (`decisions.md` #11) and the storage gap noted in `decisions.md` #14:

- [ ] `auth.users` to `workers` mapping.
- [ ] Worker self-service portal.
- [ ] Dirección/admin role tier.
- [ ] Ownership-based RLS policies once the above exist.
- [ ] Make `profile_pictures` bucket reproducible locally via migration.
