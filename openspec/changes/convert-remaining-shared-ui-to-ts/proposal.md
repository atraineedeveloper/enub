# Proposal: Convert Remaining Shared UI to TS

## Status

Draft — Phase 1, Phase 2, and Phase 3 all implemented. This is the final phase of the
`src/ui/` shared-component migration.

## Why

`convert-app-shell-to-ts` finished the app shell/navigation layer. This change covers
the rest of `src/ui/`'s shared components, deliberately split into 3 phases inside one
OpenSpec change so each phase can be reviewed independently before the next starts.
All three phases are now implemented.

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

## What changes (Phase 1)

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

- No other component converted in Phase 1. `Table.jsx` was deferred until Phase 3
  and is now covered below.
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

## What changes (Phase 3)

- `src/ui/Table.jsx` → `.tsx`: compound API (`Table`, `Table.Header`, `Table.Row`,
  `Table.Body`, `Table.Footer`) preserved exactly, including `Table.Footer` being the
  bare `Footer` styled-component itself (no wrapper function — assigned directly, same
  as the original).
  - `TableContext` typed as `{ columns: string } | undefined`, consumed via a
    non-null assertion (`useContext(TableContext)!`) at `Header`/`Row` — same
    established pattern as Phase 2's `ModalContext`/`MenusContext`, preserving the
    exact "crash if used outside `<Table>`" behavior rather than adding a new guard.
  - `CommonRow` (and by extension `StyledHeader`/`StyledRow`, both `styled(CommonRow)`)
    given a typed `columns: string` generic — confirmed via grep that every real
    `<Table columns="...">` call site (7 files) passes a literal CSS
    `grid-template-columns` string.
  - `Table.Body` is generic: `function Body<T>({ data, render }: { data: T[]; render: (item: T) => ReactNode })`.
    This is the one place in the whole migration where a real generic is used, per
    the "generics only where the existing API clearly requires them" instruction —
    confirmed necessary by checking all 7 real `render` call sites, which each accept
    exactly one item and return JSX; a non-generic `data: unknown[]` would make
    `render`'s narrower parameter type a real type error for any future `.tsx` caller
    (contravariance), while a generic correctly relates `data`'s element type to
    `render`'s parameter type without inventing any new API shape.

## What does not change (Phase 3, additional to Phase 1/2)

- No other component converted — this is the last file in
  `openspec-ts-migration-foundation`'s Phase 3 (shared/complex components) list.
- `Table`'s empty-state text, grid layout, responsive breakpoints, and footer
  auto-hide (`:not(:has(*))`) CSS are byte-identical.
- No new prop, no renamed prop, no restructured compound API member.

## Impact (Phase 3)

- **Affected code:** 1 file renamed `src/ui/Table.jsx` → `src/ui/Table.tsx`. No other
  file (see `design.md` for the explicit-`.jsx`-import grep result).
- **Affected lint baseline:** `react/prop-types` errors disappear for `Table` — 8
  total (`columns`, `children` ×3, `data`, `render`, `data.length`, `data.map`).

## Migration complete

With Phase 3 done, every file in `src/ui/` that this 3-phase change and the three
preceding changes (`convert-first-ui-component-to-ts`,
`convert-simple-ui-components-to-ts`, `convert-core-ui-components-to-ts`,
`convert-app-shell-to-ts`) targeted is now `.tsx`. Remaining `.jsx` in the repo is
`src/features/**`, `src/pages/**`, `src/pdf/**`, `src/context/**`, and a handful of
still-untouched `src/ui/*.jsx` files not named in any of these changes
(`AppLayout.jsx`, `DarkModeToggle.jsx`, `Form.jsx`, `Row.jsx`, `WorkerAppLayout.jsx`) —
none of which were in scope here and none of which this change touches.
