# AGENTS.md

## Project

Enub is a React + Vite school management system using Supabase, TanStack Query, React Router, Styled Components, React Hook Form, and PWA support.

## Non-negotiable rules

- Do not implement features directly from vague requests.
- First create or update an OpenSpec change under `openspec/changes/<change-id>/`.
- Keep existing `specs/active/` folders untouched until they are explicitly migrated or archived.
- Follow existing project patterns before introducing new ones.
- Do not add dependencies without explicit approval.
- Keep changes small and focused.
- Do not change public routes, database table names, or Supabase queries without documenting the change in the spec.
- Update documentation when behavior, setup, routes, data contracts, or feature structure changes.

## Existing architecture pattern

- Pages live in `src/pages`.
- Feature UI and hooks live in `src/features/<domain>`.
- Supabase API calls live in `src/services/api*.js`.
- Shared UI lives in `src/ui`.
- Shared hooks live in `src/hooks`.
- Global context lives in `src/context`.
- Routing is centralized in `src/App.jsx`.

## Commands

- Install dependencies: `bun install` or `npm install`
- Run dev server: `bun run dev` or `npm run dev`
- Build: `bun run build` or `npm run build`
- Lint: `bun run lint` or `npm run lint`
- Preview production build: `bun run preview` or `npm run preview`

## Verification

Before marking work complete:

- Run lint.
- Run build.
- Manually verify the affected route.
- Confirm Supabase env vars are correctly documented.
- If tests are added later, run the relevant test suite.

## Current limitation

The project currently has no test script. Until a test framework is added, every spec must include manual verification steps.

## Local environment

The developer uses Fedora Linux and Bun.

Use Bun commands:

- Install dependencies: `bun install`
- Add dev dependency: `bun add -d <package>`
- Run dev server: `bun run dev`
- Build: `bun run build`
- Lint: `bun run lint`
- Run Supabase CLI: `bunx supabase <command>`

Supabase local requires Docker Engine or another Docker-compatible runtime.

## Supabase safety rules

Allowed local commands:

- `bunx supabase status`
- `bunx supabase start`
- `bunx supabase stop`
- `bunx supabase migration new <name>`
- `bunx supabase db reset`
- `bunx supabase db lint`
- `bunx supabase test db --local`
- `bunx supabase migration list`
- `bun run build`
- `bun run lint`

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
- Any command that prints, stores, or commits secrets
- Any command that modifies remote Supabase without approval

Never commit:

- `.env`
- `.env.local`
- Supabase access tokens
- service role keys
- database passwords

- Avoid `bunx supabase migration list` if it attempts to connect to the remote database. Prefer local reset/lint verification unless the user explicitly approves remote inspection.
