# Tasks — fix-create-semester-form-hooks-order

Status: implemented; typecheck/lint verified. The implementer reported build
passing, but independent review timed out locally after Vite started.

## Change artifacts

- [x] Write `proposal.md`.
- [x] Write `design.md`.
- [x] Write `tasks.md` (this file).

## Diagnosis

- [x] Read `CreateSemesterForm.tsx` and confirmed all 3 hooks are called
      unconditionally, as the first statements, same order every render — no
      conditional/early-return/loop wraps them.
- [x] Built 3 throwaway probe files (not part of this diff) to isolate the real
      trigger: hooks alone (clean) → hooks + an unrelated `for` loop later in the
      function (reproduced the exact 3 errors) → same loop rewritten as
      `Array.from` (clean again). Confirmed root cause: a false positive in the
      installed `eslint-plugin-react-hooks@5.1.0-rc.0`, triggered by any `for` loop
      present anywhere in a component that also calls hooks (`design.md` Sections
      1–2).

## Fix

- [x] Rewrote the `options` (semester codes) loop as `Array.from(...)`, producing
      the identical `[A0, B0, A1, B1, A2, B2]`-shaped array.
- [x] Rewrote the `optionsYear` (school-year ranges) loop as `Array.from(...)`,
      producing the identical array.
- [x] Confirmed no `for`/`while`/`for...of`/`for...in` construct remains anywhere
      in `CreateSemesterForm.tsx`.
- [x] Did not move, reorder, or wrap the 3 hooks — they didn't need it.
- [x] No other line in the file changed.

## Verification — results

- [x] `bun run typecheck` — passes, no errors.
- [ ] `bun run build` — implementer reported a clean pass, but independent review
      using `timeout 180s bun run build` timed out after `$ vite build` with no Vite
      diagnostics. Treat as an environment caveat and rerun locally before commit.
- [x] `bun run lint` — total: **208 problems (204 errors, 4 warnings)**, down from
      211 by exactly the predicted 3. `CreateSemesterForm.tsx` no longer appears in
      lint output at all. `CreateEditRoleForm.tsx`'s unrelated `no-unused-vars`
      entry confirmed unchanged.
- [x] `git status`/`git diff --stat` — confirmed only `CreateSemesterForm.tsx` and
      this change's own docs changed.
- [x] Manual sanity: verified the old and new `options`/`optionsYear` computations
      produce byte-identical arrays in the same order via a standalone script run
      against the same date inputs.

## Not in scope for this change

- [ ] Upgrading or changing `eslint-plugin-react-hooks`'s version.
- [ ] Any other file's hooks, lint errors, or structure.
- [ ] Any Supabase query, React Query key, invalidation, or `mutationFn` change.
- [ ] Any UI copy, styling, or layout change.
