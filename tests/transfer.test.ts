import assert from "node:assert/strict";
import { test } from "node:test";
import {
  encryptLogin,
  type LoginPayload,
  LoginTransfers,
} from "../packages/auth-transfer/index.js";

const payload: LoginPayload = {
  cookies: [
    {
      name: "session",
      value: "private-test-value",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ],
  localStorage: [],
};
test("login transfer is encrypted, bound to target and single use", async () => {
  const transfers = new LoginTransfers();
  const ticket = await transfers.issue(
    "session-a",
    "https://example.com",
    "alice",
    "human",
    4,
  );
  const envelope = await encryptLogin(ticket, payload);
  assert(!JSON.stringify(envelope).includes("private-test-value"));
  const received = await transfers.consume(ticket.id, envelope);
  assert.deepEqual(received.payload, payload);
  assert.equal(received.epoch, 4);
  await assert.rejects(
    transfers.consume(ticket.id, envelope),
    /IMPORT_EXPIRED/,
  );
  const t = await transfers.issue(
    "session-a",
    "https://example.com",
    "alice",
    "human",
    4,
  );
  await assert.rejects(
    transfers.consume(
      t.id,
      await encryptLogin({ ...t, session: "session-b" }, payload),
    ),
    /INVALID_IMPORT/,
  );
});
test("expired and cancelled grants never decrypt", async () => {
  let now = 1000;
  const transfers = new LoginTransfers(() => now);
  const t = await transfers.issue("s", "https://example.com", "a", "human", 1);
  const e = await encryptLogin(t, payload);
  now = t.expires;
  await assert.rejects(transfers.consume(t.id, e), /IMPORT_EXPIRED/);
  const next = await transfers.issue(
    "s",
    "https://example.com",
    "a",
    "human",
    1,
  );
  transfers.cancel("s");
  await assert.rejects(
    transfers.consume(next.id, await encryptLogin(next, payload)),
    /IMPORT_EXPIRED/,
  );
});
