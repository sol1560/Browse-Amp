import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../apps/server/app.js";
import { Store } from "../packages/core/store.js";
import { LinuxDesktop } from "../packages/drivers/linux.js";

test("X11 owner grants agent input; real terminal result and takeover are verified", {
  skip: !process.env.BROWSE_TEST_DISPLAY,
}, async () => {
  const display = process.env.BROWSE_TEST_DISPLAY;
  assert(display);
  const db = new PGlite();
  const store = new Store(db);
  await store.init();
  const credentials = [
    { user: "owner", actor: "human", human: true, token: "h".repeat(64) },
    { user: "owner", actor: "agent", human: false, token: "a".repeat(64) },
    { user: "other", actor: "human", human: true, token: "o".repeat(64) },
  ];
  const { app } = await createApp(store, credentials, new Set(), {
    display,
    owner: "owner",
  });
  const request = async (
    actor: number,
    method: "GET" | "POST" | "DELETE",
    url: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      headers: { authorization: `Bearer ${credentials[actor].token}` },
      payload: payload as object,
    });
  const create = (actor: number) =>
    request(actor, "POST", "/api/sessions", {
      requestId: randomUUID(),
      name: "desktop",
      platform: "linux",
    });
  const dir = await mkdtemp(join(tmpdir(), "browse-native-"));
  const path = join(dir, "result");
  try {
    assert.equal((await create(1)).statusCode, 403);
    assert.equal((await create(2)).statusCode, 403);
    const created = await create(0);
    assert.equal(created.statusCode, 200);
    const s = created.json();
    assert.equal((await create(0)).json().error, "DESKTOP_BUSY");
    const assigned = (
      await request(0, "POST", `/api/sessions/${s.id}/control`, {
        epoch: s.epoch,
        actor: "agent",
      })
    ).json();
    const act = async (action: unknown) => {
      const r = await request(1, "POST", `/api/sessions/${s.id}/actions`, {
        requestId: randomUUID(),
        epoch: assigned.epoch,
        deadline: Date.now() + 15000,
        action,
      });
      assert.equal(r.statusCode, 200, r.body);
    };
    await act({ type: "pointer", x: 0.25, y: 0.2 });
    await act({ type: "pointer", x: 0.25, y: 0.2 });
    await act({
      type: "type",
      text: `printf 'verified-native-731' > '${path}'`,
    });
    await act({ type: "press", key: "Enter" });
    for (let i = 0; i < 50; i++) {
      if (
        (await readFile(path, "utf8").catch(() => "")) === "verified-native-731"
      )
        break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal(await readFile(path, "utf8"), "verified-native-731");
    const image = await request(0, "GET", `/api/sessions/${s.id}/screenshot`);
    assert.equal(image.headers["content-type"], "image/jpeg");
    assert(image.rawPayload.length > 1000);
    await request(0, "POST", `/api/sessions/${s.id}/control`, {
      epoch: assigned.epoch,
    });
    assert.equal(
      (
        await request(1, "POST", `/api/sessions/${s.id}/actions`, {
          requestId: randomUUID(),
          epoch: assigned.epoch,
          deadline: Date.now() + 1000,
          action: { type: "type", text: "forbidden" },
        })
      ).statusCode,
      404,
    );
    await request(0, "DELETE", `/api/sessions/${s.id}`);
    assert.deepEqual(await new LinuxDesktop(display).size(), {
      width: 1280,
      height: 800,
    });
  } finally {
    await app.close();
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
