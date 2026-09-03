/**
 * Types mirror the Firecracker OpenAPI spec:
 * https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml
 */

export type CpuTemplate = "C3" | "T2" | "T2S" | "T2CL" | "T2A" | "V1N1" | "None";

export type HugePages = "None" | "Transparent" | "2M";

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

export interface BlockTopology {
  physical_block_exp?: number;
  alignment_offset?: number;
  min_io_size?: number;
  opt_io_size?: number;
}

export interface Drive {
  drive_id: string;
  partuuid?: string;
  is_root_device: boolean;
  cache_type?: DriveCacheType;
  is_read_only?: boolean;
  discard?: boolean;
  path_on_host?: string;
  rate_limiter?: RateLimiter;
  io_engine?: DriveIoEngine;
  blk_size?: number;
  topology?: BlockTopology;
  socket?: string;
}

export interface PartialDrive {
  drive_id: string;
  path_on_host?: string;
  rate_limiter?: RateLimiter;
}

export interface Pmem {
  id: string;
  path_on_host: string;
  root_device?: boolean;
  read_only?: boolean;
  rate_limiter?: RateLimiter;
}

export interface PartialPmem {
  id: string;
  rate_limiter?: RateLimiter;
}

export interface CpuidRegisterModifier {
  register: "eax" | "ebx" | "ecx" | "edx";
  bitmap: string;
}

export interface CpuidLeafModifier {
  leaf: string;
  subleaf: string;
  flags: number;
  modifiers: CpuidRegisterModifier[];
}

export interface MsrModifier {
  addr: string;
  bitmap: string;
}

export interface ArmRegisterModifier {
  addr: string;
  bitmap: string;
}

export interface VcpuFeatures {
  index: number;
  bitmap: string;
}

export interface CpuConfig {
  /** KVM capabilities to add or remove. Prefix with '!' to remove, e.g. "121" or "!121". */
  kvm_capabilities?: string[];
  /** x86_64 only. */
  cpuid_modifiers?: CpuidLeafModifier[];
  /** x86_64 only. */
  msr_modifiers?: MsrModifier[];
  /** aarch64 only. */
  reg_modifiers?: ArmRegisterModifier[];
  /** aarch64 only. */
  vcpu_features?: VcpuFeatures[];
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

export interface BalloonStartCmd {
  /** Whether Firecracker should automatically acknowledge when the guest submits a done cmd. */
  acknowledge_on_stop?: boolean;
}

export interface BalloonHintingStatus {
  /** The last command issued by the host. */
  host_cmd: number;
  /** The last command provided by the guest. */
  guest_cmd?: number;
}

export interface EntropyDevice {
  rate_limiter?: RateLimiter;
}

export interface SerialDevice {
  /** Path to a file or named pipe on the host to which serial output should be written. */
  serial_out_path?: string;
  /** Token bucket for rate limiting serial console output bandwidth. */
  rate_limiter?: TokenBucket;
}

export interface MemoryHotplugConfig {
  /** Total size of the hotpluggable memory in MiB. */
  total_size_mib?: number;
  /** Slot size for the hotpluggable memory in MiB. Defaults to 128. */
  slot_size_mib?: number;
  /** Logical block size for the hotpluggable memory in MiB. Defaults to 2. */
  block_size_mib?: number;
}

export interface MemoryHotplugSizeUpdate {
  /** New target region size, in MiB. */
  requested_size_mib: number;
}

export interface MemoryHotplugStatus {
  total_size_mib: number;
  slot_size_mib: number;
  block_size_mib: number;
  plugged_size_mib: number;
  requested_size_mib: number;
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
  /** Whether the snapshot state and guest memory files are fsync'd before the request returns. Defaults to true. */
  sync_snapshot_files?: boolean;
}

export interface NetworkOverride {
  iface_id: string;
  host_dev_name: string;
}

export interface VsockOverride {
  /** The new path for the backing Unix Domain Socket. */
  uds_path: string;
}

export interface SnapshotLoadParams {
  /** @deprecated use track_dirty_pages */
  enable_diff_snapshots?: boolean;
  track_dirty_pages?: boolean;
  /** @deprecated use mem_backend */
  mem_file_path?: string;
  mem_backend?: { backend_path: string; backend_type: "File" | "Uffd" };
  snapshot_path: string;
  resume_vm?: boolean;
  network_overrides?: NetworkOverride[];
  /** Overrides the vsock device's UDS path on snapshot restore. */
  vsock_override?: VsockOverride;
  /** [x86_64 only] Advance kvmclock by the wall-clock time elapsed since the snapshot was taken. */
  clock_realtime?: boolean;
  /** Huge pages configuration for the restored microVM. Defaults to reusing the value serialized in the snapshot. */
  huge_pages?: "Snapshot" | "None" | "Transparent" | "2M";
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
  "cpu-config"?: CpuConfig;
  logger?: Logger;
  "machine-config"?: MachineConfiguration;
  metrics?: Metrics;
  "memory-hotplug"?: MemoryHotplugConfig;
  "mmds-config"?: MmdsConfig;
  "network-interfaces"?: NetworkInterface[];
  pmem?: Pmem[];
  vsock?: Vsock;
  entropy?: EntropyDevice;
}

/** Error body returned by the Firecracker API on non-2xx responses. */
export interface FirecrackerErrorBody {
  fault_message?: string;
}
