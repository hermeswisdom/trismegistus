/**
 * Nitro's Vercel output does not copy root vercel.json headers. Run after
 * `vite build` so /sw.js and /manifest.webmanifest stay no-cache.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = join(ROOT, ".vercel/output/config.json");

export function stampPwaVercelHeaders(configPath = CONFIG_PATH) {
  if (!existsSync(configPath)) return false;
  const cfg = JSON.parse(readFileSync(configPath, "utf8"));
  const routes = Array.isArray(cfg.routes) ? cfg.routes : [];
  if (routes.some((route) => route?.src === "/sw.js")) return false;
  cfg.routes = [
    {
      src: "/sw.js",
      headers: {
        "cache-control": "no-cache",
        "service-worker-allowed": "/",
      },
      continue: true,
    },
    {
      src: "/manifest.webmanifest",
      headers: {
        "content-type": "application/manifest+json; charset=utf-8",
        "cache-control": "no-cache",
      },
      continue: true,
    },
    ...routes,
  ];
  writeFileSync(configPath, `${JSON.stringify(cfg, null, 2)}\n`);
  return true;
}

const invoked =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) stampPwaVercelHeaders();
