import { FirecrackerClient } from "../src/index.js";

const socketPath = process.argv[2] ?? process.env.FIRECRACKER_SOCKET ?? "/run/firecracker.socket";
const kernelPath = process.argv[3] ?? process.env.FIRECRACKER_KERNEL ?? "/var/lib/firecracker/vmlinux";
const rootfsPath = process.argv[4] ?? process.env.FIRECRACKER_ROOTFS ?? "/var/lib/firecracker/rootfs.ext4";

const client = new FirecrackerClient({ socketPath });

await client.bootSource.set({
  kernel_image_path: kernelPath,
  boot_args: "console=ttyS0 reboot=k panic=1 pci=off",
});

await client.drive("rootfs").set({
  drive_id: "rootfs",
  is_root_device: true,
  path_on_host: rootfsPath,
});

await client.machineConfig.set({ vcpu_count: 2, mem_size_mib: 512 });

await client.action("InstanceStart");

const info = await client.getInstanceInfo();
console.log(info);
