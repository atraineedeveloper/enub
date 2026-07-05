# Design: OpenSpec + TypeScript Migration Foundation

## 1. From `specs/active/` to OpenSpec

### Current shape (DIY, `specs/active/<feature>/`)

Each feature folder mixes several concerns in flat files: `spec.md` (following
`docs/ai/feature-spec-template.md`), `decisions.md`, `database-plan.md`,
`verification-plan.md`, `tasks.md`, plus ad hoc folders like `qa/`. There is no
distinction in the folder structure between "proposed change" and "current agreed
behavior" — a feature's `spec.md` is both at once, for as long as it lives under
`active/`. `specs/archive/` exists as the intended destination for finished features but
is currently empty (`.gitkeep` only): nothing has been archived through it yet.

### Target shape (OpenSpec)

- `openspec/changes/<change-id>/` — a proposed, not-yet-merged unit of work:
  - `proposal.md` — why, what changes, what does not change, impact.
  - `design.md` — technical approach, for changes non-trivial enough to need one.
  - `tasks.md` — the implementation checklist.
  - (optional) delta spec files describing the capability's behavior *after* the change,
    for changes substantial enough to warrant one.
- `openspec/specs/<capability>/spec.md` — the current, agreed source of truth for a
  capability's behavior, updated only once a change affecting it is merged/archived.
- `openspec/changes/archive/<change-id>/` — changes that have been merged, kept for
  history.

### Mapping rule

| DIY concept | OpenSpec equivalent |
|---|---|
| `specs/active/<feature>/spec.md` (in progress) | `openspec/changes/<change-id>/proposal.md` + `design.md` |
| `specs/active/<feature>/tasks.md` | `openspec/changes/<change-id>/tasks.md` |
| `specs/active/<feature>/decisions.md`, `database-plan.md`, `verification-plan.md` | Folded into `design.md`, or kept as extra files inside the same `changes/<change-id>/` folder — OpenSpec does not forbid extra files, it just doesn't require them |
| A feature moved to `specs/archive/` (agreed, implemented) | `openspec/specs/<capability>/spec.md`, plus the originating change moved to `openspec/changes/archive/` |

This change does **not** perform that migration for the three features currently in
`specs/active/`. It only defines the mapping so that:

- Any **new** feature starts directly under `openspec/changes/<change-id>/`.
- An existing `specs/active/` feature is ported into `openspec/changes/<change-id>/`
  only when work on it resumes — as a small, dedicated step at the start of that work,
  not as a bulk migration today.

## 2. Handling legacy specs (`specs/active/`, `specs/archive/`)

- `specs/active/` and `specs/archive/` are **left in place** and are not deleted,
  emptied, or rewritten by this change.
- They are treated as a **frozen historical record** for any feature that is not
  actively being picked back up. `docs/ai/feature-spec-template.md` keeps documenting
  the old format so those files remain readable in context.
- The three currently-open folders under `specs/active/` (`worker-document-uploads`,
  `worker-self-service-documents`, `worker-documents-ux-and-delete`) are not touched by
  this change. Each carries its own `Status` field already; when work on one of them
  next resumes, that is the point at which it gets ported into an
  `openspec/changes/<change-id>/` folder — not before.
- No new work should be added to `specs/active/` after this change merges. New features
  start directly under `openspec/changes/`.
- `AGENTS.md` is updated in this foundation PR to remove the stale instruction ("First
  create or update a spec under `specs/active/<feature-name>/`") and point future work
  to `openspec/changes/<change-id>/`. The update is intentionally minimal and preserves
  the existing safety rules, Bun commands, Supabase safety rules, and secret-handling
  rules.

## 3. Introducing TypeScript gradually

No TypeScript dependency or file is added in this change. The following four phases are
the agreed plan for *future*, separate changes:

**Phase 0 — Tooling only (next change, not this one)**
- Add `typescript`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` as
  dev dependencies (`bun add -d ...`).
- Add a `tsconfig.json` with `allowJs: true`, `checkJs: false`, `strict: true` for new
  `.ts`/`.tsx` files only — existing `.js`/`.jsx` files are not type-checked.
- Update `eslint.config.js` to parse `.ts`/`.tsx` alongside `.js`/`.jsx` (see Section 4).
- No existing file is renamed or converted in this phase either — it only makes the
  toolchain able to build a `.ts`/`.tsx` file if one is added afterward.

**Phase 1 — Leaf utilities and types**
- New, dependency-light modules (e.g. `src/services/api*.js` helpers, pure utility
  functions, shared type/interface definitions) are written directly as `.ts` going
  forward. Existing `.js` services are converted opportunistically, one file at a time,
  only when that file is already being modified for a real feature — never as a
  standalone rename-only PR.

**Phase 2 — Leaf components**
- New presentational/leaf React components (few or no children-as-render-prop patterns,
  small prop surfaces) are written as `.tsx`. Conversion of existing `.jsx` leaf
  components follows the same "only when already touched" rule as Phase 1.

**Phase 3 — Shared/complex components**
- Higher-traffic shared components (`src/ui/*`, layout components, anything with a
  large or render-prop-heavy prop surface, e.g. `Table.jsx`) are converted last, since
  they are the ones `react/prop-types` was protecting most and where a bad conversion
  has the widest blast radius.

Each phase is its own OpenSpec change with its own verification plan; this document only
records the agreed order so future proposals don't need to re-litigate it.

## 4. ESLint adjustments during the migration

- **This change**: `eslint.config.js` is not modified at all.
- **Phase 0 (future change)**: extend the `files` glob to include `**/*.{ts,tsx}`,
  swap in `@typescript-eslint/parser` for those files, and layer in
  `@typescript-eslint/eslint-plugin`'s recommended rules for `.ts`/`.tsx` only —
  `.js`/`.jsx` files keep today's parser/rule set unchanged.
- **`react/prop-types` is disabled, but only for `.ts`/`.tsx` files, and only once those
  files carry real TypeScript prop types.** It stays **on** for `.js`/`.jsx` files for
  as long as any exist, since that's the only prop-shape checking they have. Concretely,
  this means splitting the current single `files: ['**/*.{js,jsx}']` block into a
  `.js/.jsx` block (unchanged rules, `react/prop-types` on) and a `.ts/.tsx` block
  (`react/prop-types` off, relying on TS instead) — not a global rule flip.
- The following rules stay **active and unchanged for both `.js`/`.jsx` and `.ts`/`.tsx`**
  throughout every phase, because they catch real runtime bugs that TypeScript's type
  checker does not (hook call order, scope/reference errors, dead code) rather than
  standing in for a type system:
  - `react-hooks/rules-of-hooks`
  - `no-undef`
  - `no-unused-vars` (becomes `@typescript-eslint/no-unused-vars` for `.ts`/`.tsx`
    files specifically, once Phase 0 lands, so it understands type-only imports —
    same intent, TS-aware implementation)

## 5. Lint noise vs. real defects (baseline: `bun run lint`, 304 problems today)

Ran `bun run lint` against the current tree to classify the existing baseline:

| Rule | Count | Classification |
|---|---:|---|
| `react/prop-types` | 240 | **Noise.** This is exactly the gap TypeScript prop types close. Not worth hand-fixing per-component; will disappear file-by-file as each component converts to `.tsx` with real prop types (Section 3). |
| `no-unused-vars` | 39 | **Real defect.** Dead code/imports; must be fixed on its own merits, independent of the TS migration. Stays active per-file. |
| `react/no-unescaped-entities` | 12 | **Real defect** (JSX text correctness, e.g. an unescaped `'`/`"`). Unrelated to typing; not affected by TS migration. |
| `react-hooks/rules-of-hooks` | 7 | **Real defect, verified.** Inspected the flagged files — these are genuine conditional/loop hook calls (e.g. a hook called after an early return, or inside a component that can re-invoke it), which is a real runtime bug (hook state can desync across renders), not a stylistic nit. Must not be ignored or bulk-suppressed. |
| `react-hooks/exhaustive-deps` | 2 | **Real defect.** Possible stale-closure bugs; evaluated case by case, not blanket-ignored. |
| `react-refresh/only-export-components` | 2 | Already `warn`, not `error`; no change in classification, left as-is. |
| `react/jsx-no-undef` | 1 | **Real defect, verified.** One component references a `Spinner` symbol that is never imported/defined — this line would throw at runtime. |
| `no-undef` | 1 | **Real defect, verified.** One component references `setEditModal`, which does not exist in that scope — also a runtime `ReferenceError` waiting to happen. |

**Rule of thumb going forward:** if a lint rule's *entire purpose* is describing a
shape/contract that TypeScript will describe instead (prop shapes today; likely
`no-prop-types`-adjacent rules only), it is candidate noise to retire *per file*, only
once that file has real types, never globally and never as a blanket suppression. Every
other rule — anything catching a real runtime mistake (undefined references, hook
ordering, unused/dead code, stale dependencies, invalid JSX text) — stays active for the
full duration of the migration and is fixed as a normal bug, not deferred.

This change does not fix any of the 304 existing problems. It records the
classification so future PRs (including the ones that convert files to `.tsx`) know
which pre-existing errors they are allowed to leave alone versus which ones block merge
if newly introduced or touched.

## 6. Verification plan for this foundation PR

Since this change adds no code and no dependencies, verification is about confirming
nothing was touched that shouldn't be, plus reproducing the baseline numbers cited
above:

- [ ] `bun run lint` still reports the same 304-problem baseline (300 errors, 4
      warnings) — confirms this change introduced no new lint issues and didn't
      silently fix/suppress any existing ones.
- [ ] `bun run build` passes.
- [ ] `git diff --stat` (or equivalent) confirms no file under `src/`, `supabase/`, or
      `eslint.config.js` was modified — only `openspec/**` and `AGENTS.md`
      documentation were touched.
- [ ] `specs/active/` and `specs/archive/` are unchanged (`git status` shows no
      modifications or deletions under `specs/`).
- [ ] Manual read-through of `openspec/changes/openspec-ts-migration-foundation/{proposal,design,tasks}.md`
      confirms all 7 required topics (OpenSpec structure, legacy-spec handling, TS
      phase plan, ESLint plan, noise classification, defect classification,
      verification plan) are each addressed by name.
