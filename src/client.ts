import * as http from "node:http";
import { FirecrackerApiError } from "./error.js";
import type {
  ActionType,
  Balloon,
  BalloonStats,
  BalloonStatsUpdate,
  BalloonUpdate,
  BootSource,
  Drive,
  FirecrackerErrorBody,
  FirecrackerVersion,
  FullVmConfiguration,
  InstanceActionInfo,
  InstanceInfo,
  Logger,
  MachineConfiguration,
  Metrics,
  MmdsConfig,
  NetworkInterface,
  PartialDrive,
  PartialNetworkInterface,
  SnapshotCreateParams,
  SnapshotLoadParams,
  Vm,
  VmState,
  Vsock,
} from "./types.js";

export interface FirecrackerClientOptions {
  /** Path to the Firecracker API unix socket, e.g. `/run/firecracker.socket`. */
  socketPath: string;
  /** Request timeout in milliseconds. Defaults to 5000. */
  timeoutMs?: number;
}

type Requester = <T>(method: string, path: string, body?: unknown) => Promise<T>;

class BalloonStatsResource {
  constructor(private readonly request: Requester) {}

  get(): Promise<BalloonStats> {
    return this.request("GET", "/balloon/statistics");
  }

  update(update: BalloonStatsUpdate): Promise<void> {
    return this.request("PATCH", "/balloon/statistics", update);
  }
}

class BalloonResource {
  readonly stats: BalloonStatsResource;

  constructor(private readonly request: Requester) {
    this.stats = new BalloonStatsResource(request);
  }

  get(): Promise<Balloon> {
    return this.request("GET", "/balloon");
  }

  set(config: Balloon): Promise<void> {
    return this.request("PUT", "/balloon", config);
  }

  update(update: BalloonUpdate): Promise<void> {
    return this.request("PATCH", "/balloon", update);
  }
}

class BootSourceResource {
  constructor(private readonly request: Requester) {}

  set(bootSource: BootSource): Promise<void> {
    return this.request("PUT", "/boot-source", bootSource);
  }
}

class DriveResource {
  constructor(
    private readonly request: Requester,
    private readonly driveId: string,
  ) {}

  set(drive: Drive): Promise<void> {
    return this.request("PUT", `/drives/${encodeURIComponent(this.driveId)}`, drive);
  }

  update(drive: PartialDrive): Promise<void> {
    return this.request("PATCH", `/drives/${encodeURIComponent(this.driveId)}`, drive);
  }
}

class LoggerResource {
  constructor(private readonly request: Requester) {}

  set(logger: Logger): Promise<void> {
    return this.request("PUT", "/logger", logger);
  }
}

class MachineConfigResource {
  constructor(private readonly request: Requester) {}

  get(): Promise<MachineConfiguration> {
    return this.request("GET", "/machine-config");
  }

  set(config: MachineConfiguration): Promise<void> {
    return this.request("PUT", "/machine-config", config);
  }

  update(config: Partial<MachineConfiguration>): Promise<void> {
    return this.request("PATCH", "/machine-config", config);
  }
}

class MetricsResource {
  constructor(private readonly request: Requester) {}

  set(metrics: Metrics): Promise<void> {
    return this.request("PUT", "/metrics", metrics);
  }
}

class MmdsConfigResource {
  constructor(private readonly request: Requester) {}

  set(config: MmdsConfig): Promise<void> {
    return this.request("PUT", "/mmds/config", config);
  }
}

class MmdsResource {
  readonly config: MmdsConfigResource;

  constructor(private readonly request: Requester) {
    this.config = new MmdsConfigResource(request);
  }

  get<T = Record<string, unknown>>(): Promise<T> {
    return this.request("GET", "/mmds");
  }

  set(data: Record<string, unknown>): Promise<void> {
    return this.request("PUT", "/mmds", data);
  }

  update(data: Record<string, unknown>): Promise<void> {
    return this.request("PATCH", "/mmds", data);
  }
}

class NetworkInterfaceResource {
  constructor(
    private readonly request: Requester,
    private readonly ifaceId: string,
  ) {}

  set(iface: NetworkInterface): Promise<void> {
    return this.request("PUT", `/network-interfaces/${encodeURIComponent(this.ifaceId)}`, iface);
  }

  update(iface: PartialNetworkInterface): Promise<void> {
    return this.request("PATCH", `/network-interfaces/${encodeURIComponent(this.ifaceId)}`, iface);
  }
}

class SnapshotResource {
  constructor(private readonly request: Requester) {}

  create(params: SnapshotCreateParams): Promise<void> {
    return this.request("PUT", "/snapshot/create", params);
  }

  load(params: SnapshotLoadParams): Promise<void> {
    return this.request("PUT", "/snapshot/load", params);
  }
}

class VmResource {
  constructor(private readonly request: Requester) {}

  update(state: VmState): Promise<void> {
    return this.request("PATCH", "/vm", { state } satisfies Vm);
  }
}

class VmConfigResource {
  constructor(private readonly request: Requester) {}

  get(): Promise<FullVmConfiguration> {
    return this.request("GET", "/vm/config");
  }
}

class VsockResource {
  constructor(private readonly request: Requester) {}

  set(vsock: Vsock): Promise<void> {
    return this.request("PUT", "/vsock", vsock);
  }
}

/**
 * Thin typed client for the Firecracker REST API, served by the VMM over a unix socket.
 * See https://firecracker-microvm.github.io/ and the firecracker.yaml OpenAPI spec.
 */
export class FirecrackerClient {
  private readonly socketPath: string;
  private readonly timeoutMs: number;

  readonly balloon: BalloonResource;
  readonly bootSource: BootSourceResource;
  readonly logger: LoggerResource;
  readonly machineConfig: MachineConfigResource;
  readonly metrics: MetricsResource;
  readonly mmds: MmdsResource;
  readonly snapshot: SnapshotResource;
  readonly vm: VmResource;
  readonly vmConfig: VmConfigResource;
  readonly vsock: VsockResource;

  constructor(options: FirecrackerClientOptions) {
    this.socketPath = options.socketPath;
    this.timeoutMs = options.timeoutMs ?? 5000;

    const request = this.request.bind(this);
    this.balloon = new BalloonResource(request);
    this.bootSource = new BootSourceResource(request);
    this.logger = new LoggerResource(request);
    this.machineConfig = new MachineConfigResource(request);
    this.metrics = new MetricsResource(request);
    this.mmds = new MmdsResource(request);
    this.snapshot = new SnapshotResource(request);
    this.vm = new VmResource(request);
    this.vmConfig = new VmConfigResource(request);
    this.vsock = new VsockResource(request);
  }

  /** Resource handle for `/drives/{drive_id}`. */
  drive(driveId: string): DriveResource {
    return new DriveResource(this.request.bind(this), driveId);
  }

  /** Resource handle for `/network-interfaces/{iface_id}`. */
  networkInterface(ifaceId: string): NetworkInterfaceResource {
    return new NetworkInterfaceResource(this.request.bind(this), ifaceId);
  }

  /** GET / */
  getInstanceInfo(): Promise<InstanceInfo> {
    return this.request("GET", "/");
  }

  /** GET /version */
  getVersion(): Promise<FirecrackerVersion> {
    return this.request("GET", "/version");
  }

  /** PUT /actions */
  createSyncAction(action: InstanceActionInfo): Promise<void> {
    return this.request("PUT", "/actions", action);
  }

  /** Shorthand for `createSyncAction({ action_type })`. */
  action(actionType: ActionType): Promise<void> {
    return this.createSyncAction({ action_type: actionType });
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);

      const req = http.request(
        {
          socketPath: this.socketPath,
          path,
          method,
          timeout: this.timeoutMs,
          headers: payload
            ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) }
            : undefined,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const raw = Buffer.concat(chunks).toString("utf8");
            const status = res.statusCode ?? 0;

            if (status < 200 || status >= 300) {
              let parsed: FirecrackerErrorBody | undefined;
              try {
                parsed = raw ? (JSON.parse(raw) as FirecrackerErrorBody) : undefined;
              } catch {
                parsed = undefined;
              }
              reject(new FirecrackerApiError(status, parsed, raw));
              return;
            }

            if (!raw) {
              resolve(undefined as T);
              return;
            }

            try {
              resolve(JSON.parse(raw) as T);
            } catch (err) {
              reject(err);
            }
          });
        },
      );

      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error(`Firecracker API request timed out after ${this.timeoutMs}ms`)));

      if (payload) req.write(payload);
      req.end();
    });
  }
}
