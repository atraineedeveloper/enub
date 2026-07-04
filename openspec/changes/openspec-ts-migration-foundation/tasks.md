# Tasks — openspec-ts-migration-foundation

Status: in progress. This PR is documentation/process only — no `src/`,
`eslint.config.js`, or dependency changes.

## Phase 1: OpenSpec scaffold and this change's artifacts

- [x] Confirm `openspec/config.yaml`, `openspec/specs/`, `openspec/changes/`,
      `openspec/changes/archive/` exist (already scaffolded before this change).
- [x] Write `openspec/changes/openspec-ts-migration-foundation/proposal.md`.
- [x] Write `openspec/changes/openspec-ts-migration-foundation/design.md`.
- [x] Write `openspec/changes/openspec-ts-migration-foundation/tasks.md` (this file).

## Phase 2: Baseline measurement (informs design.md, no code changes)

- [x] Run `bun run lint` against the current tree to get the real baseline: 304
      problems (300 errors, 4 warnings).
- [x] Break the baseline down by rule and classify each as noise-during-TS-migration
      vs. real defect (see `design.md` Section 5).
- [x] Spot-check every rule with a small count (`react-hooks/rules-of-hooks`,
      `no-undef`, `react/jsx-no-undef`) by reading the flagged source to confirm each
      is a genuine bug, not a false positive, before recording it as a real defect.

## Phase 3: Legacy spec handling (decision only, no files moved)

- [x] Decide and document in `design.md` that `specs/active/` and `specs/archive/`
      are left untouched by this change.
- [x] Decide and document the mapping from `specs/active/<feature>/*.md` to
      `openspec/changes/<change-id>/*.md` / `openspec/specs/<capability>/spec.md`,
      for future changes to follow.
- [x] Update `AGENTS.md`'s stale `specs/active/<feature-name>/` instruction to point
      future work to `openspec/changes/<change-id>/`, while preserving the existing
      safety rules, Bun commands, Supabase safety rules, and secret-handling rules.

## Phase 4: Verification

- [ ] `bun run lint` — confirm the problem count is still exactly 304 (300 errors, 4
      warnings), i.e. unchanged from the Phase 2 baseline.
- [ ] `bun run build` — passes.
- [ ] `git status` / `git diff --stat` — confirm only `openspec/**` and `AGENTS.md`
      changed; nothing under `src/`, `supabase/`, `specs/`, or `eslint.config.js` was
      touched.
- [ ] Re-read `proposal.md` and `design.md` against the original request to confirm
      all 7 required topics are present: OpenSpec structure, legacy-spec handling, TS
      phase plan, ESLint adjustment plan, noise classification, defect classification,
      verification plan.

## Not in scope for this change (tracked here so it isn't lost, not to be started yet)

- [ ] Add `typescript`/`@typescript-eslint/*` dev dependencies (`bun add -d ...`).
- [ ] Add `tsconfig.json`.
- [ ] Split `eslint.config.js` into a `.js/.jsx` block and a `.ts/.tsx` block, and
      disable `react/prop-types` for the latter only.
- [ ] Convert any `.js`/`.jsx` file to `.ts`/`.tsx`.
- [ ] Fix any of the 39 `no-unused-vars`, 12 `react/no-unescaped-entities`, 7
      `react-hooks/rules-of-hooks`, 2 `react-hooks/exhaustive-deps`, 1 `no-undef`, or 1
      `react/jsx-no-undef` real-defect lint errors identified in `design.md` Section 5.
      These are real bugs and should be fixed as their own small, targeted change(s) —
      not bundled into this foundation PR, and not silently suppressed.
- [ ] Port any of the three open `specs/active/` features into
      `openspec/changes/<change-id>/` — happens individually, only when work on that
      specific feature resumes.
