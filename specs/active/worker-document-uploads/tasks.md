# Tasks - Worker Document Uploads

## Phase 1: Spec and database planning

- [ ] Confirm stakeholder decisions in `decisions.md`.
- [ ] Update `spec.md` with permanent vs semester document scope.
- [ ] Create `database-plan.md`.
- [ ] Confirm existing workers table name and primary key type.
- [ ] Confirm existing semesters table name and primary key type.
- [ ] Confirm current Supabase setup.

## Phase 2: Supabase schema

- [ ] Create migration for worker document categories.
- [ ] Create migration for worker document types.
- [ ] Create migration for uploaded worker documents.
- [ ] Add support for worker-level and semester-level document scopes.
- [ ] Add support for multiple files in evidence document types.
- [ ] Add indexes.
- [ ] Add RLS policies.
- [ ] Add storage bucket setup if safely representable in SQL.
- [ ] Add seed data for categories and document types.

## Phase 3: Data access layer

- [ ] Create `src/services/apiWorkerDocuments.js`.
- [ ] Implement function to fetch document categories and types.
- [ ] Implement function to fetch uploaded documents by worker.
- [ ] Implement function to fetch uploaded documents by worker and semester.
- [ ] Implement upload function using Supabase Storage.
- [ ] Implement replace function for single-file document types.
- [ ] Implement download/view URL function.
- [ ] Implement report data function.

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
