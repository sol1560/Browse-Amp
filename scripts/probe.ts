import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const available = (command: string, args: string[]) =>
  spawnSync(command, args, { stdio: "ignore", timeout: 5000 }).status === 0;
console.log(
  JSON.stringify(
    {
      platform: process.platform,
      arch: process.arch,
      kvm: existsSync("/dev/kvm"),
      adb: available("adb", ["version"]),
      xcode: available("xcrun", ["simctl", "list", "-j"]),
      windows: process.platform === "win32",
      e2bConfigured: Boolean(process.env.E2B_API_KEY),
      note: "工具存在不代表该平台已通过真实操作测试。",
    },
    null,
    2,
  ),
);
