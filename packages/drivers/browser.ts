import { randomUUID } from "node:crypto";
import {
  type Browser,
  type BrowserContext,
  chromium,
  type ElementHandle,
  type Page,
} from "playwright";
import { type Action, ControlError, type Driver } from "../core/types.js";

export class BrowserDriver implements Driver {
  private refs = new Map<string, ElementHandle>();
  private generation = 0;
  private constructor(
    readonly browser: Browser,
    readonly context: BrowserContext,
    readonly page: Page,
    readonly origins: Set<string>,
  ) {
    page.on("framenavigated", () => this.invalidate());
    page.on("close", () => this.invalidate());
  }
  static async create(origins: Set<string>) {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        serviceWorkers: "block",
        acceptDownloads: false,
      });
      // Apply to every request including redirects, subframes and popups.
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return origins.has(url.origin) &&
          ["http:", "https:"].includes(url.protocol)
          ? route.continue()
          : route.abort("blockedbyclient");
      });
      await context.routeWebSocket("**/*", (socket) => socket.close());
      const page = await context.newPage();
      context.on("page", (p) => {
        if (p !== page) void p.close();
      });
      page.on("dialog", (dialog) => void dialog.dismiss());
      page.setDefaultTimeout(5000);
      page.setDefaultNavigationTimeout(10000);
      return new BrowserDriver(browser, context, page, origins);
    } catch (error) {
      await browser.close();
      throw error;
    }
  }
  private invalidate() {
    this.generation++;
    for (const element of this.refs.values())
      void element.dispose().catch(() => {});
    this.refs.clear();
  }
  async observe() {
    this.invalidate();
    const generation = this.generation;
    const elements: {
      ref: string;
      role: string;
      text: string;
      frame: string;
    }[] = [];
    for (const frame of this.page.frames()) {
      const handles = await frame
        .locator(
          'a,button,input:not([type="password"]),textarea,select,[role="button"],[contenteditable="true"]',
        )
        .elementHandles();
      for (const element of handles.slice(0, 200)) {
        if (generation !== this.generation) {
          await element.dispose();
          continue;
        }
        if (!(await element.isVisible())) {
          await element.dispose();
          continue;
        }
        const info = await element.evaluate((node) => {
          const el = node as Element;
          return {
            role: el.getAttribute("role") || el.tagName.toLowerCase(),
            text: (
              el.getAttribute("aria-label") ||
              el.getAttribute("placeholder") ||
              el.textContent ||
              ""
            )
              .trim()
              .slice(0, 160),
          };
        });
        const ref = `${generation}-${randomUUID()}`;
        this.refs.set(ref, element);
        elements.push({ ref, ...info, frame: frame.url() });
      }
      for (const element of handles.slice(200)) await element.dispose();
    }
    return {
      url: this.page.url(),
      title: await this.page.title(),
      elements,
      generation,
    };
  }
  async screenshot() {
    return this.page.screenshot({ type: "jpeg", quality: 75 });
  }
  async act(action: Action) {
    if (action.type === "pointer") {
      const viewport = this.page.viewportSize();
      if (!viewport) throw new ControlError("NO_VIEWPORT");
      await this.page.mouse.click(
        Math.min(viewport.width - 1, Math.floor(action.x * viewport.width)),
        Math.min(viewport.height - 1, Math.floor(action.y * viewport.height)),
      );
      return;
    }
    if (action.type === "type") {
      await this.page.keyboard.insertText(action.text);
      return;
    }
    if (action.type === "navigate") {
      const url = new URL(action.url);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        !this.origins.has(url.origin)
      )
        throw new ControlError("ORIGIN_NOT_ALLOWED", 403);
      await this.page.goto(url.href, { waitUntil: "domcontentloaded" });
      return;
    }
    if (action.type === "press") {
      await this.page.keyboard.press(action.key);
      return;
    }
    if (action.type === "scroll") {
      await this.page.mouse.wheel(action.x, action.y);
      return;
    }
    const el = this.refs.get(action.ref);
    if (
      !el ||
      !(await el.evaluate((node) => node.isConnected).catch(() => false))
    )
      throw new ControlError("STALE_REF");
    if (action.type === "click") await el.click();
    else await el.fill(action.text);
  }
  async close() {
    this.invalidate();
    await this.browser.close();
  }
}
