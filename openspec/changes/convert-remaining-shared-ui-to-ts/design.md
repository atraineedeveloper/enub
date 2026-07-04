# Design: Convert Remaining Shared UI to TS

This is a multi-phase change. **Phase 1 and Phase 2 are implemented.** Phase 3
(`Table`) is listed for planning continuity only — not started, not designed in
detail yet, and must not be started without explicit instruction.

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

## Phase 2: overlay/compound components

### 0. Requested-vs-actual file list

The requested Phase 2 target list named 4 files. Two — `src/ui/Tag.jsx` and
`src/ui/Empty.jsx` — do not exist anywhere in this repository (confirmed by
`find`/`ls` across `src/ui/`, same check as Phase 1's `FileInput`/`Checkbox`
discrepancy). Not invented. Phase 2 converts the **2 files that do exist**:
`Modal.jsx`, `Menus.jsx`.

### 1. Pre-conversion baseline (confirmed via `bun run lint`, per file)

| File | `react/prop-types` |
|---|---:|
| `Modal.jsx` | 3 (`children` on `Modal`, `children` + `name` on `Window`) |
| `Menus.jsx` | 7 (`children` on `Menus`; `id` on `Toggle`; `id` + `children` on `List`; `children` + `icon` + `onClick` on `Button`) |

Total to remove: **10**. Notably, `Modal.Open`'s own props (`children`, `opens`) are
**not** flagged by `react/prop-types` at all in the baseline — confirmed by directly
inspecting the full unfiltered lint output for `Modal.jsx` (not just a truncated
grep). Recorded as observed, not further explained — irrelevant to typing correctness
either way, since `Open`'s props are typed regardless of whether the old rule
happened to flag them.

### 2. `ModalContext`/`MenusContext` — preserving the exact "used outside provider" behavior

Both contexts are created with `createContext()` and **no default value** in the
original `.jsx` — meaning `useContext(...)` returns `undefined` if a compound
sub-component is ever rendered outside its provider, and the original code
immediately destructures it (`const { open } = useContext(ModalContext);`), which
would throw a runtime `TypeError: Cannot destructure property 'open' of 'undefined'`
in that misuse case. This is existing behavior, not a designed safeguard.

Typed as `createContext<ModalContextValue | undefined>(undefined)` /
`createContext<MenusContextValue | undefined>(undefined)`, with a **non-null
assertion** at every consuming call site: `useContext(ModalContext)!`. This was
chosen deliberately over adding a new explicit "must be used within `<Modal>`" thrown
`Error` (a common React-TS pattern) specifically because the brief said "preserve
context behavior exactly" — a non-null assertion is erased at compile time (zero
runtime effect), so the exact same crash, with the exact same message, still happens
in the same misuse case. An explicit guard would be a real, if minor, behavior change
(a different error type/message) that wasn't asked for.

### 3. `Modal`'s `cloneElement` typing

- `Open`'s `children: ReactElement<{ onClick?: () => void }>` — `cloneElement(children, { onClick: ... })`
  requires `children` to be a single element accepting `onClick`. Checked against
  every real `Modal.Open` call site (14 files): children are always exactly one
  element — either a `<Button>`/`<Menus.Button>` (both already accept an optional
  `onClick`) or a custom icon-link component — never an array or fragment.
- `Window`'s `children: ReactElement<{ onCloseModal?: () => void }>` — same
  reasoning for `cloneElement(children, { onCloseModal: close })`; every real
  `Modal.Window` child is a single form/view component (e.g. `CreateSemesterForm`,
  `ConfirmDelete`, `LinkWorkerAccountForm`). Untyped `.jsx` children (most of them)
  structurally accept the merge because `ReactElement<P>` for an untyped component
  infers a permissive prop shape; `bun run typecheck` confirms this holds for every
  real call site, not just in theory.
- `Modal`'s own `children: ReactNode` (not `ReactElement`) — it only renders
  `{children}` directly inside the context provider, with no `cloneElement`, so the
  broader type is correct and matches the "prefer `ReactNode` unless `cloneElement`
  requires `ReactElement`" instruction.

### 4. `Menus`'s `id`/`openId` — `string | number`, not `string`

`Toggle`/`List`'s `id` prop and the context's `openId` are typed `string | number`,
**not** `string`. The `useState("")` initializer suggested `string` at first glance,
but every real call site (`Menus.Toggle id={worker.id}`, `id={role.id}`, `id={degree.id}`,
etc. — 8 files) passes a Supabase row's numeric primary key. Confirmed directly
against `src/types/supabase.ts`: `workers.id`, `degrees.id`, `roles.id`,
`state_roles.id`, `study_programs.id`, `groups.id`, `utilities.id` are all typed
`number`. Since `open` is literally `setOpenId` (no transformation), `openId`'s real
runtime type after first use is whatever `id` type was passed — `string | number` is
what's actually used, not a guess or an unnecessary widening. Typing it as bare
`string` would have made every real call site a type error.

### 5. Unplanned but necessary: `useOutsideClick`'s untyped `ref`

`bun run typecheck` failed initially in both files:
`Type 'MutableRefObject<undefined>' is not assignable to type 'LegacyRef<HTMLDivElement>'`
(and the `HTMLUListElement` equivalent in `Menus.tsx`). Cause: `useOutsideClick.js`
(`src/hooks/useOutsideClick.js`, out of scope for this change) calls a bare
`useRef()` with no initial value and no type argument, which TypeScript infers as
`MutableRefObject<undefined>` — structurally incompatible with the `RefObject<T>` a
JSX `ref` prop expects (`current: T | null`, not `current: undefined`).

Fixed with a type-only cast at each of the two call sites, **not** by modifying
`useOutsideClick.js`:

```ts
const ref = useOutsideClick(close) as unknown as RefObject<HTMLDivElement>;
```

(`HTMLUListElement` in `Menus.tsx`.) The double cast through `unknown` was required —
TypeScript's direct-cast overlap check (`as RefObject<HTMLDivElement>` alone) rejected
the conversion as "insufficient overlap," which is exactly TS's standard signal for
"this is a deliberate reinterpretation, route it through `unknown`." Same class of fix
as `convert-core-ui-components-to-ts`'s `Button` cast in `Pagination`/`ConfirmDelete`:
a local, type-only workaround for an out-of-scope untyped dependency, zero runtime
effect, not a change to the hook's behavior or signature.

### 6. `StyledList`'s `position` prop

`Menus.List` reads `position` from context as `Position | null` (matches
`useState<Position | null>(null)`), but passes it to `StyledList` — which, in the
original `.jsx`, unconditionally reads `props.position.x`/`props.position.y` with no
null guard, an existing assumption that `position` is always set by the time `List`
ever renders (since `List` only renders when `openId === id`, and reaching that state
requires `Toggle`'s `handleClick` to have already called `setPosition` first). Typed
`StyledList` as `styled.ul<{ position: Position }>` (non-null) and pass
`position={position!}` at the one call site — a non-null assertion matching the
existing implicit assumption exactly, not a new runtime check.

### 7. Explicit-extension import check

Grepped `src/` for `ui/{Modal,Menus}.jsx` (the pattern that broke builds in
`convert-core-ui-components-to-ts` and `convert-app-shell-to-ts`) before running the
build. **Zero matches** — every real caller (14 files using `Modal`, 8 using `Menus`)
already imports both extension-less.

### 8. Verification plan — results

Baseline going in: **271 problems (267 errors, 4 warnings)**.

- [x] `bun run typecheck` — failed once (Section 5, the `useOutsideClick` ref typing),
      fixed with the local cast, then passes with no errors.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **261 problems (257 errors, 4 warnings)**, down from 271
      by exactly the predicted 10 (`Modal` 3, `Menus` 7).
- [x] `git status`/`git diff --stat` — changed-file set is exactly: `Modal.jsx`/
      `Menus.jsx` deleted, `Modal.tsx`/`Menus.tsx` added, plus this change's own
      `proposal.md`/`design.md`/`tasks.md` updates. No other file.

## Phase 3 — not started

`Table.jsx`: the highest-risk remaining file per `openspec-ts-migration-foundation`'s
original plan — large, render-prop-heavy prop surface (`data`, `render`, `columns`,
compound `Table.Header`/`Table.Row`/etc.), deliberately converted last. Not designed
or implemented in this pass; do not start without explicit instruction.
