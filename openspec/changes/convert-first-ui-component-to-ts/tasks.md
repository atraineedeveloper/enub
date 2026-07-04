# Tasks — convert-first-ui-component-to-ts

Status: done — implemented and verified.

## Phase 1: Change artifacts

- [x] Write `proposal.md`.
- [x] Write `design.md`.
- [x] Write `tasks.md` (this file).

## Phase 2: Pre-conversion checks

- [x] Grep every `ErrorMessage` import/usage in `src/` — confirmed all import without a
      file extension, so no import updates are needed after the rename.
- [x] Confirm `src/ui/ErrorMessage.jsx`'s exact current shape (one optional `message`
      prop, default string, no hooks/children/handlers).
- [x] Verify (via throwaway probe files, not part of this diff) whether
      `eslint.config.js` needs a change for `react/prop-types` to recognize a real TS
      prop type — confirmed it does not; see `design.md` Section 3.

## Phase 3: Conversion

- [x] Create `src/ui/ErrorMessage.tsx` with an explicit `ErrorMessageProps` interface
      (`message?: string`), same default value, same JSX, same `StyledErrorMessage`
      definition.
- [x] Delete `src/ui/ErrorMessage.jsx`.
- [x] No import statements changed anywhere (verified unnecessary in Phase 2).
- [x] No other file modified.

## Phase 4: Verification — results

- [x] `bun run typecheck` — passes, no errors.
- [x] `bun run build` — passes.
- [x] `bun run lint` — total: **303 problems (299 errors, 4 warnings)**, down from 304
      (300 errors, 4 warnings). Confirmed the removed error is exactly the
      `react/prop-types` "'message' is missing in props validation" previously reported
      for `src/ui/ErrorMessage.jsx:14`; no other rule/count changed.
- [x] `git status`/`git diff --stat` — changed-file set is exactly:
      `src/ui/ErrorMessage.jsx` (deleted), `src/ui/ErrorMessage.tsx` (added),
      `openspec/changes/convert-first-ui-component-to-ts/**` (new). No other `src/`
      file, no `eslint.config.js`, no `tsconfig.json`, no `package.json` change.

## Not in scope for this change

- [ ] Converting any other `.jsx` file.
- [ ] Any `eslint.config.js`/`tsconfig.json`/`package.json` change (confirmed
      unnecessary for this conversion — see `design.md` Section 3).
- [ ] Fixing any other pre-existing lint error.
