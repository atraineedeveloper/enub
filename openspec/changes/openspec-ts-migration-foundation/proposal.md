# Proposal: OpenSpec + TypeScript Migration Foundation

## Status

Draft

## Why

Enub's spec workflow (`specs/active/<feature>/...`) is DIY: no enforced schema, no
delta-spec/archive lifecycle, and no shared convention for how a "change" differs from a
"current, agreed behavior". Separately, the codebase is 100% `.js`/`.jsx` with no type
checking — `eslint-plugin-react`'s `react/prop-types` rule is standing in for a type
system and accounts for 240 of the current 304 lint problems (see Lint noise vs.
defects in `design.md`).

This change establishes the **process foundation** for both moves before any code
changes happen:

1. Adopt OpenSpec (`openspec/`) as the structure for new spec work going forward.
2. Define, on paper only, how TypeScript will be introduced gradually later.
3. Decide which of the current 304 lint problems are acceptable, temporary noise during
   a JS→TS migration, and which are real defects that must be fixed regardless of any
   migration.

No application behavior, dependency, or `.js`/`.jsx` file changes as part of this PR.

## What changes

- Add `openspec/config.yaml`, `openspec/specs/`, `openspec/changes/` (already scaffolded)
  as the home for all *new* spec work.
- Document the mapping from the old `specs/active/<feature>/` shape to OpenSpec's
  `changes/<id>/` (proposal + design + tasks, optionally delta specs) and
  `specs/<capability>/spec.md` (current, agreed behavior) shape.
- Update `AGENTS.md` so future work starts under `openspec/changes/<change-id>/`, while
  existing `specs/active/` folders remain untouched until explicitly migrated or
  archived.
- Document a 4-phase plan for introducing TypeScript incrementally (tooling → `.ts`
  utilities → `.tsx` leaf components → shared/complex components), with no phase beyond
  "tooling" authorized by this change.
- Document the ESLint adjustments each later phase will require (e.g. disabling
  `react/prop-types` once a file has real TS prop types), without applying any of them
  yet.
- Classify today's 304 lint problems into "noise that TS will make obsolete" vs. "real
  defects that must be fixed on their own merits."

## What does not change

- No `.js`/`.jsx` file is renamed, converted, or moved.
- No TypeScript dependency, `tsconfig.json`, or `.ts`/`.tsx` file is added.
- No existing lint error is fixed or suppressed.
- `eslint.config.js` is not modified.
- `specs/active/` and `specs/archive/` are left in place, untouched and readable. The
  three in-flight features under `specs/active/` (`worker-document-uploads`,
  `worker-self-service-documents`, `worker-documents-ux-and-delete`) keep using the DIY
  workflow until each is explicitly ported or archived — never deleted as a side effect
  of this change.
- No public route, Supabase table/query, or RLS policy is touched.

## Impact

- **Affected specs:** none (no capability spec exists yet under `openspec/specs/`).
- **Affected code:** none.
- **Affected process:** how future spec work is authored (`openspec/changes/<id>/`
  instead of `specs/active/<feature>/`) and a shared reference for what lint noise is
  acceptable to defer during the eventual TS migration.
