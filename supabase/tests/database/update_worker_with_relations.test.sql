BEGIN;

SET search_path = public, extensions;
SELECT plan(22);

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
    ('00000000-0000-0000-0000-000000000000', '51000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'worker-edit-admin@example.test', 'x', now(), '{}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '51000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'worker-edit-worker@example.test', 'x', now(), '{}', '{}', now(), now());

INSERT INTO public.profiles (id, role, worker_id)
VALUES ('51000000-0000-0000-0000-000000000001', 'admin', NULL);

CREATE TEMP TABLE worker_edit_ids AS
WITH inserted_worker AS (
    INSERT INTO public.workers (name, phone, "RFC", status)
    VALUES ('Trabajador original', '5550000000', 'TEST000000XXX', 1)
    RETURNING id
), inserted_plaza AS (
    INSERT INTO public.sustenance_plazas (sustenance, payment_key, plaza, worker_id)
    SELECT 'Estatal', 'ORIGINAL', 'Plaza original', id FROM inserted_worker
    RETURNING id, worker_id
), inserted_date AS (
    INSERT INTO public.date_of_admissions (type, date_of_admission, worker_id)
    SELECT 'Ingreso', '2020-01-01', id FROM inserted_worker
    RETURNING id, worker_id
)
SELECT inserted_worker.id AS worker_id,
       inserted_plaza.id AS plaza_id,
       inserted_date.id AS admission_id
FROM inserted_worker
JOIN inserted_plaza ON inserted_plaza.worker_id = inserted_worker.id
JOIN inserted_date ON inserted_date.worker_id = inserted_worker.id;

INSERT INTO public.profiles (id, role, worker_id)
SELECT '51000000-0000-0000-0000-000000000002', 'worker', worker_id
FROM worker_edit_ids;

SELECT worker_id, plaza_id, admission_id FROM worker_edit_ids \gset

SET LOCAL role authenticated;
SET LOCAL "request.jwt.claim.sub" = '51000000-0000-0000-0000-000000000001';

SELECT lives_ok(
    format($$SELECT public.update_worker_with_relations(%L, '{"phone":"5551111111"}'::jsonb, NULL, NULL)$$, :'worker_id'),
    'editing only the phone succeeds'
);
SELECT is((SELECT phone FROM public.workers WHERE id = :'worker_id'), '5551111111', 'phone is updated');
SELECT is((SELECT id FROM public.sustenance_plazas WHERE worker_id = :'worker_id'), :'plaza_id'::bigint, 'phone edit preserves the plaza row');
SELECT is((SELECT id FROM public.date_of_admissions WHERE worker_id = :'worker_id'), :'admission_id'::bigint, 'phone edit preserves the admission row');

SELECT lives_ok(
    format($$SELECT public.update_worker_with_relations(%L, '{"name":"Trabajador renombrado"}'::jsonb, NULL, NULL)$$, :'worker_id'),
    'editing only the name succeeds'
);
SELECT is((SELECT name FROM public.workers WHERE id = :'worker_id'), 'Trabajador renombrado', 'name is updated');
SELECT is((SELECT id FROM public.sustenance_plazas WHERE worker_id = :'worker_id'), :'plaza_id'::bigint, 'name edit preserves the plaza row');

SELECT lives_ok(
    format($$SELECT public.update_worker_with_relations(%L, '{}'::jsonb, '[{"sustenance":"Federal","payment_key":"NUEVA","plaza":"Plaza nueva"}]'::jsonb, NULL)$$, :'worker_id'),
    'editing a plaza succeeds'
);
SELECT is((SELECT payment_key FROM public.sustenance_plazas WHERE worker_id = :'worker_id'), 'NUEVA', 'plaza rows are replaced');
SELECT is((SELECT id FROM public.date_of_admissions WHERE worker_id = :'worker_id'), :'admission_id'::bigint, 'plaza edit preserves admission dates');

SELECT lives_ok(
    format($$SELECT public.update_worker_with_relations(%L, '{}'::jsonb, '[]'::jsonb, NULL)$$, :'worker_id'),
    'an explicit empty plaza array succeeds'
);
SELECT is((SELECT count(*)::integer FROM public.sustenance_plazas WHERE worker_id = :'worker_id'), 0, 'an empty plaza array removes all plazas');

SELECT lives_ok(
    format($$SELECT public.update_worker_with_relations(%L, '{}'::jsonb, NULL, '[{"type":"Reingreso","date_of_admission":"2024-08-01"}]'::jsonb)$$, :'worker_id'),
    'editing admission dates succeeds'
);
SELECT is((SELECT type FROM public.date_of_admissions WHERE worker_id = :'worker_id'), 'Reingreso', 'admission dates are replaced');

SELECT throws_ok(
    format($$SELECT public.update_worker_with_relations(%L, '{"name":"No debe persistir"}'::jsonb, '[{"sustenance":"Estatal","payment_key":"ROLLBACK","plaza":"Temporal"}]'::jsonb, '[{"type":"Inválida","date_of_admission":"no-es-fecha"}]'::jsonb)$$, :'worker_id'),
    '22007',
    NULL,
    'an admission-date failure aborts the RPC'
);
SELECT is((SELECT name FROM public.workers WHERE id = :'worker_id'), 'Trabajador renombrado', 'relation failure rolls back the worker update');
SELECT is((SELECT count(*)::integer FROM public.sustenance_plazas WHERE worker_id = :'worker_id'), 0, 'relation failure rolls back prior plaza replacement');
SELECT is((SELECT type FROM public.date_of_admissions WHERE worker_id = :'worker_id'), 'Reingreso', 'relation failure preserves prior admission dates');

SET LOCAL "request.jwt.claim.sub" = '51000000-0000-0000-0000-000000000002';
SELECT throws_ok(
    format($$SELECT public.update_worker_with_relations(%L, '{"name":"No autorizado"}'::jsonb, NULL, NULL)$$, :'worker_id'),
    'WUP01',
    NULL,
    'worker role cannot invoke the administrative edit'
);
SELECT is((SELECT name FROM public.workers WHERE id = :'worker_id'), 'Trabajador renombrado', 'unauthorized RPC leaves the worker unchanged');
SELECT throws_ok(
    format($$INSERT INTO public.sustenance_plazas (sustenance, payment_key, plaza, worker_id) VALUES ('Estatal', 'DIRECTA', 'No permitida', %L)$$, :'worker_id'),
    '42501',
    NULL,
    'worker role cannot insert plazas directly'
);
SELECT throws_ok(
    format($$INSERT INTO public.date_of_admissions (type, date_of_admission, worker_id) VALUES ('Directa', '2024-01-01', %L)$$, :'worker_id'),
    '42501',
    NULL,
    'worker role cannot insert admission dates directly'
);

RESET role;
RESET "request.jwt.claim.sub";

SELECT * FROM finish();
ROLLBACK;
