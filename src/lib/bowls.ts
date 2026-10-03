/**
 * Healing-sounds catalogue for the Sound Bowls section.
 *
 * Audio is synthesized in the browser (see bowl-synth.ts). There are no
 * third-party recordings and no licensed samples — every sitting is a
 * singing-bowl voice built from layered inharmonic partials, a strike,
 * a long decay, and a gentle loop.
 */

export const BOWLS_PATH = "/bowls";
export const BOWLS_SECTION_ID = "bowls";

export const BOWLS_DISCLAIMER =
  "These notes describe traditional or commonly claimed uses, not medical facts. This is not medical advice and is not a treatment for any condition.";

export const BOWL_TIMERS = [
  { minutes: 5, label: "5 min" },
  { minutes: 10, label: "10 min" },
  { minutes: 20, label: "20 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 0, label: "Loop" },
] as const;

export type BowlKind = "solfeggio" | "chakra" | "earth" | "rest";
export type BowlVoice = "bowl" | "binaural";

export type Bowl = {
  id: string;
  name: string;
  /** Named tone or beat shown on the card (unique across the set). */
  hz: number;
  hzLabel: string;
  note?: string;
  chakra?: string;
  kind: BowlKind;
  voice: BowlVoice;
  /** Fundamental the synth actually sounds. */
  carrierHz: number;
  /** Binaural difference in Hz (right ear − left ear). */
  beatHz?: number;
  use: string;
  listen: string;
};

export const BOWL_KINDS: { id: BowlKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "solfeggio", label: "Solfeggio" },
  { id: "chakra", label: "Chakra" },
  { id: "earth", label: "Earth" },
  { id: "rest", label: "Rest" },
];

export const BOWLS: Bowl[] = [
  {
    id: "foundation-174",
    name: "Foundation",
    hz: 174,
    hzLabel: "174 Hz",
    note: "F3",
    kind: "solfeggio",
    voice: "bowl",
    carrierHz: 174,
    use: "Traditionally associated with the lowest solfeggio tone — a foundation pitch many people sit with when they want a sense of physical ease, security, and relief from held tension.",
    listen:
      "A struck bowl with a long natural decay. Sit or lie down and let it loop. Ten to twenty minutes is a common sitting. Speakers or headphones both work.",
  },
  {
    id: "regeneration-285",
    name: "Regeneration",
    hz: 285,
    hzLabel: "285 Hz",
    note: "C♯4",
    kind: "solfeggio",
    voice: "bowl",
    carrierHz: 285,
    use: "Many people use 285 Hz when they want a feeling of repair and warmth in the body. In solfeggio teaching it is talked about as a tone of tissue and field regeneration — claimed, not proven.",
    listen:
      "Let the strike bloom, then rest in the decay. Fifteen minutes on loop is plenty. Comfortable volume; this one is mid and present.",
  },
  {
    id: "liberation-396",
    name: "Liberation",
    hz: 396,
    hzLabel: "396 Hz",
    note: "G4",
    kind: "solfeggio",
    voice: "bowl",
    carrierHz: 396,
    use: "The solfeggio UT. Traditionally associated with loosening fear and guilt, and with a return to a simpler ground. Many people use it at the start of a sitting.",
    listen:
      "Play it as an opening bowl. Five to twenty minutes. Breathe out longer than you breathe in, if that helps you settle.",
  },
  {
    id: "change-417",
    name: "Facilitating Change",
    hz: 417,
    hzLabel: "417 Hz",
    note: "A♭4",
    kind: "solfeggio",
    voice: "bowl",
    carrierHz: 417,
    use: "The solfeggio RE. Traditionally associated with undoing stuck situations and making space for a new pattern. Many people sit with it when they want to mark a change.",
    listen:
      "A clear mid bowl. Ten to twenty minutes. Sit upright if you are using it to begin something; lie down if you are letting something go.",
  },
  {
    id: "miracle-528",
    name: "Miracle",
    hz: 528,
    hzLabel: "528 Hz",
    note: "C5",
    kind: "solfeggio",
    voice: "bowl",
    carrierHz: 528,
    use: "The solfeggio MI, often called the 'love' or 'miracle' tone. Traditionally associated with transformation, heart-openness, and repair. Widely used; still a claimed use, not a medical fact.",
    listen:
      "This bowl is bright. Keep the volume gentle. Ten to twenty minutes, or loop it under evening light. Headphones bring out the shimmer.",
  },
  {
    id: "connection-639",
    name: "Connection",
    hz: 639,
    hzLabel: "639 Hz",
    note: "E♭5",
    chakra: "Heart",
    kind: "solfeggio",
    voice: "bowl",
    carrierHz: 639,
    use: "The solfeggio FA. Traditionally associated with connection — to other people, and to one's own feeling life. Many people place it at the heart.",
    listen:
      "A singing mid-high bowl. Sit with a hand on the chest if that is your custom. Ten to twenty minutes. Speakers in a quiet room work well.",
  },
  {
    id: "expression-741",
    name: "Expression",
    hz: 741,
    hzLabel: "741 Hz",
    note: "F♯5",
    chakra: "Throat",
    kind: "solfeggio",
    voice: "bowl",
    carrierHz: 741,
    use: "The solfeggio SOL. Traditionally associated with expression, cleansing, and waking intuition. Many people use it when they want to speak more clearly — to themselves first.",
    listen:
      "A higher bowl with a quick shimmer. Keep it quiet. Five to fifteen minutes is enough; longer if you like the brightness.",
  },
  {
    id: "intuition-852",
    name: "Returning to Source",
    hz: 852,
    hzLabel: "852 Hz",
    note: "A♭5",
    chakra: "Third eye",
    kind: "solfeggio",
    voice: "bowl",
    carrierHz: 852,
    use: "The solfeggio LA. Traditionally associated with inner order and a return toward the third eye. Many people use it for a short, inward sit.",
    listen:
      "Eyes closed, low light. Headphones help the high partials sit in the head without filling the room. Five to twenty minutes.",
  },
  {
    id: "unity-963",
    name: "Unity",
    hz: 963,
    hzLabel: "963 Hz",
    note: "B5",
    chakra: "Crown",
    kind: "solfeggio",
    voice: "bowl",
    carrierHz: 963,
    use: "The solfeggio SI, the highest of the common set. Traditionally associated with unity, the crown, and a sense of the divine. A claimed spiritual use, not a medical fact.",
    listen:
      "The brightest bowl here. Very moderate volume. A short sit (five to ten minutes) is traditional; loop only if the brightness stays kind.",
  },
  {
    id: "root-128",
    name: "Root",
    hz: 128,
    hzLabel: "128 Hz",
    note: "C3",
    chakra: "Root",
    kind: "chakra",
    voice: "bowl",
    carrierHz: 128,
    use: "A low C bowl many people use for the root chakra — grounding, legs, and a feeling of being in the room. Traditionally associated with safety and the earth under you.",
    listen:
      "Let it be loud enough to feel in the floor, not in the ears. Twenty to thirty minutes, seated on the ground if you can. Speakers are better than earbuds.",
  },
  {
    id: "sacral-144",
    name: "Sacral",
    hz: 144,
    hzLabel: "144 Hz",
    note: "D3",
    chakra: "Sacral",
    kind: "chakra",
    voice: "bowl",
    carrierHz: 144,
    use: "A D bowl traditionally placed at the sacral centre. Many people sit with it for creativity, feeling, and a softer belly. Claimed correspondence, not anatomy.",
    listen:
      "Lie on your back or sit easy. Ten to twenty minutes. A warm room helps this one more than focus does.",
  },
  {
    id: "solar-160",
    name: "Solar Plexus",
    hz: 160,
    hzLabel: "160 Hz",
    note: "E3",
    chakra: "Solar plexus",
    kind: "chakra",
    voice: "bowl",
    carrierHz: 160,
    use: "An E bowl traditionally associated with the solar plexus — will, warmth, and a steady centre. Many people use it when they want courage without strain.",
    listen:
      "Sit upright. Ten to twenty minutes. Breathe into the upper belly. Speakers or headphones.",
  },
  {
    id: "throat-192",
    name: "Throat",
    hz: 192,
    hzLabel: "192 Hz",
    note: "G3",
    chakra: "Throat",
    kind: "chakra",
    voice: "bowl",
    carrierHz: 192,
    use: "A G bowl many people place at the throat. Traditionally associated with truth-telling, listening, and the voice you have not used yet.",
    listen:
      "Hum once on the tone if you like, then be quiet and let the bowl continue. Ten minutes is a full sitting.",
  },
  {
    id: "third-eye-216",
    name: "Third Eye",
    hz: 216,
    hzLabel: "216 Hz",
    note: "A3",
    chakra: "Third eye",
    kind: "chakra",
    voice: "bowl",
    carrierHz: 216,
    use: "A3 at the 432 Hz octave (216 Hz). Traditionally associated with the third eye — inward sight, dream, and attention behind the brow. Many people pair it with the 432 bowl.",
    listen:
      "Eyes closed. Headphones or a still room. Ten to twenty minutes. Dim the screen if you can.",
  },
  {
    id: "harmony-432",
    name: "Natural Harmony",
    hz: 432,
    hzLabel: "432 Hz",
    note: "A4",
    kind: "earth",
    voice: "bowl",
    carrierHz: 432,
    use: "A4 tuned to 432 Hz rather than the common 440. Many listeners prefer this tuning for a softer, more settled feeling. Traditionally talked about as a natural or earth-aligned concert pitch.",
    listen:
      "The centre bowl of the set. Loop it as long as you like. Speakers fill a room; headphones show the beating between partials.",
  },
  {
    id: "still-111",
    name: "Still Cell",
    hz: 111,
    hzLabel: "111 Hz",
    note: "A2",
    kind: "earth",
    voice: "bowl",
    carrierHz: 111,
    use: "A low tone some teachers of sound sittings associate with cellular stillness and deep meditation. Many people use 111 Hz when they want the sitting to go quiet and stay there.",
    listen:
      "Lie down. Let the loop run. Five to twenty minutes. A little volume goes a long way on a low bowl.",
  },
  {
    id: "earth-om-136",
    name: "Earth Year · OM",
    hz: 136.1,
    hzLabel: "136.1 Hz",
    note: "C♯3",
    kind: "earth",
    voice: "bowl",
    carrierHz: 136.1,
    use: "Traditionally linked to the Earth's year tone and to the syllable OM. A low, rubbed bowl many people sit with for prayer, chanting, or a long still listen.",
    listen:
      "You may chant OM on the tone, or only listen. Twenty minutes or loop. Speakers in a quiet room, or headphones.",
  },
  {
    id: "schumann-783",
    name: "Schumann Pulse",
    hz: 7.83,
    hzLabel: "7.83 Hz",
    kind: "earth",
    voice: "binaural",
    carrierHz: 108,
    beatHz: 7.83,
    use: "The Schumann resonance is a very low electromagnetic pulse around 7.83 Hz, often described as the Earth's 'heartbeat.' You cannot hear 7.83 Hz as a singing-bowl note, so this sitting uses two close bowl tones whose difference is 7.83 Hz. Many people use it for grounding and a sense of being here.",
    listen:
      "Stereo headphones required — each ear needs its own tone. Sit twenty minutes or loop. If you only have a speaker, choose Root or Earth Year instead.",
  },
  {
    id: "deep-sleep-25",
    name: "Deep Sleep",
    hz: 2.5,
    hzLabel: "2.5 Hz",
    kind: "rest",
    voice: "binaural",
    carrierHz: 72,
    beatHz: 2.5,
    use: "A slow delta-range binaural pulse under a deep struck bowl. Many people use this sitting when they want to wind down toward sleep. A claimed aid to rest, not a medical recommendation for insomnia.",
    listen:
      "Stereo headphones, lights low, phone face down. Twenty to thirty minutes, or loop until you drift. Do not use when you need to stay alert.",
  },
  {
    id: "focus-40",
    name: "Focus",
    hz: 40,
    hzLabel: "40 Hz",
    kind: "rest",
    voice: "binaural",
    carrierHz: 184,
    beatHz: 40,
    use: "A 40 Hz gamma-range binaural pulse under a mid bowl. Many people use a 40 Hz sitting when they want a clearer, more alert attention. Research interest exists; this page does not claim a clinical effect.",
    listen:
      "Stereo headphones. Sit upright. Ten to twenty minutes. Pause if the beat feels busy — the Harmony or Solar Plexus bowls are a gentler focus.",
  },
];

export function getBowl(id: string | null | undefined) {
  if (!id) return undefined;
  return BOWLS.find((bowl) => bowl.id === id);
}

export function bowlsByKind(kind: BowlKind | "all") {
  if (kind === "all") return BOWLS;
  return BOWLS.filter((bowl) => bowl.kind === kind);
}

export function bowlMetaLine(bowl: Bowl) {
  const bits = [bowl.hzLabel];
  if (bowl.note) bits.push(bowl.note);
  if (bowl.chakra) bits.push(bowl.chakra);
  if (bowl.voice === "binaural" && bowl.beatHz) {
    bits.push(
      `binaural ${bowl.carrierHz.toFixed(0)} / ${(bowl.carrierHz + bowl.beatHz).toFixed(2)} Hz`,
    );
  }
  return bits.join(" · ");
}

export function remainingSeconds(endsAt: number | null, now: number) {
  if (endsAt === null) return null;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function endsAtFromTimer(minutes: number, now: number) {
  if (minutes <= 0) return null;
  return now + minutes * 60_000;
}
