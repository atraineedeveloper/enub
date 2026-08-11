BEGIN;

SET search_path = public, extensions;

SELECT plan(1);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgjwt'),
  'pgjwt is absent before PostgreSQL 17 upgrade'
);

SELECT * FROM finish();

ROLLBACK;
