# Tasks — convert-remaining-shared-ui-to-ts

Status: **Phase 1 implemented; typecheck/lint verified.** Phase 2 and Phase 3 not
started — do not begin either without explicit instruction to continue. Build was
reported passing by the implementer, but the independent review run timed out locally
after Vite started; rerun locally before commit if a clean build transcript is required.

## Phase 1: form/base inputs — DONE

### Change artifacts

- [x] Write `proposal.md`.
- [x] Write `design.md`.
- [x] Write `tasks.md` (this file).

### Pre-conversion checks

- [x] Confirmed `src/ui/FileInput.jsx` and `src/ui/Checkbox.jsx` do not exist anywhere
      in the repo (`find`/`ls`, case-insensitive) — not invented; converted the 5
      files that do exist instead (see `design.md` Section 0).
- [x] Ran `bun run lint` and recorded the exact per-file baseline for all 5 real
      target files: `FormRow.jsx` 6, `FormRowVertical.jsx` 5, `Input.jsx`/
      `Textarea.jsx`/`Select.jsx` 0 each (see `design.md` Section 1).
- [x] Grepped every real call site of `FormRow`/`FormRowVertical` (16 total across
      `src/features/**`) to confirm `children` is always a single element when
      `label` is passed, and that `error` is always `errors?.field?.message`
      (`string | undefined`) — see `design.md` Section 2.
- [x] Grepped every real call site of `Select` for a `type="white"` usage — found
      none; the branch is dead code today, preserved as-is (`design.md` Section 3).
- [x] Grepped for explicit `.jsx`-extension imports of all 5 target files across
      `src/` — found none (`design.md` Section 5).

### Conversion

- [x] `src/ui/FormRow.tsx` — `FormRowProps`
      (`label?: string`, `error?: string`, `alignTop?: boolean`,
      `children: ReactElement<{ id?: string }>`), typed `$alignTop` generic on
      `StyledFormRow`. Deleted `FormRow.jsx`.
- [x] `src/ui/FormRowVertical.tsx` — `FormRowVerticalProps`
      (`label?: string`, `error?: string`, `children: ReactElement<{ id?: string }>`).
      Deleted `FormRowVertical.jsx`.
- [x] `src/ui/Input.tsx` — no interface needed. Deleted `Input.jsx`.
- [x] `src/ui/Textarea.tsx` — no interface needed. Deleted `Textarea.jsx`.
- [x] `src/ui/Select.tsx` — `SelectOwnProps` (`type?: "white"`). Deleted `Select.jsx`.
- [x] No import path updated anywhere (confirmed unnecessary in pre-conversion
      checks).
- [x] No other file modified; no `eslint.config.js`/`tsconfig.json`/`package.json`
      change.

### Verification — results

- [x] `bun run typecheck` — passes, no errors, first attempt.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **271 problems (267 errors, 4 warnings)**, down from 282
      by exactly the predicted 11.
- [x] `git status`/`git diff --stat` — changed-file set is exactly the 5
      `.jsx` → `.tsx` renames and `openspec/changes/convert-remaining-shared-ui-to-ts/**`.
      No other file.

## Phase 2: overlay/compound/simple display — NOT STARTED

- [ ] `src/ui/Modal.jsx`
- [ ] `src/ui/Menus.jsx`
- [ ] `src/ui/Tag.jsx`
- [ ] `src/ui/Empty.jsx`

Do not begin without explicit instruction.

## Phase 3: table — NOT STARTED

- [ ] `src/ui/Table.jsx`

Do not begin without explicit instruction. Highest-risk file in the remaining
migration — convert only after Phase 2 is reviewed.

## Not in scope for this change (any phase)

- [ ] Creating `FileInput`/`Checkbox` components — never existed; a new-feature
      decision, not part of a TS-migration rename.
- [ ] Converting any feature component, PDF component, Supabase/`services` file, or
      route page.
- [ ] Fixing `Select`'s dead `type === "white"` branch, or any other pre-existing
      lint/behavior issue.
