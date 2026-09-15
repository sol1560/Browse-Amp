import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../apps/server/app.js";
import { Store } from "../packages/core/store.js";
import { BrowseClient } from "../packages/sdk/index.js";

test("SDK drives actual HTTP service; insecure remote endpoints rejected", async () => {
  assert.throws(
    () => new BrowseClient("http://not-local.example", "x"),
    /HTTPS_REQUIRED/,
  );
  const db = new PGlite();
  const store = new Store(db);
  await store.init();
  const token = "b".repeat(64);
  const { app } = await createApp(
    store,
    [{ user: "sdk", actor: "worker", human: false, token }],
    new Set(),
  );
  const url = await app.listen({ host: "127.0.0.1", port: 0 });
  const client = new BrowseClient(url, token);
  try {
    const s = await client.create("SDK check");
    assert.equal((await client.list()).length, 1);
    assert.equal((await client.observe(s.id)).url, "about:blank");
    const renewed = await client.claim(s.id, s.epoch);
    assert.equal(renewed.epoch, 2);
    await client.stop(s.id);
    assert.equal((await client.get(s.id)).status, "stopped");
  } finally {
    await app.close();
    await db.close();
  }
});
