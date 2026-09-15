import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { Controller } from "../packages/core/controller.js";
import { Store } from "../packages/core/store.js";
import type { Driver, Principal } from "../packages/core/types.js";

const alice: Principal = { user: "alice", actor: "worker-a", human: false };
const human: Principal = { user: "alice", actor: "human", human: true };
async function fixture() {
  const db = new PGlite();
  const store = new Store(db);
  await store.init();
  const c = new Controller(store);
  const { session: s } = await store.create(alice, randomUUID(), "test");
  await db.query("UPDATE sessions SET status='ready' WHERE id=$1", [s.id]);
  return { db, store, c, s };
}
const fake = (act: Driver["act"]): Driver => ({
  act,
  observe: async () => ({}),
  screenshot: async () => Buffer.alloc(0),
  close: async () => {},
});
test("different users and agents cannot read a session", async () => {
  const { db, store, s } = await fixture();
  try {
    await assert.rejects(
      store.get({ ...alice, user: "bob" }, s.id),
      /NOT_FOUND/,
    );
    await assert.rejects(
      store.get({ ...alice, actor: "worker-b" }, s.id),
      /NOT_FOUND/,
    );
    assert.equal((await store.get(human, s.id)).id, s.id);
  } finally {
    await db.close();
  }
});
test("atomic claims only allow one winner; stale epoch and expired lease fail", async () => {
  const { db, store, s } = await fixture();
  try {
    const results = await Promise.allSettled([
      store.claim(human, s.id, 1),
      store.claim(human, s.id, 1),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    await assert.rejects(
      store.assertControl(human, s.id, 1, Date.now() + 1000),
      /CONTROL_LOST/,
    );
    await db.query("UPDATE sessions SET lease_until=0 WHERE id=$1", [s.id]);
    await assert.rejects(
      store.assertControl(human, s.id, 2, Date.now() + 1000),
      /CONTROL_LOST/,
    );
  } finally {
    await db.close();
  }
});
test("duplicate acknowledged action is not executed twice; altered payload rejected", async () => {
  const { db, c, s } = await fixture();
  let count = 0;
  c.drivers.set(
    s.id,
    fake(async () => {
      count++;
    }),
  );
  const cmd = {
    requestId: randomUUID(),
    epoch: 1,
    deadline: Date.now() + 5000,
    action: { type: "press" as const, key: "Enter" },
  };
  try {
    await c.execute(alice, s.id, cmd);
    assert.equal((await c.execute(alice, s.id, cmd)).replay, true);
    await assert.rejects(
      c.execute(alice, s.id, {
        ...cmd,
        action: { type: "press", key: "Escape" },
      }),
      /IDEMPOTENCY_CONFLICT/,
    );
    assert.equal(count, 1);
  } finally {
    await c.close();
    await db.close();
  }
});
test("lost reply never repeats a possibly completed action", async () => {
  const { db, c, s } = await fixture();
  let count = 0;
  c.drivers.set(
    s.id,
    fake(async () => {
      count++;
      throw Error("transport failed after input");
    }),
  );
  const cmd = {
    requestId: randomUUID(),
    epoch: 1,
    deadline: Date.now() + 5000,
    action: { type: "press" as const, key: "Enter" },
  };
  try {
    await assert.rejects(c.execute(alice, s.id, cmd), /OUTCOME_UNKNOWN/);
    await assert.rejects(c.execute(alice, s.id, cmd), /OUTCOME_UNKNOWN/);
    assert.equal(count, 1);
  } finally {
    await c.close();
    await db.close();
  }
});
test("human takeover fences input queued behind an in-flight command", async () => {
  const { db, c, s, store } = await fixture();
  let release = () => {};
  let started = () => {};
  let count = 0;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const entered = new Promise<void>((r) => {
    started = r;
  });
  c.drivers.set(
    s.id,
    fake(async () => {
      count++;
      started();
      await gate;
    }),
  );
  const command = () => ({
    requestId: randomUUID(),
    epoch: 1,
    deadline: Date.now() + 5000,
    action: { type: "press" as const, key: "Enter" },
  });
  try {
    const first = c.execute(alice, s.id, command());
    await entered;
    const queued = assert.rejects(
      c.execute(alice, s.id, command()),
      /NOT_FOUND|CONTROL_LOST/,
    );
    const takeover = c.claim(human, s.id, 1);
    while ((await store.get(human, s.id)).epoch === 1)
      await new Promise((r) => setTimeout(r, 1));
    release();
    await first;
    await takeover;
    await queued;
    assert.equal(count, 1);
  } finally {
    release();
    await c.close();
    await db.close();
  }
});

test("takeover between validation and dispatch cannot send old input", async () => {
  const { db, store, c, s } = await fixture();
  let release = () => {};
  let entered = () => {};
  let checks = 0;
  let count = 0;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const paused = new Promise<void>((r) => {
    entered = r;
  });
  const assertControl = store.assertControl.bind(store);
  store.assertControl = async (...args) => {
    const result = await assertControl(...args);
    if (++checks === 2) {
      entered();
      await gate;
    }
    return result;
  };
  c.drivers.set(
    s.id,
    fake(async () => {
      count++;
    }),
  );
  try {
    const rejected = assert.rejects(
      c.execute(alice, s.id, {
        requestId: randomUUID(),
        epoch: 1,
        deadline: Date.now() + 5000,
        action: { type: "press", key: "Enter" },
      }),
      /OUTCOME_UNKNOWN|CONTROL_LOST|NOT_FOUND/,
    );
    await paused;
    const takeover = c.claim(human, s.id, 1);
    while ((await store.get(human, s.id)).epoch === 1)
      await new Promise((r) => setTimeout(r, 1));
    release();
    await rejected;
    await takeover;
    assert.equal(count, 0);
  } finally {
    release();
    await c.close();
    await db.close();
  }
});
