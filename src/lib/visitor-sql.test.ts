import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { HEARTBEAT_SQL, PRUNE_SQL, READ_SQL } from "./visitor-sql.ts";

// Runs the real migration + queries on embedded Postgres (PGLite) — the same
// engine the preview fallback uses — so the counting rules are tested in SQL.
const MIGRATION = readFileSync(
  new URL("../../migrations/0009_site_visitors.sql", import.meta.url),
  "utf8",
);
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

let db: PGlite;

type Row = { online: number | bigint; total: number | bigint };
const num = (v: number | bigint | string) => Number(v);

async function beat(id: string) {
  const res = await db.query<Row>(HEARTBEAT_SQL, [id]);
  return { online: num(res.rows[0].online), total: num(res.rows[0].total) };
}

async function age(id: string, column: "last_seen" | "counted_at", interval: string) {
  await db.query(
    `update site_presence set ${column} = ${column} - interval '${interval}' where visitor_id = $1`,
    [id],
  );
}

describe("visitor SQL (PGLite)", () => {
  before(async () => {
    db = new PGlite();
    await db.waitReady;
    await db.exec(MIGRATION);
    await db.exec(MIGRATION); // idempotent, like a re-run deploy
  });
  after(async () => {
    await db.close();
  });

  it("starts at zero with the seeded total row", async () => {
    const res = await db.query<Row>(READ_SQL);
    assert.equal(num(res.rows[0].total), 0);
    assert.equal(num(res.rows[0].online), 0);
  });

  it("counts a new browser once and shows it online", async () => {
    assert.deepEqual(await beat(A), { online: 1, total: 1 });
  });

  it("does not recount repeat heartbeats within 24h", async () => {
    assert.deepEqual(await beat(A), { online: 1, total: 1 });
    await age(A, "counted_at", "23 hours");
    assert.deepEqual(await beat(A), { online: 1, total: 1 });
  });

  it("adds a second browser to both counts", async () => {
    assert.deepEqual(await beat(B), { online: 2, total: 2 });
  });

  it("drops a browser from online after ~2 minutes of silence", async () => {
    await age(B, "last_seen", "3 minutes");
    assert.deepEqual(await beat(A), { online: 1, total: 2 });
  });

  it("recounts a browser seen again after 24h", async () => {
    await age(B, "counted_at", "25 hours");
    assert.deepEqual(await beat(B), { online: 2, total: 3 });
  });

  it("prunes presence rows older than ~26h but keeps the total", async () => {
    await beat(C);
    await age(C, "last_seen", "27 hours");
    await db.exec(PRUNE_SQL);
    const left = await db.query<{ visitor_id: string }>(
      "select visitor_id from site_presence order by visitor_id",
    );
    assert.deepEqual(
      left.rows.map((r) => r.visitor_id),
      [A, B],
    );
    const res = await db.query<Row>(READ_SQL);
    assert.equal(num(res.rows[0].total), 4);
  });
});
