-- Candidate only; execute after schema-candidate.sql in the same migration transaction.
-- No production execution. All public wrappers are SECURITY INVOKER.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.groups FROM PUBLIC, anon, authenticated;
GRANT INSERT (year_of_admission, letter, degree_id) ON public.groups TO authenticated;
-- Existing SELECT and INSERT RLS retained. Audit schema remains absent from API exposed schemas.
GRANT USAGE ON SCHEMA group_admin_private TO authenticated;

CREATE FUNCTION group_admin_private.audit_create_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF actor IS NULL OR coalesce(public.current_app_role(),'') NOT IN ('admin','staff') THEN
    RAISE EXCEPTION 'Group creation not authorized' USING ERRCODE='42501';
  END IF;
  INSERT INTO group_admin_private.events(group_id,actor_id,action,after_state)
    VALUES (NEW.id,actor,'create',to_jsonb(NEW));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION group_admin_private.audit_create_group() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION group_admin_private.prepare_group_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  NEW.letter := upper(btrim(NEW.letter));
  NEW.version := 1;
  NEW.updated_at := statement_timestamp();
  NEW.archived_at := NULL;
  NEW.archived_by := NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION group_admin_private.prepare_group_insert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER groups_prepare_insert BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION group_admin_private.prepare_group_insert();
CREATE TRIGGER groups_audit_insert AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION group_admin_private.audit_create_group();

CREATE FUNCTION group_admin_private.mutate_group(
  p_action text, p_id bigint, p_version integer, p_year integer,
  p_letter text, p_degree bigint, p_reason text
) RETURNS public.groups
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := auth.uid();
  app_role text := coalesce(public.current_app_role(),'');
  before_row public.groups%ROWTYPE;
  after_row public.groups%ROWTYPE;
  reason text := nullif(btrim(p_reason),'');
BEGIN
  IF actor IS NULL OR app_role NOT IN ('staff','admin')
     OR (p_action='delete' AND app_role <> 'admin') THEN
    RAISE EXCEPTION 'Group mutation not authorized' USING ERRCODE='42501';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Group lifecycle requires read committed' USING ERRCODE='GRP06';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('edit','archive','reactivate','delete')
     OR p_id IS NULL OR p_version IS NULL OR p_version < 1
     OR (p_action IN ('archive','reactivate','delete') AND reason IS NULL)
     OR char_length(reason)>500 THEN
    RAISE EXCEPTION 'Invalid group mutation' USING ERRCODE='GRP05';
  END IF;
  SELECT * INTO before_row FROM public.groups WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found' USING ERRCODE='GRP04'; END IF;
  IF before_row.version <> p_version THEN
    RAISE EXCEPTION 'Group version conflict' USING ERRCODE='GRP01';
  END IF;
  IF p_action='edit' THEN
    IF p_year IS NULL OR p_degree IS NULL OR nullif(btrim(p_letter),'') IS NULL THEN
      RAISE EXCEPTION 'Group identity required' USING ERRCODE='GRP05';
    END IF;
    IF (before_row.year_of_admission,before_row.letter,before_row.degree_id)
       IS NOT DISTINCT FROM (p_year,upper(btrim(p_letter)),p_degree) THEN
      RETURN before_row; -- no mutation, no audit event
    END IF;
    IF EXISTS (SELECT 1 FROM public.schedule_assignments WHERE group_id=p_id) THEN
      RAISE EXCEPTION 'Historical identity protected' USING ERRCODE='GRP02';
    END IF;
    UPDATE public.groups SET year_of_admission=p_year, letter=upper(btrim(p_letter)),
      degree_id=p_degree, version=version+1, updated_at=clock_timestamp()
      WHERE id=p_id RETURNING * INTO after_row;
  ELSIF p_action='archive' THEN
    IF before_row.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Group already archived' USING ERRCODE='GRP03';
    END IF;
    UPDATE public.groups SET archived_at=clock_timestamp(),archived_by=actor,
      version=version+1,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO after_row;
  ELSIF p_action='reactivate' THEN
    IF before_row.archived_at IS NULL THEN
      RAISE EXCEPTION 'Group already active' USING ERRCODE='GRP03';
    END IF;
    UPDATE public.groups SET archived_at=NULL,archived_by=NULL,
      version=version+1,updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO after_row;
  ELSE
    IF EXISTS (SELECT 1 FROM public.schedule_assignments WHERE group_id=p_id) THEN
      RAISE EXCEPTION 'Group has schedule dependencies' USING ERRCODE='GRP02';
    END IF;
    DELETE FROM public.groups WHERE id=p_id;
  END IF;
  INSERT INTO group_admin_private.events(group_id,actor_id,action,before_state,after_state,reason)
    VALUES(p_id,actor,p_action,to_jsonb(before_row),
      CASE WHEN p_action='delete' THEN NULL ELSE to_jsonb(after_row) END,reason);
  IF p_action='delete' THEN RETURN before_row; END IF;
  RETURN after_row;
END;
$$;
REVOKE ALL ON FUNCTION group_admin_private.mutate_group(text,bigint,integer,integer,text,bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION group_admin_private.mutate_group(text,bigint,integer,integer,text,bigint,text) TO authenticated;

CREATE FUNCTION public.update_group(p_id bigint,p_version integer,p_year integer,p_letter text,p_degree bigint)
RETURNS public.groups LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT group_admin_private.mutate_group('edit',p_id,p_version,p_year,p_letter,p_degree,NULL);
$$;
CREATE FUNCTION public.archive_group(p_id bigint,p_version integer,p_reason text)
RETURNS public.groups LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT group_admin_private.mutate_group('archive',p_id,p_version,NULL,NULL,NULL,p_reason);
$$;
CREATE FUNCTION public.restore_group(p_id bigint,p_version integer,p_reason text)
RETURNS public.groups LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT group_admin_private.mutate_group('reactivate',p_id,p_version,NULL,NULL,NULL,p_reason);
$$;
CREATE FUNCTION public.delete_group(p_id bigint,p_version integer,p_reason text)
RETURNS public.groups LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT group_admin_private.mutate_group('delete',p_id,p_version,NULL,NULL,NULL,p_reason);
$$;
REVOKE ALL ON FUNCTION public.update_group(bigint,integer,integer,text,bigint),
 public.archive_group(bigint,integer,text),public.restore_group(bigint,integer,text),
 public.delete_group(bigint,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_group(bigint,integer,integer,text,bigint),
 public.archive_group(bigint,integer,text),public.restore_group(bigint,integer,text),
 public.delete_group(bigint,integer,text) TO authenticated;

CREATE FUNCTION group_admin_private.guard_schedule_group()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE archived timestamptz;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.group_id IS NOT DISTINCT FROM OLD.group_id AND NEW.semester_id IS NOT DISTINCT FROM OLD.semester_id THEN
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.group_id IS NULL THEN RETURN NEW; END IF; -- preserve existing nullable semantics
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Schedule group guard requires read committed' USING ERRCODE='GRP06';
  END IF;
  SELECT archived_at INTO archived FROM public.groups WHERE id=NEW.group_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found' USING ERRCODE='23503'; END IF;
  IF archived IS NOT NULL THEN RAISE EXCEPTION 'Group archived' USING ERRCODE='GRP03'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION group_admin_private.guard_schedule_group() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER schedule_group_lifecycle_guard BEFORE INSERT OR UPDATE OF group_id,semester_id
 ON public.schedule_assignments FOR EACH ROW EXECUTE FUNCTION group_admin_private.guard_schedule_group();

-- Admin-only, bounded audit read, no direct client grants on events.
CREATE FUNCTION group_admin_private.read_group_events(p_id bigint,p_before bigint,p_limit integer)
RETURNS SETOF group_admin_private.events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR coalesce(public.current_app_role(),'') <> 'admin' THEN
    RAISE EXCEPTION 'Audit access denied' USING ERRCODE='42501';
  END IF;
  RETURN QUERY SELECT e.* FROM group_admin_private.events e
    WHERE (p_id IS NULL OR e.group_id=p_id) AND (p_before IS NULL OR e.id<p_before)
    ORDER BY e.id DESC LIMIT greatest(1,least(coalesce(p_limit,50),100));
END;
$$;
REVOKE ALL ON FUNCTION group_admin_private.read_group_events(bigint,bigint,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION group_admin_private.read_group_events(bigint,bigint,integer) TO authenticated;
CREATE FUNCTION public.get_group_audit(p_id bigint DEFAULT NULL,p_before bigint DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS TABLE(id bigint,group_id bigint,actor_id uuid,action text,occurred_at timestamptz,before_state jsonb,after_state jsonb,reason text)
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT e.id,e.group_id,e.actor_id,e.action,e.occurred_at,e.before_state,e.after_state,e.reason
  FROM group_admin_private.read_group_events(p_id,p_before,p_limit) e;
$$;
REVOKE ALL ON FUNCTION public.get_group_audit(bigint,bigint,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_audit(bigint,bigint,integer) TO authenticated;

-- Release gates: isolated migration and role tests, service/fixture compatibility,
-- verify schema is not API exposed, audit backup coverage, two-session lock tests,
-- verify effective column grants and trigger execution, no production writes.
