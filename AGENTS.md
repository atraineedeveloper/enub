# AGENTS.md

## Project

Enub is a React + Vite school-management PWA using TypeScript, Supabase, TanStack Query, React Router, Styled Components, React Hook Form and Bun.

## OpenSpec workflow

Use OpenSpec to make intent and acceptance criteria durable without turning small changes into paperwork.

### Fast lane — default

Use this path for a focused change that is low risk, reversible and limited to one feature or layer:

1. Create one OpenSpec change with `/opsx:propose`.
2. Keep the proposal and changed requirements concise.
3. Implement with `/opsx:apply`.
4. Run only the relevant verification commands.
5. Synchronize and archive with `/opsx:sync` and `/opsx:archive`.

A fast-lane change normally does not need a long design document. Record only decisions that are not obvious from existing project patterns.

### Full lane — use when risk justifies it

Use a fuller proposal, specs, design and tasks flow when the change includes one or more of these:

- Supabase schema migrations, RLS policies or remote data operations.
- Authentication, authorization, roles or worker-document access.
- New dependencies or infrastructure.
- Public routes, shared data contracts or broad UI behavior changes.
- Cross-feature refactors or work spanning several architectural layers.
- Destructive, difficult-to-reverse or security-sensitive behavior.

### Direct lane — no new change folder

A separate OpenSpec change is not required for typo-only documentation edits, formatting-only changes, generated lockfile updates or a mechanical correction that does not change behavior. Mention the reason in the commit or PR.

## Non-negotiable rules

- Do not implement a behavior change from an ambiguous request; clarify it in the OpenSpec proposal first.
- Keep existing `specs/active/` folders untouched until they are explicitly migrated or archived.
- Follow existing project patterns before introducing new ones.
- Do not add dependencies without explicit approval.
- Keep changes small and focused.
- Document changes to public routes, database objects, Supabase queries and shared contracts.
- Update documentation when behavior, setup, routes, data contracts or feature structure changes.

## Existing architecture pattern

- Pages live in `src/pages`.
- Feature UI and hooks live in `src/features/<domain>`.
- Supabase API calls live in `src/services/api*`.
- Shared UI lives in `src/ui`.
- Shared hooks live in `src/hooks`.
- Global context lives in `src/context`.
- Routing is centralized in `src/App.jsx`.
- Database migrations and database tests live under `supabase/`.

## Commands

Prefer Bun:

- Install dependencies: `bun install`
- Run dev server: `bun run dev`
- Build: `bun run build`
- Lint: `bun run lint`
- Type-check: `bun run typecheck`
- Preview production build: `bun run preview`
- Start local Supabase: `bun run supabase:start`
- Lint local database: `bun run supabase:lint`
- Run local database tests: `bun run supabase:test`

## Verification matrix

Always:

- Run `bun run typecheck`.
- Run `bun run lint`.

Also run:

- `bun run build` for UI, routing, configuration or bundling changes.
- Relevant unit tests when changing tested services or logic.
- `bun run supabase:lint` for migrations, functions, policies or SQL changes.
- `bun run supabase:test` for database behavior changes.
- Manual route verification only for behavior that is not reasonably covered automatically.

Do not require unrelated checks merely to satisfy a template. Record skipped checks and the reason in the change or PR.

## Supabase safety rules

Allowed local commands:

- `bunx supabase status`
- `bunx supabase start`
- `bunx supabase stop`
- `bunx supabase migration new <name>`
- `bunx supabase db reset`
- `bunx supabase db lint`
- `bunx supabase test db --local`
- `bun run build`
- `bun run lint`
- `bun run typecheck`

Commands requiring explicit human approval:

- `bunx supabase login`
- `bunx supabase link --project-ref ...`
- `bunx supabase db pull`
- `bunx supabase db push --dry-run`
- `bunx supabase db push`

Forbidden commands:

- `bunx supabase db reset --linked`
- `bunx supabase db reset --db-url ...`
- `bunx supabase migration repair`
- Any command that prints, stores or commits secrets.
- Any command that modifies remote Supabase without approval.

Never commit `.env`, `.env.local`, Supabase access tokens, service-role keys or database passwords.
