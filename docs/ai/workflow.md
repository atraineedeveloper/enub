# Spec-Driven Development Workflow

ENU uses OpenSpec as its repository-native source of truth for planned product and engineering changes. Current changes live under `openspec/changes/`; durable requirements live under `openspec/specs/` after synchronization and archival.

The older `specs/active/` tree is preserved as legacy project history. Do not edit, migrate, or archive those folders unless a change explicitly covers that work.

## Standard lifecycle

```txt
Request → propose → apply → verify → sync → archive → pull request
```

## Select the appropriate lane

### Fast lane — default

Use a concise proposal, changed requirements, tasks, and only the design decisions that are not obvious for a focused, low-risk, reversible change.

### Full lane

Use substantive proposal, specs, design, tasks, and verification for:

- Supabase migrations, RLS, storage, RPCs, or remote data operations.
- Authentication, authorization, roles, or worker-document access.
- New dependencies or infrastructure.
- Public routes or shared contracts.
- Cross-feature, destructive, or security-sensitive work.

### Direct lane

A new change is unnecessary for typo-only documentation, formatting, generated lockfile updates, or mechanical corrections with no behavioral effect. Explain the reason in the commit or pull request.

## 1. Propose

Create a kebab-case change and follow the artifact order returned by the CLI:

```bash
openspec new change <change-name>
openspec status --change <change-name> --json
openspec instructions <artifact> --change <change-name> --json
```

Do not guess artifact paths or templates. Use the resolved paths and instructions from the CLI. A pure documentation or tooling change may set `skip_specs: true` in `.openspec.yaml`; do not invent product requirements for such work.

## 2. Apply

Before implementation, read:

1. `AGENTS.md`
2. `docs/ai/architecture.md`
3. `docs/ai/testing.md`
4. `docs/ai/constitution.md`
5. `docs/ai/workflow.md`
6. `docs/ai/api.md`
7. Every context file returned by:

```bash
openspec instructions apply --change <change-name> --json
```

Implement tasks in order and mark each checkbox immediately after completing it. If implementation changes the intended design or scope, update the OpenSpec artifacts first.

## 3. Verify

Use the matrix in `docs/ai/testing.md`. The default repository baseline is:

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

Run Supabase checks only when the affected area requires them. Record checks that were skipped and why.

Validate the change before completion:

```bash
openspec validate <change-name> --strict
```

## 4. Synchronize and archive

After implementation and verification:

1. Assess each delta spec against `openspec/specs/`.
2. Synchronize changed requirements when applicable.
3. Archive the completed change using the current date.
4. Preserve the proposal, decisions, tasks, and verification record in the archive.

Tooling-only changes with `skip_specs: true` have no delta requirements to synchronize.

## 5. Pull request

Each pull request should state:

- What changed and why.
- The OpenSpec change or reason for using the direct lane.
- Commands actually executed and their results.
- Manual checks performed or explicitly skipped.
- Risks, deployment order, and post-deployment steps when applicable.
- Documentation updated.

AI-generated implementation still requires human review before merge.
