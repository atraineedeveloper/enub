do $preflight$
declare
  v_external_dependencies integer;
begin
  if not exists (select 1 from pg_extension where extname='pgjwt') then
    raise exception 'pgjwt is not installed; refusing unexpected upgrade-prep state';
  end if;

  with ext as (
    select oid from pg_extension where extname='pgjwt'
  ),
  ext_objects as (
    select d.classid, d.objid, d.objsubid
    from pg_depend d
    join ext on d.refclassid='pg_extension'::regclass
            and d.refobjid=ext.oid
            and d.deptype='e'
  )
  select count(*) into v_external_dependencies
  from pg_depend d
  join ext_objects e
    on d.refclassid=e.classid
   and d.refobjid=e.objid
   and d.refobjsubid=e.objsubid
  where d.deptype='n'
    and not exists (
      select 1 from ext_objects own
      where own.classid=d.classid
        and own.objid=d.objid
        and own.objsubid=d.objsubid
    );

  if v_external_dependencies <> 0 then
    raise exception 'pgjwt has % external dependencies; aborting', v_external_dependencies;
  end if;
end
$preflight$;

drop extension pgjwt;

do $postcondition$
begin
  if exists (select 1 from pg_extension where extname='pgjwt') then
    raise exception 'pgjwt remains installed after drop';
  end if;
end
$postcondition$;