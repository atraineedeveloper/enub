begin;

select plan(9);

select ok(
  to_regclass('public.worker_document_storage_cleanup_queue') is not null,
  'cleanup queue table exists'
);

select ok(
  coalesce((
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'worker_document_storage_cleanup_queue'
  ), false),
  'cleanup queue has RLS enabled'
);

select is(
  (select count(*)::integer
   from pg_policies
   where schemaname = 'public'
     and tablename = 'worker_document_storage_cleanup_queue'),
  0,
  'cleanup queue exposes no client RLS policies'
);

select ok(
  not has_table_privilege('anon', 'public.worker_document_storage_cleanup_queue', 'SELECT')
  and not has_table_privilege('anon', 'public.worker_document_storage_cleanup_queue', 'INSERT')
  and not has_table_privilege('anon', 'public.worker_document_storage_cleanup_queue', 'UPDATE')
  and not has_table_privilege('anon', 'public.worker_document_storage_cleanup_queue', 'DELETE'),
  'anon has no cleanup queue DML privileges'
);

select ok(
  not has_table_privilege('authenticated', 'public.worker_document_storage_cleanup_queue', 'SELECT')
  and not has_table_privilege('authenticated', 'public.worker_document_storage_cleanup_queue', 'INSERT')
  and not has_table_privilege('authenticated', 'public.worker_document_storage_cleanup_queue', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.worker_document_storage_cleanup_queue', 'DELETE'),
  'authenticated has no cleanup queue DML privileges'
);

select ok(
  has_table_privilege('service_role', 'public.worker_document_storage_cleanup_queue', 'SELECT')
  and has_table_privilege('service_role', 'public.worker_document_storage_cleanup_queue', 'INSERT')
  and has_table_privilege('service_role', 'public.worker_document_storage_cleanup_queue', 'UPDATE')
  and has_table_privilege('service_role', 'public.worker_document_storage_cleanup_queue', 'DELETE'),
  'service_role can manage cleanup queue'
);

select is(
  (select count(*)::integer
   from pg_trigger t
   join pg_class c on c.oid = t.tgrelid
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'worker_documents'
     and t.tgname = 'enqueue_worker_document_storage_cleanup'
     and not t.tgisinternal
     and pg_get_triggerdef(t.oid) like 'CREATE TRIGGER % AFTER DELETE ON public.worker_documents%'),
  1,
  'worker_documents has one AFTER DELETE cleanup trigger'
);

select ok(
  coalesce((
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'enqueue_worker_document_storage_cleanup'
      and pg_get_function_identity_arguments(p.oid) = ''
  ), false),
  'cleanup trigger function is SECURITY DEFINER in private schema'
);

select ok(
  not has_function_privilege('anon', 'private.enqueue_worker_document_storage_cleanup()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'private.enqueue_worker_document_storage_cleanup()', 'EXECUTE'),
  'client roles cannot execute cleanup trigger function directly'
);

select * from finish();
rollback;
