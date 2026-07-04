# Tasks — convert-remaining-shared-ui-to-ts

Status: **Phase 1 and Phase 2 implemented; typecheck/lint verified.** The implementer
reported build passing, but independent review runs timed out locally after Vite
started. **Phase 3 not started** — do not begin without explicit instruction to
continue.

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

## Phase 2: overlay/compound/simple display — DONE

### Pre-conversion checks

- [x] Confirmed `src/ui/Tag.jsx` and `src/ui/Empty.jsx` do not exist anywhere in the
      repo (`find`/`ls`, case-insensitive) — not invented; converted the 2 files that
      do exist instead (see `design.md` Phase 2 Section 0).
- [x] Ran `bun run lint` and recorded the exact per-file baseline: `Modal.jsx` 3,
      `Menus.jsx` 7 (see `design.md` Phase 2 Section 1).
- [x] Read every real `Modal.Open`/`Modal.Window` call site (14 files) to confirm
      `children` is always a single element compatible with `cloneElement`'s merged
      `onClick`/`onCloseModal` prop (`design.md` Section 3).
- [x] Grepped every real `Menus.Toggle`/`Menus.List` call site (8 files) and
      cross-checked `src/types/supabase.ts` to confirm `id` is always a Supabase
      `number` primary key, not a `string` (`design.md` Section 4).
- [x] Grepped for explicit `.jsx`-extension imports of `Modal`/`Menus` across `src/`
      — found none (`design.md` Section 7).

### Conversion

- [x] `src/ui/Modal.tsx` — compound API (`Modal`, `Modal.Open`, `Modal.Window`)
      preserved exactly. `ModalContext` typed `ModalContextValue | undefined`,
      consumed via `useContext(ModalContext)!` (non-null assertion, not a new guard —
      see `design.md` Section 2). `Open`'s/`Window`'s `children` typed as the
      narrowest `ReactElement<...>` `cloneElement` requires. Deleted `Modal.jsx`.
- [x] `src/ui/Menus.tsx` — compound API (`Menus`, `Menus.Menu`, `Menus.Toggle`,
      `Menus.List`, `Menus.Button`) preserved exactly. `MenusContext`'s `openId`/`id`
      typed `string | number` (matches real usage, not narrowed to `string` — see
      `design.md` Section 4). Deleted `Menus.jsx`.
- [x] Fixed the one unplanned issue found via `bun run typecheck`: `useOutsideClick.js`
      (out of scope, untyped) returns a `ref` inferred as
      `MutableRefObject<undefined>`; added a local
      `as unknown as RefObject<HTMLDivElement/HTMLUListElement>` cast at the one call
      site in each file — `useOutsideClick.js` itself is untouched (`design.md`
      Section 5).
- [x] `Menus.List`'s `position={position!}` — non-null assertion matching the
      existing implicit assumption that `position` is always set by the time `List`
      renders (`design.md` Section 6).
- [x] No import path updated anywhere (confirmed unnecessary in pre-conversion
      checks).
- [x] No other file modified; no `eslint.config.js`/`tsconfig.json`/`package.json`
      change.

### Verification — results

- [x] `bun run typecheck` — failed once (`useOutsideClick` ref typing), fixed, then
      passes with no errors.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **261 problems (257 errors, 4 warnings)**, down from 271
      by exactly the predicted 10 (`Modal` 3, `Menus` 7).
- [x] `git status`/`git diff --stat` — changed-file set is exactly: `Modal.jsx`/
      `Menus.jsx` deleted, `Modal.tsx`/`Menus.tsx` added, and this change's own
      `proposal.md`/`design.md`/`tasks.md` updated. No other file.

## Phase 3: table — NOT STARTED

- [ ] `src/ui/Table.jsx`

Do not begin without explicit instruction. Highest-risk file in the remaining
migration — convert only after Phase 2 is reviewed.

## Not in scope for this change (any phase)

- [ ] Creating `FileInput`/`Checkbox`/`Tag`/`Empty` components — none exist; a
      new-feature decision, not part of a TS-migration rename.
- [ ] Converting any feature component, PDF component, Supabase/`services` file, or
      route page.
- [ ] Converting `useOutsideClick.js` (the local cast in `Modal.tsx`/`Menus.tsx`
      is the accepted workaround for now — see `design.md` Phase 2 Section 5).
- [ ] Fixing `Select`'s dead `type === "white"` branch, or any other pre-existing
      lint/behavior issue.
