# Design: Convert Remaining Shared UI to TS

This is a multi-phase change. **Only Phase 1 is implemented in this pass**, per
explicit instruction. Phases 2 (`Modal`/`Menus`/`Tag`/`Empty`) and 3 (`Table`) are
listed for planning continuity only — not started, not designed in detail yet.

## 0. Requested-vs-actual file list

The requested Phase 1 target list named 7 files. Two — `src/ui/FileInput.jsx` and
`src/ui/Checkbox.jsx` — do not exist anywhere in this repository (`find`/`ls` across
`src/ui/` confirmed, case-insensitive). They are not invented as part of this change;
inventing a new component isn't a TS-migration task, it's a new-feature decision. The 5
files that do exist are converted:

`FormRow.jsx`, `FormRowVertical.jsx`, `Input.jsx`, `Textarea.jsx`, `Select.jsx`.

## 1. Pre-conversion baseline (confirmed via `bun run lint`, per file)

| File | `react/prop-types` |
|---|---:|
| `FormRow.jsx` | 6 (`label`, `error`, `children`, `alignTop`, `children.props`, `children.props.id`) |
| `FormRowVertical.jsx` | 5 (`label`, `error`, `children`, `children.props`, `children.props.id`) |
| `Input.jsx` | 0 |
| `Textarea.jsx` | 0 |
| `Select.jsx` | 0 |

Total to remove: **11**. `Input`/`Textarea`/`Select` are bare `styled.xxx` calls with
no wrapper function — same reason as `Spinner`/`ButtonIcon` in
`convert-core-ui-components-to-ts`: nothing for `react/prop-types` to have ever
flagged.

## 2. `FormRow.tsx` / `FormRowVertical.tsx` — the `children.props.id` constraint

Both components read `children.props.id` directly (to wire a `<label htmlFor={...}>`
to the wrapped control), which structurally requires `children` to be a single
`ReactElement` with an `id` prop — not a generic `ReactNode` (a string, number,
fragment, or array has no `.props`). Verified this holds at **every** real call site
across `src/features/**` (14 `FormRow` call sites, 2 `FormRowVertical` call sites)
before typing:

- Whenever `label` is passed, `children` is always exactly one element
  (`<Input>`, `<Select>`, `<Textarea>`, or a single wrapper `<div>` like
  `AdmissionsContainer` in `CreateEditWorkerForm.jsx`) — never an array or fragment.
- Whenever `children` is a `<Button>` (the "no label" action-row case, e.g.
  `<FormRow><Button>Cancelar</Button></FormRow>`), `label` is always absent, so
  `children.props.id` is never evaluated (`label && <Label htmlFor={children.props.id}>`
  short-circuits — the right-hand JSX, including `children.props.id`, is only
  evaluated if `label` is truthy). This was already true before conversion; typing
  doesn't change it.
- `children: ReactElement<{ id?: string }>` is the narrowest type that satisfies both
  cases: it requires a single element (matching every real call site), and makes
  `.props.id` well-typed as `string | undefined` (every native host element —
  `input`/`select`/`textarea`/`div`/`Button`'s underlying `button` — already accepts an
  optional `id`, so this doesn't reject any real caller).
- Not typed as `ReactElement` alone (which would make `.props` an untyped/`unknown`
  object with no `.id`) or as `ReactNode` (which lacks `.props` entirely and would be
  a type error at the `children.props.id` access) — both were considered and rejected
  because they'd either lose the `.id` access or require a cast, neither preserving
  the existing implicit contract as precisely as `ReactElement<{ id?: string }>` does.
- `FormRowProps` additionally has `alignTop?: boolean` (only `CreateEditWorkerForm.jsx`
  passes it, as a bare boolean shorthand prop) with a matching typed `$alignTop`
  generic added to `StyledFormRow` (transient prop, `$`-prefixed, unchanged from the
  original). `FormRowVerticalProps` has no `alignTop` — that prop doesn't exist on
  this component and wasn't added.
- `error?: string` on both — confirmed via grep that every real call site passes
  `error={errors?.<field>?.message}` (react-hook-form's `FieldError.message`, always
  `string | undefined`), never a `FieldError` object directly.

## 3. `Select.tsx` — a fully custom, non-native `type` prop

`Select`'s `type === "white"` branch reads a prop named `type` — but native
`<select>` has no `type` HTML attribute (unlike `<input>`/`<button>`), so this is
purely a custom prop invented by this component, not a shadowed native one.
`SelectOwnProps { type?: "white" }` types it as actually used. Confirmed by grep: **no
real call site anywhere passes `type="white"`** — the light-border branch is dead code
in practice today. This is preserved exactly, not removed or "cleaned up": the task is
a type-safe rename, not a dead-code pass.

One consequence, called out for future readers: because `type` isn't `$`-prefixed,
`styled-components`' default prop-forwarding still passes it through to the underlying
DOM `<select type="...">` when set — pre-existing, invalid-but-harmless HTML behavior,
unchanged by this conversion (renaming it to `$type` would change what's forwarded to
the DOM, i.e. change rendered output, which is out of scope here).

## 4. `Input.tsx` / `Textarea.tsx`

No custom prop interface added to either — both are bare `styled.input`/
`styled.textarea` calls with zero transient props. `id`, `type`, `value`, `onChange`,
`disabled`, and react-hook-form's `{...register(...)}` spread are all already covered
by `styled-components`' built-in native-element typing, confirmed by `bun run
typecheck` passing without any annotation.

## 5. Explicit-extension import check

Grepped `src/` for `ui/{FormRow,FormRowVertical,Input,Textarea,Select}.jsx` (the
pattern that broke builds in both `convert-core-ui-components-to-ts` and
`convert-app-shell-to-ts`) before running the build. **Zero matches** — every real
caller across `src/features/**` and `src/pages/**` already imports these 5
extension-less. No import path needed updating anywhere.

## 6. Verification plan — results

Baseline going in: **282 problems (278 errors, 4 warnings)**.

- [x] `bun run typecheck` — passes, no errors, on the first attempt.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **271 problems (267 errors, 4 warnings)**, down from 282
      by exactly the predicted 11 (`FormRow` 6, `FormRowVertical` 5;
      `Input`/`Textarea`/`Select` had 0 to begin with).
- [x] `git status`/`git diff --stat` — changed-file set is exactly: the 5
      `.jsx` → `.tsx` renames and `openspec/changes/convert-remaining-shared-ui-to-ts/**`.
      No other file.

## Phase 2 / Phase 3 — not started

Listed here only so the overall shape of the remaining work is visible in one place;
neither is designed or implemented in this pass.

- **Phase 2** (`Modal.jsx`, `Menus.jsx`, `Tag.jsx`, `Empty.jsx`): overlay/compound
  components — expect `Modal`/`Menus` in particular to need render-prop / compound
  -component (`Modal.Open`/`Modal.Window`) typing, likely the first real test of a
  generic context-based API in this migration.
- **Phase 3** (`Table.jsx`): the highest-risk remaining file per
  `openspec-ts-migration-foundation`'s original plan — large, render-prop-heavy prop
  surface (`data`, `render`, `columns`, compound `Table.Header`/`Table.Row`/etc.),
  deliberately converted last.
