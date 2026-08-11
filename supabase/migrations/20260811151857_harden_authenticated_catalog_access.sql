-- Require authentication for shared catalog reads and a staff/admin profile
-- for the catalog writes used by the ENU application.

do $preflight$
declare
  v_legacy_policy_count integer;
  v_total_policy_count integer;
  v_rls_table_count integer;
begin
  select count(*) into v_legacy_policy_count
  from pg_policies
  where schemaname = 'public'
    and roles = array['public']::name[]
    and permissive = 'PERMISSIVE'
    and (
      (tablename = 'groups'
        and policyname = 'Enable read access for all users'
        and cmd = 'SELECT' and qual = 'true' and with_check is null)
      or
      (tablename = 'groups'
        and policyname = 'Enable insert access for all users'
        and cmd = 'INSERT' and qual is null and with_check = 'true')
      or
      (tablename = 'semesters'
        and policyname = 'Enable read access for all users'
        and cmd = 'SELECT' and qual = 'true' and with_check is null)
      or
      (tablename = 'semesters'
        and policyname = 'Enable create access for all users'
        and cmd = 'INSERT' and qual is null and with_check = 'true')
      or
      (tablename = 'utilities'
        and policyname = 'Enable read access for all users'
        and cmd = 'SELECT' and qual = 'true' and with_check is null)
      or
      (tablename = 'utilities'
        and policyname = 'Enable update access for all users'
        and cmd = 'UPDATE' and qual = 'true' and with_check = 'true')
    );

  select count(*) into v_total_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('groups', 'semesters', 'utilities');

  if v_legacy_policy_count <> 6 or v_total_policy_count <> 6 then
    raise exception
      'Catalog access preflight failed: expected exactly 6 known legacy policies; matched %, total %',
      v_legacy_policy_count,
      v_total_policy_count;
  end if;

  select count(*) into v_rls_table_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('groups', 'semesters', 'utilities')
    and c.relkind = 'r'
    and c.relrowsecurity;

  if v_rls_table_count <> 3 then
    raise exception
      'Catalog access preflight failed: expected all 3 catalog tables with RLS enabled; found %',
      v_rls_table_count;
  end if;
end
$preflight$;

drop policy "Enable read access for all users" on public.groups;
drop policy "Enable insert access for all users" on public.groups;

create policy "Authenticated users can read groups"
on public.groups
for select
to authenticated
using (true);

create policy "Staff and admin can create groups"
on public.groups
for insert
to authenticated
with check ((select public.current_app_role()) in ('staff', 'admin'));

drop policy "Enable read access for all users" on public.semesters;
drop policy "Enable create access for all users" on public.semesters;

create policy "Authenticated users can read semesters"
on public.semesters
for select
to authenticated
using (true);

create policy "Staff and admin can create semesters"
on public.semesters
for insert
to authenticated
with check ((select public.current_app_role()) in ('staff', 'admin'));

drop policy "Enable read access for all users" on public.utilities;
drop policy "Enable update access for all users" on public.utilities;

create policy "Authenticated users can read utilities"
on public.utilities
for select
to authenticated
using (true);

create policy "Staff and admin can update utilities"
on public.utilities
for update
to authenticated
using ((select public.current_app_role()) in ('staff', 'admin'))
with check ((select public.current_app_role()) in ('staff', 'admin'));

-- Revoke inherited and direct broad grants, then expose only the operations
-- the current application performs. Service-role privileges are unchanged.
revoke all on table
  public.groups,
  public.semesters,
  public.utilities
from public, anon, authenticated;

grant select, insert on table public.groups, public.semesters to authenticated;
grant select, update on table public.utilities to authenticated;

revoke all on sequence
  public.groups_id_seq,
  public.semesters_id_seq,
  public.utilities_id_seq
from public, anon, authenticated;

grant usage, select on sequence
  public.groups_id_seq,
  public.semesters_id_seq
to authenticated;

do $postconditions$
declare
  v_bad_policy_count integer;
  v_authenticated_policy_count integer;
begin
  select count(*) into v_bad_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('groups', 'semesters', 'utilities')
    and ('public' = any(roles) or 'anon' = any(roles));

  if v_bad_policy_count <> 0 then
    raise exception
      'Catalog access postcondition failed: % public/anon policies remain',
      v_bad_policy_count;
  end if;

  select count(*) into v_authenticated_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('groups', 'semesters', 'utilities')
    and permissive = 'PERMISSIVE'
    and roles = array['authenticated']::name[];

  if v_authenticated_policy_count <> 6 then
    raise exception
      'Catalog access postcondition failed: expected 6 authenticated policies, found %',
      v_authenticated_policy_count;
  end if;

  if has_table_privilege('anon', 'public.groups', 'SELECT')
     or has_table_privilege('anon', 'public.groups', 'INSERT')
     or has_table_privilege('anon', 'public.groups', 'UPDATE')
     or has_table_privilege('anon', 'public.groups', 'DELETE')
     or has_table_privilege('anon', 'public.semesters', 'SELECT')
     or has_table_privilege('anon', 'public.semesters', 'INSERT')
     or has_table_privilege('anon', 'public.semesters', 'UPDATE')
     or has_table_privilege('anon', 'public.semesters', 'DELETE')
     or has_table_privilege('anon', 'public.utilities', 'SELECT')
     or has_table_privilege('anon', 'public.utilities', 'INSERT')
     or has_table_privilege('anon', 'public.utilities', 'UPDATE')
     or has_table_privilege('anon', 'public.utilities', 'DELETE') then
    raise exception 'Catalog access postcondition failed: anon retains catalog DML privileges';
  end if;

  if not has_table_privilege('authenticated', 'public.groups', 'SELECT')
     or not has_table_privilege('authenticated', 'public.groups', 'INSERT')
     or has_table_privilege('authenticated', 'public.groups', 'UPDATE')
     or has_table_privilege('authenticated', 'public.groups', 'DELETE')
     or not has_table_privilege('authenticated', 'public.semesters', 'SELECT')
     or not has_table_privilege('authenticated', 'public.semesters', 'INSERT')
     or has_table_privilege('authenticated', 'public.semesters', 'UPDATE')
     or has_table_privilege('authenticated', 'public.semesters', 'DELETE')
     or not has_table_privilege('authenticated', 'public.utilities', 'SELECT')
     or has_table_privilege('authenticated', 'public.utilities', 'INSERT')
     or not has_table_privilege('authenticated', 'public.utilities', 'UPDATE')
     or has_table_privilege('authenticated', 'public.utilities', 'DELETE') then
    raise exception 'Catalog access postcondition failed: authenticated catalog grants differ from the least-privilege model';
  end if;

  if has_sequence_privilege('anon', 'public.groups_id_seq', 'USAGE')
     or has_sequence_privilege('anon', 'public.semesters_id_seq', 'USAGE')
     or has_sequence_privilege('anon', 'public.utilities_id_seq', 'USAGE')
     or not has_sequence_privilege('authenticated', 'public.groups_id_seq', 'USAGE')
     or not has_sequence_privilege('authenticated', 'public.semesters_id_seq', 'USAGE')
     or has_sequence_privilege('authenticated', 'public.utilities_id_seq', 'USAGE') then
    raise exception 'Catalog access postcondition failed: catalog sequence grants differ from the least-privilege model';
  end if;
end
$postconditions$;
