
-- P0: close anonymous/public writes and unrestricted role access while
-- preserving staff/admin operations and worker-owned reads.

do $preflight$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and (
      (tablename = 'roles' and policyname in (
        'Enable read access for all users',
        'Enable update access for all users'
      ))
      or
      (tablename = 'state_roles' and policyname in (
        'Enable read access for all users',
        'Enable update access for all users'
      ))
      or
      (tablename = 'schedule_assignments' and policyname in (
        'Enable create access for all users',
        'Enable update access for all users',
        'Enable delete access for all users'
      ))
      or
      (tablename = 'schedule_teachers' and policyname in (
        'Enable create access for all users',
        'Enable update access for all users',
        'Enable delete access for all users'
      ))
    )
    and roles = array['public']::name[];

  if v_count <> 10 then
    raise exception 'P0 preflight failed: expected 10 legacy public policies, found %', v_count;
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'worker_access_email_corrections'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ) then
    raise exception 'P0 preflight failed: worker_access_email_corrections is missing or RLS state drifted';
  end if;
end
$preflight$;

-- Internal operational state remains service-role-only. No anon/authenticated
-- policy is intentionally created.
alter table public.worker_access_email_corrections enable row level security;
revoke all on table public.worker_access_email_corrections from public, anon, authenticated;
grant all on table public.worker_access_email_corrections to service_role;

-- Worker-related administrative roles.
drop policy "Enable read access for all users" on public.roles;
drop policy "Enable update access for all users" on public.roles;

create policy "Staff and admin manage roles"
on public.roles
for all
to authenticated
using ((select public.current_app_role()) in ('staff', 'admin'))
with check ((select public.current_app_role()) in ('staff', 'admin'));

create policy "Workers can read own roles"
on public.roles
for select
to authenticated
using (
  (select public.current_app_role()) = 'worker'
  and worker_id = (select public.current_worker_id())
);

-- Institution/state role records have no worker ownership key, so they are
-- administrative-only.
drop policy "Enable read access for all users" on public.state_roles;
drop policy "Enable update access for all users" on public.state_roles;

create policy "Staff and admin manage state roles"
on public.state_roles
for all
to authenticated
using ((select public.current_app_role()) in ('staff', 'admin'))
with check ((select public.current_app_role()) in ('staff', 'admin'));

-- Keep the existing staff/admin + worker-owned SELECT policies; replace only
-- the unsafe public write policies.
drop policy "Enable create access for all users" on public.schedule_assignments;
drop policy "Enable update access for all users" on public.schedule_assignments;
drop policy "Enable delete access for all users" on public.schedule_assignments;

create policy "Staff and admin create schedule assignments"
on public.schedule_assignments
for insert
to authenticated
with check ((select public.current_app_role()) in ('staff', 'admin'));

create policy "Staff and admin update schedule assignments"
on public.schedule_assignments
for update
to authenticated
using ((select public.current_app_role()) in ('staff', 'admin'))
with check ((select public.current_app_role()) in ('staff', 'admin'));

create policy "Staff and admin delete schedule assignments"
on public.schedule_assignments
for delete
to authenticated
using ((select public.current_app_role()) in ('staff', 'admin'));

drop policy "Enable create access for all users" on public.schedule_teachers;
drop policy "Enable update access for all users" on public.schedule_teachers;
drop policy "Enable delete access for all users" on public.schedule_teachers;

create policy "Staff and admin create schedule teacher activities"
on public.schedule_teachers
for insert
to authenticated
with check ((select public.current_app_role()) in ('staff', 'admin'));

create policy "Staff and admin update schedule teacher activities"
on public.schedule_teachers
for update
to authenticated
using ((select public.current_app_role()) in ('staff', 'admin'))
with check ((select public.current_app_role()) in ('staff', 'admin'));

create policy "Staff and admin delete schedule teacher activities"
on public.schedule_teachers
for delete
to authenticated
using ((select public.current_app_role()) in ('staff', 'admin'));

-- Remove broad table privileges and grant only the DML operations used by the
-- authenticated application. RLS remains the authorization boundary.
revoke all on table
  public.roles,
  public.state_roles,
  public.schedule_assignments,
  public.schedule_teachers
from anon, authenticated;

grant select, insert, update, delete on table
  public.roles,
  public.state_roles,
  public.schedule_assignments,
  public.schedule_teachers
to authenticated;

-- Identity sequences are never available to anonymous requests.
revoke all on sequence
  public.roles_id_seq,
  public.state_roles_id_seq,
  public.schedule_assignments_id_seq,
  public.schedule_teachers_id_seq
from anon;

grant usage, select on sequence
  public.roles_id_seq,
  public.state_roles_id_seq,
  public.schedule_assignments_id_seq,
  public.schedule_teachers_id_seq
to authenticated;

-- These helpers/RPCs are intentionally callable by signed-in users. The three
-- mutating RPCs enforce an admin-only check internally. Remove the inherited
-- PUBLIC/anon execution path explicitly.
revoke all on function public.current_app_role() from public, anon, authenticated;
grant execute on function public.current_app_role() to authenticated, service_role;

revoke all on function public.current_worker_id() from public, anon, authenticated;
grant execute on function public.current_worker_id() to authenticated, service_role;

revoke all on function public.grant_staff_role(text) from public, anon, authenticated;
grant execute on function public.grant_staff_role(text) to authenticated, service_role;

revoke all on function public.link_worker_account(bigint, text) from public, anon, authenticated;
grant execute on function public.link_worker_account(bigint, text) to authenticated, service_role;

revoke all on function public.unlink_worker_account(bigint) from public, anon, authenticated;
grant execute on function public.unlink_worker_account(bigint) to authenticated, service_role;

do $postconditions$
declare
  v_public_policies integer;
begin
  select count(*) into v_public_policies
  from pg_policies
  where (
    schemaname = 'public'
    and tablename in ('roles', 'state_roles', 'schedule_assignments', 'schedule_teachers')
    and ('public' = any(roles) or 'anon' = any(roles))
  );

  if v_public_policies <> 0 then
    raise exception 'P0 postcondition failed: % public/anon policies remain', v_public_policies;
  end if;

  if not (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'worker_access_email_corrections'
  ) then
    raise exception 'P0 postcondition failed: worker_access_email_corrections RLS is disabled';
  end if;

  if has_table_privilege('anon', 'public.roles', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', 'public.state_roles', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', 'public.schedule_assignments', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', 'public.schedule_teachers', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', 'public.worker_access_email_corrections', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'P0 postcondition failed: anon retains a protected-table DML privilege';
  end if;

  if has_function_privilege('anon', 'public.current_app_role()', 'EXECUTE')
     or has_function_privilege('anon', 'public.current_worker_id()', 'EXECUTE')
     or has_function_privilege('anon', 'public.grant_staff_role(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.link_worker_account(bigint,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.unlink_worker_account(bigint)', 'EXECUTE') then
    raise exception 'P0 postcondition failed: anon retains EXECUTE on a protected function';
  end if;
end
$postconditions$;
