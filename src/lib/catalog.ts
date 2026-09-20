export type OscKind = "sine" | "triangle" | "sawtooth";

export type TrackSpec = {
  drones: { freq: number; type: OscKind; gain: number; detune: number }[];
  noiseGain: number;
  noiseCutoff: number;
  delayTime: number;
  delayFeedback: number;
  reverbGain: number;
  lfoRate: number;
  lfoDepth: number;
  pulse?: { freq: number; interval: number; gain: number; type: OscKind };
  sparkle?: { freqs: number[]; interval: number; gain: number };
};

export type Release = {
  id: string;
  title: string;
  year: number;
  kind: "LP" | "EP" | "Single";
  catalog: string;
  image: string;
  excerpt: string;
  liner: string;
  recorded: string;
  tracks: { n: string; title: string }[];
  spec: TrackSpec;
};

export const RELEASES: Release[] = [
  {
    id: "after-the-veil",
    title: "After the Veil",
    year: 2026,
    kind: "LP",
    catalog: "HRM-09",
    image: "/images/after-the-veil.jpg",
    excerpt: "Nine movements from the far side of the veil.",
    liner:
      "Recorded between 03:00 and dawn over fourteen nights. Tape was left running after the last musician left. The veil is not a metaphor for secrecy; it is the cloth that hung between this room and the next. TRISMEGISTUS carried the take across.",
    recorded: "Unlisted hall, winter 2025",
    tracks: [
      { n: "01", title: "Threshold" },
      { n: "02", title: "Cloth Over the Mouth" },
      { n: "03", title: "After the Veil" },
      { n: "04", title: "Unlisted Hall" },
      { n: "05", title: "What the Tape Kept" },
      { n: "06", title: "No Civic Name" },
      { n: "07", title: "Low Light, Lower" },
      { n: "08", title: "The Fourth Chair" },
      { n: "09", title: "Remain" },
    ],
    spec: {
      drones: [
        { freq: 55, type: "sine", gain: 0.12, detune: 0 },
        { freq: 82.4, type: "sine", gain: 0.07, detune: 8 },
        { freq: 110, type: "triangle", gain: 0.04, detune: -6 },
      ],
      noiseGain: 0.045,
      noiseCutoff: 420,
      delayTime: 0.48,
      delayFeedback: 0.38,
      reverbGain: 0.42,
      lfoRate: 0.07,
      lfoDepth: 180,
      pulse: { freq: 220, interval: 7200, gain: 0.035, type: "sine" },
      sparkle: { freqs: [880, 1174, 1318], interval: 5400, gain: 0.028 },
    },
  },
  {
    id: "room-4",
    title: "Room 4",
    year: 2025,
    kind: "EP",
    catalog: "HRM-08",
    image: "/images/room-4.jpg",
    excerpt: "A corridor between houses. A door that would not close.",
    liner:
      "Field recordings from a hotel that has since been gutted. The fourth room was never on the floor plan. Fluorescent ballast hum is the spine. TRISMEGISTUS does not open doors; TRISMEGISTUS stands in them.",
    recorded: "East wing, June 2025",
    tracks: [
      { n: "01", title: "Keycard" },
      { n: "02", title: "Room 4" },
      { n: "03", title: "Ajar" },
      { n: "04", title: "Ballast" },
    ],
    spec: {
      drones: [
        { freq: 60, type: "sine", gain: 0.1, detune: 0 },
        { freq: 120, type: "triangle", gain: 0.05, detune: 3 },
        { freq: 90, type: "sine", gain: 0.06, detune: -12 },
      ],
      noiseGain: 0.07,
      noiseCutoff: 780,
      delayTime: 0.31,
      delayFeedback: 0.44,
      reverbGain: 0.28,
      lfoRate: 0.11,
      lfoDepth: 260,
      pulse: { freq: 185, interval: 4100, gain: 0.04, type: "triangle" },
      sparkle: { freqs: [740, 1110], interval: 3800, gain: 0.02 },
    },
  },
  {
    id: "unsent",
    title: "Unsent",
    year: 2025,
    kind: "Single",
    catalog: "HRM-07",
    image: "/images/unsent.jpg",
    excerpt: "A tablet that was never posted. One drop of water on the seal.",
    liner:
      "Written as a reply to a session that did not happen. The envelope on the sleeve is empty. The drop is real. Messengers are not required to deliver every word.",
    recorded: "Desk, March 2025",
    tracks: [{ n: "01", title: "Unsent" }],
    spec: {
      drones: [
        { freq: 49, type: "sine", gain: 0.09, detune: 0 },
        { freq: 98, type: "sine", gain: 0.05, detune: 5 },
      ],
      noiseGain: 0.03,
      noiseCutoff: 280,
      delayTime: 0.72,
      delayFeedback: 0.32,
      reverbGain: 0.55,
      lfoRate: 0.045,
      lfoDepth: 90,
      sparkle: { freqs: [1568, 1975, 2093], interval: 6200, gain: 0.03 },
    },
  },
  {
    id: "low-light-protocol",
    title: "Nigredo",
    year: 2024,
    kind: "LP",
    catalog: "HRM-06",
    image: "/images/low-light.jpg",
    excerpt: "The blackening. Meters only. No overheads.",
    liner:
      "Mixed with the room lights off. Nigredo is not a mood; it is the first operation. If you can read the fader labels, the work has not begun. Sub-harmonics taken from a generator that failed in 1998.",
    recorded: "The desk, autumn 2024",
    tracks: [
      { n: "01", title: "Meters Only" },
      { n: "02", title: "Blackening" },
      { n: "03", title: "Cable, Vein" },
      { n: "04", title: "Failed Generator" },
      { n: "05", title: "No Overheads" },
      { n: "06", title: "Close the Book" },
    ],
    spec: {
      drones: [
        { freq: 41, type: "sine", gain: 0.14, detune: 0 },
        { freq: 61.5, type: "sine", gain: 0.08, detune: 7 },
        { freq: 82, type: "sawtooth", gain: 0.025, detune: -4 },
      ],
      noiseGain: 0.055,
      noiseCutoff: 360,
      delayTime: 0.39,
      delayFeedback: 0.41,
      reverbGain: 0.36,
      lfoRate: 0.09,
      lfoDepth: 140,
      pulse: { freq: 164, interval: 5600, gain: 0.045, type: "sine" },
      sparkle: { freqs: [328, 492, 656], interval: 4800, gain: 0.022 },
    },
  },
  {
    id: "glass-archive",
    title: "Speculum",
    year: 2023,
    kind: "EP",
    catalog: "HRM-04",
    image: "/images/glass-archive.jpg",
    excerpt: "A mirror that records instead of reflecting.",
    liner:
      "Contact mics on antique window glass. Each crack is a different high partial. The speculum is the pane, not the file. What is below is silvered here.",
    recorded: "North window, 2023",
    tracks: [
      { n: "01", title: "Silvering" },
      { n: "02", title: "Partial" },
      { n: "03", title: "The Pane" },
      { n: "04", title: "Archive" },
    ],
    spec: {
      drones: [
        { freq: 73.4, type: "sine", gain: 0.07, detune: 0 },
        { freq: 146.8, type: "triangle", gain: 0.045, detune: 11 },
        { freq: 220.4, type: "sine", gain: 0.03, detune: -9 },
      ],
      noiseGain: 0.038,
      noiseCutoff: 1400,
      delayTime: 0.22,
      delayFeedback: 0.29,
      reverbGain: 0.48,
      lfoRate: 0.16,
      lfoDepth: 420,
      sparkle: { freqs: [1174, 1396, 1760, 2093], interval: 2600, gain: 0.036 },
    },
  },
  {
    id: "first-silence",
    title: "Prima Materia",
    year: 2022,
    kind: "LP",
    catalog: "HRM-01",
    image: "/images/first-silence.jpg",
    excerpt: "The first record. A nave, a candle, the unworked stone.",
    liner:
      "The room was a chapel that had already been deconsecrated. One candle. No choir. This is the only work with a seated figure on the sleeve — not the messenger. Prima materia: that from which the rest is drawn.",
    recorded: "Deconsecrated chapel, 2022",
    tracks: [
      { n: "01", title: "Nave" },
      { n: "02", title: "Wick" },
      { n: "03", title: "Prima Materia" },
      { n: "04", title: "Stone" },
      { n: "05", title: "Unnamed" },
      { n: "06", title: "Leave the Light" },
    ],
    spec: {
      drones: [
        { freq: 36.7, type: "sine", gain: 0.11, detune: 0 },
        { freq: 73.4, type: "sine", gain: 0.05, detune: 4 },
      ],
      noiseGain: 0.022,
      noiseCutoff: 210,
      delayTime: 0.86,
      delayFeedback: 0.26,
      reverbGain: 0.62,
      lfoRate: 0.03,
      lfoDepth: 60,
      sparkle: { freqs: [392, 523, 784], interval: 8800, gain: 0.025 },
    },
  },
];

export const FEATURED_ID = "after-the-veil";

export function getRelease(id: string) {
  return RELEASES.find((r) => r.id === id);
}

export const TRANSMISSIONS = [
  {
    date: "12.09.26",
    title: "The fourth house",
    body: "The fourth room was never on the floor plan. I recorded anyway. The take is on After the Veil, movement four. Do not look for the building. The messenger does not live there.",
  },
  {
    date: "28.06.26",
    title: "No civic name",
    body: "A magazine asked for a portrait. I sent the back of a coat. They ran it under the name TRISMEGISTUS. That is the last interview. Thrice-great is an office, not a biography.",
  },
  {
    date: "03.03.25",
    title: "Unsent",
    body: "The tablet was written. The tablet was sealed. The tablet was not posted. The drop of water was not staged. Not every word is for the other world.",
  },
  {
    date: "19.11.24",
    title: "Nigredo",
    body: "If you can read the fader labels, the work has not begun. This is not a mood. It is the first operation.",
  },
];
