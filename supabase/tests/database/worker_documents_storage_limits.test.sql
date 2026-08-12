begin;

select plan(4);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'worker_documents'
  ),
  'worker_documents bucket exists'
);

select is(
  (select public from storage.buckets where id = 'worker_documents'),
  false,
  'worker_documents bucket remains private'
);

select is(
  (select file_size_limit from storage.buckets where id = 'worker_documents'),
  10485760::bigint,
  'worker_documents bucket remains capped at 10 MiB'
);

select is(
  (
    select array_agg(mime_type order by mime_type)
    from storage.buckets b,
         unnest(b.allowed_mime_types) as mime_type
    where b.id = 'worker_documents'
  ),
  array[
    'application/msword',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[],
  'worker_documents bucket retains the exact approved MIME allowlist'
);

select * from finish();
rollback;
