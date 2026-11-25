SET LOCAL lock_timeout = '5s';
-- Candidate for separate CLI-generated migration; not active until validated.
CREATE POLICY "Staff and admin can insert workers"
ON public.workers FOR INSERT TO authenticated
WITH CHECK ((SELECT public.current_app_role()) IN ('staff','admin'));
GRANT INSERT ON public.workers TO authenticated;
GRANT USAGE ON SEQUENCE public.workers_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.create_worker_with_relations(
  p_worker jsonb,
  p_sustenance_plazas jsonb DEFAULT NULL,
  p_date_of_admissions jsonb DEFAULT NULL
)
RETURNS SETOF public.workers
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE v_worker public.workers%ROWTYPE;
BEGIN
  IF coalesce(public.current_app_role(), '') NOT IN ('admin','staff') THEN
    RAISE EXCEPTION 'Unauthorized worker creation' USING ERRCODE = 'WUP01';
  END IF;
  IF p_worker IS NULL OR jsonb_typeof(p_worker) <> 'object' OR
     nullif(btrim(p_worker->>'name'),'') IS NULL OR nullif(btrim(p_worker->>'RFC'),'') IS NULL THEN
    RAISE EXCEPTION 'Worker name and RFC required' USING ERRCODE = 'WUP02';
  END IF;
  SELECT * INTO v_worker FROM jsonb_populate_record(NULL::public.workers, p_worker - ARRAY['id','created_at']);
  INSERT INTO public.workers (name, "RFC", profile_picture, street, neighborhood, post_code, city, state, phone, email, specialty, type_worker, function_performed, observations, status)
  VALUES (v_worker.name, v_worker."RFC", v_worker.profile_picture, v_worker.street, v_worker.neighborhood, v_worker.post_code, v_worker.city, v_worker.state, v_worker.phone, v_worker.email, v_worker.specialty, v_worker.type_worker, v_worker.function_performed, v_worker.observations, v_worker.status)
  RETURNING * INTO v_worker;
  RETURN QUERY SELECT * FROM public.update_worker_with_relations(v_worker.id, '{}'::jsonb, p_sustenance_plazas, p_date_of_admissions);
END;
$$;
REVOKE ALL ON FUNCTION public.create_worker_with_relations(jsonb,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_worker_with_relations(jsonb,jsonb,jsonb) TO authenticated;
