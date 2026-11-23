-- Candidate migration; validate locally before moving into supabase/migrations.
CREATE POLICY "Staff and admin can create workers"
ON public.workers FOR INSERT TO authenticated
WITH CHECK ((SELECT public.current_app_role()) IN ('staff', 'admin'));

CREATE FUNCTION public.create_worker_with_relations(
  p_worker jsonb,
  p_sustenance_plazas jsonb DEFAULT '[]'::jsonb,
  p_date_of_admissions jsonb DEFAULT '[]'::jsonb
)
RETURNS SETOF public.workers
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_worker public.workers%ROWTYPE;
BEGIN
  IF public.current_app_role() IS NULL OR public.current_app_role() NOT IN ('staff', 'admin') THEN
    RAISE EXCEPTION 'Only administrators and staff can create workers' USING ERRCODE = '42501';
  END IF;
  IF p_worker IS NULL OR jsonb_typeof(p_worker) <> 'object'
     OR nullif(btrim(p_worker->>'name'), '') IS NULL
     OR nullif(btrim(p_worker->>'RFC'), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid worker payload' USING ERRCODE = '22023';
  END IF;
  IF p_sustenance_plazas IS NULL OR jsonb_typeof(p_sustenance_plazas) <> 'array'
     OR p_date_of_admissions IS NULL OR jsonb_typeof(p_date_of_admissions) <> 'array' THEN
    RAISE EXCEPTION 'Invalid relation payload' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_sustenance_plazas) AS p(sustenance text, payment_key text, plaza text)
    WHERE p.sustenance IS NULL OR p.sustenance NOT IN ('Estatal','Federal')
      OR nullif(btrim(p.payment_key),'') IS NULL OR nullif(btrim(p.plaza),'') IS NULL) THEN
    RAISE EXCEPTION 'Invalid plaza' USING ERRCODE = '22023';
  END IF;
  SELECT (jsonb_populate_record(NULL::public.workers, p_worker - ARRAY['id','created_at'])).* INTO v_worker;
  INSERT INTO public.workers (name, profile_picture, street, neighborhood, post_code, city, state, phone, email, "RFC", specialty, type_worker, function_performed, observations, status)
  VALUES (v_worker.name, v_worker.profile_picture, v_worker.street, v_worker.neighborhood, v_worker.post_code, v_worker.city, v_worker.state, v_worker.phone, v_worker.email, v_worker."RFC", v_worker.specialty, v_worker.type_worker, v_worker.function_performed, v_worker.observations, coalesce(v_worker.status, 1))
  RETURNING * INTO v_worker;
  INSERT INTO public.sustenance_plazas (sustenance, payment_key, plaza, worker_id)
    SELECT p.sustenance, p.payment_key, p.plaza, v_worker.id
    FROM jsonb_to_recordset(p_sustenance_plazas) AS p(sustenance varchar, payment_key varchar, plaza varchar);
  INSERT INTO public.date_of_admissions (type, date_of_admission, worker_id)
    SELECT d.type, d.date_of_admission, v_worker.id
    FROM jsonb_to_recordset(p_date_of_admissions) AS d(type varchar, date_of_admission date);
  RETURN NEXT v_worker;
END;
$$;
REVOKE ALL ON FUNCTION public.create_worker_with_relations(jsonb,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_worker_with_relations(jsonb,jsonb,jsonb) TO authenticated;
