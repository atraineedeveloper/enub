# ENU Project Constitution

This document defines the non-negotiable engineering rules for ENU. Agents and humans must follow these rules when planning, implementing, reviewing, and documenting changes.

## 1. Specs before implementation

Do not implement features directly from vague requests.

Every non-trivial change must start with a spec under:

```txt
specs/active/<feature-name>/
```

At minimum, a feature spec should include:

- Problem.
- Scope.
- Out of scope.
- Current behavior.
- Desired behavior.
- Data requirements.
- Technical plan.
- Acceptance criteria.
- Verification plan.
- Risks.

Use `docs/ai/feature-spec-template.md` as the default template.

## 2. Small, focused changes

Prefer small pull requests and small specs.

A change should not mix unrelated concerns. For example, do not combine a UI redesign, a database migration, a routing change, and a dependency upgrade unless the spec explicitly justifies why they must ship together.

## 3. Existing patterns first

Follow existing project patterns before introducing new ones.

Current project conventions:

- Pages live in `src/pages`.
- Feature UI and hooks live in `src/features/<domain>`.
- Supabase API calls live in `src/services/api*.js`.
- Shared UI lives in `src/ui`.
- Shared hooks live in `src/hooks`.
- Global context lives in `src/context`.
- Routing is centralized in `src/App.jsx`.

Do not introduce a new folder pattern, state-management approach, UI library, or data-access style unless the spec explicitly approves it.

## 4. No new dependencies without approval

Do not add runtime or dev dependencies without explicit human approval.

Before proposing a dependency, explain:

- Why existing code cannot solve the problem.
- Bundle/runtime impact.
- Maintenance risk.
- Alternative options.
- Exact package name and version.

## 5. RLS is the security boundary

Frontend route guards and hidden buttons are convenience only. Supabase Row Level Security is the real enforcement boundary.

Any data-access change must preserve this rule:

- Workers can access only their own worker-linked data.
- Staff/admin access must be intentionally granted by existing role policies or documented policy changes.
- No frontend code may bypass RLS.
- No service-role key may appear in `src/`.
- No Supabase Admin API call may appear in `src/`.

Service-role usage is allowed only inside approved Supabase Edge Functions or server-side environments where secrets are not exposed to the browser.

## 6. Auth and role behavior must stay deny-by-default

A signed-in user without a valid `profiles` row must not be treated as staff/admin/worker by default.

Expected behavior:

- `admin` and `staff` profiles can access staff routes.
- `worker` profiles are routed to worker self-service.
- Missing/unknown profile states land on `/pending-access`.
- `/set-password` remains reachable for invite/recovery flows.

## 7. Public routes, data contracts, and schema changes require documentation

If a change modifies any of these, update the relevant documentation:

- App route.
- Supabase table/column/RPC/function.
- Storage bucket/path convention.
- Edge Function request/response.
- Authentication or role behavior.
- Environment variable.
- Product-level behavior visible to users.

Likely docs to update:

- `docs/ai/architecture.md`
- `docs/ai/api.md`
- `README.md`
- Relevant spec files under `specs/active/<feature-name>/`

## 8. Verification is required before completion

A task is not complete until the verification plan is executed or explicitly marked as not run with a reason.

Required default checks:

```bash
bun run lint
bun run build
```

For Supabase changes, also consider:

```bash
bunx supabase db lint
bunx supabase db reset
bunx supabase test db --local
```

If a check cannot be run, document that fact. Do not silently claim success.

## 9. Manual verification is mandatory until automated tests exist

The project currently has no JavaScript test script. Until a test framework is added, every spec must include manual checks for the affected user flow.

Manual verification must include:

- Happy path.
- Empty state.
- Loading state.
- Error state.
- Permission/RLS behavior when relevant.
- Responsive behavior when UI changes.
- Dark mode behavior when UI changes.

## 10. Preserve user-facing Spanish copy consistency

The product UI is Spanish-first. New user-facing copy should be Spanish unless the surrounding UI is already English.

Use clear, direct wording for:

- Button labels.
- Toasts.
- Form errors.
- Empty states.
- Confirmation modals.

Do not expose raw technical errors, stack traces, database details, or secret values to users.

## 11. Secrets must never be committed

Never commit:

- `.env`
- `.env.local`
- Supabase access tokens
- Supabase service-role keys
- Database passwords
- API keys
- Any generated file containing secrets

Only commit safe examples such as `.env.example` with placeholder values.

## 12. Remote Supabase changes require human approval

Local Supabase commands are allowed when safe. Remote commands require explicit human approval.

Commands requiring approval include:

```bash
bunx supabase login
bunx supabase link --project-ref ...
bunx supabase db pull
bunx supabase db push --dry-run
bunx supabase db push
```

Forbidden without explicit approval and a documented reason:

```bash
bunx supabase db reset --linked
bunx supabase db reset --db-url ...
bunx supabase migration repair
```

## 13. Documentation must stay alive

If implementation reveals that `AGENTS.md`, `docs/ai/*`, or the active spec is stale, update the documentation as part of the same change.

Do not leave stale documentation behind just because the code works.

## 14. Human review remains required

AI-generated implementation must be reviewed by a human before merge.

The reviewer should compare the final diff against:

- The active spec.
- Acceptance criteria.
- Verification plan.
- Architecture docs.
- API/data contract docs.
- This constitution.
