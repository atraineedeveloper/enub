# Spec-Driven Development Workflow

This project uses a lightweight, repository-native Spec-Driven Development workflow. It is currently a DIY/manual SDD setup, not a formal OpenSpec installation.

The source of truth for active product/engineering changes is:

```txt
specs/active/<feature-name>/
```

The default feature spec template is:

```txt
docs/ai/feature-spec-template.md
```

## Goals

This workflow exists to make AI-assisted development predictable, reviewable, and safe.

The goal is not to generate code faster from vague instructions. The goal is to turn vague requests into precise, validated, documented changes.

## Standard lifecycle

```txt
Request → refinement → spec → review → implementation → verification → PR → archive/update docs
```

## 1. Request intake

Start with the user's request or issue.

Do not implement yet.

Capture:

- What the user asked for.
- The affected product area.
- The suspected routes/components/services involved.
- Any ambiguity.
- Any security, data, or permission concern.

If the request is vague, refine it before writing code.

## 2. Create or update a feature folder

Create:

```txt
specs/active/<feature-name>/
```

Use kebab-case for `<feature-name>`:

```txt
worker-documents-ux-and-delete
semester-report-export
subject-filtering
```

Recommended files:

```txt
specs/active/<feature-name>/
  spec.md
  decisions.md
  tasks.md
  verification-plan.md
  database-plan.md        # only when database/RLS/storage/RPC changes are involved
  implementation-plan.md  # optional when the change is complex
```

## 3. Write the spec before code

Use this template:

```txt
docs/ai/feature-spec-template.md
```

A good spec must include:

- Current behavior.
- Desired behavior.
- Scope.
- Out of scope.
- Files likely to change.
- Existing patterns to follow.
- Data requirements.
- Acceptance criteria.
- Verification plan.
- Risks.

The spec should be concrete enough that another developer or agent can implement it without inventing architecture.

## 4. Record decisions explicitly

Use `decisions.md` for any decision that could affect implementation.

Examples:

```md
# Decisions - <feature-name>

## 1. Should this require a database migration?

Decision: No.
Reason: Existing table already contains the required fields.
Impact: Only frontend/service-layer changes are needed.

## 2. Should workers be allowed to access this route?

Decision: Workers can access only `/my-documents`.
Reason: Staff routes remain staff/admin-only. Worker access is mediated by profile role and RLS.
Impact: No worker-facing link to staff routes.
```

Decisions should remove ambiguity before implementation.

## 5. Create implementation tasks

Use `tasks.md` to break the work into phases.

Recommended format:

```md
# Tasks - <feature-name>

## Phase 1: Data/API layer

- [ ] Task
- [ ] Task

## Phase 2: Hooks/state

- [ ] Task
- [ ] Task

## Phase 3: UI

- [ ] Task
- [ ] Task

## Phase 4: Documentation

- [ ] Update `docs/ai/architecture.md` if needed.
- [ ] Update `docs/ai/api.md` if needed.
- [ ] Update `README.md` if product-level behavior changed.

## Phase 5: Verification

- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] Manual verification completed.
```

Tasks should be small enough to review independently.

## 6. Plan database and RLS changes separately

If the feature touches Supabase schema, RLS, functions, RPCs, or storage policies, create:

```txt
specs/active/<feature-name>/database-plan.md
```

Include:

- Tables affected.
- Columns affected.
- Migration name.
- RLS policies affected.
- Storage buckets affected.
- RPCs/functions affected.
- Rollback/compatibility notes.
- Local verification commands.

Do not make database changes casually. Every migration must be justified by the spec.

## 7. Implement only after spec review

Before implementation, read:

1. `AGENTS.md`
2. `docs/ai/architecture.md`
3. `docs/ai/testing.md`
4. `docs/ai/constitution.md`
5. `docs/ai/workflow.md`
6. `docs/ai/api.md`
7. The active feature spec under `specs/active/<feature-name>/`

Implementation rules:

- Follow the spec.
- Do not expand scope without updating the spec first.
- Do not introduce new dependencies without approval.
- Do not change routes, schema, or data contracts without documenting them.
- Keep changes focused.
- Update `tasks.md` as phases are completed.

## 8. If the spec is wrong, fix the spec first

Do not silently fix implementation details in code while leaving the spec stale.

If implementation reveals a better approach:

1. Update `decisions.md`.
2. Update `spec.md` or `tasks.md`.
3. Then update the code.

The spec should describe the final intended behavior, not the initial guess.

## 9. Verification

Every feature must verify the relevant path from `docs/ai/testing.md`.

Required default checks:

```bash
bun run lint
bun run build
```

For Supabase/database work, consider:

```bash
bunx supabase db reset
bunx supabase db lint
bunx supabase test db --local
```

Manual verification must be recorded in `verification-plan.md`.

If something was not run, write that clearly.

## 10. Documentation update

Update docs when behavior changes.

Common docs:

- `docs/ai/architecture.md` — routes, architecture, auth model, major feature structure.
- `docs/ai/api.md` — Supabase tables, storage, RPCs, Edge Functions, environment variables, data contracts.
- `docs/ai/testing.md` — verification rules when project testing strategy changes.
- `README.md` — product-level feature list and setup instructions.
- `AGENTS.md` — only when agent-facing rules or factual project structure changes.

## 11. PR checklist

Each PR should include:

```md
## Summary

- ...

## Spec

- `specs/active/<feature-name>/spec.md`

## Verification

- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] Manual verification:

## Risks

- ...

## Documentation updated

- [ ] `docs/ai/architecture.md`
- [ ] `docs/ai/api.md`
- [ ] `README.md`
- [ ] Not needed; reason:
```

## 12. After merge

After a feature is merged:

- Mark the spec as `Implemented` or `Archived`.
- Move old specs out of `specs/active/` when they are no longer active.
- Keep important final decisions in docs if they affect future work.

Recommended archive structure:

```txt
specs/archive/<yyyy-mm>/<feature-name>/
```

Example:

```txt
specs/archive/2026-07/worker-documents-ux-and-delete/
```

## 13. OpenSpec note

This repository currently uses a manual SDD workflow.

Do not create an `openspec/` directory or migrate to OpenSpec unless explicitly requested.

If OpenSpec is adopted later, this workflow should be mapped carefully so the existing `specs/active/` history is not duplicated or lost.
