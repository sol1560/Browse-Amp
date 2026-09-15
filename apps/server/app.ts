import { createHash, timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyRequest } from "fastify";
import { ZodError, z } from "zod";
import { LoginTransfers } from "../../packages/auth-transfer/index.js";
import { Controller } from "../../packages/core/controller.js";
import type { Store } from "../../packages/core/store.js";
import {
  ControlError,
  commandSchema,
  type Principal,
} from "../../packages/core/types.js";
import { BrowserDriver } from "../../packages/drivers/browser.js";
import { LinuxDesktop } from "../../packages/drivers/linux.js";

export type Credential = Principal & { token: string };
export async function createApp(
  store: Store,
  credentials: Credential[],
  origins: Set<string>,
  desktop?: { display: string; owner: string },
) {
  if (!credentials.length || credentials.some((c) => c.token.length < 32))
    throw Error("Tokens must contain at least 32 characters");
  const app = Fastify({ logger: false, bodyLimit: 128 * 1024 });
  const controller = new Controller(store);
  const transfers = new LoginTransfers(store.now);
  const principals = new WeakMap<FastifyRequest, Principal>();
  const hash = (value: string) => createHash("sha256").update(value).digest();
  const p = (r: FastifyRequest) => {
    const result = principals.get(r);
    if (!result) throw new ControlError("UNAUTHORIZED", 401);
    return result;
  };
  const id = (r: FastifyRequest) =>
    z.object({ id: z.uuid() }).parse(r.params).id;
  app.addHook("onRequest", async (request, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer");
    if (!request.url.startsWith("/api/")) return;
    const auth = request.headers.authorization;
    if (!auth?.startsWith("Bearer "))
      throw new ControlError("UNAUTHORIZED", 401);
    const match = credentials.find((c) =>
      timingSafeEqual(hash(c.token), hash(auth.slice(7))),
    );
    if (!match) throw new ControlError("UNAUTHORIZED", 401);
    principals.set(request, {
      user: match.user,
      actor: match.actor,
      human: match.human,
    });
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ControlError)
      return reply.code(error.status).send({ error: error.code });
    if (error instanceof ZodError)
      return reply.code(400).send({ error: "INVALID_INPUT" });
    // Do not echo browser errors, URLs, submitted text or cookies.
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });
  app.get("/health", async () => ({ ok: true }));
  app.get("/api/me", async (r) => p(r));
  app.get("/api/platforms", async (r) => [
    {
      id: "browser",
      available: true,
      detail: "本地 Chromium · 仅允许配置的网站",
    },
    {
      id: "linux",
      available: !!desktop && p(r).human && p(r).user === desktop.owner,
      detail: "需由电脑所有者显式启用 X11 桌面；一台桌面只允许一个会话",
    },
    ...[
      "macos",
      "windows",
      "android",
      "ios",
      "ipados",
      "visionos",
      "watchos",
    ].map((id) => ({ id, available: false, detail: "尚未接入并验证真实设备" })),
  ]);
  app.get("/api/sessions", async (r) => store.list(p(r)));
  app.post("/api/sessions", async (r) => {
    const body = z
      .object({
        requestId: z.uuid(),
        name: z.string().min(1).max(80),
        platform: z.string(),
      })
      .strict()
      .parse(r.body);
    if (body.platform !== "browser" && body.platform !== "linux")
      throw new ControlError("UNSUPPORTED_CAPABILITY", 422);
    if (
      body.platform === "linux" &&
      (!desktop || !p(r).human || p(r).user !== desktop.owner)
    )
      throw new ControlError("FORBIDDEN", 403);
    return controller.serial("create", async () => {
      if (controller.drivers.size >= 20)
        throw new ControlError("CAPACITY_REACHED", 429);
      const { session, created } = await store.create(
        p(r),
        body.requestId,
        body.name,
        body.platform,
      );
      if (!created) return session;
      try {
        if (
          body.platform === "linux" &&
          [...controller.drivers.values()].some(
            (d) => d instanceof LinuxDesktop,
          )
        )
          throw new ControlError("DESKTOP_BUSY");
        const driver =
          body.platform === "linux" && desktop
            ? new LinuxDesktop(desktop.display)
            : await BrowserDriver.create(origins);
        controller.drivers.set(session.id, driver);
        await driver.observe();
        const ready = await store.db.query(
          "UPDATE sessions SET status='ready' WHERE id=$1 AND status='starting' RETURNING id",
          [session.id],
        );
        if (!ready.rows.length) throw new ControlError("SESSION_NOT_READY");
        return await store.get(p(r), session.id);
      } catch (error) {
        await store.stop(session.id);
        const d = controller.drivers.get(session.id);
        if (d) await d.close();
        controller.drivers.delete(session.id);
        throw error;
      }
    });
  });
  app.get("/api/sessions/:id", async (r) => store.get(p(r), id(r)));
  app.post("/api/sessions/:id/control", async (r) => {
    const body = z
      .object({
        epoch: z.number().int().nonnegative(),
        actor: z.string().min(1).max(80).optional(),
      })
      .strict()
      .parse(r.body);
    if (
      body.actor &&
      !credentials.some((c) => c.user === p(r).user && c.actor === body.actor)
    )
      throw new ControlError("UNKNOWN_ACTOR", 400);
    return controller.claim(p(r), id(r), body.epoch, body.actor);
  });
  app.post("/api/sessions/:id/actions", async (r) =>
    controller.execute(p(r), id(r), commandSchema.parse(r.body)),
  );
  app.post("/api/sessions/:id/import", async (r) => {
    const principal = p(r);
    if (!principal.human) throw new ControlError("HUMAN_REQUIRED", 403);
    const body = z
      .object({ origin: z.url(), epoch: z.number().int() })
      .strict()
      .parse(r.body);
    const origin = new URL(body.origin).origin;
    if (!origins.has(origin)) throw new ControlError("ORIGIN_NOT_ALLOWED", 403);
    await store.assertControl(principal, id(r), body.epoch, Date.now() + 1000);
    if (!(controller.driver(id(r)) instanceof BrowserDriver))
      throw new ControlError("UNSUPPORTED_CAPABILITY", 422);
    return transfers.issue(
      id(r),
      origin,
      principal.user,
      principal.actor,
      body.epoch,
    );
  });
  app.delete("/api/sessions/:id/import", async (r) => {
    if (!p(r).human) throw new ControlError("HUMAN_REQUIRED", 403);
    await store.get(p(r), id(r));
    transfers.cancel(id(r));
    return { ok: true };
  });
  // A 256-bit single-use capability, not the user's long-lived service token.
  app.post("/transfer/:ticket", async (r) => {
    const ticket = z
      .object({ ticket: z.string().regex(/^[a-f0-9]{64}$/) })
      .parse(r.params).ticket;
    const envelope = z
      .object({
        key: z.string().max(1024),
        iv: z.string().max(32),
        data: z.string().max(120000),
      })
      .strict()
      .parse(r.body);
    const grant = await transfers.consume(ticket, envelope);
    return controller.serial(grant.ticket.session, async () => {
      await store.assertControl(
        { user: grant.owner, actor: grant.actor, human: true },
        grant.ticket.session,
        grant.epoch,
        grant.ticket.expires,
      );
      const driver = controller.driver(grant.ticket.session);
      if (!(driver instanceof BrowserDriver))
        throw new ControlError("UNSUPPORTED_CAPABILITY", 422);
      const origin = grant.ticket.origin;
      await driver.context.addCookies(
        grant.payload.cookies.map((c) => ({
          ...c,
          domain: new URL(origin).hostname,
        })),
      );
      if (grant.payload.localStorage.length) {
        await driver.act({ type: "navigate", url: origin });
        if (new URL(driver.page.url()).origin !== origin)
          throw new ControlError("IMPORT_ORIGIN_CHANGED");
        await driver.page.evaluate((items) => {
          for (const item of items) localStorage.setItem(item.name, item.value);
        }, grant.payload.localStorage);
      }
      return {
        imported: true,
        loginVerified: false,
        note: "已写入会话；请打开网站确认登录是否仍然有效。",
      };
    });
  });
  for (const operation of ["observe", "screenshot"] as const) {
    app.get(`/api/sessions/:id/${operation}`, async (r, reply) => {
      const target = id(r);
      return controller.serial(target, async () => {
        const s = await store.get(p(r), target);
        if (s.status !== "ready" || s.expires_at <= store.now())
          throw new ControlError("SESSION_NOT_READY");
        if (operation === "screenshot") reply.type("image/jpeg");
        return controller.driver(target)[operation]();
      });
    });
  }
  app.delete("/api/sessions/:id", async (r) => {
    await controller.stop(p(r), id(r));
    return { ok: true };
  });
  const timer = setInterval(() => {
    void (async () => {
      const { rows } = await store.db.query<{ id: string; owner: string }>(
        "SELECT id,owner FROM sessions WHERE expires_at<=$1 AND status!='stopped'",
        [store.now()],
      );
      for (const s of rows)
        await controller.stop(
          { user: s.owner, actor: "cleanup", human: true },
          s.id,
        );
    })().catch(() => {});
  }, 5000);
  timer.unref();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    await controller.close();
  });
  return { app, controller };
}
