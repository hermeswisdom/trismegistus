import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseDownloadSearch } from "./download-search.ts";

describe("parseDownloadSearch", () => {
  it("reads session, receipt, cancel, and tablet", () => {
    assert.deepEqual(
      parseDownloadSearch({
        session_id: " cs_test_1 ",
        cancelled: "1",
        tablet: "the-sleepers-waking",
      }),
      {
        session_id: "cs_test_1",
        cancelled: 1,
        tablet: "the-sleepers-waking",
      },
    );
    assert.deepEqual(parseDownloadSearch({ receipt: "aabbcc" }), {
      receipt: "aabbcc",
    });
    assert.deepEqual(parseDownloadSearch({}), {});
  });
});
