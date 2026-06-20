import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { FirecrackerClient } from "../../src/index.js";

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (args.includes("-h") || args.includes("--help")) {
  console.log(`Usage:
  npm run examples:lambda
  FIRECRACKER_ROOTFS=/path/to/rootfs.ext4 npm run examples:lambda
  npm run examples:lambda:python
  npm run examples:lambda:node

Positional arguments:
  firecracker-bin kernel-path rootfs-path lambda-example-dir

Environment:
  FIRECRACKER_BIN       Firecracker binary path
  FIRECRACKER_KERNEL    Kernel image path
  FIRECRACKER_ROOTFS    Guest rootfs image path
  LAMBDA_EXAMPLE_DIR    Directory packed into the Lambda payload drive
  LAMBDA_VM_EXIT_MS     Milliseconds to keep VM alive after invocation, default 8000
`);
  process.exit(0);
}

const fcBin = process.argv[2] ?? process.env.FIRECRACKER_BIN;
const kernelPath = process.argv[3] ?? process.env.FIRECRACKER_KERNEL;
const rootfsPath = process.argv[4] ?? process.env.FIRECRACKER_ROOTFS;
const lambdaDir = path.resolve(process.argv[5] ?? process.env.LAMBDA_EXAMPLE_DIR ?? thisDir);
const socketPath = path.join(os.tmpdir(), `firecracker-lambda-${randomUUID()}.sock`);
const sharedImage = path.join(os.tmpdir(), `firecracker-lambda-${randomUUID()}.ext4`);
const bootArgs =
  process.env.FIRECRACKER_BOOT_ARGS ?? "console=ttyS0 reboot=k panic=1 pci=off root=/dev/vda rw init=/bin/sh";

function requireFile(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required`);
  if (!fs.existsSync(value)) throw new Error(`${name} does not exist: ${value}`);
  return value;
}

function hasKvmAccess(): boolean {
  try {
    fs.accessSync("/dev/kvm", fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function buildLambdaDrive(): void {
  if (!fs.existsSync(lambdaDir) || !fs.statSync(lambdaDir).isDirectory()) {
    throw new Error(`Lambda example directory does not exist: ${lambdaDir}`);
  }

  execFileSync("truncate", ["-s", process.env.FIRECRACKER_LAMBDA_SIZE ?? "128M", sharedImage]);
  execFileSync("mkfs.ext4", ["-q", "-F", "-d", lambdaDir, sharedImage]);
}

async function waitForSocket(socket: string): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (fs.existsSync(socket)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Firecracker did not create ${socket} in time`);
}

function cleanup(child?: ChildProcess): void {
  child?.kill("SIGTERM");
  if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
  if (fs.existsSync(sharedImage)) fs.unlinkSync(sharedImage);
}

function sendGuestCommands(child: ChildProcess): void {
  const commands = [
    "echo",
    "echo 'host sent Lambda runtime invocation over the serial console'",
    "mkdir -p /dev /mnt/lambda",
    "mount -t devtmpfs devtmpfs /dev 2>/dev/null || true",
    "mount -t ext4 /dev/vdb /mnt/lambda",
    "sh /mnt/lambda/microvm-runtime.sh",
    "poweroff -f 2>/dev/null || reboot -f 2>/dev/null || halt -f 2>/dev/null",
  ];

  child.stdin?.write(`${commands.join("\n")}\n`);
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

console.log(`Using rootfs: ${rootfs}`);
if (process.env.LAMBDA_EXPECT_RUNTIME) {
  console.log(`Expected runtime in rootfs: ${process.env.LAMBDA_EXPECT_RUNTIME}`);
}
if (rootfs.endsWith("/rootfs.ext4")) {
  console.log("The default fixture rootfs usually only runs the shell handler. Build/use a runtime rootfs for Python or Node.");
}

console.log("Packing Lambda examples into an ext4 drive image...");
buildLambdaDrive();

console.log("Starting Firecracker and invoking Lambda-style handlers inside the microVM.");
console.log("Press Ctrl+C to stop the VM.");

const fcProcess = spawn(firecracker, ["--api-sock", socketPath], {
  stdio: ["pipe", "inherit", "inherit"],
});

process.once("SIGINT", () => {
  cleanup(fcProcess);
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanup(fcProcess);
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

await client.drive("lambda").set({
  drive_id: "lambda",
  is_root_device: false,
  is_read_only: true,
  path_on_host: sharedImage,
});

await client.machineConfig.set({ vcpu_count: 1, mem_size_mib: 256 });
await client.action("InstanceStart");

const info = await client.getInstanceInfo();
console.log(`\nMicroVM state: ${info.state}`);
console.log("Waiting for the guest shell, then invoking /mnt/lambda/microvm-runtime.sh...\n");

setTimeout(() => {
  sendGuestCommands(fcProcess);
  setTimeout(() => {
    console.log("\nStopping Firecracker after Lambda-style invocation window.");
    cleanup(fcProcess);
  }, Number(process.env.LAMBDA_VM_EXIT_MS ?? 8_000));
}, 2_000);

await new Promise<void>((resolve) => fcProcess.once("exit", () => resolve()));
cleanup();
