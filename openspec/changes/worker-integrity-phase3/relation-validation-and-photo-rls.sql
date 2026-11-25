-- Atomic administrative worker editing. NULL relation arguments preserve the
-- current rows, [] clears them, and a non-empty array replaces them.
CREATE OR REPLACE FUNCTION "public"."update_worker_with_relations"(
    "p_worker_id" bigint,
    "p_worker" jsonb,
    "p_sustenance_plazas" jsonb DEFAULT NULL,
    "p_date_of_admissions" jsonb DEFAULT NULL
)
RETURNS SETOF "public"."workers"
LANGUAGE "plpgsql"
SECURITY INVOKER
SET "search_path" = ''
AS $$
DECLARE
    v_worker "public"."workers"%ROWTYPE;
BEGIN
    IF "public"."current_app_role"() IS NULL
       OR "public"."current_app_role"() NOT IN ('admin', 'staff') THEN
        RAISE EXCEPTION 'Only administrators and staff can update workers'
            USING ERRCODE = 'WUP01';
    END IF;

    IF p_worker IS NULL OR jsonb_typeof(p_worker) <> 'object' THEN
        RAISE EXCEPTION 'Worker payload must be a JSON object'
            USING ERRCODE = 'WUP02';
    END IF;

    IF p_sustenance_plazas IS NOT NULL
       AND jsonb_typeof(p_sustenance_plazas) <> 'array' THEN
        RAISE EXCEPTION 'Sustenance plazas payload must be a JSON array'
            USING ERRCODE = 'WUP03';
    END IF;

    IF p_date_of_admissions IS NOT NULL
       AND jsonb_typeof(p_date_of_admissions) <> 'array' THEN
        RAISE EXCEPTION 'Admission dates payload must be a JSON array'
            USING ERRCODE = 'WUP04';
    END IF;

    IF p_sustenance_plazas IS NOT NULL AND EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_sustenance_plazas) AS p(sustenance text, payment_key text, plaza text)
        WHERE coalesce(btrim(p.sustenance),'') NOT IN ('Estatal','Federal')
           OR nullif(btrim(p.payment_key),'') IS NULL OR nullif(btrim(p.plaza),'') IS NULL
    ) THEN
        RAISE EXCEPTION 'Invalid plaza fields' USING ERRCODE = 'WUP03';
    END IF;
    IF p_sustenance_plazas IS NOT NULL AND EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_sustenance_plazas) AS p(payment_key text)
        GROUP BY btrim(p.payment_key) HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate payment key' USING ERRCODE = 'WUP03';
    END IF;
    IF p_date_of_admissions IS NOT NULL AND EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_date_of_admissions) AS d(type text, date_of_admission date)
        WHERE nullif(btrim(d.type),'') IS NULL OR d.date_of_admission IS NULL
    ) THEN
        RAISE EXCEPTION 'Incomplete admission' USING ERRCODE = 'WUP04';
    END IF;
    IF p_date_of_admissions IS NOT NULL AND EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_date_of_admissions) AS d(type text)
        GROUP BY upper(btrim(d.type)) HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate admission type' USING ERRCODE = 'WUP04';
    END IF;

    SELECT (jsonb_populate_record(w, p_worker - ARRAY['id', 'created_at'])).*
      INTO v_worker
      FROM "public"."workers" AS w
     WHERE w.id = p_worker_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Worker not found'
            USING ERRCODE = 'WUP05';
    END IF;

    UPDATE "public"."workers"
       SET "name" = v_worker."name",
           "profile_picture" = v_worker."profile_picture",
           "street" = v_worker."street",
           "neighborhood" = v_worker."neighborhood",
           "post_code" = v_worker."post_code",
           "city" = v_worker."city",
           "state" = v_worker."state",
           "phone" = v_worker."phone",
           "email" = v_worker."email",
           "RFC" = v_worker."RFC",
           "specialty" = v_worker."specialty",
           "type_worker" = v_worker."type_worker",
           "function_performed" = v_worker."function_performed",
           "observations" = v_worker."observations",
           "status" = v_worker."status"
     WHERE "id" = p_worker_id
     RETURNING * INTO v_worker;

    IF p_sustenance_plazas IS NOT NULL THEN
        DELETE FROM "public"."sustenance_plazas"
         WHERE "worker_id" = p_worker_id;

        INSERT INTO "public"."sustenance_plazas" (
            "sustenance", "payment_key", "plaza", "worker_id"
        )
        SELECT p."sustenance", p."payment_key", p."plaza", p_worker_id
          FROM jsonb_to_recordset(p_sustenance_plazas) AS p(
              "sustenance" character varying,
              "payment_key" character varying,
              "plaza" character varying
          );
    END IF;

    IF p_date_of_admissions IS NOT NULL THEN
        DELETE FROM "public"."date_of_admissions"
         WHERE "worker_id" = p_worker_id;

        INSERT INTO "public"."date_of_admissions" (
            "type", "date_of_admission", "worker_id"
        )
        SELECT d."type", d."date_of_admission", p_worker_id
          FROM jsonb_to_recordset(p_date_of_admissions) AS d(
              "type" character varying,
              "date_of_admission" date
          );
    END IF;

    RETURN NEXT v_worker;
END;
$$;


-- Keep existing read policies; restrict mutations to administrative roles.
DROP POLICY IF EXISTS "Allow delete pictures 1pmf6kr_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow update pictures 1pmf6kr_0" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload pictures 1pmf6kr_0" ON storage.objects;
CREATE POLICY "Staff admin upload worker photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile_pictures' AND (SELECT public.current_app_role()) IN ('staff','admin'));
CREATE POLICY "Staff admin update worker photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile_pictures' AND (SELECT public.current_app_role()) IN ('staff','admin'))
WITH CHECK (bucket_id = 'profile_pictures' AND (SELECT public.current_app_role()) IN ('staff','admin'));
CREATE POLICY "Staff admin delete worker photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile_pictures' AND (SELECT public.current_app_role()) IN ('staff','admin'));
