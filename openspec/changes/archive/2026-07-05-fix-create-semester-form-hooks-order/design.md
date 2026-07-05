# Design: Fix CreateSemesterForm Hooks-Order Errors

## 1. Diagnosis — this was never a real conditional-hook-call bug

Reading `CreateSemesterForm.tsx`'s actual structure:

```tsx
function CreateSemesterForm({ onCloseModal }: CreateSemesterFormProps) {
  const queryClient = useQueryClient();          // line 15
  const { register, handleSubmit, reset, formState } = useForm();  // line 17
  const { mutate, isPending: isCreating } = useMutation({ ... });  // line 20

  function onSubmit(data: object) { mutate(data); }

  // ... two `for` loops building `options`/`optionsYear` ...

  return ( ... );
}
```

All three hooks are the first three statements in the component, unconditional, same
order every render, no early return before them. There is nothing here for a
correctly-functioning rules-of-hooks check to flag.

## 2. Root cause, confirmed by direct experiment

`package.json` pins `eslint-plugin-react-hooks@^5.1.0-rc.0` — a **release candidate**
of that plugin's v5 rewrite, which replaced the old regex/heuristic-based
rules-of-hooks checker with a new control-flow-graph-based analyzer. Built two
throwaway probe files (not part of this diff, deleted immediately after) to isolate
the trigger:

- **Probe A** — a component calling `useQueryClient`/`useForm`/`useMutation`
  unconditionally, no loop anywhere: **lint-clean**.
- **Probe B** — identical hooks, plus one plain `for (let i = 0; i < 3; i++) { ... }`
  loop *after* the hooks, never touching them: reproduced the **exact same 3 errors**,
  same message ("may be executed more than once. Possibly because it is called in a
  loop"), on the exact hook-call lines.
- **Probe C** — same as Probe B, but the `for` loop replaced with
  `Array.from({ length: 3 }, (_, i) => i)` (equivalent result, no `ForStatement` AST
  node): **lint-clean** again.

This confirms the false positive is triggered by the mere **presence** of a `for`
loop anywhere in the same component function — not by the loop wrapping, preceding,
or interacting with the hook calls in any way. This is a known class of bug in
early-RC rewrites of static-analysis lint rules (the CFG builder mis-attributes a
later loop's "may repeat" property backward onto earlier, unrelated statements in the
same function). `CreateSemesterForm.tsx` has two real `for` loops (building the
`options`/`optionsYear` dropdown arrays) — the only TS-migrated form in this app that
does — which is exactly why it, uniquely, has shown this error since before the
TS migration began.

## 3. The fix: remove the `for` loops, not touch the hooks

Per the brief's own preference order ("prefer moving hooks before conditional
returns or extracting a small inner component... if a guard/early return is still
needed, place it after all hooks") — none of those apply here, since there was never
a conditional/early-return/loop *around* the hooks to move. The actual fix is
upstream of that: remove the *unrelated* `for` loops that were confusing the
analyzer, since they're what the experiment identified as the real trigger.

Before:

```ts
const options = [];
const optionsYear = [];

for (let i = 0; i < 3; i++) {
  const year = currentYear + i;
  options.push(`${year.toString().slice(-2)}A`);
  options.push(`${year.toString().slice(-2)}B`);
}

for (let i = 0; i < 4; i++) {
  const startYear = lastYear + i;
  const endYear = startYear + 1;
  optionsYear.push(`${startYear} - ${endYear}`);
}
```

After:

```ts
const options = Array.from({ length: 3 }, (_, i) => {
  const year = currentYear + i;
  return [`${year.toString().slice(-2)}A`, `${year.toString().slice(-2)}B`];
}).flat();

const optionsYear = Array.from({ length: 4 }, (_, i) => {
  const startYear = lastYear + i;
  const endYear = startYear + 1;
  return `${startYear} - ${endYear}`;
});
```

Verified equivalent by hand-tracing both: for `i = 0, 1, 2`, the original loop pushes
`A0, B0, A1, B1, A2, B2` in that order; `Array.from(...).flat()` produces
`[[A0,B0],[A1,B1],[A2,B2]].flat()` = the same `[A0, B0, A1, B1, A2, B2]`. Same for
`optionsYear`'s direct 1:1 mapping. Byte-identical output, same order, same
`currentYear`/`lastYear` inputs, recomputed on every render exactly as before (not
hoisted to module scope or memoized — that would be a scope-creep optimization not
asked for here).

## 4. Why not upgrade `eslint-plugin-react-hooks` instead

The version is pinned as a release candidate (`^5.1.0-rc.0`) deliberately by
whatever earlier setup chose it; bumping a dev-tooling dependency version is a
separate, larger-blast-radius change (could shift many other files' lint results,
not just this one) than what this focused bug-fix change asked for ("do not add
dependencies" — and a version bump, while not literally "adding" one, carries the
same category of review weight). The code-shape fix is fully sufficient, smaller, and
scoped to exactly the one file named.

## 5. Verification plan — results

Baseline going in: **211 problems (207 errors, 4 warnings)**.

- [x] `bun run typecheck` — passes, no errors.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **208 problems (204 errors, 4 warnings)**, down from
      211 by exactly the predicted 3. `CreateSemesterForm.tsx` no longer appears in
      the lint output at all — fully clean. `CreateEditRoleForm.tsx`'s unrelated
      `no-unused-vars` entry confirmed present, unchanged.
- [x] `git status`/`git diff --stat` — changed-file set is exactly
      `CreateSemesterForm.tsx`, plus this change's own `proposal.md`/`design.md`/
      `tasks.md`. No other file.
- [x] Manual sanity: ran both the old (`for`-loop) and new (`Array.from`) versions
      of `options`/`optionsYear` side by side against the same `currentYear`/
      `lastYear` inputs — byte-identical arrays, same order
      (`["26A","26B","27A","27B","28A","28B"]` and
      `["2025 - 2026","2026 - 2027","2027 - 2028","2028 - 2029"]` for the date this
      was verified).
