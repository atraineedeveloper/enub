# Proposal: Convert Remaining Shared UI to TS

## Status

Draft — Phase 1 and Phase 2 implemented; Phase 3 (Table) not started.

## Why

`convert-app-shell-to-ts` finished the app shell/navigation layer. This change covers
the rest of `src/ui/`'s shared components, deliberately split into 3 phases inside one
OpenSpec change so each phase can be reviewed independently before the next starts.
Phase 1 and Phase 2 are implemented; Phase 3 remains deferred.

## Discrepancy found before implementation: 2 of 7 listed Phase 1 files don't exist

The requested Phase 1 target list included `src/ui/FileInput.jsx` and
`src/ui/Checkbox.jsx`. Neither exists anywhere in this repository (confirmed by
`find`/`ls` across `src/ui/` — there is no file by either name, under any casing).
This change does **not** invent them. Phase 1 as actually implemented converts the
**5 files that do exist**:

- `src/ui/FormRow.jsx`
- `src/ui/FormRowVertical.jsx`
- `src/ui/Input.jsx`
- `src/ui/Textarea.jsx`
- `src/ui/Select.jsx`

If a file input or checkbox component is needed, that's a separate, new-component
decision for the user to make explicitly — out of scope for a rename-only TS migration
change.

## What changes (Phase 1 only)

- `src/ui/FormRow.jsx` → `.tsx`: `FormRowProps`
  (`label?: string`, `error?: string`, `alignTop?: boolean`,
  `children: ReactElement<{ id?: string }>`), plus a typed `$alignTop` generic on
  `StyledFormRow`.
- `src/ui/FormRowVertical.jsx` → `.tsx`: `FormRowVerticalProps`
  (`label?: string`, `error?: string`, `children: ReactElement<{ id?: string }>`) — no
  `alignTop` (that prop doesn't exist on this component).
- `src/ui/Input.jsx`, `src/ui/Textarea.jsx` → `.tsx`: no custom prop interface — both
  are bare `styled.input`/`styled.textarea` with zero transient props; native
  attributes (`id`, `value`, `onChange`, `disabled`, `type`, `{...register(...)}`
  spreads, etc.) already come from `styled-components`' built-in element typing.
- `src/ui/Select.jsx` → `.tsx`: `SelectOwnProps` (`type?: "white"`) — a fully custom,
  non-native prop (native `<select>` has no `type` attribute), typed exactly as
  currently used (only ever read inside the component's own CSS interpolation; no
  real call site anywhere passes `type="white"` today — the branch is currently dead
  in practice, and is preserved as-is, not removed).

## What does not change

- No other component converted. `Table.jsx` (Phase 3) is explicitly deferred.
- No feature component, PDF component, Supabase/`services` file, or route page
  touched.
- `children.props.id` access in `FormRow`/`FormRowVertical` preserved exactly — typed
  as `ReactElement<{ id?: string }>`, not redesigned to accept arbitrary `ReactNode`
  (verified against every real call site — see `design.md` Section 1).
- `Select`'s dead `type === "white"` branch is preserved, not removed or "fixed."
- No dependency added; `eslint.config.js`/`tsconfig.json`/`package.json` untouched.

## Impact

- **Affected code (Phase 1):** 5 files renamed `src/ui/*.jsx` → `src/ui/*.tsx`. No
  other file (see `design.md` for the explicit-`.jsx`-import grep results).
- **Affected lint baseline (Phase 1):** `react/prop-types` errors disappear for
  `FormRow` (6) and `FormRowVertical` (5) — 11 total. `Input`/`Textarea`/`Select` had 0
  to begin with (no wrapper function, no custom-prop React component for the rule to
  inspect).

## Discrepancy found before Phase 2: 2 of 4 listed Phase 2 files don't exist

The requested Phase 2 target list included `src/ui/Tag.jsx` and `src/ui/Empty.jsx`.
Neither exists anywhere in this repository (confirmed by `find`/`ls` across
`src/ui/`, same check as Phase 1's `FileInput`/`Checkbox` discrepancy). Phase 2 as
actually implemented converts the **2 files that do exist**:

- `src/ui/Modal.jsx`
- `src/ui/Menus.jsx`

As with Phase 1, no new component is invented to fill the gap — that would be a
new-feature decision, not a TS-migration rename.

## What changes (Phase 2)

- `src/ui/Modal.jsx` → `.tsx`: compound API (`Modal`, `Modal.Open`, `Modal.Window`)
  preserved exactly. `ModalContext` typed as
  `{ openName: string; close: () => void; open: (name: string) => void } | undefined`,
  consumed via a non-null assertion at each `useContext` call site (`useContext(ModalContext)!`)
  — preserves the exact original runtime behavior (a "Cannot destructure..." crash if
  ever used outside a `<Modal>` provider) rather than introducing a new, different
  guard/error. `Open`'s `children: ReactElement<{ onClick?: () => void }>`,
  `Window`'s `children: ReactElement<{ onCloseModal?: () => void }>` — both required by
  `cloneElement`, confirmed against every real call site (14 files using
  `Modal.Open`/`Modal.Window`).
- `src/ui/Menus.jsx` → `.tsx`: compound API (`Menus`, `Menus.Menu`, `Menus.Toggle`,
  `Menus.List`, `Menus.Button`) preserved exactly. `MenusContext` typed with
  `openId: string | number` (not narrowed to `string`) — every real call site passes a
  numeric Supabase row `id` (confirmed via `src/types/supabase.ts`: `workers.id`,
  `degrees.id`, `roles.id`, etc. are all `number`), so `openId`'s actual runtime type
  is `string | number` (starts `""`, becomes whatever numeric `id` is opened) even
  though the `useState` initializer is a string literal. Typing it as plain `string`
  would reject every real call site; `string | number` is the type that's actually
  used, not a guess or a widening for its own sake.

## What does not change (Phase 2, additional to the Phase 1 list)

- `useOutsideClick.js` (the hook both `Modal.jsx`/`Menus.jsx` depend on) is not
  converted or modified — stays `.js`, consumed via `allowJs` interop exactly as
  before.
- No compound-component API renamed, restructured, or given new safety checks not
  present in the original (e.g. no new thrown `Error` for misuse — see the
  non-null-assertion note above).
- `Menus`'s positioning/outside-click/toggle logic (`Toggle`'s `getBoundingClientRect`
  math, `List`'s portal, `useOutsideClick`) is byte-identical, only typed.

## Impact (Phase 2)

- **Affected code:** 2 files renamed `src/ui/*.jsx` → `src/ui/*.tsx`. No other file.
- **Affected lint baseline:** `react/prop-types` errors disappear for `Modal` (3) and
  `Menus` (7) — 10 total.
