import { createHash } from "node:crypto";
import type { Store } from "./store.js";
import {
  type Command,
  ControlError,
  type Driver,
  type Principal,
} from "./types.js";

export class Controller {
  private tails = new Map<string, Promise<unknown>>();
  private fences = new Map<string, number>();
  readonly drivers = new Map<string, Driver>();
  constructor(readonly store: Store) {}
  async serial<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(fn);
    this.tails.set(id, next);
    try {
      return await next;
    } finally {
      if (this.tails.get(id) === next) this.tails.delete(id);
    }
  }
  driver(id: string) {
    const d = this.drivers.get(id);
    if (!d) throw new ControlError("DEVICE_UNAVAILABLE", 503);
    return d;
  }
  async execute(p: Principal, id: string, cmd: Command) {
    const fence = this.fences.get(id) ?? 0;
    // Check on arrival AND after queueing. A handoff can invalidate queued input.
    await this.store.assertControl(p, id, cmd.epoch, cmd.deadline);
    return this.serial(id, async () => {
      await this.store.assertControl(p, id, cmd.epoch, cmd.deadline);
      const digest = createHash("sha256")
        .update(
          JSON.stringify({
            actor: p.actor,
            epoch: cmd.epoch,
            action: cmd.action,
          }),
        )
        .digest("hex");
      const inserted = await this.store.db.query(
        `INSERT INTO commands VALUES($1,$2,$3,'running')
        ON CONFLICT DO NOTHING RETURNING request_id`,
        [id, cmd.requestId, digest],
      );
      if (!inserted.rows.length) {
        const { rows } = await this.store.db.query<{
          digest: string;
          outcome: string;
        }>(
          "SELECT digest,outcome FROM commands WHERE session_id=$1 AND request_id=$2",
          [id, cmd.requestId],
        );
        if (rows[0].digest !== digest)
          throw new ControlError("IDEMPOTENCY_CONFLICT");
        if (rows[0].outcome !== "ok") throw new ControlError("OUTCOME_UNKNOWN");
        return { outcome: "ok", replay: true };
      }
      let outcome = "ok";
      try {
        await this.store.assertControl(p, id, cmd.epoch, cmd.deadline);
        if ((this.fences.get(id) ?? 0) !== fence)
          throw new ControlError("CONTROL_LOST");
        await this.driver(id).act(cmd.action);
      } catch {
        outcome = "OUTCOME_UNKNOWN";
      }
      await this.store.db.query(
        "UPDATE commands SET outcome=$1 WHERE session_id=$2 AND request_id=$3",
        [outcome, id, cmd.requestId],
      );
      if (outcome !== "ok") throw new ControlError(outcome);
      return { outcome, replay: false };
    });
  }
  async claim(p: Principal, id: string, epoch: number, actor?: string) {
    // Fence immediately, then wait for a dispatched action to finish before acknowledging.
    await this.store.get(p, id);
    this.fences.set(id, (this.fences.get(id) ?? 0) + 1);
    const s = await this.store.claim(p, id, epoch, actor);
    await this.serial(id, async () => {});
    return s;
  }
  async stop(p: Principal, id: string) {
    await this.store.get(p, id);
    this.fences.set(id, (this.fences.get(id) ?? 0) + 1);
    await this.store.stop(id);
    await this.serial(id, async () => {
      const d = this.drivers.get(id);
      if (d) await d.close();
      this.drivers.delete(id);
    });
  }
  async close() {
    await Promise.all(
      [...this.drivers].map(async ([id, d]) => {
        await this.store.stop(id);
        await this.serial(id, () => d.close());
      }),
    );
    this.drivers.clear();
  }
}
