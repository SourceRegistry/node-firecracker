# Lambda-Style Workloads

These examples show the kind of application payload you could place inside a Firecracker microVM. They do not implement AWS Lambda itself; they demonstrate the handler shapes Lambda uses and how a tiny runtime can invoke them.

## Layout

- `nodejs/`: Node.js handler plus a local invoker.
- `python/`: Python handler plus a local invoker.
- `shell/`: POSIX shell handler that runs in the minimal quickstart rootfs.
- `ai-container/`: Lambda container-image style Python handler for a small local text classification task.

## Run Locally

Node.js:

```bash
node examples/lambda/nodejs/invoke.mjs
```

Python:

```bash
python3 examples/lambda/python/invoke.py
```

AI container handler locally:

```bash
python3 examples/lambda/ai-container/handler.py
```

## Try Inside The MicroVM

Invoke the Python Lambda-style handlers inside a fresh Firecracker VM:

```bash
npm run examples:lambda
```

That command boots a VM, attaches this folder as `/dev/vdb`, mounts it at `/mnt/lambda`, and runs `microvm-runtime.sh` through the guest serial console. It is intentionally small, but the shape is Lambda-like: a prepared runtime receives an event and calls a handler inside a microVM isolation boundary.

The stock Firecracker quickstart rootfs used by this repo does not include Python or Node.js. The shell handler always runs there; the Python, Node.js, and AI examples run in-VM when you provide a rootfs that includes those runtimes.

## Build Runtime Rootfs Images

There are two rootfs builders:

- `build-alpine-rootfs.sh`: create a fresh ext4 image and populate it from Alpine Linux through Docker. This does not require loop devices because it uses `mkfs.ext4 -d`.
- `build-runtime-rootfs.sh`: copy the downloaded Firecracker fixture rootfs and install packages into it with `apt-get`. This requires loop mount/chroot privileges.

Each builder accepts `RUNTIME=shell|python|node|all`. Prefer one runtime per image when you want Lambda-like lean rootfs images.

Create runtime-specific Alpine images:

```bash
sudo npm run examples:lambda:rootfs:python
sudo npm run examples:lambda:rootfs:node
```

By default those write:

```text
$HOME/.cache/firecracker-fixtures/rootfs-python.ext4
$HOME/.cache/firecracker-fixtures/rootfs-node.ext4
```

Run the in-VM Lambda example with one image at a time:

```bash
FIRECRACKER_ROOTFS=$HOME/.cache/firecracker-fixtures/rootfs-python.ext4 npm run examples:lambda
FIRECRACKER_ROOTFS=$HOME/.cache/firecracker-fixtures/rootfs-node.ext4 npm run examples:lambda

# Equivalent shortcuts after building:
npm run examples:lambda:python
npm run examples:lambda:node
```

Or create fresh Alpine-based rootfs images with Alpine-specific names:

```bash
sudo npm run examples:lambda:rootfs:alpine:python
sudo npm run examples:lambda:rootfs:alpine:node

FIRECRACKER_ROOTFS=$HOME/.cache/firecracker-fixtures/alpine-python.ext4 npm run examples:lambda
FIRECRACKER_ROOTFS=$HOME/.cache/firecracker-fixtures/alpine-node.ext4 npm run examples:lambda

# Equivalent shortcuts after building:
npm run examples:lambda:alpine:python
npm run examples:lambda:alpine:node
```

Useful overrides:

```bash
BASE_ROOTFS=/path/to/base.ext4 \
OUT_ROOTFS=/tmp/rootfs-python.ext4 \
RUNTIME=python \
ROOTFS_SIZE=3G \
sudo -E bash examples/lambda/build-runtime-rootfs.sh
```

For the Alpine builder:

```bash
OUT_ROOTFS=/tmp/alpine-node.ext4 \
RUNTIME=node \
ROOTFS_SIZE=1G \
sudo -E bash examples/lambda/build-alpine-rootfs.sh
```

To build the combined demo image anyway, use:

```bash
sudo npm run examples:lambda:rootfs
sudo npm run examples:lambda:rootfs:alpine
```

To modify the downloaded Firecracker fixture rootfs instead, use the fixture scripts. These need loop device and chroot permissions:

```bash
sudo npm run examples:lambda:rootfs:fixture:python
sudo npm run examples:lambda:rootfs:fixture:node
```

## Layered Filesystems

Firecracker attaches block devices; it does not provide Docker-style image layering by itself. You can still get similar behavior in the guest:

- Build one read-only base rootfs per runtime, such as `rootfs-python.ext4` or `rootfs-node.ext4`.
- Attach application code as a separate read-only drive, as `run-in-microvm.ts` already does with `/dev/vdb`.
- Add a small writable ext4 drive and mount it as scratch space.
- For true layering, boot an init script that mounts an overlayfs with `lowerdir` on read-only runtime/application drives and `upperdir` on the writable drive. This requires overlayfs support in the guest kernel/rootfs.

For these examples, separate rootfs images are simpler and more explicit than a full overlayfs boot pipeline.

Pack this folder into the interactive Firecracker example as the second drive:

```bash
FIRECRACKER_SHARE_DIR=./examples/lambda npm run examples:tty
```

Then, inside the guest:

```sh
mkdir -p /dev /mnt/shared
mount -t devtmpfs devtmpfs /dev 2>/dev/null
mount -t ext4 /dev/vdb /mnt/shared
ls -la /mnt/shared
```

If the guest rootfs has the relevant runtime installed, run the same commands from `/mnt/shared`.

## Container Image Example

The `ai-container/Dockerfile` follows the Lambda container image convention:

```bash
docker build -t node-firecracker-lambda-ai examples/lambda/ai-container
docker run --rm -p 9000:8080 node-firecracker-lambda-ai
```

Invoke it with the Lambda Runtime Interface Emulator style endpoint:

```bash
curl -sS -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{"text":"Firecracker isolates workloads with very fast startup."}'
```

For a real AI workload, replace the toy classifier in `handler.py` with a small local model and keep model files in the image or on an attached read-only drive.
