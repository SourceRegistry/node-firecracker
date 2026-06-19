import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FirecrackerClient } from "./client.js";

/**
 * Boots a real Firecracker microVM and drives it through the actual REST API.
 *
 * Skipped unless FIRECRACKER_BIN, FIRECRACKER_KERNEL and FIRECRACKER_ROOTFS point at a
 * real firecracker binary, kernel image and rootfs (see README "Real VM testing"), and
 * /dev/kvm is accessible. This never runs by default — it needs a Linux host with KVM
 * and ~300MB of VM fixtures that aren't checked into the repo.
 */
const fcBin = process.env.FIRECRACKER_BIN;
const kernelPath = process.env.FIRECRACKER_KERNEL;
const rootfsPath = process.env.FIRECRACKER_ROOTFS;

function hasKvmAccess(): boolean {
  try {
    fs.accessSync("/dev/kvm", fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

const canRun =
  process.platform === "linux" &&
  !!fcBin &&
  !!kernelPath &&
  !!rootfsPath &&
  fs.existsSync(fcBin) &&
  fs.existsSync(kernelPath) &&
  fs.existsSync(rootfsPath) &&
  hasKvmAccess();

describe.skipIf(!canRun)("FirecrackerClient against a real firecracker process", () => {
  const socketPath = path.join(os.tmpdir(), `firecracker-real-${randomUUID()}.sock`);
  let fcProcess: ChildProcess;
  let client: FirecrackerClient;

  beforeAll(async () => {
    fcProcess = spawn(fcBin!, ["--api-sock", socketPath], { stdio: "ignore" });

    for (let i = 0; i < 50 && !fs.existsSync(socketPath); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!fs.existsSync(socketPath)) {
      throw new Error("firecracker did not create its API socket in time");
    }

    client = new FirecrackerClient({ socketPath, timeoutMs: 10_000 });
  }, 15_000);

  afterAll(() => {
    fcProcess?.kill();
    if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
  });

  it("boots a microVM through bootSource, drive, machineConfig and InstanceStart", async () => {
    const before = await client.getInstanceInfo();
    expect(before.state).toBe("Not started");

    await client.bootSource.set({
      kernel_image_path: kernelPath!,
      boot_args: "console=ttyS0 reboot=k panic=1 pci=off",
    });

    await client.drive("rootfs").set({
      drive_id: "rootfs",
      is_root_device: true,
      path_on_host: rootfsPath!,
    });

    await client.machineConfig.set({ vcpu_count: 1, mem_size_mib: 256 });

    await client.action("InstanceStart");

    await new Promise((r) => setTimeout(r, 2000));

    const after = await client.getInstanceInfo();
    expect(after.state).toBe("Running");
  }, 20_000);
});
