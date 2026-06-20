#!/bin/sh
set -eu

event_file="${1:-event.json}"
request_id="$(sed -n 's/.*"requestId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$event_file" | head -n 1)"
name="$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$event_file" | head -n 1)"
numbers="$(tr -d '\n' < "$event_file" | sed -n 's/.*"numbers"[[:space:]]*:[[:space:]]*\[\([^]]*\)\].*/\1/p')"
sum=0

old_ifs="$IFS"
IFS=","
for value in $numbers; do
  value="$(printf '%s' "$value" | tr -dc '0-9-')"
  [ -n "$value" ] && sum=$((sum + value))
done
IFS="$old_ifs"

cat <<EOF
{
  "requestId": "${request_id:-local-shell-demo}",
  "message": "Hello ${name:-microVM}",
  "sum": $sum,
  "runtime": "posix-shell",
  "isolation": "executed inside the Firecracker guest"
}
EOF
