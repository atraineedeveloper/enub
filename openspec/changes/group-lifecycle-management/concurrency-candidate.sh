#!/usr/bin/env bash
# Only for the disposable GitHub Actions PostgreSQL instance.
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true ]] || { echo "CI only"; exit 1; }
export PGPASSWORD=postgres
db=(psql -X -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq)
tmp=$(mktemp -d)
trap 'jobs -pr | xargs -r kill; rm -rf "$tmp"' EXIT
actor=59000000-0000-0000-0000-000000000001
"${db[@]}" <<SQL
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES ('00000000-0000-0000-0000-000000000000','$actor','authenticated','authenticated','group-race@example.test','x',now(),'{}','{}',now(),now());
INSERT INTO public.profiles(id,role,worker_id) VALUES ('$actor','admin',NULL);
INSERT INTO public.degrees(code,name) VALUES ('GLRACE','Race fixture');
SET ROLE authenticated;
SET "request.jwt.claim.sub" = '$actor';
INSERT INTO public.groups(year_of_admission,letter,degree_id)
SELECT 2095,l,id FROM public.degrees CROSS JOIN (VALUES ('RACEA'),('RACEB'),('RACEC')) AS letters(l) WHERE code='GLRACE';
SQL
group_id() { "${db[@]}" -c "SELECT id FROM public.groups WHERE year_of_admission=2095 AND letter='$1'"; }
# A holds the transaction open until the shell confirms B is genuinely blocked.
# Advisory lock is a rendezvous marker; it is not used by the application.
run_race() {
  local label=$1 first=$2 second=$3 expected=$4
  local app_a="group-qa-a-$label" app_b="group-qa-b-$label"
  mkfifo "$tmp/$label.fifo"
  # Keep the FIFO open read/write so psql receives commands incrementally.
  exec 9<>"$tmp/$label.fifo"
  PGAPPNAME="$app_a" "${db[@]}" <"$tmp/$label.fifo" >"$tmp/$label.a" 2>&1 &
  local a=$!
  printf '%s\n' "BEGIN; SET LOCAL statement_timeout='30s'; SET LOCAL ROLE authenticated; SET LOCAL \"request.jwt.claim.sub\"='$actor';" "$first;" "SELECT pg_advisory_xact_lock(59001);" >&9
  local ready=false
  for _ in {1..100}; do
    if [[ "$("${db[@]}" -c "SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.application_name='$app_a' AND l.locktype='advisory' AND l.granted)")" == t ]]; then ready=true; break; fi
    sleep 0.1
  done
  [[ "$ready" == true ]] || { cat "$tmp/$label.a"; echo "A did not acquire rendezvous lock"; exit 1; }
  PGAPPNAME="$app_b" "${db[@]}" -v VERBOSITY=verbose -c "SET statement_timeout='30s'; SET ROLE authenticated; SET \"request.jwt.claim.sub\"='$actor'; $second" >"$tmp/$label.b" 2>&1 &
  local b=$!
  local blocked=false
  for _ in {1..100}; do
    if [[ "$("${db[@]}" -c "SELECT EXISTS(SELECT 1 FROM pg_stat_activity b JOIN pg_stat_activity a ON a.pid=ANY(pg_blocking_pids(b.pid)) WHERE b.application_name='$app_b' AND a.application_name='$app_a')")" == t ]]; then blocked=true; break; fi
    sleep 0.1
  done
  [[ "$blocked" == true ]] || { cat "$tmp/$label.b"; echo "B was not blocked by A"; exit 1; }
  printf '%s\n' 'COMMIT;' '\q' >&9
  wait "$a"
  exec 9>&-
  if wait "$b"; then echo "Expected B to fail: $label"; exit 1; fi
  grep -q "$expected" "$tmp/$label.b" || { cat "$tmp/$label.b"; exit 1; }
  echo "PASS $label: observed blocking and expected $expected"
}
a=$(group_id RACEA); b=$(group_id RACEB); c=$(group_id RACEC)
[[ "$a" =~ ^[0-9]+$ && "$b" =~ ^[0-9]+$ && "$c" =~ ^[0-9]+$ ]]
run_race archive_first "SELECT public.archive_group($a,1,'race archive')" "INSERT INTO public.schedule_assignments(group_id,weekday,start_time,end_time) VALUES ($a,'Martes','07:00','08:50')" GRP03
run_race assignment_first "INSERT INTO public.schedule_assignments(group_id,weekday,start_time,end_time) VALUES ($b,'Martes','07:00','08:50')" "SELECT public.delete_group($b,1,'race delete')" GRP02
run_race stale_version "SELECT public.archive_group($c,1,'race archive')" "SELECT public.archive_group($c,1,'stale archive')" GRP01
[[ "$("${db[@]}" -c "SELECT count(*) FROM public.schedule_assignments WHERE group_id=$a")" == 0 ]]
[[ "$("${db[@]}" -c "SELECT count(*) FROM public.schedule_assignments WHERE group_id=$b")" == 1 ]]
[[ "$("${db[@]}" -c "SELECT version FROM public.groups WHERE id=$c")" == 2 ]]
echo "All three two-session races passed"
