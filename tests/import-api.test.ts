import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createApp } from "../apps/server/app.js";
import { encryptLogin } from "../packages/auth-transfer/index.js";
import { Store } from "../packages/core/store.js";
import { BrowserDriver } from "../packages/drivers/browser.js";

test("one-use authorized import changes real browser login but not another session", async () => {
  const site = createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(
      req.headers.cookie?.includes("login=test-login")
        ? "<h1>Signed in</h1>"
        : "<h1>Signed out</h1>",
    );
  });
  await new Promise<void>((r) => site.listen(0, "127.0.0.1", r));
  const addr = site.address();
  assert(addr && typeof addr === "object");
  const origin = `http://127.0.0.1:${addr.port}`;
  const db = new PGlite();
  const store = new Store(db);
  await store.init();
  const token = "c".repeat(64);
  const agent = "d".repeat(64);
  const headers = { authorization: `Bearer ${token}` };
  const { app, controller } = await createApp(
    store,
    [
      { token, user: "a", actor: "human", human: true },
      { token: agent, user: "a", actor: "agent", human: false },
    ],
    new Set([origin]),
  );
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/sessions",
      headers,
      payload: { name: "login", platform: "browser", requestId: randomUUID() },
    });
    const s = response.json();
    assert.equal(s.status, "ready");
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/sessions/${s.id}/import`,
          headers: { authorization: `Bearer ${agent}` },
          payload: { origin, epoch: s.epoch },
        })
      ).statusCode,
      403,
    );
    const ticket = (
      await app.inject({
        method: "POST",
        url: `/api/sessions/${s.id}/import`,
        headers,
        payload: { origin, epoch: s.epoch },
      })
    ).json();
    const envelope = await encryptLogin(ticket, {
      cookies: [
        {
          name: "login",
          value: "test-login",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      localStorage: [],
    });
    const receipt = await app.inject({
      method: "POST",
      url: `/transfer/${ticket.id}`,
      payload: envelope,
    });
    assert.equal(receipt.statusCode, 200);
    assert.equal(receipt.json().loginVerified, false);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/transfer/${ticket.id}`,
          payload: envelope,
        })
      ).statusCode,
      410,
    );
    const browser = controller.driver(s.id);
    assert(browser instanceof BrowserDriver);
    await browser.act({ type: "navigate", url: origin });
    assert.equal(await browser.page.locator("h1").innerText(), "Signed in");
    const b = await BrowserDriver.create(new Set([origin]));
    try {
      await b.act({ type: "navigate", url: origin });
      assert.equal(await b.page.locator("h1").innerText(), "Signed out");
    } finally {
      await b.close();
    }
  } finally {
    await app.close();
    await db.close();
    await new Promise<void>((r) => site.close(() => r()));
  }
});
