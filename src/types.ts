/**
 * Types mirror the Firecracker OpenAPI spec:
 * https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml
 */

export type CpuTemplate = "C3" | "T2" | "T2S" | "T2CL" | "T2A" | "V1N1" | "None";

export type HugePages = "None" | "2M";

export interface TokenBucket {
  /** Number of free initial tokens, that are consumed before refilling, used to allow short bursts. */
  one_time_burst?: number;
  /** Complete refill time in milliseconds. */
  refill_time: number;
  /** Total number of tokens this bucket can hold. */
  size: number;
}

export interface RateLimiter {
  bandwidth?: TokenBucket;
  ops?: TokenBucket;
}

export interface BootSource {
  boot_args?: string;
  initrd_path?: string;
  kernel_image_path: string;
}

export type DriveCacheType = "Unsafe" | "Writeback";
export type DriveIoEngine = "Sync" | "Async";

export interface Drive {
  drive_id: string;
  partuuid?: string;
  is_root_device: boolean;
  cache_type?: DriveCacheType;
  is_read_only?: boolean;
  path_on_host?: string;
  rate_limiter?: RateLimiter;
  io_engine?: DriveIoEngine;
  socket?: string;
}

export interface PartialDrive {
  drive_id: string;
  path_on_host?: string;
  rate_limiter?: RateLimiter;
}

export interface MachineConfiguration {
  cpu_template?: CpuTemplate;
  smt?: boolean;
  mem_size_mib: number;
  track_dirty_pages?: boolean;
  vcpu_count: number;
  huge_pages?: HugePages;
}

export interface NetworkInterface {
  guest_mac?: string;
  host_dev_name: string;
  iface_id: string;
  mtu?: number;
  rx_rate_limiter?: RateLimiter;
  tx_rate_limiter?: RateLimiter;
}

export interface PartialNetworkInterface {
  iface_id: string;
  rx_rate_limiter?: RateLimiter;
  tx_rate_limiter?: RateLimiter;
}

export type LogLevel = "Error" | "Warning" | "Info" | "Debug" | "Trace" | "Off";

export interface Logger {
  level?: LogLevel;
  log_path?: string;
  show_level?: boolean;
  show_log_origin?: boolean;
  module?: string;
}

export interface Metrics {
  metrics_path: string;
}

export type MmdsVersion = "V1" | "V2";

export interface MmdsConfig {
  version?: MmdsVersion;
  network_interfaces: string[];
  ipv4_address?: string;
  imds_compat?: boolean;
}

export interface Balloon {
  amount_mib: number;
  deflate_on_oom: boolean;
  stats_polling_interval_s?: number;
}

export interface BalloonUpdate {
  amount_mib: number;
}

export interface BalloonStatsUpdate {
  stats_polling_interval_s: number;
}

export interface BalloonStats {
  target_pages: number;
  actual_pages: number;
  target_mib: number;
  actual_mib: number;
  swap_in?: number;
  swap_out?: number;
  major_faults?: number;
  minor_faults?: number;
  free_memory?: number;
  total_memory?: number;
  available_memory?: number;
  disk_caches?: number;
  hugetlb_allocations?: number;
  hugetlb_failures?: number;
}

export type ActionType = "FlushMetrics" | "InstanceStart" | "SendCtrlAltDel";

export interface InstanceActionInfo {
  action_type: ActionType;
}

export type InstanceState = "Not started" | "Running" | "Paused";

export interface InstanceInfo {
  app_name: string;
  id: string;
  state: InstanceState;
  vmm_version: string;
}

export type SnapshotType = "Full" | "Diff";

export interface SnapshotCreateParams {
  mem_file_path: string;
  snapshot_path: string;
  snapshot_type?: SnapshotType;
}

export interface NetworkOverride {
  iface_id: string;
  host_dev_name: string;
}

export interface SnapshotLoadParams {
  enable_diff_snapshots?: boolean;
  track_dirty_pages?: boolean;
  mem_file_path?: string;
  mem_backend?: { backend_path: string; backend_type: "File" | "Uffd" };
  snapshot_path: string;
  resume_vm?: boolean;
  network_overrides?: NetworkOverride[];
}

export interface Vsock {
  guest_cid: number;
  uds_path: string;
  vsock_id?: string;
}

export interface FirecrackerVersion {
  firecracker_version: string;
}

export type VmState = "Paused" | "Resumed";

export interface Vm {
  state: VmState;
}

export interface FullVmConfiguration {
  balloon?: Balloon;
  drives?: Drive[];
  "boot-source"?: BootSource;
  logger?: Logger;
  "machine-config"?: MachineConfiguration;
  metrics?: Metrics;
  "mmds-config"?: MmdsConfig;
  "network-interfaces"?: NetworkInterface[];
  vsock?: Vsock;
}

/** Error body returned by the Firecracker API on non-2xx responses. */
export interface FirecrackerErrorBody {
  fault_message?: string;
}
