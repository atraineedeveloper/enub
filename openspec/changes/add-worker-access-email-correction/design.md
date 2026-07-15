## Context

**Current state of this branch** (verified directly, not assumed): `workers` has no unique constraint on `email` (`character varying`, nullable). `profiles` enforces `profiles_worker_role_consistency` (role = 'worker' iff worker_id is non-null) and a unique `worker_id`. `link_worker_account(worker_id, worker_email)` is the pre-hardening version — a plain `WHERE email = worker_email` match, no canonicalization, no locking. `create-worker-account` and `resend-worker-access-link` are plain `Deno.serve(...)` functions (not dependency-injected, no Deno tests exist for either on this branch). No server-only canonical-email-match lookup RPC exists on this branch today. `src/ui/Modal.tsx` (verified directly) is a plain `createPortal`-based `<div>` overlay with no dialog role/ARIA wiring, no focus trap, no initial-focus management, no focus restoration, and no Escape-key handling. (A separate, still-unmerged change, `harden-and-bulk-provision-worker-accounts`, built related-but-distinct primitives on a different branch; this design does not assume that branch's artifacts exist. Dependency injection, Deno testing, and discriminated Edge Function responses are patterns **introduced by this change**.)

**Installed versions** (verified directly against this branch's `bun.lock`/`node_modules`): `@supabase/supabase-js@2.52.0`, depending on `@supabase/auth-js@2.71.1`. `AdminUserAttributes.email`/`email_confirm`, and `GoTrueAdminApi.listUsers(params?: PageParams)`'s pagination-only signature, were checked directly against the installed `.d.ts` files. `auth.users` is a plain Postgres table `SECURITY DEFINER` functions can read directly via SQL — the Admin API is required only for the actual email-changing **write** (`updateUserById`), never for reads used purely for internal comparison/convergence checking.

**This revision keeps the simplified three-state durable-operation architecture from the prior revision unchanged in its basic shape** (no automatic access-link delivery; `active`/`completed`/`manual_attention_required`; a durable claim, not just an advisory lock, spans the multi-step operation). It corrects several concrete defects found in that architecture's detail: the claim RPC could previously have attempted an `INSERT` that was structurally impossible given an already-existing blocking row (violating its own partial unique indexes); it never checked for a duplicate worker email or a missing linked Auth user *before* creating a claim; and the internal RPCs were grantable to `authenticated`, when they should only ever be reachable through the Edge Functions' own service-role connection. This revision fixes those defects without reopening the earlier architectural decisions (three states, no delivery, immutable guard, fixed lock order) that are unchanged from before.

Supabase Auth (GoTrue, its own schema) and `public` Postgres tables are not transactionally linked, and a Postgres transaction cannot span an external HTTP call to the Auth Admin API — `pg_advisory_xact_lock` releases when its transaction ends, so no lock can protect the whole multi-step operation across the external `updateUserById` call. A durable, row-based claim is what spans the operation instead.

## Goals / Non-Goals

**Goals:**
- Let an administrator correct a worker's linked Auth login email in one guarded action: update Auth, synchronize `workers.email`, verify both converge.
- Never create a second Auth account for a worker who already has one; never delete the existing Auth account.
- Make every state transition safe to retry (idempotent).
- Prevent two *different-target* corrections for the same worker/Auth identity from both proceeding, using a durable database claim — and never attempt a database insert that is structurally impossible given the table's own uniqueness guarantees.
- Keep the browser stateless with respect to Auth internals and trusted business inputs minimal: the claim RPC accepts only `worker_id` and the raw requested email.
- Never derive a final status from an unobserved timeout — always attempt a fresh read (or, for a database-transition call, a fresh read through the operation-context RPC) before concluding an outcome is genuinely uncertain.
- Confine every internal operation RPC (claim, context, sync, both transitions) to the server's own service-role connection — none of them independently reachable by any authenticated browser session, regardless of role.

**Non-Goals:**
- Bulk correction across multiple workers; worker self-service email changes.
- Any change to `create-worker-account`, `resend-worker-access-link`, or `link_worker_account`.
- **Automatic access-link delivery of any kind.** This change never calls `resetPasswordForEmail` or any other delivery mechanism — the administrator uses the existing, separate "Reenviar enlace de acceso" action afterward.
- A `workers.email` uniqueness constraint; any remote/hosted Supabase operation.
- An in-app feature to resolve a `manual_attention_required` operation. This change adds no automatic abandonment, supersession, or in-app override of that state.
- Modifying `src/ui/Modal.tsx` — this change adds a dedicated dialog instead.

## Decisions

### 1. A dedicated Edge Function, not an extension of `create-worker-account`

**Decision, unchanged:** add `supabase/functions/update-worker-access-email/`. The precondition is the opposite of `create-worker-account`'s, and the side effect (`updateUserById` on an *existing* Auth user) is materially different.

### 2. Reads of `auth.users` go through direct SQL inside `SECURITY DEFINER` functions; only the write goes through the Admin API

**Decision, unchanged:** every internal comparison this change needs against `auth.users.email` is a plain SQL `SELECT` inside a `SECURITY DEFINER` function — never a round-trip through `adminClient.auth.admin.getUserById` for pure comparison purposes. The service-role `adminClient` is used for exactly one thing at the Edge Function layer: `updateUserById` (the actual write).

### 3. A server-only canonical-Auth-email-match lookup RPC

**Decision, unchanged:** `public.find_auth_users_by_canonical_email(raw_email text) RETURNS SETOF uuid` — `SECURITY DEFINER`, `SET search_path = ''`, owned by `postgres`, `EXECUTE` granted to `service_role` only, no internal admin check (already the correct, server-only pattern this revision now extends to every other internal RPC — see Decision 9).

### 4. All internal operation RPCs are service-role-only; the Edge Function's own authorization is the sole gate

**Decision:** every internal RPC introduced by this change — the claim RPC, the operation-context RPC, the sync RPC, and both transition RPCs — is:
- owned by `postgres`;
- `SECURITY DEFINER`;
- `SET search_path = ''`;
- `REVOKE ALL ... FROM PUBLIC`, `REVOKE ALL ... FROM anon`, `REVOKE ALL ... FROM authenticated`;
- `GRANT EXECUTE ... TO service_role` only.

None of them perform an internal `current_app_role()` check. **Why:** when called through the service-role connection, there is no end-user JWT in scope, so `auth.uid()`/`current_app_role()` would resolve to `NULL` regardless of who originally initiated the request — an internal admin check inside these functions would be both meaningless and misleading. The **real** authorization boundary is, and remains, the Edge Function's own `current_app_role()` check via `userClient`, performed once, before any of these internal RPCs are ever called (Decision, unchanged, "authorization precedes parsing"). After that check passes, every subsequent privileged operation — reading operation context, claiming, synchronizing, transitioning — goes through the Edge Function's own service-role `adminClient`, never the caller's `userClient`. This is the same pattern `find_auth_users_by_canonical_email` (Decision 3) already established; this revision applies it consistently to the whole internal RPC surface instead of leaving the newer RPCs grantable to `authenticated` (a defect in the prior revision — those RPCs were reachable, in principle, by any authenticated admin session directly via `supabase.rpc(...)`, bypassing the Edge Function's own request-shaping and reconciliation logic entirely).

**Consequence for the browser-facing response:** the correction endpoint (`update-worker-access-email`) never returns an operation id or a linked Auth user id, under any outcome (restated from the prior revision, now additionally true because the browser has no way to call any of these RPCs itself even if it somehow obtained an id).

### 5. A durable claim table with three states, both non-`completed` states blocking

**Decision, unchanged in shape:** `public.worker_access_email_corrections`:

| Column | Type | Notes |
|---|---|---|
| `id` | `bigint generated always as identity primary key` | operation id, internal only |
| `worker_id` | `bigint not null references workers(id)` | |
| `linked_auth_user_id` | `uuid not null` | resolved by the claim RPC itself |
| `requested_canonical_email` | `text not null check (requested_canonical_email <> '' and requested_canonical_email = lower(trim(requested_canonical_email)))` | |
| `raw_expected_worker_email` | `text` | immutable once set |
| `state` | `text not null check (state in ('active', 'completed', 'manual_attention_required'))` | three states only |
| `claimed_by` | `uuid` | internal operational metadata only |
| `last_reason_code` | `text check (last_reason_code is null or last_reason_code in (<the full closed reasonCode set, Decision 11>))` | table-level domain integrity — the broadest permissible set; the manual-attention *transition* itself additionally restricts to a narrower subset (Decision 9) |
| `created_at` / `updated_at` | `timestamptz not null default now()` | |

Blocking states are `active` and `manual_attention_required`, both, via the same two partial unique indexes as before (on `worker_id`, on `linked_auth_user_id`, each `WHERE state IN ('active', 'manual_attention_required')`). Only `completed` rows fall outside both indexes.

### 6. Claim RPC: pre-claim validation, then non-destructive reconciliation, then — only if nothing blocks — an insert

**Decision:** `public.claim_worker_access_email_correction(worker_id bigint, requested_email text) RETURNS TABLE(operation_id bigint, outcome text, reason_code text)`. Inputs unchanged (only `worker_id` and the raw requested email). Full internal order, corrected from the prior revision:

1. Canonicalize `requested_email` (`lower(trim(...))`); **raise** a stable-coded exception for an empty or malformed result (the Edge Function maps this to `status: "invalid_email"`) — this is the one case handled by raising rather than returning a closed `outcome`, since it is checked before any lock or row access and needs no reconciliation.
2. Acquire the worker-identity advisory lock (Decision 7's fixed order, position 1).
3. Re-read the worker and its raw `email`, under the lock; return `worker_not_found` if absent (no row created).
4. Resolve the linked profile (`profiles WHERE worker_id = ... AND role = 'worker'`); return `worker_not_linked` if absent, `invalid_profile_role` if present with an unexpected role (no row created).
5. Derive `linked_auth_user_id` from that profile.
6. Acquire the Auth-identity advisory lock (Decision 7, position 2), using that value.
7. Re-read the profile's linked Auth id one more time, now under both locks. If it no longer matches step 5's value (an unrelated, non-lock-sharing operation — e.g. the pre-existing `link_worker_account`/`unlink_worker_account` RPCs — relinked or unlinked this worker between steps 5 and 6), return `ambiguous_claim_state` with **no operation created** (there is nothing yet to transition; this is a pure pre-claim race).
8. **(Finding: verify the linked Auth user exists.)** Read `auth.users` directly for `linked_auth_user_id`; if no such row exists, return `linked_auth_user_missing` — **no operation created, no mutation**. Checked here, unconditionally, before any duplicate check or blocking-row search.
9. **(Finding: reject a duplicate worker email before creating any claim.)** Check whether any *other* worker's `lower(trim(email))` already equals the canonical requested email; if so, return `duplicate_worker_email` — **no operation created, no mutation**. This is the identical check the sync RPC (Decision 8) re-performs later, inside its own transaction, as defense-in-depth against a race between this check and the eventual write; it is not a special case unique to the claim RPC.
10. Search for a **blocking** row (`state IN ('active', 'manual_attention_required')`) two ways, independently: by `worker_id` (`row_by_worker`) and by `linked_auth_user_id` (`row_by_auth`).
11. **Reconcile — never attempting an insert where a blocking row already exists for either identity:**
    - **Neither search finds anything:** proceed to step 12 (the only path that inserts).
    - **Both searches find the *same* row** (`row_by_worker.id = row_by_auth.id`) — the normal, consistent case:
      - that row is `manual_attention_required` → `outcome = 'manual_attention_blocking'`, operation_id = that row's id, **no mutation**.
      - that row is `active` and its `requested_canonical_email` matches this request → `outcome = 'resumed'`, operation_id = that row's id, **no mutation, no second row**.
      - that row is `active` but its `requested_canonical_email` differs → `outcome = 'different_target_in_progress'`, operation_id = that row's id, **no mutation**.
    - **Both searches find rows, but they are *different* rows** (a genuinely inconsistent, invariant-broken state — e.g. two separate blocking operations, one keyed to this worker, a different one keyed to this Auth identity): `outcome = 'ambiguous_claim_state'`, `operation_id = NULL` (neither row is uniquely "the" operation for this attempt) — **do not touch either row**, do not attempt any insert, do not expose which constraint or row caused this.
    - **Exactly one search finds a row** (e.g. `row_by_worker` exists but `row_by_auth` does not, or vice versa) — that row's own recorded identity disagrees with what this attempt just resolved (its linkage has drifted since it was created): if that row is currently `active`, transition it **in place** (`UPDATE ... SET state = 'manual_attention_required', last_reason_code = 'ambiguous_claim_state'` — never an `INSERT`) so the inconsistency becomes durably blocking; if it is already `manual_attention_required`, leave it as-is. Either way, `outcome = 'ambiguous_claim_state'`, `operation_id` = that row's id.
12. **(Only reached when step 11 found no blocking row at all.)** Check, via direct SQL, whether the freshly-read raw `workers.email` **and** a direct read of `auth.users.email` for `linked_auth_user_id` already both canonically equal the requested email. If both: insert a new row **directly as `state = 'completed'`**, `outcome = 'already_completed'`. Otherwise: insert a new row as `state = 'active'`, `outcome = 'created'`.
13. Wrap the insert from step 12 in an exception handler catching only `unique_violation`; confirm via `GET STACKED DIAGNOSTICS ... constraint_name` that it is one of this table's own two partial indexes (re-raise any other violation — never convert an unrelated constraint failure into a false success); on a confirmed match, re-run steps 10–11's reconciliation (the concurrent inserter has since committed) and return the outcome that produces.
14. Return only `operation_id`, `outcome`, `reason_code`. Never the linked Auth user id.

**Why this ordering fixes the prior defect:** the prior revision jumped straight from "detected an ambiguity" to "insert a new `manual_attention_required` row," which is exactly the operation the table's own partial unique indexes would reject whenever a blocking row for either identity already existed — an "impossible insert." This revision searches for blocking rows *before* ever considering an insert, and when a row is implicated, it is *transitioned in place*, never duplicated.

### 7. Fixed, valid advisory-lock SQL and order — reused identically by every RPC in this change

**Decision, unchanged:**
```sql
PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:worker:' || worker_id::text, 0));
PERFORM pg_advisory_xact_lock(hashtextextended('worker_access_email:auth:' || linked_auth_user_id::text, 0));
```
Fixed order, always: worker identity, then linked Auth identity — reused identically by the claim RPC, the sync RPC, and both transition RPCs.

### 8. Claim outcomes are closed

**Decision:** the claim RPC's returned `outcome` (as opposed to the one case it raises for, `invalid_email` — Decision 6, step 1) is one of: `created`, `already_completed`, `resumed`, `different_target_in_progress`, `manual_attention_blocking`, `worker_not_found`, `worker_not_linked`, `invalid_profile_role`, `linked_auth_user_missing`, `duplicate_worker_email`, `ambiguous_claim_state` — 11 values. `already_completed` needs no further Auth/worker round-trip; a resumed operation converges through exactly the same logic a fresh one does ("correction resumed" is a test-coverage concern, not a distinct endpoint status).

### 9. Sync RPC and both transition RPCs share one locking-and-linkage protocol

**Decision:** `sync_worker_email_after_access_correction(operation_id bigint)`, `mark_worker_access_email_correction_completed(operation_id bigint)`, and `mark_worker_access_email_correction_manual_attention(operation_id bigint, reason_code text)` all follow the same seven-step protocol before performing their own specific, narrow effect:

1. Load the operation by `operation_id`; if it does not exist, raise a stable-coded exception (an Edge-Function-internal defensive backstop — the Edge Function should never pass an operation id it did not just receive from the claim/context RPC). If it exists but `state <> 'active'`, return/raise a closed `operation_not_active` result (for `sync`) — the two transition RPCs simply refuse the transition outright for a non-`active` operation (Decision 6's step semantics: `completed` needs no further sync, `manual_attention_required` must never be processed further).
2. Acquire the worker-identity lock (Decision 7, position 1).
3. Re-read the worker and its linked profile.
4. Verify the profile's linked Auth id still equals the operation's own stored `linked_auth_user_id`; if not, this is `linkage_changed` (the worker's profile drifted mid-operation, distinct from the operation's own internal consistency, below).
5. Acquire the Auth-identity lock (Decision 7, position 2).
6. Re-verify, now under both locks, that the operation is still `active` and the linkage still matches. If the operation's own recorded `(worker_id, linked_auth_user_id)` pairing fails this independent structural re-check (e.g. the recorded Auth user row no longer exists in `auth.users` at all), this is `operation_identity_mismatch` — distinct from `linkage_changed`, which is specifically about the *worker's profile* pointing elsewhere now.
7. Only past this point does each RPC perform its own specific, narrow effect (below).

**`sync_worker_email_after_access_correction`'s own effect** (steps continuing from 7): recheck canonical duplicates (`duplicate_worker_email`, a closed return value); compare the current raw `workers.email` against the operation's **immutable** `raw_expected_worker_email` (never refreshed); `UPDATE workers SET email = requested_canonical_email WHERE id = worker_id AND email IS NOT DISTINCT FROM raw_expected_worker_email` → `updated` / `already_current` / `stale_worker_edit` / `worker_not_found`.

**`mark_worker_access_email_correction_completed`'s own effect:** re-verify, via direct SQL, that `workers.email` **and** `auth.users.email` (for the operation's `linked_auth_user_id`) both already canonically equal `requested_canonical_email`; only if both hold, set `state = 'completed'` and return `true`; otherwise return `false` without transitioning (the RPC's own independent re-check, never trusting a caller-asserted "it worked").

**`mark_worker_access_email_correction_manual_attention`'s own effect:** validate `reason_code` against a **narrow, explicit set** — `ambiguous_claim_state`, `duplicate_worker_email`, `linkage_changed`, `operation_identity_mismatch`, `auth_update_uncertain`, `worker_sync_uncertain` — rejecting any other value outright, even one that is otherwise a member of the table's broader `last_reason_code` domain (Decision 5); set `state = 'manual_attention_required'`, record `last_reason_code`. No code path transitions a `manual_attention_required` row back to `active` or `completed`.

No RPC or grant permits a direct, unguarded `UPDATE`/`INSERT`/`DELETE` against `worker_access_email_corrections` from any role other than `service_role` acting through one of these four functions.

### 10. A server-only operation-context RPC — distinct from the browser-facing context endpoint

**Decision:** add `public.get_worker_access_email_correction_context(operation_id bigint) RETURNS TABLE(operation_id bigint, worker_id bigint, linked_auth_user_id uuid, requested_canonical_email text, raw_expected_worker_email text, state text, last_reason_code text)` — service-role-only (Decision 4), no admin check inside. Loads exactly one operation by id; raises a stable-coded exception for a missing or invalid `operation_id` (an internal defensive backstop, per Decision 9's step 1). Exposes no data to any browser-facing role directly.

**This is a completely different thing from `get-worker-access-email-context` (Decision 15), the browser-facing Edge Function that returns a masked login-email display for the confirmation dialog** — the similar names are a deliberate echo of their related purposes, not the same object. To avoid confusion: `get_worker_access_email_correction_context` (snake_case RPC, "correction," internal, service-role-only, keyed by `operation_id`) vs. `get-worker-access-email-context` (kebab-case Edge Function, no "correction" in the name, browser-facing, keyed by `workerId`).

**Why the Edge Function must use this rather than re-resolving the worker/profile/Auth identity itself:** after the claim RPC returns an `operation_id` for `created`/`resumed`/`already_completed`, the Edge Function's *own* subsequent processing must operate on exactly the worker/Auth pairing the claim actually locked onto — not a second, independently-re-run resolution that could, in a genuine race, diverge from it (e.g. if the linked profile changed between the claim call and a later step). Calling `get_worker_access_email_correction_context(operationId)` immediately after a successful claim gives the Edge Function one single, authoritative view of `worker_id`/`linked_auth_user_id`/`requested_canonical_email`/`raw_expected_worker_email` to work from for the rest of that request.

### 11. The closed response contract

```ts
{
  workerId: number;
  status: CorrectionStatus;        // closed union, 17 values
  reasonCode: CorrectionReasonCode; // always present, closed union
  retryable: boolean;
  emailSynchronized: boolean;       // true only when THIS response's own fresh observation confirmed it; false otherwise
  message?: string;                 // optional, display-only
}
```
No `accessLinkDelivery` field, no operation id, no Auth id, under any outcome (Decision 4). Closed `status` union (17 values, one more than the prior revision): `updated`, `already_synchronized`, `correction_already_in_progress`, `manual_attention_required`, `worker_not_found`, `worker_not_linked`, `invalid_profile_role`, `linked_auth_user_missing`, `invalid_email`, `duplicate_worker_email`, `email_owned_by_another_auth_user`, `multiple_canonical_auth_matches`, `auth_update_failed`, `auth_update_uncertain`, `worker_sync_failed`, `worker_sync_uncertain`, and — **new in this revision** — the `manual_attention_required` status now also covers `reasonCode: "operation_identity_mismatch"` as its sixth possible reason (the status itself is not new; the reason code is).

`manual_attention_required` covers six distinct `reasonCode`s: `ambiguous_claim_state`, `manual_attention_blocking`, `duplicate_worker_email`, `linkage_changed`, `operation_identity_mismatch`, and (per the transition-uncertainty protocol, Decision 13) an inconclusive uncertainty that could not be resolved by re-observation. The caller-relevant fact is identical across all six ("this needs a human, do not retry"); every `manual_attention_required` response, regardless of `reasonCode`, uses the same generic, safe display text `"Revisión manual requerida"` — this revision generalizes that display rule from just `invalid_profile_role`/`linked_auth_user_missing` (which remain their own distinct top-level statuses, also using this same text) to the `manual_attention_required` status as a whole, for one consistent, simple UI rule rather than one exception-by-exception.

### 12. `operation_id` and the linked Auth user id never reach the browser

**Decision, unchanged, now additionally enforced structurally by Decision 4's grants:** resumption is fully automatic and server-side. The browser never holds, passes, or reasons about an operation id.

### 13. The complete, literal response table

| # | Scenario | Attempted operation | Required fresh reads | Final operation state | `status` | `reasonCode` | HTTP | `retryable` | `emailSynchronized` | Cache invalidation |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Worker does not exist | none | worker existence check | none (no row) | `worker_not_found` | `worker_not_found` | 404 | false | false | no |
| 2 | Worker has no linked profile | none | profile existence check | none (no row) | `worker_not_linked` | `worker_not_linked` | 409 | false | false | no |
| 3 | Linked profile has an unexpected role | none | profile role check | none (no row) | `invalid_profile_role` | `invalid_profile_role` | 500 | false | false | no |
| 4 | Linked Auth user no longer exists, checked before any claim | none | direct SQL check against `auth.users` | none (no row) | `linked_auth_user_missing` | `linked_auth_user_missing` | 500 | false | false | no |
| 5 | Requested email empty or malformed | none | format check inside claim RPC | none (no row) | `invalid_email` | `invalid_email` | 400 | false | false | no |
| 6 | Requested email canonically duplicates another worker's, checked before any claim | none | `workers` canonical-duplicate check | none (no row) | `duplicate_worker_email` | `duplicate_worker_email` | 409 | false | false | no |
| 7 | A different-target correction is already active for this worker | none | blocking-row lookup by worker and Auth id | unchanged (still `active`, other target) | `correction_already_in_progress` | `different_target_in_progress` | 409 | false | false | no |
| 8 | A manual-attention operation already blocks this worker | none | blocking-row lookup | unchanged (still `manual_attention_required`) | `manual_attention_required` | `manual_attention_blocking` | 409 | false | false | no |
| 9 | Exactly one blocking row is implicated with inconsistent linkage | none (existing row transitioned in place, not inserted) | linkage cross-check | existing row transitioned to `manual_attention_required` | `manual_attention_required` | `ambiguous_claim_state` | 500 | false | false | yes |
| 10 | Two distinct blocking rows found (invariant-broken state) | none (neither row touched) | independent worker-id and Auth-id blocking-row lookups | unchanged (both rows as they were) | `manual_attention_required` | `ambiguous_claim_state` | 500 | false | false | no |
| 11 | Auth and worker already both match the target, detected at claim time | none | direct SQL read of both, at claim time | new row created directly as `completed` | `already_synchronized` | `already_synchronized` | 200 | false | true | yes |
| 12 | Correction fully converges this call | Auth update and/or worker sync, as needed | Auth email + worker email, confirmed via the completion RPC's own re-check | `completed` | `updated` | `updated` | 200 | false | true | yes |
| 13 | Auth update attempted, fails definitely | Auth update | direct SQL re-read of `auth.users.email`, confirms still not target | stays `active` | `auth_update_failed` | `auth_update_failed` | 502 | true | false | yes |
| 14 | Auth update attempted, uncertain, re-read cannot confirm either way | Auth update | direct SQL re-read of `auth.users.email`, inconclusive | stays `active` | `auth_update_uncertain` | `auth_update_uncertain` | 500 | true | false | yes |
| 15 | Worker sync attempted, rejected by a concurrent ordinary worker edit (stale guard) | worker sync | direct re-read of `workers.email`, confirms still not target | stays `active` | `worker_sync_failed` | `stale_worker_edit` | 200 | true | false | yes |
| 16 | Worker sync attempted, uncertain, re-read cannot confirm either way | worker sync | direct re-read of `workers.email`, inconclusive | stays `active` | `worker_sync_uncertain` | `worker_sync_uncertain` | 500 | true | false | yes |
| 17 | Worker sync rejected by a genuine duplicate detected mid-synchronization (Auth already updated) | worker sync | direct re-read confirms the conflicting other-worker duplicate persists | transitions to `manual_attention_required` | `manual_attention_required` | `duplicate_worker_email` | 500 | false | false | yes |
| 18 | The linked profile changed identity mid-operation | worker sync rejects with `linkage_changed` | profile re-read confirms the drift | transitions to `manual_attention_required` | `manual_attention_required` | `linkage_changed` | 500 | false | false | yes |
| 19 | Requested email belongs to a different Auth user, detected before the write | none (Auth update never attempted) | canonical Auth-match lookup | stays `active` | `email_owned_by_another_auth_user` | `email_owned_by_another_auth_user` | 409 | false | false | yes |
| 20 | Requested email matches more than one Auth user, detected before the write | none | canonical Auth-match lookup | stays `active` | `multiple_canonical_auth_matches` | `multiple_canonical_auth_matches` | 409 | false | false | yes |
| 21 | The operation's own recorded identity is no longer internally consistent (e.g. the recorded Auth user vanished by some other means) | sync/transition rejects with `operation_identity_mismatch` | independent re-check under both locks | transitions to `manual_attention_required` | `manual_attention_required` | `operation_identity_mismatch` | 500 | false | false | yes |

`emailSynchronized` defaults to `false` for every row except 11 and 12. Rows 9 and 10 both illustrate the two distinct sub-cases of claim-time ambiguity (Decision 6, step 11) that a prior revision conflated. Rows 15 and 21 double as entries in the process/recovery matrix (Decision 14) where the same named scenario is explicitly required there too — intentional overlap, not duplication in error.

### 14. The process/recovery matrix — literal, no placeholders

A second table, distinct from Decision 13's response-outcome table, walking through the operation's *mechanics* across possibly-multiple calls (resumption, process death, external drift) rather than the caller-visible response alone:

| # | Scenario | Fresh observed starting state | Attempted action | Required re-reads | Final operation state | `status` | `reasonCode` | HTTP | `retryable` | `emailSynchronized` | Cache invalidation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Auth already at target, worker not yet (fresh claim) | Auth = target, worker ≠ target | worker sync only | worker email after sync | `completed` | `updated` | `updated` | 200 | false | true | yes |
| 2 | Worker already at target, Auth not yet (fresh claim) | worker = target, Auth ≠ target | Auth update only, after a fresh zero/one/multiple check | Auth email after update | `completed` | `updated` | `updated` | 200 | false | true | yes |
| 3 | Neither at target (fresh claim) | Auth ≠ target, worker ≠ target | Auth update, then worker sync | Auth email after update; worker email after sync | `completed` | `updated` | `updated` | 200 | false | true | yes |
| 4 | Both already at target (fresh claim) | Auth = target, worker = target | none (claim RPC itself marks `completed`) | direct SQL read of both, at claim time | `completed` | `already_synchronized` | `already_synchronized` | 200 | false | true | yes |
| 5 | Process death after claim, before any Auth/worker mutation attempted; resumed | Auth ≠ target, worker ≠ target (unchanged since the crashed attempt) | resumed claim (`outcome: 'resumed'`), then Auth update, then worker sync | operation-context read, then Auth email, then worker email | `completed` | `updated` | `updated` | 200 | false | true | yes |
| 6 | Process death after a successful Auth update, before worker sync attempted; resumed | Auth = target, worker ≠ target | worker sync only (Auth update never repeated) | operation-context read confirms `active`; worker email after sync | `completed` | `updated` | `updated` | 200 | false | true | yes |
| 7 | Process death after a successful worker sync, before the completion transition; resumed | Auth = target, worker = target | `mark_worker_access_email_correction_completed` only | operation-context read confirms `active`; both emails re-verified by the completion RPC itself | `completed` | `updated` | `updated` | 200 | false | true | yes |
| 8 | External Auth drift to an unrelated third value, discovered by the Edge Function's fresh pre-write read | Auth = neither old nor target, worker ≠ target | Auth update (using the fresh value, not a stale one), then worker sync | Auth email immediately before the write; both emails after | `completed` | `updated` | `updated` | 200 | false | true | yes |
| 9 | External Auth drift lands exactly on the target during an idle resume (an administrator fixed it via Studio while this operation sat `active`) | Auth = target (newly, coincidentally), worker ≠ target | worker sync only | operation-context read; Auth email freshly confirms target; worker email after sync | `completed` | `updated` | `updated` | 200 | false | true | yes |
| 10 | Ordinary concurrent worker edit races the sync step | Auth = target, worker ≠ target (edited to a third value by an unrelated admin action) | worker sync rejected by the immutable guard | direct re-read of `workers.email`, confirms still not target | stays `active` | `worker_sync_failed` | `stale_worker_edit` | 200 | true | false | yes |
| 11 | Completion-transition call is transport-uncertain; re-observed as still genuinely unresolved | Auth = target, worker ≠ target (the sync itself had not yet converged when the transition was attempted) | `mark_worker_access_email_correction_completed` returns `false`/uncertain; re-read via the operation-context RPC | operation-context read; fresh worker/Auth re-read | stays `active` | `worker_sync_uncertain` | `worker_sync_uncertain` | 500 | true | false | yes |
| 12 | Manual-attention-transition call is transport-uncertain; re-observed as having actually applied | (irrelevant — the transition itself, not email convergence, is in question) | `mark_worker_access_email_correction_manual_attention` call times out | operation-context read confirms `state = 'manual_attention_required'` was in fact recorded | `manual_attention_required` | `manual_attention_required` | `duplicate_worker_email` (or whichever reason triggered the original attempt) | 500 | false | false | yes |
| 13 | The operation's own recorded identity fails its independent re-check under both locks | — | sync/transition rejects with `operation_identity_mismatch` | independent structural re-check under both locks | transitions to `manual_attention_required` | `manual_attention_required` | `operation_identity_mismatch` | 500 | false | false | yes |

**Transition-uncertainty protocol (rows 11–12 generalized):** whenever a call to `mark_worker_access_email_correction_completed` or `mark_worker_access_email_correction_manual_attention` is itself transport-uncertain, the Edge Function re-reads the operation through `get_worker_access_email_correction_context` (Decision 10) and re-reads the worker/profile/Auth state directly: if the operation is now `completed` and both emails genuinely converge → report success; if the operation is now `manual_attention_required` → report the matching manual-attention result using whatever `last_reason_code` was actually stored; if the operation is still `active` and the underlying state is one this Edge Function knows how to safely resume → report the matching retryable-uncertain status; if none of these can be established → transition the operation to `manual_attention_required` (a final, safe fallback — never left ambiguous, never used as grounds to start a different-target correction automatically).

### 15. A dedicated accessible dialog — not the current `Modal.tsx`

**Decision, unchanged.** A new, dedicated dialog component. After a successful correction, shows `"Correo de acceso actualizado. Envía ahora un nuevo enlace de acceso al trabajador."` and a clear, non-automatic path to "Reenviar enlace de acceso."

### 16. The browser-facing context endpoint's closed contract

**Decision:** `supabase/functions/get-worker-access-email-context/` accepts exactly `{ workerId: number, reveal?: boolean }`.

**Success response** (closed shape): masked email (default) or full email (`reveal: true`), plus the worker's display name — **never** an Auth user id, **never** an operation id, **never** any other Auth metadata.

**Error responses**, each with an explicit HTTP code and safe `reasonCode`:

| `reasonCode` | HTTP | Meaning |
|---|---|---|
| `unauthorized` | 401 | no bearer token |
| `forbidden` | 403 | authenticated but not `admin` |
| `invalid_request` | 400 | body is not exactly `{ workerId: number, reveal?: boolean }` |
| `worker_not_found` | 404 | no matching worker |
| `worker_not_linked` | 409 | worker has no linked profile |
| `invalid_profile_role` | 500 | linked profile has an unexpected role (defense-in-depth; display "Revisión manual requerida") |
| `linked_auth_user_missing` | 500 | linked profile references a missing Auth user (display "Revisión manual requerida") |

Authorization (steps analogous to the correction endpoint's `current_app_role()` check) occurs strictly before parsing `workerId`/`reveal`. This endpoint calls the worker/profile-resolution logic directly (via the same server-only patterns as the correction endpoint) — it does not call `get_worker_access_email_correction_context` (that RPC is keyed by `operation_id`, which has no meaning for this endpoint's stateless, non-claiming read).

## Risks / Trade-offs

- **[Risk]** No transactional atomicity between the Auth update and the `workers.email` write. → **Accepted, by design**: every partial state is closed and retryable, and the immutable stored guard plus fresh-read reconciliation make a resumed request always self-heal.
- **[Risk]** `find_auth_users_by_canonical_email` duplicates a helper the still-unmerged `harden-and-bulk-provision-worker-accounts` change also defines. → **Mitigation, a mandatory pre-merge task** (tasks §10): reconcile rather than duplicate if that branch merges first.
- **[Risk]** A genuinely-conflicting duplicate detected *during* sync, after Auth has already been updated, leaves Auth and `workers.email` divergent until a human resolves the conflict. → **Accepted, by design**: `manual_attention_required`/non-retryable; this change intentionally provides no in-app resolution path.
- **[Risk]** Removing automatic delivery means an administrator must remember the second step. → **Accepted, intentional**: the dialog's explicit post-success guidance is the mitigation.
- **[Risk]** Type declarations prove an API's shape, not its live behavior. → **Mitigation**: a dedicated, unchecked manual-verification task group exercises the specific runtime questions locally; hosted behavior remains separate and unchecked.
- **[Risk]** This branch has no existing Deno test precedent for Edge Functions. → **Mitigation**: this change introduces the dependency-injected `handleRequest(req, deps: HandlerDeps)` pattern for its own two functions only.
- **[Risk]** Two distinct blocking rows (response-table row 10) is a state that should be structurally unreachable given `profiles.worker_id`'s uniqueness, but is retained as a defense-in-depth classification rather than assumed impossible. → **Accepted**: reported as `manual_attention_required`/`ambiguous_claim_state`, neither row mutated, matching this codebase's established practice of keeping defense-in-depth backstops for conditions current constraints should already prevent.

## Migration Plan

1. `find_auth_users_by_canonical_email`.
2. `worker_access_email_corrections` (table + two partial unique indexes + check constraints).
3. `claim_worker_access_email_correction`.
4. `get_worker_access_email_correction_context`.
5. `sync_worker_email_after_access_correction`.
6. `mark_worker_access_email_correction_completed` and `mark_worker_access_email_correction_manual_attention`.
7. pgTAP coverage for all of the above, including the service-role-only grant on every one.
8. `supabase/functions/update-worker-access-email/` and `supabase/functions/get-worker-access-email-context/` (dependency-injected), registered with `verify_jwt = true`.
9. Deno tests for both.
10. Frontend: service functions, mutation/query hooks, the dedicated dialog, the `WorkerRow.tsx` menu entry.
11. Local automated verification.
12. Manual local verification.
13. No remote/hosted step; hosted verification is separate and human-owned.

**Rollback:** all new migrations are additive; dropping them and the two new Edge Functions fully reverts this change, aside from any rows accumulated in `worker_access_email_corrections` (safe to drop with the table).

## Product Decisions (resolved)

- Current Auth login email masked by default, explicit administrator reveal.
- Every `manual_attention_required` response (all six `reasonCode`s) and the two structurally-unreachable statuses (`invalid_profile_role`/`linked_auth_user_missing`) all display the same generic `"Revisión manual requerida"` text, retaining distinct `reasonCode`s for diagnosis.
- Audit logging of the acting administrator remains out of scope; `claimed_by` is internal operational state only.
- No automatic access-link delivery of any kind.
- No in-app resolution path for `manual_attention_required`.
- "Correction resumed" is not a distinct response `status`.
- All internal RPCs (claim, operation-context, sync, both transitions) are service-role-only; no internal `current_app_role()` check inside any of them, since the Edge Function's own check is the sole, sufficient authorization boundary.
