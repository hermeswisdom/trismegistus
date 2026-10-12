import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LUCIDE_FILES, SPRITE_ICONS, type SpriteIconName } from "./icon-paths.ts";

describe("sprite icon paths", () => {
  for (const name of Object.keys(SPRITE_ICONS) as SpriteIconName[]) {
    it(`${name} matches lucide-react's ${LUCIDE_FILES[name]}`, async () => {
      const mod = await import(`lucide-react/dist/esm/icons/${LUCIDE_FILES[name]}.js`);
      const lucide = (mod.__iconNode as [string, Record<string, string>][]).map(([tag, { key: _key, ...attrs }]) => [tag, attrs]);
      assert.deepEqual(SPRITE_ICONS[name], lucide);
    });
  }
  it("styles.css gives .icon lucide's stroke defaults in the components layer", async () => {
    const fs = await import("node:fs");
    const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    assert.match(css, /@layer components \{\s*\.icon \{[^}]*fill: none;[^}]*stroke: currentColor;[^}]*stroke-width: 2;/);
  });
});
