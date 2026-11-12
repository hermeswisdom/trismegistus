/**
 * Hermes Atlas types. Data only — no DOM or server imports.
 */

export type Entry = {
  id: string;
  name: string;
  group: string;
  era: string;
  year: number | null;
  summary: string;
  story: string;
  symbols: string;
  refs: string[];
  status: string;
  image: string;
};

export type Edge = {
  a: string;
  b: string;
  type: string;
  note: string;
};

export type SourceRef = {
  title: string;
  href: string;
};

export type Period = {
  name: string;
  range: readonly number[];
  label: string;
  note: string;
};

export type Tour = {
  title: string;
  note: string;
  ids: readonly string[];
};

export type ReadingPanel = {
  heading: string;
  intro: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
  refs: readonly string[];
};

export type WisdomTheme = {
  title: string;
  body: string;
  ids: readonly string[];
};

export type DeeperRoute = {
  title: string;
  body: string;
  ids: readonly string[];
};

export const HERMES_PATH = "/hermes";
export const HERMES_TITLE = "Hermes · Atlas of Names, Wisdom & Worlds";
export const HERMES_DESCRIPTION =
  "An explorable constellation of 158 figures, texts, symbols and traditions, with 329 labelled connections. Follow Hermes into Egypt, Rome, Islamic learning and later wisdom traditions—without confusing historical contact, religious identification and resemblance.";
