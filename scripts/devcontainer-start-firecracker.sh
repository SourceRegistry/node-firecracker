#!/usr/bin/env bash
# Starts (or restarts) a long-lived firecracker process bound to a fixed API
# socket, for manual poking inside the devcontainer. Run by postStartCommand
# on every container start/attach.
set -euo pipefail

SOCKET_PATH="${FIRECRACKER_SOCKET:-/run/firecracker.socket}"
FC_BIN="${FIRECRACKER_BIN:?FIRECRACKER_BIN not set}"

if [ ! -x "$FC_BIN" ]; then
  echo "firecracker binary not found at $FC_BIN - run scripts/fetch-firecracker-fixtures.sh first" >&2
  exit 0
fi

pkill -f "$(basename "$FC_BIN")" 2>/dev/null || true
rm -f "$SOCKET_PATH"

setsid "$FC_BIN" --api-sock "$SOCKET_PATH" >/tmp/firecracker.log 2>&1 </dev/null &
disown

for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  [ -S "$SOCKET_PATH" ] && break
  sleep 0.2
done

if [ -S "$SOCKET_PATH" ]; then
  echo "firecracker API socket ready at $SOCKET_PATH"
else
  echo "firecracker did not create $SOCKET_PATH - check /tmp/firecracker.log" >&2
fi
