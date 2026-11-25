#!/usr/bin/env bash
set -euo pipefail
umask 077
src="$1"; out="$2"; recipient="$3"
[[ "$recipient" =~ ^age1[0-9a-z]+$ ]] || { echo "Invalid age recipient"; exit 1; }
[[ -d "$src" && ! -e "$out" ]] || exit 1
(cd "$src"; find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 -r sha256sum > SHA256SUMS)
test -s "$src/SHA256SUMS"
tar -C "$src" -czf - . | age -r "$recipient" -o "$out"
test -s "$out"
