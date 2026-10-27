import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { STREAM_SLUGS } from "./stream-manifest.ts";
import {
  HQ_PROBE_TTL_MS,
  hqStreamAvailable,
  resetStreamStoreForTests,
  setHqBlobProbeForTests,
  streamSignPathname,
} from "./stream-store.ts";

const slug = STREAM_SLUGS[0]!;

afterEach(() => {
  resetStreamStoreForTests();
});

describe("HQ stream pathname", () => {
  it("prefers streams-hq/ when the HQ object is on Blob", async () => {
    setHqBlobProbeForTests((pathname) => pathname === `streams-hq/${slug}.mp3`);
    assert.equal(await streamSignPathname(slug, { hq: true }), `streams-hq/${slug}.mp3`);
    assert.equal(await streamSignPathname(slug), `streams/${slug}.mp3`);
  });

  it("falls back to streams/ when HQ is missing, including before any HQ upload", async () => {
    setHqBlobProbeForTests(() => false);
    assert.equal(await streamSignPathname(slug, { hq: true }), `streams/${slug}.mp3`);
    assert.equal(await streamSignPathname(slug, { hq: true }), `streams/${slug}.mp3`);
  });

  it("treats a failed HQ probe as missing so Auto Mix still gets 128k", async () => {
    setHqBlobProbeForTests(() => {
      throw new Error("blob down");
    });
    assert.equal(await streamSignPathname(slug, { hq: true }), `streams/${slug}.mp3`);
  });

  it("never signs masters/ even if a probe claims it exists", async () => {
    setHqBlobProbeForTests(() => true);
    const path = await streamSignPathname(slug, { hq: true });
    assert.equal(path, `streams-hq/${slug}.mp3`);
    assert.doesNotMatch(path ?? "", /masters/);
    assert.equal(await streamSignPathname("not-a-track", { hq: true }), null);
    assert.equal(await streamSignPathname("../masters/awake", { hq: true }), null);
  });

  it("reuses a HQ probe inside the TTL window", async () => {
    let calls = 0;
    setHqBlobProbeForTests(() => {
      calls += 1;
      return calls === 1;
    });
    assert.equal(await hqStreamAvailable(`streams-hq/${slug}.mp3`, 0), true);
    assert.equal(await hqStreamAvailable(`streams-hq/${slug}.mp3`, HQ_PROBE_TTL_MS - 1), true);
    assert.equal(calls, 1);
    assert.equal(await hqStreamAvailable(`streams-hq/${slug}.mp3`, HQ_PROBE_TTL_MS), false);
    assert.equal(calls, 2);
  });
});
