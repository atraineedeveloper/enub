#!/usr/bin/env bash
set -euo pipefail
umask 077
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/input" "$tmp/restored"
printf 'synthetic test only\n' > "$tmp/input/sample.sql"
age-keygen -o "$tmp/key" 2>/dev/null
recipient=$(age-keygen -y "$tmp/key")
bash scripts/backup/package.sh "$tmp/input" "$tmp/archive.age" "$recipient"
age -d -i "$tmp/key" "$tmp/archive.age" | tar -xzf - -C "$tmp/restored"
(cd "$tmp/restored"; sha256sum -c SHA256SUMS)
cmp "$tmp/input/sample.sql" "$tmp/restored/sample.sql"
if bash scripts/backup/package.sh "$tmp/input" "$tmp/invalid.age" invalid; then exit 1; fi
