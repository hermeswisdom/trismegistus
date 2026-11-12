import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CORE_NAMES,
  DEEPER_ROUTES,
  DEEPER_SOURCE_KEYS,
  EDGES,
  ENTRIES,
  EVIDENCE_LAYERS,
  EXTRA_ALIASES,
  GROUPS,
  HERMES_PATH,
  IDRIS_ROWS,
  READINGS,
  REFS,
  SOURCE_KEYS,
  STORY_IDS,
  SYMBOL_ROWS,
  TOURS,
  TRADITION_NAMES,
  WISDOM_THEMES,
  entryById,
  layerOf,
  primaryTradition,
  traditionsOf,
} from "./index.ts";

describe("Hermes Atlas catalogue", () => {
  it("has 158 entries, 329 edges, 17 traditions, 3 evidence layers, 8 tours and 16 readings", () => {
    assert.equal(ENTRIES.length, 158);
    assert.equal(new Set(ENTRIES.map((entry) => entry.id)).size, 158);
    assert.equal(EDGES.length, 329);
    assert.equal(TRADITION_NAMES.length, 17);
    assert.equal(EVIDENCE_LAYERS.length, 3);
    assert.deepEqual([...EVIDENCE_LAYERS], [
      "Attested history",
      "Tradition / identification",
      "Modern interpretation / fringe",
    ]);
    assert.equal(TOURS.length, 8);
    assert.equal(Object.keys(READINGS).length, 16);
    assert.equal(HERMES_PATH, "/hermes");
  });

  it("resolves every edge endpoint, tour stop, reading, story and source key to an entry or ref", () => {
    const ids = new Set(ENTRIES.map((entry) => entry.id));
    for (const edge of EDGES) {
      assert.ok(ids.has(edge.a), `edge.a missing: ${edge.a}`);
      assert.ok(ids.has(edge.b), `edge.b missing: ${edge.b}`);
      assert.ok(edge.a !== edge.b, `self-edge ${edge.a}`);
      assert.ok(edge.type.length > 0, `empty type ${edge.a}–${edge.b}`);
    }
    for (const entry of ENTRIES) {
      assert.equal(entryById(entry.id).id, entry.id);
      assert.ok(GROUPS.includes(entry.group as (typeof GROUPS)[number]), entry.group);
      assert.ok(entry.refs.length > 0, entry.id);
      for (const key of entry.refs) {
        assert.ok(REFS[key], `${entry.id} ref ${key}`);
      }
      const traditions = traditionsOf(entry);
      assert.ok(traditions.length > 0, entry.id);
      assert.ok(TRADITION_NAMES.includes(primaryTradition(entry) as (typeof TRADITION_NAMES)[number]), entry.id);
      assert.ok(EVIDENCE_LAYERS.includes(layerOf(entry)), entry.id);
    }
    for (const tour of TOURS) {
      assert.ok(tour.ids.length > 0, tour.title);
      for (const id of tour.ids) assert.ok(ids.has(id), `${tour.title} ${id}`);
    }
    for (const [id, panel] of Object.entries(READINGS)) {
      assert.ok(ids.has(id), `reading ${id}`);
      assert.ok(panel.columns.length > 0, id);
      assert.ok(panel.rows.length > 0, id);
      for (const key of panel.refs) assert.ok(REFS[key], `${id} ${key}`);
    }
    for (const id of [...CORE_NAMES, ...STORY_IDS]) assert.ok(ids.has(id), id);
    for (const theme of WISDOM_THEMES) {
      for (const id of theme.ids) assert.ok(ids.has(id), `${theme.title} ${id}`);
    }
    for (const route of DEEPER_ROUTES) {
      for (const id of route.ids) assert.ok(ids.has(id), `${route.title} ${id}`);
    }
    for (const [, id] of EXTRA_ALIASES) assert.ok(ids.has(id), id);
    for (const key of [...SOURCE_KEYS, ...DEEPER_SOURCE_KEYS]) assert.ok(REFS[key], key);
    assert.equal(SYMBOL_ROWS.length, 16);
    assert.equal(IDRIS_ROWS.length, 6);
  });
});
