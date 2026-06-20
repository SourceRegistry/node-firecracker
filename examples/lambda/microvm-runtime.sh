#!/bin/sh
set -eu

echo
echo "== Lambda-style runtime inside Firecracker microVM =="

mkdir -p /dev /proc /sys /mnt/lambda
mount -t devtmpfs devtmpfs /dev 2>/dev/null || true
mount -t proc proc /proc 2>/dev/null || true
mount -t sysfs sysfs /sys 2>/dev/null || true

if ! mountpoint -q /mnt/lambda 2>/dev/null; then
  mount -t ext4 /dev/vdb /mnt/lambda
fi

cd /mnt/lambda

echo
echo "-- Runtime environment --"
uname -a
echo "memory:"
grep MemTotal /proc/meminfo 2>/dev/null || true

echo
echo "-- Shell handler invocation --"
sh shell/handler.sh shell/event.json

echo
echo "-- Python handler invocation --"
if command -v python3 >/dev/null 2>&1; then
  python3 python/invoke.py
else
  echo "python3 is not installed in this guest rootfs"
fi

echo
echo "-- AI container-style handler invocation --"
if command -v python3 >/dev/null 2>&1; then
  python3 ai-container/handler.py
else
  echo "python3 is not installed in this guest rootfs"
fi

echo
echo "-- Node.js handler invocation --"
if command -v node >/dev/null 2>&1; then
  node nodejs/invoke.mjs
else
  echo "node is not installed in this guest rootfs; copy a Node-enabled rootfs to run this handler in-VM"
fi

echo
echo "== Lambda-style invocation complete =="
echo "You are still inside the microVM. Inspect /mnt/lambda or press Ctrl+C in the host terminal to stop."
