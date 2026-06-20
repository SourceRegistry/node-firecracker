import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { FirecrackerClient } from "../src/index.js";

const fcBin = process.argv[2] ?? process.env.FIRECRACKER_BIN;
const kernelPath = process.argv[3] ?? process.env.FIRECRACKER_KERNEL;
const rootfsPath = process.argv[4] ?? process.env.FIRECRACKER_ROOTFS;
const sharedPath = process.argv[5] ?? process.env.FIRECRACKER_SHARE_IMAGE ?? process.env.FIRECRACKER_SHARE_DIR;
const socketPath = path.join(os.tmpdir(), `firecracker-tty-${randomUUID()}.sock`);
const bootArgs =
  process.env.FIRECRACKER_BOOT_ARGS ?? "console=ttyS0 reboot=k panic=1 pci=off root=/dev/vda rw init=/bin/sh";
let generatedSharedImage: string | undefined;

function requireFile(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required`);
  if (!fs.existsSync(value)) throw new Error(`${name} does not exist: ${value}`);
  return value;
}

function prepareSharedDrive(source: string): string {
  if (!fs.existsSync(source)) throw new Error(`Shared path does not exist: ${source}`);
  const stat = fs.statSync(source);
  if (stat.isFile()) return source;
  if (!stat.isDirectory()) throw new Error(`Shared path must be a directory or ext4 image: ${source}`);

  const image = path.join(os.tmpdir(), `firecracker-share-${randomUUID()}.ext4`);
  execFileSync("truncate", ["-s", process.env.FIRECRACKER_SHARE_SIZE ?? "64M", image]);
  execFileSync("mkfs.ext4", ["-q", "-F", "-d", source, image]);
  generatedSharedImage = image;
  return image;
}

function hasKvmAccess(): boolean {
  try {
    fs.accessSync("/dev/kvm", fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function waitForSocket(socket: string): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (fs.existsSync(socket)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Firecracker did not create ${socket} in time`);
}

function cleanup(): void {
  if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
  if (generatedSharedImage && fs.existsSync(generatedSharedImage)) fs.unlinkSync(generatedSharedImage);
}

function stop(child: ChildProcess): void {
  child.kill("SIGTERM");
  cleanup();
}

if (process.platform !== "linux") {
  throw new Error("Firecracker examples require Linux with KVM access");
}
if (!hasKvmAccess()) {
  throw new Error("Cannot access /dev/kvm. Run in the devcontainer or on a KVM-enabled Linux host.");
}

const firecracker = requireFile("FIRECRACKER_BIN", fcBin);
const kernel = requireFile("FIRECRACKER_KERNEL", kernelPath);
const rootfs = requireFile("FIRECRACKER_ROOTFS", rootfsPath);
const sharedDrive = sharedPath ? prepareSharedDrive(sharedPath) : undefined;

console.log("Starting Firecracker. After boot, this terminal is the guest serial console.");
console.log("Press Ctrl+C to stop the microVM and return to the host.");
console.log("When the shell appears, try: uname -a; cat /proc/meminfo; mount");
if (sharedDrive) {
  console.log("Shared ext4 drive attached as /dev/vdb. Mount it with:");
  console.log("  mkdir -p /dev /mnt/shared; mount -t devtmpfs devtmpfs /dev 2>/dev/null; mount -t ext4 /dev/vdb /mnt/shared; ls -la /mnt/shared");
}

const fcProcess = spawn(firecracker, ["--api-sock", socketPath], {
  stdio: "inherit",
});

process.once("SIGINT", () => {
  stop(fcProcess);
  process.exit(130);
});
process.once("SIGTERM", () => {
  stop(fcProcess);
  process.exit(143);
});

await waitForSocket(socketPath);

const client = new FirecrackerClient({ socketPath, timeoutMs: 10_000 });

await client.bootSource.set({
  kernel_image_path: kernel,
  boot_args: bootArgs,
});

await client.drive("rootfs").set({
  drive_id: "rootfs",
  is_root_device: true,
  path_on_host: rootfs,
});

if (sharedDrive) {
  await client.drive("shared").set({
    drive_id: "shared",
    is_root_device: false,
    is_read_only: false,
    path_on_host: sharedDrive,
  });
}

await client.machineConfig.set({ vcpu_count: 1, mem_size_mib: 256 });
await client.action("InstanceStart");

const info = await client.getInstanceInfo();
console.log(`\nMicroVM state: ${info.state}`);
console.log("The shell prompt below is running inside the microVM, not on the host.\n");

await new Promise<void>((resolve) => fcProcess.once("exit", () => resolve()));
cleanup();
