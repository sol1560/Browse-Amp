import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { BrowserDriver } from "../packages/drivers/browser.js";

test("real Chromium input, stale refs, iframe and cookie isolation", async () => {
  const server = createServer((req, res) => {
    res.setHeader("content-type", "text/html");
    res.end(
      req.url === "/frame"
        ? "<button>Frame action</button>"
        : '<title>Test board</title><input placeholder="Task name"><button onclick="this.textContent=document.querySelector(\'input\').value">Save</button><iframe src="/frame"></iframe>',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const a = await BrowserDriver.create(new Set([origin]));
  const b = await BrowserDriver.create(new Set([origin]));
  try {
    await a.act({ type: "navigate", url: origin });
    await a.page.frameLocator("iframe").getByRole("button").waitFor();
    const view = await a.observe();
    assert.equal(view.title, "Test board");
    const input = view.elements.find((e) => e.role === "input");
    const save = view.elements.find((e) => e.text === "Save");
    assert(input && save);
    assert(view.elements.some((e) => e.text === "Frame action"));
    await a.act({ type: "fill", ref: input.ref, text: "Asymmetric 739" });
    await a.act({ type: "click", ref: save.ref });
    assert.equal(await a.page.locator("button").innerText(), "Asymmetric 739");
    assert((await a.screenshot()).length > 1000);
    await a.context.addCookies([
      { name: "secret", value: "only-a", url: origin },
    ]);
    assert.equal((await b.context.cookies()).length, 0);
    await a.act({ type: "navigate", url: origin });
    await assert.rejects(a.act({ type: "click", ref: save.ref }), /STALE_REF/);
    await assert.rejects(
      a.act({ type: "navigate", url: "file:///etc/passwd" }),
      /ORIGIN_NOT_ALLOWED/,
    );
    await assert.rejects(
      a.act({ type: "navigate", url: "https://example.org" }),
      /ORIGIN_NOT_ALLOWED/,
    );
  } finally {
    await a.close();
    await b.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
