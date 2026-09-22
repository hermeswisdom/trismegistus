import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { stampPwaVercelHeaders } from "./stamp-pwa-vercel-headers.mjs";

test("stamps no-cache routes onto a Nitro Vercel config", () => {
  const dir = mkdtempSync(join(tmpdir(), "pwa-vercel-"));
  const path = join(dir, "config.json");
  writeFileSync(
    path,
    JSON.stringify({
      version: 3,
      routes: [{ handle: "filesystem" }],
    }),
  );
  assert.equal(stampPwaVercelHeaders(path), true);
  const cfg = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(cfg.routes[0].src, "/sw.js");
  assert.equal(cfg.routes[0].headers["cache-control"], "no-cache");
  assert.equal(cfg.routes[1].src, "/manifest.webmanifest");
  assert.equal(cfg.routes.at(-1).handle, "filesystem");
  assert.equal(stampPwaVercelHeaders(path), false);
});
