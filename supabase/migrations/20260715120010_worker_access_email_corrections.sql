-- Durable correction-operation table for add-worker-access-email-correction
-- (design.md §5). Internal operational state only -- not a public audit-log
-- feature. Three states: active / completed / manual_attention_required.
-- Both `active` and `manual_attention_required` are blocking states for the
-- two partial unique indexes below; only `completed` releases blocking.
CREATE TABLE "public"."worker_access_email_corrections" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "worker_id" bigint NOT NULL,
    "linked_auth_user_id" uuid NOT NULL,
    "requested_canonical_email" text NOT NULL,
    "raw_expected_worker_email" text,
    "state" text NOT NULL,
    "claimed_by" uuid,
    "last_reason_code" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "worker_access_email_corrections_state_check" CHECK (
        "state" IN ('active', 'completed', 'manual_attention_required')
    ),
    -- The table itself enforces the already-canonical, nonempty invariant,
    -- in addition to the claim RPC canonicalizing before insert --
    -- defense-in-depth, not merely trusting the RPC layer (design.md §5).
    CONSTRAINT "worker_access_email_corrections_requested_email_check" CHECK (
        "requested_canonical_email" <> '' AND "requested_canonical_email" = lower(trim("requested_canonical_email"))
    ),
    -- The full closed reasonCode set (design.md §11), not merely the
    -- narrower subset the manual-attention transition itself accepts
    -- (design.md §9) -- this column may also record a completion reason
    -- (updated/already_synchronized), so its own domain is the broadest
    -- permissible one.
    CONSTRAINT "worker_access_email_corrections_last_reason_code_check" CHECK (
        "last_reason_code" IS NULL OR "last_reason_code" IN (
            'worker_not_found',
            'worker_not_linked',
            'invalid_profile_role',
            'linked_auth_user_missing',
            'invalid_email',
            'duplicate_worker_email',
            'different_target_in_progress',
            'manual_attention_blocking',
            'ambiguous_claim_state',
            'already_synchronized',
            'updated',
            'auth_update_failed',
            'auth_update_uncertain',
            'stale_worker_edit',
            'worker_sync_uncertain',
            'linkage_changed',
            'email_owned_by_another_auth_user',
            'multiple_canonical_auth_matches',
            'operation_identity_mismatch',
            'external_auth_email_changed'
        )
    )
);

ALTER TABLE "public"."worker_access_email_corrections" OWNER TO "postgres";

ALTER TABLE ONLY "public"."worker_access_email_corrections"
    ADD CONSTRAINT "worker_access_email_corrections_worker_id_fkey" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE RESTRICT;

-- Blocking states are 'active' AND 'manual_attention_required', both -- a
-- manual_attention_required row keeps blocking indefinitely (there is no
-- automatic resolution path), while a completed row never blocks a future,
-- legitimate correction for the same identity.
CREATE UNIQUE INDEX "worker_access_email_corrections_blocking_worker_key"
    ON "public"."worker_access_email_corrections" ("worker_id")
    WHERE "state" IN ('active', 'manual_attention_required');

CREATE UNIQUE INDEX "worker_access_email_corrections_blocking_auth_key"
    ON "public"."worker_access_email_corrections" ("linked_auth_user_id")
    WHERE "state" IN ('active', 'manual_attention_required');

-- No direct grant of any kind to authenticated/anon -- every access goes
-- through the five service-role-only functions added by the migrations
-- that follow this one (design.md §4).
REVOKE ALL ON TABLE "public"."worker_access_email_corrections" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."worker_access_email_corrections" FROM "anon";
REVOKE ALL ON TABLE "public"."worker_access_email_corrections" FROM "authenticated";
GRANT ALL ON TABLE "public"."worker_access_email_corrections" TO "service_role";

-- The identity sequence backing "id" must also be usable by service_role
-- (GENERATED ALWAYS AS IDENTITY already restricts direct sequence access,
-- but service_role -- which owns every INSERT via the functions above --
-- needs no extra grant beyond the table's own ALL grant here).
