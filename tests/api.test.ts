import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../apps/server/app.js";
import { Store } from "../packages/core/store.js";

test("API authenticates every device operation and does not leak validation input", async () => {
  const db = new PGlite();
  const store = new Store(db);
  await store.init();
  const token = "a".repeat(64);
  const credentials = [{ token, user: "alice", actor: "human", human: true }];
  const { app } = await createApp(store, credentials, new Set());
  const headers = { authorization: `Bearer ${token}` };
  try {
    assert.equal((await app.inject("/api/sessions")).statusCode, 401);
    assert.equal(
      (await app.inject({ url: "/api/sessions", headers })).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/sessions",
          method: "POST",
          headers,
          payload: { requestId: randomUUID(), name: "x", platform: "ios" },
        })
      ).statusCode,
      422,
    );
    const invalid = await app.inject({
      url: "/api/sessions",
      method: "POST",
      headers,
      payload: { token: "secret-mark" },
    });
    assert.equal(invalid.statusCode, 400);
    assert(!invalid.body.includes("secret-mark"));
    const a = await app.inject({
      url: "/api/sessions",
      method: "POST",
      headers,
      payload: {
        requestId: randomUUID(),
        name: "real browser",
        platform: "browser",
      },
    });
    assert.equal(a.statusCode, 200);
    const session = a.json();
    assert.equal(session.status, "ready");
    assert.equal(
      (
        await app.inject({
          url: `/api/sessions/${session.id}/screenshot`,
          headers,
        })
      ).headers["content-type"],
      "image/jpeg",
    );
    await app.inject({
      url: `/api/sessions/${session.id}`,
      method: "DELETE",
      headers,
    });
    assert.equal(
      (await app.inject({ url: `/api/sessions/${session.id}`, headers })).json()
        .status,
      "stopped",
    );
  } finally {
    await app.close();
    await db.close();
  }
});
