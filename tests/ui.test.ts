import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import staticFiles from "@fastify/static";
import { chromium } from "playwright";
import { createApp } from "../apps/server/app.js";
import { Store } from "../packages/core/store.js";
import { BrowserDriver } from "../packages/drivers/browser.js";
import { BrowseClient } from "../packages/sdk/index.js";

test("touch workbench maps scaled input correctly and hands control to an agent", {
  skip: process.env.BROWSE_TEST_UI !== "1",
}, async () => {
  const db = new PGlite();
  const store = new Store(db);
  await store.init();
  const humanToken = "u".repeat(64),
    agentToken = "v".repeat(64);
  const { app, controller } = await createApp(
    store,
    [
      { user: "ui-test", actor: "human", human: true, token: humanToken },
      { user: "ui-test", actor: "agent-1", human: false, token: agentToken },
    ],
    new Set(),
  );
  await app.register(staticFiles, {
    root: resolve("dist/console"),
    wildcard: false,
  });
  const url = await app.listen({ host: "127.0.0.1", port: 0 });
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const human = new BrowseClient(url, humanToken),
    agent = new BrowseClient(url, agentToken);
  try {
    await page.goto(url);
    assert(await page.evaluate(() => matchMedia("(pointer: coarse)").matches));
    await page.getByLabel("访问凭据").fill(humanToken);
    await page.getByRole("button", { name: "连接服务 ↗" }).tap();
    await page.getByLabel("新会话").fill("触控与 Agent 验收");
    await page.getByRole("button", { name: "+ 创建会话" }).tap();
    await page.locator(".screen-control img").waitFor();
    const [s] = await human.list();
    const target = controller.driver(s.id);
    assert(target instanceof BrowserDriver);
    await target.page.setContent(
      '<body style="margin:0;background:#faf9f6;font:24px sans-serif"><h1>输入验收</h1><input aria-label="result" style="position:absolute;left:240px;top:180px;width:180px;height:70px"><button style="position:absolute;left:780px;top:400px;width:250px;height:100px" onclick="this.textContent=document.querySelector(\'input\').value">保存</button></body>',
    );
    const screen = page.locator(".screen-control");
    await screen.scrollIntoViewIfNeeded();
    const box = await screen.boundingBox();
    assert(box);
    await page.touchscreen.tap(
      box.x + (box.width * 330) / 1280,
      box.y + (box.height * 215) / 800,
    );
    await page.getByLabel("要填写的文字").fill("touch-739");
    await page.getByRole("button", { name: "发送文字" }).tap();
    await target.page.waitForFunction(
      () => document.querySelector("input")?.value === "touch-739",
    );
    await page.getByRole("button", { name: "交给 Agent", exact: true }).tap();
    await page
      .getByRole("status")
      .filter({ hasText: "已交给 Agent" })
      .waitFor();
    assert(await screen.isDisabled());
    const assigned = await agent.get(s.id);
    const view = await agent.observe(s.id);
    const save = view.elements.find((e) => e.role === "button");
    assert(save);
    await agent.act(s.id, assigned.epoch, { type: "click", ref: save.ref });
    assert.equal(await target.page.locator("button").innerText(), "touch-739");
    await page.getByRole("button", { name: "接管 / 续租" }).tap();
    await page
      .getByRole("status")
      .filter({ hasText: "已获得输入权" })
      .waitFor();
    await assert.rejects(
      agent.act(s.id, assigned.epoch, { type: "type", text: "wrong" }),
      /NOT_FOUND/,
    );
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const previousImage = await page
      .locator(".screen-control img")
      .getAttribute("src");
    await page.waitForFunction((previous) => {
      const image = document.querySelector<HTMLImageElement>(
        ".screen-control img",
      );
      return (
        image &&
        image.src !== previous &&
        image.complete &&
        image.naturalWidth === 1280
      );
    }, previousImage);
    await mkdir(".amp/in/artifacts", { recursive: true });
    await page.screenshot({
      path: resolve(".amp/in/artifacts/mobile-control.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "结束会话" }).tap();
    await page
      .locator(".screen-placeholder")
      .filter({ hasText: "会话已结束" })
      .waitFor();
  } finally {
    await browser.close();
    await app.close();
    await db.close();
  }
});
