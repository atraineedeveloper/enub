-- Local-only fictitious data for development and manual verification.
-- Login: admin.local@enub.test / EnubLocal123!
--
-- Additional local worker fixtures (reserved id block 9001-9007, added at
-- the end of this file -- see the comment above that block for the full
-- rationale and openspec/changes/expand-worker-development-seed for design):
--   9002 (trabajador.vinculado.local@enub.test) is a fully linked worker
--     account -- password: TrabajadorLocal123!
--   9001 (auth-sin-perfil.local@enub.test) has an Auth user + identity but
--     no linked profile -- password: AuthSinPerfilLocal123!

INSERT INTO "auth"."users" (
    "instance_id",
    "id",
    "aud",
    "role",
    "email",
    "encrypted_password",
    "email_confirmed_at",
    "last_sign_in_at",
    "raw_app_meta_data",
    "raw_user_meta_data",
    "created_at",
    "updated_at",
    "confirmation_token",
    "email_change",
    "email_change_token_new",
    "recovery_token"
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'admin.local@enub.test',
    "extensions"."crypt"('EnubLocal123!', "extensions"."gen_salt"('bf')),
    "now"(),
    "now"(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Usuario Local Enub"}'::jsonb,
    "now"(),
    "now"(),
    '',
    '',
    '',
    ''
)
ON CONFLICT ("id") DO UPDATE
SET
    "email" = EXCLUDED."email",
    "encrypted_password" = EXCLUDED."encrypted_password",
    "email_confirmed_at" = EXCLUDED."email_confirmed_at",
    "raw_app_meta_data" = EXCLUDED."raw_app_meta_data",
    "raw_user_meta_data" = EXCLUDED."raw_user_meta_data",
    "updated_at" = EXCLUDED."updated_at";

INSERT INTO "auth"."identities" (
    "id",
    "user_id",
    "identity_data",
    "provider",
    "provider_id",
    "last_sign_in_at",
    "created_at",
    "updated_at"
)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '{"sub": "11111111-1111-1111-1111-111111111111", "email": "admin.local@enub.test"}'::jsonb,
    'email',
    'admin.local@enub.test',
    "now"(),
    "now"(),
    "now"()
)
ON CONFLICT ("provider_id", "provider") DO UPDATE
SET
    "user_id" = EXCLUDED."user_id",
    "identity_data" = EXCLUDED."identity_data",
    "last_sign_in_at" = EXCLUDED."last_sign_in_at",
    "updated_at" = EXCLUDED."updated_at";

-- Local-only bootstrap admin profile for the seeded local user above, so a
-- fresh `db reset` always has a working admin without a manual Studio step.
-- This is separate from the profiles backfill migration, which only covers
-- auth.users rows that already existed at migration time -- this seed user
-- is created afterwards, during the seed step. See database-plan.md #12 and
-- decisions.md #5.
INSERT INTO "public"."profiles" ("id", "role", "worker_id")
VALUES ('11111111-1111-1111-1111-111111111111', 'admin', NULL)
ON CONFLICT ("id") DO UPDATE
SET
    "role" = EXCLUDED."role",
    "worker_id" = EXCLUDED."worker_id";

INSERT INTO "public"."semesters" ("id", "semester", "school_year")
VALUES
    (1, '2026-A', '2025-2026'),
    (2, '2026-B', '2026-2027')
ON CONFLICT ("id") DO UPDATE
SET
    "semester" = EXCLUDED."semester",
    "school_year" = EXCLUDED."school_year";

INSERT INTO "public"."degrees" ("id", "code", "name")
VALUES
    (1, 'LTI', 'Licenciatura de Prueba en Tecnologías'),
    (2, 'LAE', 'Licenciatura de Prueba en Administración')
ON CONFLICT ("id") DO UPDATE
SET
    "code" = EXCLUDED."code",
    "name" = EXCLUDED."name";

INSERT INTO "public"."study_programs" ("id", "year", "name")
VALUES
    (1, 2026, 'Plan de estudios ficticio 2026')
ON CONFLICT ("id") DO UPDATE
SET
    "year" = EXCLUDED."year",
    "name" = EXCLUDED."name";

INSERT INTO "public"."subjects" (
    "id",
    "semester",
    "name",
    "credits",
    "hours_per_week",
    "hours_per_semester",
    "study_program_id",
    "degree_id"
)
VALUES
    (1, '1', 'Asignatura de prueba I', 6, 4, 64, 1, 1),
    (2, '2', 'Asignatura de prueba II', 6, 4, 64, 1, 1)
ON CONFLICT ("id") DO UPDATE
SET
    "semester" = EXCLUDED."semester",
    "name" = EXCLUDED."name",
    "credits" = EXCLUDED."credits",
    "hours_per_week" = EXCLUDED."hours_per_week",
    "hours_per_semester" = EXCLUDED."hours_per_semester",
    "study_program_id" = EXCLUDED."study_program_id",
    "degree_id" = EXCLUDED."degree_id";

INSERT INTO "public"."groups" ("id", "year_of_admission", "letter", "degree_id")
VALUES
    (1, 2026, 'A', 1),
    (2, 2026, 'B', 2)
ON CONFLICT ("id") DO UPDATE
SET
    "year_of_admission" = EXCLUDED."year_of_admission",
    "letter" = EXCLUDED."letter",
    "degree_id" = EXCLUDED."degree_id";

INSERT INTO "public"."workers" (
    "id",
    "name",
    "profile_picture",
    "street",
    "neighborhood",
    "post_code",
    "city",
    "state",
    "phone",
    "email",
    "RFC",
    "specialty",
    "type_worker",
    "function_performed",
    "observations",
    "status"
)
VALUES
    (
        1,
        'María Prueba López',
        NULL,
        'Calle Local 123',
        'Colonia Centro',
        '00000',
        'Ciudad de Prueba',
        'Estado de Prueba',
        '5550000001',
        'maria.prueba@example.test',
        'LOPM900101XXX',
        'Matemáticas',
        'Maestro',
        'Docencia frente a grupo',
        'Registro ficticio para pruebas locales',
        1
    ),
    (
        2,
        'Carlos Demo Hernández',
        NULL,
        'Avenida Demo 456',
        'Colonia Norte',
        '00001',
        'Ciudad de Prueba',
        'Estado de Prueba',
        '5550000002',
        'carlos.demo@example.test',
        'HEGC850202XXX',
        'Tutoría',
        'Administrativo',
        'Apoyo académico',
        'Registro ficticio para pruebas locales',
        1
    )
ON CONFLICT ("id") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "profile_picture" = EXCLUDED."profile_picture",
    "street" = EXCLUDED."street",
    "neighborhood" = EXCLUDED."neighborhood",
    "post_code" = EXCLUDED."post_code",
    "city" = EXCLUDED."city",
    "state" = EXCLUDED."state",
    "phone" = EXCLUDED."phone",
    "email" = EXCLUDED."email",
    "RFC" = EXCLUDED."RFC",
    "specialty" = EXCLUDED."specialty",
    "type_worker" = EXCLUDED."type_worker",
    "function_performed" = EXCLUDED."function_performed",
    "observations" = EXCLUDED."observations",
    "status" = EXCLUDED."status";

INSERT INTO "public"."date_of_admissions" (
    "id",
    "date_of_admission",
    "type",
    "worker_id"
)
VALUES
    (1, '2024-08-15', 'Ingreso institucional', 1),
    (2, '2025-01-10', 'Ingreso institucional', 2)
ON CONFLICT ("id") DO UPDATE
SET
    "date_of_admission" = EXCLUDED."date_of_admission",
    "type" = EXCLUDED."type",
    "worker_id" = EXCLUDED."worker_id";

INSERT INTO "public"."sustenance_plazas" (
    "id",
    "sustenance",
    "payment_key",
    "plaza",
    "worker_id"
)
VALUES
    (1, 'Estatal', 'LOCAL-001', 'Plaza ficticia docente', 1),
    (2, 'Federal', 'LOCAL-002', 'Plaza ficticia administrativa', 2)
ON CONFLICT ("id") DO UPDATE
SET
    "sustenance" = EXCLUDED."sustenance",
    "payment_key" = EXCLUDED."payment_key",
    "plaza" = EXCLUDED."plaza",
    "worker_id" = EXCLUDED."worker_id";

INSERT INTO "public"."roles" ("id", "role", "worker_id")
VALUES
    (1, 'Coordinación local ficticia', 1)
ON CONFLICT ("id") DO UPDATE
SET
    "role" = EXCLUDED."role",
    "worker_id" = EXCLUDED."worker_id";

INSERT INTO "public"."state_roles" ("id", "role", "name_worker")
VALUES
    (1, 'Representante local ficticio', 'María Prueba López')
ON CONFLICT ("id") DO UPDATE
SET
    "role" = EXCLUDED."role",
    "name_worker" = EXCLUDED."name_worker";

INSERT INTO "public"."utilities" ("id", "description", "value")
VALUES
    (1, 'Nombre de la institución', 'Institución Local de Prueba'),
    (2, 'Ciudad', 'Ciudad de Prueba')
ON CONFLICT ("id") DO UPDATE
SET
    "description" = EXCLUDED."description",
    "value" = EXCLUDED."value";

INSERT INTO "public"."schedule_assignments" (
    "id",
    "weekday",
    "group_id",
    "subject_id",
    "start_time",
    "end_time",
    "worker_id",
    "semester_id"
)
VALUES
    (1, 'Lunes', 1, 1, '08:00', '10:00', 1, 1),
    (2, 'Miércoles', 1, 2, '10:00', '12:00', 1, 1)
ON CONFLICT ("id") DO UPDATE
SET
    "weekday" = EXCLUDED."weekday",
    "group_id" = EXCLUDED."group_id",
    "subject_id" = EXCLUDED."subject_id",
    "start_time" = EXCLUDED."start_time",
    "end_time" = EXCLUDED."end_time",
    "worker_id" = EXCLUDED."worker_id",
    "semester_id" = EXCLUDED."semester_id";

INSERT INTO "public"."schedule_teachers" (
    "id",
    "weekday",
    "activity",
    "start_time",
    "end_time",
    "worker_id",
    "semester_id"
)
VALUES
    (1, 'Martes', 'Tutoría local ficticia', '09:00', '11:00', 1, 1),
    (2, 'Jueves', 'Asesoría local ficticia', '12:00', '14:00', 2, 1)
ON CONFLICT ("id") DO UPDATE
SET
    "weekday" = EXCLUDED."weekday",
    "activity" = EXCLUDED."activity",
    "start_time" = EXCLUDED."start_time",
    "end_time" = EXCLUDED."end_time",
    "worker_id" = EXCLUDED."worker_id",
    "semester_id" = EXCLUDED."semester_id";

-- ============================================================================
-- Reserved local development fixture range: workers 9001-9007.
--
-- These ids are a practical, out-of-band reserved block for local-only
-- manual-verification fixtures (see
-- openspec/changes/expand-worker-development-seed). Workers 9001-9007 use
-- these explicit reserved literal ids, exactly like ids 1 and 2 above, and
-- explicit-id inserts do not advance "workers_id_seq" -- that sequence's
-- setval below stays pinned to 2, so the next normal worker created through
-- the running application still receives id = 3.
--
-- If you add another fixture to this block, do NOT "fix" the
-- workers_id_seq setval to match a higher literal id here. Keeping it at 2
-- is what lets normal generated worker ids continue from 3 upward;
-- advancing it to 9007 would not make anything safer -- a clean `supabase
-- db reset` already removes any manually created local rows before this
-- file ever runs -- it would just unnecessarily skip ids 3-9007 for no
-- benefit. The one thing this range does not eliminate: in a long-lived
-- local database that is never reset, the natural sequence could in
-- principle reach 9001 on its own after enough organically-created
-- workers, and would then collide with this reserved block on a later
-- reset. This is a practical local fixture strategy for ordinary
-- day-to-day development, not a permanent, collision-proof guarantee.
--
-- Fixture roles (see design.md for the full rationale):
--   9001 - has an Auth user + identity, but NO linked profile (exercises
--          the "link existing account" path).
--   9002 - fully linked worker account: auth.users + auth.identities +
--          profiles(role='worker'). Can sign in with the password
--          documented above and exercises /my-documents and password
--          recovery.
--   9003 - active worker with no email (email = NULL).
--   9004 - inactive worker (status = 0) with a valid email and no account.
--   9005 - FIXTURE NEGATIVO: deliberately malformed email (no "@"), to
--          exercise create-worker-account's email-format guard. Not real
--          data.
--   9006/9007 - FIXTURE NEGATIVO: an exact duplicate email shared by two
--          workers, to exercise create-worker-account's duplicate-email
--          guard. Not real data.
--
-- None of 9001-9007 get rows in date_of_admissions/sustenance_plazas/roles/
-- schedule_assignments/schedule_teachers -- none of the manual-verification
-- scenarios this block exists for call for them, and workers 1 and 2 above
-- already cover the "has schedule assignments" / "has no schedule
-- assignments" cases.
-- ============================================================================

INSERT INTO "public"."workers" (
    "id",
    "name",
    "profile_picture",
    "street",
    "neighborhood",
    "post_code",
    "city",
    "state",
    "phone",
    "email",
    "RFC",
    "specialty",
    "type_worker",
    "function_performed",
    "observations",
    "status"
)
VALUES
    (
        9001,
        'Fixture Cuenta Auth Sin Perfil',
        NULL,
        'Calle Local 9001',
        'Colonia Fixture',
        '00009',
        'Ciudad de Prueba',
        'Estado de Prueba',
        '5559000001',
        'auth-sin-perfil.local@enub.test',
        'FIXA010101XXX',
        'Matemáticas',
        'Maestro',
        'Docencia frente a grupo',
        'Fixture local: cuenta Auth existente sin perfil vinculado. No es un dato real.',
        1
    ),
    (
        9002,
        'Fixture Trabajador Vinculado',
        NULL,
        'Calle Local 9002',
        'Colonia Fixture',
        '00009',
        'Ciudad de Prueba',
        'Estado de Prueba',
        '5559000002',
        'trabajador.vinculado.local@enub.test',
        'FIXB020202XXX',
        'Tutoría',
        'Administrativo',
        'Apoyo académico',
        'Fixture local: cuenta totalmente vinculada, puede iniciar sesión. No es un dato real.',
        1
    ),
    (
        9003,
        'Fixture Trabajador Sin Correo',
        NULL,
        'Calle Local 9003',
        'Colonia Fixture',
        '00009',
        'Ciudad de Prueba',
        'Estado de Prueba',
        '5559000003',
        NULL,
        'FIXC030303XXX',
        'Asesoría',
        'Contratacion',
        'Apoyo por contrato',
        'Fixture local: trabajador activo sin correo registrado. No es un dato real.',
        1
    ),
    (
        9004,
        'Fixture Trabajador Inactivo',
        NULL,
        'Calle Local 9004',
        'Colonia Fixture',
        '00009',
        'Ciudad de Prueba',
        'Estado de Prueba',
        '5559000004',
        'inactivo.local@enub.test',
        'FIXD040404XXX',
        'Matemáticas',
        'Maestro',
        'Docencia frente a grupo',
        'Fixture local: trabajador inactivo, sin cuenta. No es un dato real.',
        0
    ),
    (
        9005,
        'FIXTURE NEGATIVO — Correo Inválido (no usar)',
        NULL,
        'Calle Local 9005',
        'Colonia Fixture',
        '00009',
        'Ciudad de Prueba',
        'Estado de Prueba',
        '5559000005',
        'trabajador-correo-invalido',
        'FIXE050505XXX',
        'Apoyo',
        'Administrativo',
        'Apoyo académico',
        'Fixture negativo local: correo con formato inválido a propósito -- exercita el guard de formato de correo de create-worker-account. No es un dato real ni debe tratarse como tal.',
        1
    ),
    (
        9006,
        'FIXTURE NEGATIVO — Correo Duplicado A (no usar)',
        NULL,
        'Calle Local 9006',
        'Colonia Fixture',
        '00009',
        'Ciudad de Prueba',
        'Estado de Prueba',
        '5559000006',
        'correo.duplicado.local@enub.test',
        'FIXF060606XXX',
        'Asesoría',
        'Contratacion',
        'Apoyo por contrato',
        'Fixture negativo local: comparte correo a propósito con el fixture 9007 -- exercita el guard de correo duplicado de create-worker-account. No es un dato real ni debe tratarse como tal.',
        1
    ),
    (
        9007,
        'FIXTURE NEGATIVO — Correo Duplicado B (no usar)',
        NULL,
        'Calle Local 9007',
        'Colonia Fixture',
        '00009',
        'Ciudad de Prueba',
        'Estado de Prueba',
        '5559000007',
        'correo.duplicado.local@enub.test',
        'FIXG070707XXX',
        'Matemáticas',
        'Maestro',
        'Docencia frente a grupo',
        'Fixture negativo local: comparte correo a propósito con el fixture 9006 -- exercita el guard de correo duplicado de create-worker-account. No es un dato real ni debe tratarse como tal.',
        1
    )
ON CONFLICT ("id") DO UPDATE
SET
    "name" = EXCLUDED."name",
    "profile_picture" = EXCLUDED."profile_picture",
    "street" = EXCLUDED."street",
    "neighborhood" = EXCLUDED."neighborhood",
    "post_code" = EXCLUDED."post_code",
    "city" = EXCLUDED."city",
    "state" = EXCLUDED."state",
    "phone" = EXCLUDED."phone",
    "email" = EXCLUDED."email",
    "RFC" = EXCLUDED."RFC",
    "specialty" = EXCLUDED."specialty",
    "type_worker" = EXCLUDED."type_worker",
    "function_performed" = EXCLUDED."function_performed",
    "observations" = EXCLUDED."observations",
    "status" = EXCLUDED."status";

-- Auth fixtures for 9001 (Auth user + identity only, no profile) and 9002
-- (fully linked). Same pattern as the bootstrap admin block at the top of
-- this file: a fixed UUID, ON CONFLICT upserts, and a fresh bcrypt hash of a
-- deterministic local-only plaintext password on every run (the hash bytes
-- differ per reset; the plaintext documented at the top of this file does
-- not).
INSERT INTO "auth"."users" (
    "instance_id",
    "id",
    "aud",
    "role",
    "email",
    "encrypted_password",
    "email_confirmed_at",
    "last_sign_in_at",
    "raw_app_meta_data",
    "raw_user_meta_data",
    "created_at",
    "updated_at",
    "confirmation_token",
    "email_change",
    "email_change_token_new",
    "recovery_token"
)
VALUES
    (
        '00000000-0000-0000-0000-000000000000',
        '22222222-2222-2222-2222-222222222222',
        'authenticated',
        'authenticated',
        'auth-sin-perfil.local@enub.test',
        "extensions"."crypt"('AuthSinPerfilLocal123!', "extensions"."gen_salt"('bf')),
        "now"(),
        "now"(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"name": "Fixture Cuenta Auth Sin Perfil"}'::jsonb,
        "now"(),
        "now"(),
        '',
        '',
        '',
        ''
    ),
    (
        '00000000-0000-0000-0000-000000000000',
        '33333333-3333-3333-3333-333333333333',
        'authenticated',
        'authenticated',
        'trabajador.vinculado.local@enub.test',
        "extensions"."crypt"('TrabajadorLocal123!', "extensions"."gen_salt"('bf')),
        "now"(),
        "now"(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        '{"name": "Fixture Trabajador Vinculado"}'::jsonb,
        "now"(),
        "now"(),
        '',
        '',
        '',
        ''
    )
ON CONFLICT ("id") DO UPDATE
SET
    "email" = EXCLUDED."email",
    "encrypted_password" = EXCLUDED."encrypted_password",
    "email_confirmed_at" = EXCLUDED."email_confirmed_at",
    "raw_app_meta_data" = EXCLUDED."raw_app_meta_data",
    "raw_user_meta_data" = EXCLUDED."raw_user_meta_data",
    "updated_at" = EXCLUDED."updated_at";

INSERT INTO "auth"."identities" (
    "id",
    "user_id",
    "identity_data",
    "provider",
    "provider_id",
    "last_sign_in_at",
    "created_at",
    "updated_at"
)
VALUES
    (
        '22222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222222',
        '{"sub": "22222222-2222-2222-2222-222222222222", "email": "auth-sin-perfil.local@enub.test"}'::jsonb,
        'email',
        'auth-sin-perfil.local@enub.test',
        "now"(),
        "now"(),
        "now"()
    ),
    (
        '33333333-3333-3333-3333-333333333333',
        '33333333-3333-3333-3333-333333333333',
        '{"sub": "33333333-3333-3333-3333-333333333333", "email": "trabajador.vinculado.local@enub.test"}'::jsonb,
        'email',
        'trabajador.vinculado.local@enub.test',
        "now"(),
        "now"(),
        "now"()
    )
ON CONFLICT ("provider_id", "provider") DO UPDATE
SET
    "user_id" = EXCLUDED."user_id",
    "identity_data" = EXCLUDED."identity_data",
    "last_sign_in_at" = EXCLUDED."last_sign_in_at",
    "updated_at" = EXCLUDED."updated_at";

-- Worker 9002 only: fully linked profile (role='worker', worker_id=9002).
-- Worker 9001 deliberately gets NO profiles row -- it must remain an
-- unlinked Auth user in order to exercise the "link existing account" path.
INSERT INTO "public"."profiles" ("id", "role", "worker_id")
VALUES ('33333333-3333-3333-3333-333333333333', 'worker', 9002)
ON CONFLICT ("id") DO UPDATE
SET
    "role" = EXCLUDED."role",
    "worker_id" = EXCLUDED."worker_id";

SELECT "pg_catalog"."setval"('"public"."date_of_admissions_id_seq"', 2, true);
SELECT "pg_catalog"."setval"('"public"."degrees_id_seq"', 2, true);
SELECT "pg_catalog"."setval"('"public"."groups_id_seq"', 2, true);
SELECT "pg_catalog"."setval"('"public"."roles_id_seq"', 1, true);
SELECT "pg_catalog"."setval"('"public"."schedule_assignments_id_seq"', 2, true);
SELECT "pg_catalog"."setval"('"public"."schedule_teachers_id_seq"', 2, true);
SELECT "pg_catalog"."setval"('"public"."semesters_id_seq"', 2, true);
SELECT "pg_catalog"."setval"('"public"."state_roles_id_seq"', 1, true);
SELECT "pg_catalog"."setval"('"public"."study_programs_id_seq"', 1, true);
SELECT "pg_catalog"."setval"('"public"."subject_id_seq"', 2, true);
SELECT "pg_catalog"."setval"('"public"."sustenance_plazas_id_seq"', 2, true);
SELECT "pg_catalog"."setval"('"public"."utilities_id_seq"', 2, true);
-- Deliberately left at 2, NOT advanced to 9007 -- see the reserved-fixture-
-- range comment above the 9001-9007 block. The next worker created through
-- the running application must still receive id = 3.
SELECT "pg_catalog"."setval"('"public"."workers_id_seq"', 2, true);
