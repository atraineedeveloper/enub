# Enub Architecture

## Stack

- React 18
- Vite
- React Router DOM
- TanStack Query
- Supabase
- Styled Components
- React Hook Form
- React Hot Toast
- Vite PWA

## App entry

- `src/main.jsx` renders `App` inside `ErrorBoundary`.
- `src/App.jsx` defines providers, router, protected routes, lazy pages, and toast configuration.

## Routing

Protected app routes:

- `/dashboard`
- `/degrees`
- `/subjects`
- `/groups`
- `/study-programs`
- `/state-roles`
- `/roles`
- `/others`
- `/semesters`
- `/workers`
- `/semesters/:id`

Public route:

- `/login`

## Data access pattern

Use this pattern for data-driven features:

1. `src/services/apiDomain.js`
   - Contains Supabase calls.
   - Throws user-facing errors when Supabase returns errors.

2. `src/features/domain/useDomain.js`
   - Uses TanStack Query or mutation hooks.
   - Defines query keys.

3. `src/features/domain/DomainTable.jsx`
   - Handles loading, error, filtering, pagination, and rendering.

4. `src/pages/...`
   - Composes layout, headings, and feature components.

## Current examples

- Subjects:
  - `src/services/apiSubjects.js`
  - `src/features/subjects/useSubjects.js`
  - `src/features/subjects/SubjectTable.jsx`
  - `src/pages/Records/Subjects.jsx`

## Environment

The code expects:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY`

README currently mentions `VITE_SUPABASE_ANON_KEY`, so update docs or code before relying on automated agents.
