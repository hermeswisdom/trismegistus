import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { blobHostFromToken, sameOriginStreamPath, streamVia } from "./stream-proxy.ts";

const HOST = "abcdef123.private.blob.vercel-storage.com";

describe("same-origin streams", () => {
  it("derives only the store host from a token", () => {
    assert.equal(blobHostFromToken("vercel_blob_rw_AbCdEf123_secretpart"), HOST);
    assert.equal(blobHostFromToken("nope"), null);
    assert.equal(blobHostFromToken(undefined), null);
    assert.doesNotMatch(blobHostFromToken("vercel_blob_rw_AbCdEf123_secretpart") ?? "", /secret/);
  });

  it("maps a presigned streams/ URL to our /media/streams/ path, keeping the signature", () => {
    assert.equal(
      sameOriginStreamPath(`https://${HOST}/streams/awake.mp3?vercel-blob-signature=x&exp=1`, HOST),
      "/media/streams/awake.mp3?vercel-blob-signature=x&exp=1",
    );
  });

  it("never maps masters/, other hosts or odd paths", () => {
    assert.equal(sameOriginStreamPath(`https://${HOST}/masters/awake.mp3?s=1`, HOST), null);
    assert.equal(sameOriginStreamPath(`https://${HOST}/streams/../masters/a.mp3`, HOST), null);
    assert.equal(sameOriginStreamPath(`https://evil.example/streams/awake.mp3`, HOST), null);
    assert.equal(sameOriginStreamPath(`http://${HOST}/streams/awake.mp3`, HOST), null);
    assert.equal(sameOriginStreamPath(`https://${HOST}/streams/awake.mp3`, null), null);
    assert.equal(sameOriginStreamPath("not a url", HOST), null);
  });

  it("?stream=direct opts back into the cross-origin redirect", () => {
    assert.equal(streamVia("?stream=direct"), "direct");
    assert.equal(streamVia("?qc=1"), "same-origin");
    assert.equal(streamVia(null), "same-origin");
  });
});
