import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FirecrackerClient } from "./client.js";
import { FirecrackerApiError } from "./error.js";

describe("FirecrackerClient", () => {
  let server: http.Server;
  let socketPath: string;
  let client: FirecrackerClient;
  let lastRequest: { method?: string; url?: string; body?: unknown } | undefined;
  let nextResponse: { status: number; body?: unknown };

  beforeEach(async () => {
    socketPath =
      process.platform === "win32"
        ? `\\\\.\\pipe\\firecracker-test-${randomUUID()}`
        : path.join(os.tmpdir(), `firecracker-test-${randomUUID()}.sock`);
    nextResponse = { status: 204 };
    lastRequest = undefined;

    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        lastRequest = {
          method: req.method,
          url: req.url,
          body: raw ? JSON.parse(raw) : undefined,
        };
        res.statusCode = nextResponse.status;
        if (nextResponse.body !== undefined) {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(nextResponse.body));
        } else {
          res.end();
        }
      });
    });

    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
    client = new FirecrackerClient({ socketPath });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (process.platform !== "win32" && fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
  });

  it("sends GET / and parses InstanceInfo", async () => {
    nextResponse = {
      status: 200,
      body: { app_name: "Firecracker", id: "anonymous-instance", state: "Running", vmm_version: "1.7.0" },
    };

    const info = await client.getInstanceInfo();

    expect(lastRequest?.method).toBe("GET");
    expect(lastRequest?.url).toBe("/");
    expect(info.state).toBe("Running");
  });

  it("sends PUT /boot-source with JSON body", async () => {
    await client.bootSource.set({ kernel_image_path: "/vmlinux", boot_args: "console=ttyS0" });

    expect(lastRequest?.method).toBe("PUT");
    expect(lastRequest?.url).toBe("/boot-source");
    expect(lastRequest?.body).toEqual({ kernel_image_path: "/vmlinux", boot_args: "console=ttyS0" });
  });

  it("PUTs drives to /drives/{drive_id} via client.drive(id)", async () => {
    await client.drive("rootfs").set({ drive_id: "rootfs", is_root_device: true, path_on_host: "/rootfs.ext4" });

    expect(lastRequest?.method).toBe("PUT");
    expect(lastRequest?.url).toBe("/drives/rootfs");
  });

  it("PATCHes drives to /drives/{drive_id} via client.drive(id)", async () => {
    await client.drive("rootfs").update({ drive_id: "rootfs", path_on_host: "/new.ext4" });

    expect(lastRequest?.method).toBe("PATCH");
    expect(lastRequest?.url).toBe("/drives/rootfs");
  });

  it("PUTs /actions via action() shorthand", async () => {
    await client.action("InstanceStart");

    expect(lastRequest?.method).toBe("PUT");
    expect(lastRequest?.url).toBe("/actions");
    expect(lastRequest?.body).toEqual({ action_type: "InstanceStart" });
  });

  it("throws FirecrackerApiError with fault_message on non-2xx responses", async () => {
    nextResponse = { status: 400, body: { fault_message: "invalid kernel path" } };

    await expect(client.bootSource.set({ kernel_image_path: "/missing" })).rejects.toMatchObject({
      statusCode: 400,
      faultMessage: "invalid kernel path",
    });
    await expect(client.bootSource.set({ kernel_image_path: "/missing" })).rejects.toBeInstanceOf(
      FirecrackerApiError,
    );
  });

  it("PATCHes /vm with the requested state via vm.update()", async () => {
    await client.vm.update("Paused");

    expect(lastRequest?.method).toBe("PATCH");
    expect(lastRequest?.url).toBe("/vm");
    expect(lastRequest?.body).toEqual({ state: "Paused" });
  });

  it("balloon.get/set/update and balloon.stats.get/update hit the right routes", async () => {
    nextResponse = { status: 200, body: { amount_mib: 64, deflate_on_oom: true } };
    await client.balloon.get();
    expect(lastRequest).toMatchObject({ method: "GET", url: "/balloon" });

    nextResponse = { status: 204 };
    await client.balloon.set({ amount_mib: 64, deflate_on_oom: true });
    expect(lastRequest).toMatchObject({ method: "PUT", url: "/balloon" });

    await client.balloon.update({ amount_mib: 128 });
    expect(lastRequest).toMatchObject({ method: "PATCH", url: "/balloon" });

    nextResponse = {
      status: 200,
      body: { target_pages: 1, actual_pages: 1, target_mib: 1, actual_mib: 1 },
    };
    await client.balloon.stats.get();
    expect(lastRequest).toMatchObject({ method: "GET", url: "/balloon/statistics" });

    nextResponse = { status: 204 };
    await client.balloon.stats.update({ stats_polling_interval_s: 5 });
    expect(lastRequest).toMatchObject({ method: "PATCH", url: "/balloon/statistics" });
  });

  it("networkInterface(id).set/update hit /network-interfaces/{iface_id}", async () => {
    await client.networkInterface("eth0").set({ host_dev_name: "tap0", iface_id: "eth0" });
    expect(lastRequest).toMatchObject({ method: "PUT", url: "/network-interfaces/eth0" });

    await client.networkInterface("eth0").update({ iface_id: "eth0" });
    expect(lastRequest).toMatchObject({ method: "PATCH", url: "/network-interfaces/eth0" });
  });

  it("mmds.get/set/update and mmds.config.set hit the right routes", async () => {
    nextResponse = { status: 200, body: { hello: "world" } };
    const data = await client.mmds.get();
    expect(lastRequest).toMatchObject({ method: "GET", url: "/mmds" });
    expect(data).toEqual({ hello: "world" });

    nextResponse = { status: 204 };
    await client.mmds.set({ hello: "world" });
    expect(lastRequest).toMatchObject({ method: "PUT", url: "/mmds" });

    await client.mmds.update({ hello: "again" });
    expect(lastRequest).toMatchObject({ method: "PATCH", url: "/mmds" });

    await client.mmds.config.set({ network_interfaces: ["eth0"] });
    expect(lastRequest).toMatchObject({ method: "PUT", url: "/mmds/config" });
  });

  it("snapshot.create/load and vmConfig.get hit the right routes", async () => {
    await client.snapshot.create({ mem_file_path: "/mem", snapshot_path: "/snap" });
    expect(lastRequest).toMatchObject({ method: "PUT", url: "/snapshot/create" });

    await client.snapshot.load({ snapshot_path: "/snap" });
    expect(lastRequest).toMatchObject({ method: "PUT", url: "/snapshot/load" });

    nextResponse = { status: 200, body: {} };
    await client.vmConfig.get();
    expect(lastRequest).toMatchObject({ method: "GET", url: "/vm/config" });
  });
});
