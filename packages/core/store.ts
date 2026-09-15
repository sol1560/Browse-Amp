import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { ControlError, type Principal, type Session } from "./types.js";

// One process owns this embedded PostgreSQL instance. Never share its data directory.
export class Store {
  constructor(
    readonly db: PGlite,
    readonly now = () => Date.now(),
  ) {}
  async init() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id text PRIMARY KEY, owner text NOT NULL, actor text NOT NULL,
        name text NOT NULL, platform text NOT NULL, status text NOT NULL,
        epoch integer NOT NULL, lease_until double precision NOT NULL,
        expires_at double precision NOT NULL, creation_key text NOT NULL,
        UNIQUE(owner, creation_key)
      );
      CREATE TABLE IF NOT EXISTS commands (
        session_id text NOT NULL REFERENCES sessions(id), request_id text NOT NULL,
        digest text NOT NULL, outcome text NOT NULL,
        PRIMARY KEY(session_id, request_id)
      );
    `);
    // Local browser processes cannot be reattached safely after a service restart.
    await this.db.exec(
      "UPDATE sessions SET status='stopped', epoch=epoch+1 WHERE status != 'stopped'; UPDATE commands SET outcome='OUTCOME_UNKNOWN' WHERE outcome='running';",
    );
  }
  async create(p: Principal, key: string, name: string, platform = "browser") {
    const result = await this.db.query<Session>(
      `INSERT INTO sessions
      VALUES ($1,$2,$3,$4,$8,'starting',1,$5,$6,$7)
      ON CONFLICT(owner,creation_key) DO NOTHING RETURNING *`,
      [
        randomUUID(),
        p.user,
        p.actor,
        name,
        this.now() + 60_000,
        this.now() + 30 * 60_000,
        key,
        platform,
      ],
    );
    if (result.rows[0]) return { session: result.rows[0], created: true };
    const previous = await this.db.query<Session>(
      "SELECT * FROM sessions WHERE owner=$1 AND creation_key=$2",
      [p.user, key],
    );
    const session = previous.rows[0];
    if (
      !session ||
      (session.actor !== p.actor && !p.human) ||
      session.name !== name ||
      session.platform !== platform
    )
      throw new ControlError("IDEMPOTENCY_CONFLICT");
    return { session, created: false };
  }
  async get(p: Principal, id: string) {
    const { rows } = await this.db.query<Session>(
      "SELECT * FROM sessions WHERE id=$1 AND owner=$2",
      [id, p.user],
    );
    const s = rows[0];
    if (!s || (!p.human && s.actor !== p.actor))
      throw new ControlError("NOT_FOUND", 404);
    return s;
  }
  async list(p: Principal) {
    const { rows } = await this.db.query<Session>(
      "SELECT * FROM sessions WHERE owner=$1 AND ($2 OR actor=$3) ORDER BY expires_at DESC",
      [p.user, p.human, p.actor],
    );
    return rows;
  }
  async assertControl(
    p: Principal,
    id: string,
    epoch: number,
    deadline: number,
  ) {
    const s = await this.get(p, id);
    if (s.status !== "ready" || s.expires_at <= this.now())
      throw new ControlError("SESSION_NOT_READY");
    if (deadline <= this.now()) throw new ControlError("DEADLINE_EXCEEDED");
    if (s.actor !== p.actor || s.epoch !== epoch || s.lease_until <= this.now())
      throw new ControlError("CONTROL_LOST");
    return s;
  }
  async claim(
    p: Principal,
    id: string,
    expectedEpoch: number,
    actor = p.actor,
  ) {
    await this.get(p, id);
    if (!p.human && actor !== p.actor) throw new ControlError("FORBIDDEN", 403);
    const { rows } = await this.db.query<Session>(
      `UPDATE sessions
      SET actor=$1, epoch=epoch+1, lease_until=$2
      WHERE id=$3 AND epoch=$4 AND status='ready' AND expires_at>$5
      AND ($6 OR actor=$7) RETURNING *`,
      [
        actor,
        this.now() + 60_000,
        id,
        expectedEpoch,
        this.now(),
        p.human,
        p.actor,
      ],
    );
    if (!rows[0]) throw new ControlError("CONTROL_CONFLICT");
    return rows[0];
  }
  async stop(id: string) {
    await this.db.query(
      "UPDATE sessions SET status='stopped', epoch=epoch+1 WHERE id=$1",
      [id],
    );
  }
}
