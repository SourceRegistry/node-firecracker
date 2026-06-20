#!/usr/bin/env bash
# Build a Firecracker rootfs image with a selected Lambda-style runtime.
set -euo pipefail

if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
  DEFAULT_CACHE_HOME="$(getent passwd "$SUDO_USER" | cut -d: -f6)"
else
  DEFAULT_CACHE_HOME="$HOME"
fi

BASE_ROOTFS="${BASE_ROOTFS:-${FIRECRACKER_ROOTFS:-/opt/firecracker-fixtures/rootfs.ext4}}"
RUNTIME="${RUNTIME:-all}"
OUT_ROOTFS="${1:-${OUT_ROOTFS:-$DEFAULT_CACHE_HOME/.cache/firecracker-fixtures/rootfs-${RUNTIME}.ext4}}"
ROOTFS_SIZE="${ROOTFS_SIZE:-2G}"
MOUNT_DIR=""
LOOP_DEV=""

case "$RUNTIME" in
  shell)
    DEFAULT_APT_PACKAGES="ca-certificates curl"
    VERIFY_COMMANDS="true"
    ;;
  python)
    DEFAULT_APT_PACKAGES="ca-certificates curl python3 python3-pip"
    VERIFY_COMMANDS="python3 --version"
    ;;
  node)
    DEFAULT_APT_PACKAGES="ca-certificates curl nodejs npm"
    VERIFY_COMMANDS="node --version && npm --version"
    ;;
  all)
    DEFAULT_APT_PACKAGES="ca-certificates curl python3 python3-pip nodejs npm"
    VERIFY_COMMANDS="python3 --version && node --version && npm --version"
    ;;
  *)
    echo "Invalid RUNTIME=$RUNTIME. Use shell, python, node, or all." >&2
    exit 1
    ;;
esac

APT_PACKAGES="${APT_PACKAGES:-$DEFAULT_APT_PACKAGES}"

usage() {
  cat <<EOF
Usage:
  sudo $0 [output-rootfs.ext4]

Environment:
  BASE_ROOTFS    Source ext4 rootfs. Default: FIRECRACKER_ROOTFS or /opt/firecracker-fixtures/rootfs.ext4
  RUNTIME        Runtime profile: shell, python, node, or all. Default: all
  OUT_ROOTFS     Output image path. Default: $DEFAULT_CACHE_HOME/.cache/firecracker-fixtures/rootfs-\$RUNTIME.ext4
  ROOTFS_SIZE    Expanded output image size. Default: 2G
  APT_PACKAGES   Packages installed in the guest image. Defaults depend on RUNTIME.

After building:
  FIRECRACKER_ROOTFS=<output-rootfs.ext4> npm run examples:lambda
EOF
}

cleanup() {
  set +e
  if [ -n "$MOUNT_DIR" ] && mountpoint -q "$MOUNT_DIR/dev"; then umount "$MOUNT_DIR/dev"; fi
  if [ -n "$MOUNT_DIR" ] && mountpoint -q "$MOUNT_DIR/proc"; then umount "$MOUNT_DIR/proc"; fi
  if [ -n "$MOUNT_DIR" ] && mountpoint -q "$MOUNT_DIR/sys"; then umount "$MOUNT_DIR/sys"; fi
  if [ -n "$MOUNT_DIR" ] && mountpoint -q "$MOUNT_DIR"; then umount "$MOUNT_DIR"; fi
  if [ -n "$LOOP_DEV" ]; then losetup -d "$LOOP_DEV" 2>/dev/null || true; fi
  if [ -n "$MOUNT_DIR" ]; then rmdir "$MOUNT_DIR" 2>/dev/null || true; fi
}
trap cleanup EXIT

ensure_loop_devices() {
  if losetup --find >/dev/null 2>&1; then
    return 0
  fi

  modprobe loop 2>/dev/null || true
  [ -e /dev/loop-control ] || mknod /dev/loop-control c 10 237 2>/dev/null || true

  for index in 0 1 2 3 4 5 6 7; do
    [ -e "/dev/loop${index}" ] || mknod "/dev/loop${index}" b 7 "$index" 2>/dev/null || true
  done

  if ! losetup --find >/dev/null 2>&1; then
    cat >&2 <<EOF
No usable loop device is available.

If you are running inside Docker/devcontainer, start it with loop devices enabled, for example:
  docker run --privileged ...

Or expose loop control/devices:
  --device /dev/loop-control --device /dev/loop0 --cap-add SYS_ADMIN
EOF
    exit 1
  fi
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "This script needs root privileges for loop mounts and chroot." >&2
  echo "Run: sudo $0 ${1:-}" >&2
  exit 1
fi

for command in cp e2fsck truncate resize2fs losetup mount chroot apt-get; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

ensure_loop_devices

if [ ! -f "$BASE_ROOTFS" ]; then
  cat >&2 <<EOF
Base rootfs not found: $BASE_ROOTFS

Create the default fixtures first:
  ./scripts/fetch-firecracker-fixtures.sh

Or pass a base image:
  BASE_ROOTFS=/path/to/rootfs.ext4 sudo $0
EOF
  exit 1
fi

mkdir -p "$(dirname "$OUT_ROOTFS")"
cp "$BASE_ROOTFS" "$OUT_ROOTFS"
e2fsck -fy "$OUT_ROOTFS" >/dev/null
truncate -s "$ROOTFS_SIZE" "$OUT_ROOTFS"
resize2fs "$OUT_ROOTFS" >/dev/null

LOOP_DEV="$(losetup --find --show "$OUT_ROOTFS")"
MOUNT_DIR="$(mktemp -d)"
mount "$LOOP_DEV" "$MOUNT_DIR"

cp /etc/resolv.conf "$MOUNT_DIR/etc/resolv.conf"
mount --bind /dev "$MOUNT_DIR/dev"
mount -t proc proc "$MOUNT_DIR/proc"
mount -t sysfs sysfs "$MOUNT_DIR/sys"

cat <<EOF
Installing packages in $OUT_ROOTFS:
  $APT_PACKAGES
Runtime profile:
  $RUNTIME
EOF

chroot "$MOUNT_DIR" /bin/sh -euxc "
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends $APT_PACKAGES
apt-get clean
rm -rf /var/lib/apt/lists/*
$VERIFY_COMMANDS
"

cleanup
trap - EXIT

cat <<EOF

Runtime rootfs ready:
  $OUT_ROOTFS

Run Lambda-style handlers inside Firecracker with:
  FIRECRACKER_ROOTFS=$OUT_ROOTFS npm run examples:lambda

Or open an interactive guest with:
  FIRECRACKER_ROOTFS=$OUT_ROOTFS FIRECRACKER_SHARE_DIR=./examples/lambda npm run examples:tty
EOF
