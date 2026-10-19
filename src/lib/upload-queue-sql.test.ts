import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  DELETE_WAITING_QUEUE_SQL,
  INSERT_QUEUE_SQL,
  LIST_QUEUE_SQL,
} from "./upload-queue-sql.ts";
import { buildQueueRecord } from "./upload-queue.ts";

// Real migration + queries on embedded Postgres, like visitor-sql.test.ts.
const MIGRATION = readFileSync(
  new URL("../../migrations/0011_upload_queue.sql", import.meta.url),
  "utf8",
);
const ID = "123e4567-e89b-42d3-a456-426614174000";
let db: PGlite;

async function insert(id = ID, title = "Queued Song") {
  const rec = buildQueueRecord(
    { id, titleOverride: title, originalFilename: "queued-song.mp3", mp3Pathname: `queue/${id}.mp3`, mp3SizeBytes: 42 },
    "smlc@me.com",
  );
  const res = await db.query(INSERT_QUEUE_SQL, [
    rec.id, rec.title, rec.originalFilename, rec.mp3BlobPathname, rec.mp3BlobUrl,
    rec.mp3SizeBytes, rec.coverBlobPathname, rec.coverBlobUrl, rec.coverSizeBytes,
    rec.durationSeconds, rec.notes, rec.status, rec.uploadedBy,
  ]);
  return res.rows[0] as { status: string; title: string };
}

describe("upload queue SQL (PGLite)", () => {
  before(async () => {
    db = new PGlite();
    await db.waitReady;
    await db.exec(MIGRATION);
    await db.exec(MIGRATION); // idempotent re-run, like a re-deploy
  });
  after(async () => {
    await db.close();
  });

  it("creates a waiting record and lists it newest first", async () => {
    const row = await insert();
    assert.equal(row.status, "waiting");
    assert.equal(row.title, "Queued Song");
    const list = await db.query(LIST_QUEUE_SQL, ["waiting"]);
    assert.equal(list.rows.length, 1);
  });

  it("rejects an invalid status in SQL", async () => {
    await assert.rejects(() =>
      db.query("update upload_queue set status = 'published' where id = $1", [ID]),
    );
  });

  it("delete only removes waiting items and returns their blob paths", async () => {
    await db.query("update upload_queue set status = 'in_progress' where id = $1", [ID]);
    const blocked = await db.query(DELETE_WAITING_QUEUE_SQL, [ID]);
    assert.equal(blocked.rows.length, 0);
    await db.query("update upload_queue set status = 'waiting' where id = $1", [ID]);
    const removed = await db.query<{ mp3BlobPathname: string }>(DELETE_WAITING_QUEUE_SQL, [ID]);
    assert.equal(removed.rows.length, 1);
    assert.equal(removed.rows[0].mp3BlobPathname, `queue/${ID}.mp3`);
    const list = await db.query(LIST_QUEUE_SQL, ["waiting"]);
    assert.equal(list.rows.length, 0);
  });
});
