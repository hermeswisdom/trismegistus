import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LIST_QUEUE_QUERY,
  dryRunMessage,
  formatQueueRows,
  parseListQueueArgs,
} from "./list-queue.mjs";

test("defaults to waiting, non-json, live run", () => {
  assert.deepEqual(parseListQueueArgs([]), {
    help: false,
    status: "waiting",
    json: false,
    dryRun: false,
  });
});

test("parses --status, --json and --dry-run", () => {
  assert.deepEqual(parseListQueueArgs(["--status=live", "--json", "--dry-run"]), {
    help: false,
    status: "live",
    json: true,
    dryRun: true,
  });
  assert.equal(parseListQueueArgs(["--status", "rejected"]).status, "rejected");
});

test("rejects an unknown status and unknown flags", () => {
  assert.throws(() => parseListQueueArgs(["--status", "published"]), /invalid --status/);
  assert.throws(() => parseListQueueArgs(["--nope"]), /unknown argument/);
});

test("query only ever reads upload_queue for one status", () => {
  assert.match(LIST_QUEUE_QUERY, /from upload_queue where status = \$1/);
  assert.doesNotMatch(LIST_QUEUE_QUERY, /insert|update|delete/i);
});

test("formats rows and the empty queue", () => {
  assert.equal(formatQueueRows([]), "queue: nothing waiting");
  const out = formatQueueRows([
    {
      title: "New Song",
      status: "waiting",
      created_at: "2026-10-19T08:00:00.000Z",
      mp3_size_bytes: 5 * 1024 * 1024,
      original_filename: "new-song.mp3",
      mp3_blob_pathname: "queue/abc.mp3",
      uploaded_by: "smlc@me.com",
      notes: "first take",
    },
  ]);
  assert.match(out, /New Song \[waiting\]/);
  assert.match(out, /queue\/abc\.mp3/);
});

test("dry-run message names the env it needs, never a value", () => {
  const msg = dryRunMessage({ status: "waiting" });
  assert.match(msg, /DATABASE_URL/);
  assert.match(msg, /status='waiting'/);
});
