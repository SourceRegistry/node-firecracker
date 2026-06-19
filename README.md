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
```

### Real VM testing

`src/integration.real.test.ts` boots an actual Firecracker microVM through the client and is
skipped by default — it needs a Linux host with `/dev/kvm` access plus a real firecracker
binary, kernel image, and rootfs (none of which are checked into this repo). Get them from the
[Firecracker quickstart guide](https://github.com/firecracker-microvm/firecracker/blob/main/docs/getting-started.md),
then run:

```bash
FIRECRACKER_BIN=/path/to/firecracker \
FIRECRACKER_KERNEL=/path/to/vmlinux \
FIRECRACKER_ROOTFS=/path/to/rootfs.ext4 \
npx vitest run src/integration.real.test.ts
```

---

## License

[Apache-2.0](./LICENSE) © [Alexander Slaa](https://github.com/SourceRegistry)
