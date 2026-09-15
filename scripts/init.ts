import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

await mkdir(".data", { recursive: true, mode: 0o700 });
await writeFile(
  ".data/credentials.json",
  JSON.stringify(
    [
      {
        user: "local",
        actor: "human",
        human: true,
        token: randomBytes(32).toString("hex"),
      },
      {
        user: "local",
        actor: "agent-1",
        human: false,
        token: randomBytes(32).toString("hex"),
      },
    ],
    null,
    2,
  ),
  { flag: "wx", mode: 0o600 },
);
console.log(
  "已创建 .data/credentials.json（仅当前用户可读）。不会覆盖已有凭据。",
);
