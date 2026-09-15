import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createApp } from "../apps/server/app.js";
import { Store } from "../packages/core/store.js";

test("MCP child process creates, observes and stops a real browser", async () => {
  const db = new PGlite();
  const store = new Store(db);
  await store.init();
  const token = "m".repeat(64);
  const { app } = await createApp(
    store,
    [{ token, user: "test", actor: "worker", human: false }],
    new Set(),
  );
  const url = await app.listen({ host: "127.0.0.1", port: 0 });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "apps/mcp/main.ts"],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          (x): x is [string, string] => typeof x[1] === "string",
        ),
      ),
      BROWSE_URL: url,
      BROWSE_TOKEN: token,
    },
    stderr: "pipe",
  });
  const client = new Client({ name: "test", version: "1" });
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args });
    assert(!result.isError);
    const content = result.content as { type: string; text: string }[];
    return JSON.parse(content[0].text);
  };
  try {
    await client.connect(transport);
    assert((await client.listTools()).tools.length >= 6);
    const s = await call("session_create", {
      name: "MCP check",
      requestId: randomUUID(),
    });
    assert.equal(s.status, "ready");
    const observed = await call("session_observe", { id: s.id });
    assert.equal(observed.url, "about:blank");
    await call("session_stop", { id: s.id });
    assert.equal((await call("sessions_list", {}))[0].status, "stopped");
  } finally {
    await client.close();
    await app.close();
    await db.close();
  }
});
