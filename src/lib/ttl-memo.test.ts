import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTtlMemo } from "./ttl-memo.ts";

describe("createTtlMemo", () => {
  it("serves one read per TTL window", async () => {
    let t = 0;
    let calls = 0;
    const memo = createTtlMemo(async () => ++calls, 30_000, () => t);
    assert.equal(await memo.get(), 1);
    t = 29_999;
    assert.equal(await memo.get(), 1);
    t = 30_000;
    assert.equal(await memo.get(), 2);
    assert.equal(calls, 2);
  });
  it("shares an in-flight read between concurrent callers", async () => {
    let calls = 0;
    const memo = createTtlMemo(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 5));
      return calls;
    }, 30_000);
    const [a, b, c] = await Promise.all([memo.get(), memo.get(), memo.get()]);
    assert.deepEqual([a, b, c], [1, 1, 1]);
    assert.equal(calls, 1);
  });
  it("invalidate() forces the next read (a write busts the board)", async () => {
    let calls = 0;
    const memo = createTtlMemo(async () => ++calls, 30_000, () => 0);
    await memo.get();
    memo.invalidate();
    assert.equal(await memo.get(), 2);
  });
  it("never stores a read that started before invalidate()", async () => {
    let calls = 0;
    let release: () => void = () => {};
    const memo = createTtlMemo(async () => {
      calls += 1;
      const n = calls;
      if (n === 1) await new Promise<void>((r) => (release = r));
      return n;
    }, 30_000, () => 0);
    const stale = memo.get();
    memo.invalidate();
    release();
    assert.equal(await stale, 1);
    assert.equal(await memo.get(), 2);
    assert.equal(await memo.get(), 2);
  });
  it("does not cache failures", async () => {
    let calls = 0;
    const memo = createTtlMemo(async () => {
      calls += 1;
      if (calls === 1) throw new Error("db down");
      return calls;
    }, 30_000, () => 0);
    await assert.rejects(memo.get());
    assert.equal(await memo.get(), 2);
  });
});
