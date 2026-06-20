<div align="center">

<img src="https://raw.githubusercontent.com/firecracker-microvm/firecracker/main/docs/images/fc_logo_full_transparent-bg.png" alt="Firecracker logo" width="300">

# @sourceregistry/node-firecracker

**Typed Node.js client for the [Firecracker](https://firecracker-microvm.github.io/) microVM REST API**

[![npm version](https://img.shields.io/npm/v/@sourceregistry/node-firecracker?style=flat-square&color=f96743)](https://www.npmjs.com/package/@sourceregistry/node-firecracker)
[![npm downloads](https://img.shields.io/npm/dm/@sourceregistry/node-firecracker?style=flat-square)](https://www.npmjs.com/package/@sourceregistry/node-firecracker)
[![JSR](https://jsr.io/badges/@sourceregistry/node-firecracker?style=flat-square)](https://jsr.io/@sourceregistry/node-firecracker)
[![license](https://img.shields.io/npm/l/@sourceregistry/node-firecracker?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/node/v/@sourceregistry/node-firecracker?style=flat-square&color=339933&logo=node.js&logoColor=white)](https://nodejs.org)
[![CI](https://img.shields.io/github/actions/workflow/status/SourceRegistry/node-firecracker/ci.yml?style=flat-square&label=CI)](https://github.com/SourceRegistry/node-firecracker/actions/workflows/ci.yml)
[![issues](https://img.shields.io/github/issues/SourceRegistry/node-firecracker?style=flat-square)](https://github.com/SourceRegistry/node-firecracker/issues)

[Docs](https://sourceregistry.github.io/node-firecracker/) · [npm](https://www.npmjs.com/package/@sourceregistry/node-firecracker) · [JSR](https://jsr.io/@sourceregistry/node-firecracker) · [Issues](https://github.com/SourceRegistry/node-firecracker/issues)

</div>

---

## What this is

A thin, fully-typed client for the Firecracker VMM's HTTP API. Firecracker exposes its API over a unix
domain socket (one socket per running microVM process) — this library speaks that API. It does **not**
spawn or manage the `firecracker` binary itself; point it at the socket of an already-running Firecracker
process and use it to configure and control that VM.

## Installation

```bash
npm install @sourceregistry/node-firecracker
```

Node.js 18+ is required.

## Quick Start

```ts
import { FirecrackerClient } from "@sourceregistry/node-firecracker";

const client = new FirecrackerClient({ socketPath: "/run/firecracker.socket" });

await client.bootSource.set({
  kernel_image_path: "/var/lib/firecracker/vmlinux",
  boot_args: "console=ttyS0 reboot=k panic=1 pci=off",
});

await client.drive("rootfs").set({
  drive_id: "rootfs",
  is_root_device: true,
  path_on_host: "/var/lib/firecracker/rootfs.ext4",
});

await client.machineConfig.set({ vcpu_count: 2, mem_size_mib: 512 });

await client.action("InstanceStart");

const info = await client.getInstanceInfo();
console.log(info.state); // "Running"
```

## API

`FirecrackerClient` groups operations by resource — each resource exposes `get`/`set`/`update` (mirroring
Firecracker's `GET`/`PUT`/`PATCH`). All request/response bodies are typed against the
[Firecracker OpenAPI spec](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml).

| Member | Endpoint |
|---|---|
| `getInstanceInfo()` | `GET /` |
| `getVersion()` | `GET /version` |
| `createSyncAction(action)` / `action(type)` | `PUT /actions` |
| `balloon.get()` | `GET /balloon` |
| `balloon.set(config)` | `PUT /balloon` |
| `balloon.update(partial)` | `PATCH /balloon` |
| `balloon.stats.get()` | `GET /balloon/statistics` |
| `balloon.stats.update(partial)` | `PATCH /balloon/statistics` |
| `bootSource.set(config)` | `PUT /boot-source` |
| `drive(id).set(drive)` | `PUT /drives/{drive_id}` |
| `drive(id).update(partial)` | `PATCH /drives/{drive_id}` |
| `logger.set(config)` | `PUT /logger` |
| `machineConfig.get()` | `GET /machine-config` |
| `machineConfig.set(config)` | `PUT /machine-config` |
| `machineConfig.update(partial)` | `PATCH /machine-config` |
| `metrics.set(config)` | `PUT /metrics` |
| `mmds.get()` | `GET /mmds` |
| `mmds.set(data)` | `PUT /mmds` |
| `mmds.update(data)` | `PATCH /mmds` |
| `mmds.config.set(config)` | `PUT /mmds/config` |
| `networkInterface(id).set(iface)` | `PUT /network-interfaces/{iface_id}` |
| `networkInterface(id).update(partial)` | `PATCH /network-interfaces/{iface_id}` |
| `snapshot.create(params)` | `PUT /snapshot/create` |
| `snapshot.load(params)` | `PUT /snapshot/load` |
| `vm.update(state)` | `PATCH /vm` |
| `vmConfig.get()` | `GET /vm/config` |
| `vsock.set(config)` | `PUT /vsock` |

### Error handling

Non-2xx responses reject with `FirecrackerApiError`, which carries the HTTP `statusCode` and the
`fault_message` Firecracker returns in its error body:

```ts
import { FirecrackerApiError } from "@sourceregistry/node-firecracker";

try {
  await client.drive("rootfs").set({ drive_id: "rootfs", is_root_device: true, path_on_host: "/missing.ext4" });
} catch (err) {
  if (err instanceof FirecrackerApiError) {
    console.error(err.statusCode, err.faultMessage);
  }
}
```

### Options

```ts
new FirecrackerClient({
  socketPath: "/run/firecracker.socket",
  timeoutMs: 5000, // default: 5000
});
```

---

## Development

```bash
npm test            # run tests
npm run test:ui     # vitest UI
npm run test:coverage
npm run build
npm run docs:build  # generate TypeDoc
npm run examples:tty # boot a VM with this terminal attached to ttyS0
npm run examples:lambda # invoke Lambda-style handlers inside a microVM
npm run examples:lambda:python # invoke with the Python fixture-based rootfs
npm run examples:lambda:node # invoke with the Node fixture-based rootfs
npm run examples:lambda:rootfs:python # build a Python-only rootfs
npm run examples:lambda:rootfs:node # build a Node-only rootfs
npm run examples:lambda:rootfs:alpine:python # build a fresh Alpine Python rootfs
npm run examples:lambda:rootfs:alpine:node # build a fresh Alpine Node rootfs
```

### Interactive TTY example

To see the isolation boundary directly, run a Firecracker process with its serial console attached to your terminal. The example starts a fresh VM, configures it through `FirecrackerClient`, boots with `console=ttyS0`, and leaves you at a shell inside the guest. Try `uname -a`, `cat /proc/meminfo`, or `mount` to inspect the isolated environment. Press Ctrl+C to stop the VM.

You can also attach a mountable ext4 filesystem as a second drive. Firecracker does not make this a live host-folder mount: if you pass a directory, the example copies it into a temporary ext4 image before boot. Writes made inside the guest stay in that image and are discarded when the example exits unless you pass your own image via `FIRECRACKER_SHARE_IMAGE`.

Inside the devcontainer, the fixture environment variables are already set:

```bash
npm run examples:tty

# Optional: pack a host directory into /dev/vdb for the guest
FIRECRACKER_SHARE_DIR=./examples \
npm run examples:tty
```

Inside the guest, mount the extra drive with:

```sh
mkdir -p /dev /mnt/shared; mount -t devtmpfs devtmpfs /dev 2>/dev/null; mount -t ext4 /dev/vdb /mnt/shared; ls -la /mnt/shared
```

Outside the devcontainer, download fixtures first and pass them through the environment:

```bash
./scripts/fetch-firecracker-fixtures.sh

FIRECRACKER_BIN=$HOME/.cache/firecracker-fixtures/release-v1.16.0-x86_64/firecracker-v1.16.0-x86_64 \
FIRECRACKER_KERNEL=$HOME/.cache/firecracker-fixtures/vmlinux \
FIRECRACKER_ROOTFS=$HOME/.cache/firecracker-fixtures/rootfs.ext4 \
npm run examples:tty
```

### Lambda-style examples

`examples/lambda/` contains small Node.js, Python, and container-image style handlers that resemble the application payloads commonly run by serverless platforms on top of microVM isolation. Run them locally, pack the folder into the interactive VM with `FIRECRACKER_SHARE_DIR=./examples/lambda npm run examples:tty`, or invoke them through the microVM runner:

```bash
npm run examples:lambda
```

The runner boots a fresh Firecracker VM, attaches `examples/lambda/` as a read-only ext4 drive, mounts it in the guest, and executes `microvm-runtime.sh` over the serial console. The stock fixture rootfs only runs the shell handler; Python, Node.js, and AI examples run in-VM once your guest rootfs includes those runtimes.

To build lean runtime-specific guest rootfs images:

```bash
# Create container-friendly Alpine rootfs images without loop mounts.
sudo npm run examples:lambda:rootfs:python
sudo npm run examples:lambda:rootfs:node

# Or use explicit Alpine output names.
sudo npm run examples:lambda:rootfs:alpine:python
sudo npm run examples:lambda:rootfs:alpine:node

FIRECRACKER_ROOTFS=$HOME/.cache/firecracker-fixtures/rootfs-python.ext4 npm run examples:lambda
FIRECRACKER_ROOTFS=$HOME/.cache/firecracker-fixtures/rootfs-node.ext4 npm run examples:lambda

# Equivalent shortcuts after building:
npm run examples:lambda:python
npm run examples:lambda:node
```

### Real VM testing

`src/integration.real.test.ts` boots an actual Firecracker microVM through the client and is
skipped by default — it needs a Linux host with `/dev/kvm` access plus a real firecracker
binary, kernel image, and rootfs (none of which are checked into this repo).

Open this repo in the provided devcontainer (`.devcontainer/devcontainer.json` — "Reopen in
Container" in VSCode), which passes `/dev/kvm` through, downloads the firecracker binary/kernel/
rootfs on first create, and keeps a long-lived firecracker process bound to
`/run/firecracker.socket` running on every container start — so a real VM is already reachable
as soon as the container is up:

```bash
curl --unix-socket /run/firecracker.socket http://localhost/
```

`FIRECRACKER_BIN`, `FIRECRACKER_KERNEL`, `FIRECRACKER_ROOTFS` and `FIRECRACKER_SOCKET` are set in
the container environment automatically, so the real integration test just runs:

```bash
npx vitest run src/integration.real.test.ts
```

Outside the devcontainer, fetch the fixtures and run the test manually instead:

```bash
./scripts/fetch-firecracker-fixtures.sh   # downloads firecracker + vmlinux + rootfs.ext4, prints the command below

FIRECRACKER_BIN=/path/to/firecracker \
FIRECRACKER_KERNEL=/path/to/vmlinux \
FIRECRACKER_ROOTFS=/path/to/rootfs.ext4 \
npx vitest run src/integration.real.test.ts
```

Without a devcontainer, this needs a native Linux environment (WSL2 works) — running on a
filesystem shared with Windows (`/mnt/c/...`) breaks native `node_modules` binaries when you
switch between `npm install` on Windows and on Linux. Either keep two separate `npm install`s
(one per OS, reinstalled when you switch), or clone the repo into the Linux-native filesystem
(e.g. `~/node-firecracker`) and work from there instead.

---

## License

[Apache-2.0](./LICENSE) © [Alexander Slaa](https://github.com/SourceRegistry)
