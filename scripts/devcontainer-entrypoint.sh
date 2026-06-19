#!/usr/bin/env bash
# Container entrypoint. Unlike postCreateCommand/postStartCommand, the
# ENTRYPOINT always runs on every container start regardless of which
# devcontainer client is used (some, like JetBrains Gateway, don't reliably
# invoke postStartCommand). Boots a long-lived firecracker process bound to
# a fixed API socket before handing off to the client's actual command.
set -euo pipefail

find_repo_root() {
  for candidate in "$PWD" /workspace /workspaces/* /IdeaProjects/*; do
    if [ -f "$candidate/scripts/fetch-firecracker-fixtures.sh" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if REPO_ROOT="$(find_repo_root)"; then
  chmod 666 /dev/kvm 2>/dev/null || true

  if [ ! -x "${FIRECRACKER_BIN:-}" ]; then
    "$REPO_ROOT/scripts/fetch-firecracker-fixtures.sh" /opt/firecracker-fixtures || true
  fi

  bash "$REPO_ROOT/scripts/devcontainer-start-firecracker.sh" || true
else
  echo "devcontainer-entrypoint: could not locate repo root, skipping firecracker bootstrap" >&2
fi

exec "$@"
