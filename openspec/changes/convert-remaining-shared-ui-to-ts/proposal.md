# Proposal: Convert Remaining Shared UI to TS

## Status

Draft — Phase 1 implemented in this pass; Phase 2 (Modal/Menus/Tag/Empty) and Phase 3
(Table) not started.

## Why

`convert-app-shell-to-ts` finished the app shell/navigation layer. This change covers
the rest of `src/ui/`'s shared components, deliberately split into 3 phases inside one
OpenSpec change so each phase can be reviewed independently before the next starts —
per explicit instruction, only Phase 1 is implemented now.

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

- No other component converted. `Modal.jsx`, `Menus.jsx`, `Tag.jsx`, `Empty.jsx`
  (Phase 2) and `Table.jsx` (Phase 3) are explicitly deferred.
- No feature component, PDF component, Supabase/`services` file, or route page
  touched.
- `children.props.id` access in `FormRow`/`FormRowVertical` preserved exactly — typed
  as `ReactElement<{ id?: string }>`, not redesigned to accept arbitrary `ReactNode`
  (verified against every real call site — see `design.md` Section 1).
- `Select`'s dead `type === "white"` branch is preserved, not removed or "fixed."
- No dependency added; `eslint.config.js`/`tsconfig.json`/`package.json` untouched.

## Impact

- **Affected code:** 5 files renamed `src/ui/*.jsx` → `src/ui/*.tsx`. No other file
  (see `design.md` for the explicit-`.jsx`-import grep results).
- **Affected lint baseline:** `react/prop-types` errors disappear for `FormRow` (6) and
  `FormRowVertical` (5) — 11 total. `Input`/`Textarea`/`Select` had 0 to begin with
  (no wrapper function, no custom-prop React component for the rule to inspect).
