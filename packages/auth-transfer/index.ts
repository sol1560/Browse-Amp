import { randomBytes, webcrypto } from "node:crypto";
import { z } from "zod";
import { ControlError } from "../core/types.js";

const subtle = webcrypto.subtle;
export const payloadSchema = z
  .object({
    cookies: z
      .array(
        z
          .object({
            name: z.string().max(256),
            value: z.string().max(16000),
            path: z.string().startsWith("/").max(1024),
            expires: z.number().optional(),
            httpOnly: z.boolean(),
            secure: z.boolean(),
            sameSite: z.enum(["Strict", "Lax", "None"]),
          })
          .strict(),
      )
      .max(100),
    localStorage: z
      .array(
        z
          .object({ name: z.string().max(1000), value: z.string().max(16000) })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type LoginPayload = z.infer<typeof payloadSchema>;
export type ImportTicket = {
  id: string;
  session: string;
  origin: string;
  expires: number;
  publicKey: JsonWebKey;
};
export type Envelope = { key: string; iv: string; data: string };
const from64 = (value: string) => new Uint8Array(Buffer.from(value, "base64"));
export const aad = (t: ImportTicket) =>
  new TextEncoder().encode(
    JSON.stringify([t.id, t.session, t.origin, t.expires]),
  );

export async function encryptLogin(
  t: ImportTicket,
  payload: LoginPayload,
): Promise<Envelope> {
  const rsa = await subtle.importKey(
    "jwk",
    t.publicKey,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
  ]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  return {
    key: Buffer.from(
      await subtle.encrypt("RSA-OAEP", rsa, await subtle.exportKey("raw", key)),
    ).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
    data: Buffer.from(
      await subtle.encrypt(
        { name: "AES-GCM", iv, additionalData: aad(t) },
        key,
        new TextEncoder().encode(JSON.stringify(payload)),
      ),
    ).toString("base64"),
  };
}
export class LoginTransfers {
  private grants = new Map<
    string,
    {
      ticket: ImportTicket;
      privateKey: webcrypto.CryptoKey;
      owner: string;
      actor: string;
      epoch: number;
    }
  >();
  constructor(readonly now = () => Date.now()) {}
  async issue(
    session: string,
    origin: string,
    owner: string,
    actor: string,
    epoch: number,
  ) {
    for (const [id, g] of this.grants)
      if (g.ticket.expires <= this.now() || g.ticket.session === session)
        this.grants.delete(id);
    if (this.grants.size >= 50) throw new ControlError("CAPACITY_REACHED", 429);
    const keys = await subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      false,
      ["encrypt", "decrypt"],
    );
    const ticket: ImportTicket = {
      id: randomBytes(32).toString("hex"),
      session,
      origin,
      expires: this.now() + 60_000,
      publicKey: await subtle.exportKey("jwk", keys.publicKey),
    };
    this.grants.set(ticket.id, {
      ticket,
      privateKey: keys.privateKey,
      owner,
      actor,
      epoch,
    });
    return ticket;
  }
  cancel(session: string) {
    for (const [id, g] of this.grants)
      if (g.ticket.session === session) this.grants.delete(id);
  }
  async consume(id: string, envelope: Envelope) {
    const g = this.grants.get(id);
    this.grants.delete(id);
    if (!g || g.ticket.expires <= this.now())
      throw new ControlError("IMPORT_EXPIRED", 410);
    try {
      const raw = await subtle.decrypt(
        "RSA-OAEP",
        g.privateKey,
        from64(envelope.key),
      );
      const key = await subtle.importKey("raw", raw, "AES-GCM", false, [
        "decrypt",
      ]);
      const decrypted = await subtle.decrypt(
        {
          name: "AES-GCM",
          iv: from64(envelope.iv),
          additionalData: aad(g.ticket),
        },
        key,
        from64(envelope.data),
      );
      const payload = payloadSchema.parse(
        JSON.parse(new TextDecoder().decode(decrypted)),
      );
      return {
        ticket: g.ticket,
        owner: g.owner,
        actor: g.actor,
        epoch: g.epoch,
        payload,
      };
    } catch {
      throw new ControlError("INVALID_IMPORT", 400);
    }
  }
}
