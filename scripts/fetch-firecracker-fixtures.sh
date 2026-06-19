#!/usr/bin/env bash
# Downloads a real firecracker binary, kernel and rootfs for use with
# src/integration.real.test.ts. Linux x86_64 only.
set -euo pipefail

FC_VERSION="${FC_VERSION:-1.16.0}"
DEST="${1:-$HOME/.cache/firecracker-fixtures}"

mkdir -p "$DEST"
cd "$DEST"

if [ ! -f "release-v${FC_VERSION}-x86_64/firecracker-v${FC_VERSION}-x86_64" ]; then
  curl -fsSL -o fc.tgz \
    "https://github.com/firecracker-microvm/firecracker/releases/download/v${FC_VERSION}/firecracker-v${FC_VERSION}-x86_64.tgz"
  tar -xzf fc.tgz
  rm fc.tgz
fi

[ -f vmlinux ] || curl -fsSL -o vmlinux \
  "https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/kernels/vmlinux.bin"

[ -f rootfs.ext4 ] || curl -fsSL -o rootfs.ext4 \
  "https://s3.amazonaws.com/spec.ccfc.min/img/quickstart_guide/x86_64/rootfs/bionic.rootfs.ext4"

cat <<EOF

Fixtures ready in $DEST. Run the real-VM test with:

  FIRECRACKER_BIN=$DEST/release-v${FC_VERSION}-x86_64/firecracker-v${FC_VERSION}-x86_64 \\
  FIRECRACKER_KERNEL=$DEST/vmlinux \\
  FIRECRACKER_ROOTFS=$DEST/rootfs.ext4 \\
  npx vitest run src/integration.real.test.ts
EOF
