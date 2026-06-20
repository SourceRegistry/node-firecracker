#!/usr/bin/env bash
# Build a fresh Alpine-based Firecracker rootfs with a selected runtime.
# This follows the shape of Firecracker's rootfs setup guide: create an ext4
# image and populate it from a distro userspace.
set -euo pipefail

if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
  DEFAULT_CACHE_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
else
  DEFAULT_CACHE_HOME="$HOME"
fi

RUNTIME="${RUNTIME:-all}"
OUT_ROOTFS="${1:-${OUT_ROOTFS:-$DEFAULT_CACHE_HOME/.cache/firecracker-fixtures/alpine-${RUNTIME}.ext4}}"
ROOTFS_SIZE="${ROOTFS_SIZE:-512M}"
ALPINE_IMAGE="${ALPINE_IMAGE:-alpine:3.20}"
ROOTFS_DIR=""

case "$RUNTIME" in
  shell)
    DEFAULT_APK_PACKAGES="openrc util-linux ca-certificates"
    VERIFY_COMMANDS="true"
    ;;
  python)
    DEFAULT_APK_PACKAGES="openrc util-linux ca-certificates python3 py3-pip"
    VERIFY_COMMANDS="python3 --version"
    ;;
  node)
    DEFAULT_APK_PACKAGES="openrc util-linux ca-certificates nodejs npm"
    VERIFY_COMMANDS="node --version && npm --version"
    ;;
  all)
    DEFAULT_APK_PACKAGES="openrc util-linux ca-certificates python3 py3-pip nodejs npm"
    VERIFY_COMMANDS="python3 --version && node --version && npm --version"
    ;;
  *)
    echo "Invalid RUNTIME=$RUNTIME. Use shell, python, node, or all." >&2
    exit 1
    ;;
esac

APK_PACKAGES="${APK_PACKAGES:-$DEFAULT_APK_PACKAGES}"

usage() {
  cat <<EOF
Usage:
  sudo $0 [output-rootfs.ext4]

Environment:
  RUNTIME        Runtime profile: shell, python, node, or all. Default: all
  OUT_ROOTFS     Output image path. Default: $DEFAULT_CACHE_HOME/.cache/firecracker-fixtures/alpine-\$RUNTIME.ext4
  ROOTFS_SIZE    Output image size. Default: 512M
  ALPINE_IMAGE   Docker image used to populate the rootfs. Default: alpine:3.20
  APK_PACKAGES   Alpine packages installed into the image. Defaults depend on RUNTIME.

After building:
  FIRECRACKER_ROOTFS=<output-rootfs.ext4> npm run examples:lambda
EOF
}

cleanup() {
  set +e
  if [ -n "$ROOTFS_DIR" ]; then rm -rf "$ROOTFS_DIR"; fi
}
trap cleanup EXIT

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

for command in docker mkfs.ext4 truncate; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$OUT_ROOTFS")"
rm -f "$OUT_ROOTFS"
ROOTFS_DIR="$(mktemp -d)"

cat <<EOF
Populating $OUT_ROOTFS from $ALPINE_IMAGE with:
  $APK_PACKAGES
Runtime profile:
  $RUNTIME
EOF

docker run --rm -v "$ROOTFS_DIR:/my-rootfs" "$ALPINE_IMAGE" /bin/sh -euxc "
apk add --no-cache $APK_PACKAGES

# Serial console and special filesystems for normal init boots.
ln -sf agetty /etc/init.d/agetty.ttyS0
echo ttyS0 > /etc/securetty
rc-update add agetty.ttyS0 default
rc-update add devfs boot
rc-update add procfs boot
rc-update add sysfs boot

for dir in bin etc lib root sbin usr; do
  tar c \"/\$dir\" | tar x -C /my-rootfs
done

for dir in dev proc run sys var tmp mnt opt home; do
  mkdir -p \"/my-rootfs/\$dir\"
done
chmod 1777 /my-rootfs/tmp

$VERIFY_COMMANDS
"

truncate -s "$ROOTFS_SIZE" "$OUT_ROOTFS"
mkfs.ext4 -q -F -d "$ROOTFS_DIR" "$OUT_ROOTFS"

cleanup
trap - EXIT

cat <<EOF

Alpine runtime rootfs ready:
  $OUT_ROOTFS

Run Lambda-style handlers inside Firecracker with:
  FIRECRACKER_ROOTFS=$OUT_ROOTFS npm run examples:lambda

For a normal OpenRC boot instead of the example's /bin/sh boot, remove
init=/bin/sh from FIRECRACKER_BOOT_ARGS.
EOF
