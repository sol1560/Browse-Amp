import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import staticFiles from "@fastify/static";
import { z } from "zod";
import { Store } from "../../packages/core/store.js";
import { createApp } from "./app.js";

const credentials = z
  .array(
    z.object({
      token: z.string().min(32),
      user: z.string(),
      actor: z.string(),
      human: z.boolean(),
    }),
  )
  .min(1)
  .parse(
    JSON.parse(
      await readFile(
        process.env.BROWSE_CREDENTIALS_FILE || ".data/credentials.json",
        "utf8",
      ),
    ),
  );
const origins = new Set(
  (process.env.BROWSE_ALLOWED_ORIGINS || "https://example.com")
    .split(",")
    .map((s) => new URL(s).origin),
);
await mkdir(".data", { recursive: true, mode: 0o700 });
const db = new PGlite(".data/db");
const store = new Store(db);
await store.init();
const desktop =
  process.env.BROWSE_DESKTOP_DISPLAY && process.env.BROWSE_DESKTOP_OWNER
    ? {
        display: process.env.BROWSE_DESKTOP_DISPLAY,
        owner: process.env.BROWSE_DESKTOP_OWNER,
      }
    : undefined;
const { app } = await createApp(store, credentials, origins, desktop);
await app.register(staticFiles, {
  root: resolve("dist/console"),
  wildcard: false,
});
await app.listen({
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3000),
});
console.log("Browse-Amp 服务已启动；不记录访问凭据或浏览器输入。");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close().then(() => db.close());
  });
