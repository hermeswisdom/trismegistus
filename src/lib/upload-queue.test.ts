import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ADMIN_EMAILS,
  MAX_MP3_BYTES,
  buildQueueRecord,
  formatBytes,
  formatDuration,
  isAdminEmail,
  parseAdminEmails,
  queueBlobPath,
  titleFromFilename,
  validateCoverFile,
  validateMp3File,
  validateQueueBlobPathname,
} from "./upload-queue.ts";
import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks.ts";

const TRACKS = SOUNDCLOUD_TRACKS as unknown as Array<{id:string;title:string;downloadKey?:string}>;

const ID = "123e4567-e89b-42d3-a456-426614174000";

describe("admin allowlist", () => {
  it("defaults to Atman's account when ADMIN_EMAILS is unset", () => {
    assert.deepEqual(parseAdminEmails(undefined), [...DEFAULT_ADMIN_EMAILS]);
    assert.equal(isAdminEmail("smlc@me.com", undefined), true);
    assert.equal(isAdminEmail("SMLC@me.com ", undefined), true);
  });
  it("uses a set allowlist and rejects everyone else", () => {
    assert.equal(isAdminEmail("a@example.com", "a@example.com, b@example.com"), true);
    assert.equal(isAdminEmail("smlc@me.com", "a@example.com"), false);
    assert.equal(isAdminEmail(null, undefined), false);
    assert.equal(isAdminEmail("dev@example.com", undefined), false);
    assert.equal(isAdminEmail("", undefined), false);
  });
});

describe("file validation", () => {
  it("accepts a normal MP3 and rejects wrong type / oversize / empty", () => {
    assert.equal(validateMp3File({ filename: "Song.MP3", contentType: "audio/mpeg", sizeBytes: 5_000_000 }).ok, true);
    assert.equal(validateMp3File({ filename: "song.wav", contentType: "audio/wav", sizeBytes: 10 }).ok, false);
    assert.equal(validateMp3File({ filename: "song.mp3", contentType: "image/png", sizeBytes: 10 }).ok, false);
    assert.equal(validateMp3File({ filename: "song.mp3", contentType: "audio/mpeg", sizeBytes: MAX_MP3_BYTES + 1 }).ok, false);
    assert.equal(validateMp3File({ filename: "song.mp3", contentType: "audio/mpeg", sizeBytes: 0 }).ok, false);
  });
  it("accepts jpg/png/webp covers only, capped", () => {
    assert.equal(validateCoverFile({ filename: "c.PNG", contentType: "image/png", sizeBytes: 10 }).ok, true);
    assert.equal(validateCoverFile({ filename: "c.gif", contentType: "image/gif", sizeBytes: 10 }).ok, false);
    assert.equal(validateCoverFile({ filename: "c.jpg", contentType: "image/jpeg", sizeBytes: 11 * 1024 * 1024 }).ok, false);
  });
});

describe("blob pathnames", () => {
  it("are queue/<uuid> and never carry the original filename", () => {
    assert.equal(queueBlobPath("mp3", ID, "../../My Secret Song.mp3"), `queue/${ID}.mp3`);
    assert.equal(queueBlobPath("cover", ID, "image/png"), `queue/${ID}-cover.png`);
    assert.equal(queueBlobPath("mp3", "not-a-uuid", "x.mp3"), null);
  });
  it("token gate rejects masters/, streams/ and traversal paths", () => {
    assert.deepEqual(validateQueueBlobPathname(`queue/${ID}.mp3`), { ok: true, kind: "mp3" });
    assert.deepEqual(validateQueueBlobPathname(`queue/${ID}-cover.webp`), { ok: true, kind: "cover" });
    assert.equal(validateQueueBlobPathname("masters/the-sleepers-waking.mp3").ok, false);
    assert.equal(validateQueueBlobPathname("streams/x.mp3").ok, false);
    assert.equal(validateQueueBlobPathname(`queue/../masters/x.mp3`).ok, false);
    assert.equal(validateQueueBlobPathname(`queue/${ID}.exe`).ok, false);
  });
});

describe("queue record shape", () => {
  it("derives the title from the filename and starts waiting", () => {
    const rec = buildQueueRecord(
      {
        id: ID,
        originalFilename: "my_new-song (final).mp3",
        mp3Pathname: `queue/${ID}.mp3`,
        mp3Url: "https://blob.example/queue/x",
        mp3SizeBytes: 123,
      },
      "smlc@me.com",
    );
    assert.equal(rec.title, "my new song (final)");
    assert.equal(rec.status, "waiting");
    assert.equal(rec.uploadedBy, "smlc@me.com");
    assert.equal(rec.coverBlobPathname, null);
  });
  it("prefers a title override and keeps notes", () => {
    const rec = buildQueueRecord(
      {
        id: ID, titleOverride: "  Real Title ", notes: " take 2 ",
        originalFilename: "x.mp3", mp3Pathname: `queue/${ID}.mp3`,
        coverPathname: `queue/${ID}-cover.jpg`, coverSizeBytes: 9,
      },
      "smlc@me.com",
    );
    assert.equal(rec.title, "Real Title");
    assert.equal(rec.notes, "take 2");
    assert.equal(rec.coverBlobPathname, `queue/${ID}-cover.jpg`);
  });
  it("rejects records pointing outside queue/<id>", () => {
    const base = { id: ID, originalFilename: "x.mp3" };
    assert.throws(() => buildQueueRecord({ ...base, mp3Pathname: "masters/x.mp3" }, "a@b.c"), /Invalid MP3/);
    assert.throws(
      () => buildQueueRecord({ ...base, id: "123e4567-e89b-42d3-a456-426614174001", mp3Pathname: `queue/${ID}.mp3` }, "a@b.c"),
      /Invalid MP3/,
    );
    assert.throws(() => buildQueueRecord({ ...base, originalFilename: "x.wav", mp3Pathname: `queue/${ID}.mp3` }, "a@b.c"), /\.mp3/);
  });
});

describe("wall catalogue is untouched by the queue", () => {
  it("no queue record becomes or mutates a wall track", () => {
    const before = TRACKS.map((t) => t.id);
    const rec = buildQueueRecord(
      { id: ID, originalFilename: "brand-new-song.mp3", mp3Pathname: `queue/${ID}.mp3` },
      "smlc@me.com",
    );
    assert.deepEqual(TRACKS.map((t) => t.id), before);
    assert.equal(TRACKS.some((t) => t.id === rec.id || t.title === rec.title), false);
    assert.equal(TRACKS.some((t) => t.downloadKey?.startsWith("queue/")), false);
  });
  it("formats size and duration for the list", () => {
    assert.equal(formatBytes(5 * 1024 * 1024), "5.0 MB");
    assert.equal(formatDuration(185), "3:05");
    assert.equal(formatDuration(null), "—");
  });
  it("titleFromFilename falls back sensibly", () => {
    assert.equal(titleFromFilename("---.mp3"), "Untitled");
    assert.equal(titleFromFilename("/a/b/Calm_Turns-Steel.mp3"), "Calm Turns Steel");
  });
});
