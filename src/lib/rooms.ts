import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks";

export type Track = {
  id: string;
  title: string;
  soundId: string;
  slug: string;
  image: string;
  permalink: string;
  recorded: string;
};

export type StyleRoom = {
  id: string;
  name: string;
  numeral: string;
  style: string;
  epithet: string;
  note: string;
  backdrop: string;
  trackIds: string[];
};

export const TRACKS: Track[] = SOUNDCLOUD_TRACKS as Track[];

export const ROOMS: StyleRoom[] = [
  {
    id: "hip-hop",
    name: "Hip-Hop",
    numeral: "I",
    style: "Hip-Hop",
    epithet: "Bars · beat · the long game",
    note: "UK streets, Warrington, the graft. The Sleepers Waking and Fragile God are tagged hip-hop on SoundCloud. The beat can be house. The voice is still bars.",
    backdrop: "/images/tracks/old-mens-game.jpg",
    trackIds: [
      "the-sleepers-waking",
      "fragile-god",
      "old-mens-game",
      "me-and-eric",
      "paper-crown",
      "gold-curtains",
      "spy-pigeons",
      "bank-holiday-bloke",
      "dodgy-sir-keir-scandal-after",
      "broken-britain-debt-bomb",
      "welcome-home-neville",
      "mirror-mirror-left-wing",
      "fiat-slaves-no-more",
      "the-city-of-london",
      "when-we-were-cool",
      "mr-oil-up-aaron-mp3",
      "cockny-in-his-polish-tracksuit",
      "the-best-of-the-worst-mp3",
      "famous-aint-fun-anymore",
      "puppets-on-a-string",
      "warrington-boy-outside-the",
      "michael-my-lil-legend",
      "el-chapo-lev",
      "cardboard-kingdom",
      "paper-tigers-in-red-ties",
      "still-on-the-graft",
      "critical-mass-in-warrington",
      "still-not-retiring-in",
      "trevor-the-beat-creator",
      "ego-overload-mp3",
      "bones-keep-score",
      "scratch-on-the-floor",
      "makers-make",
      "nobody-can-stop-it",
    ],
  },
  {
    id: "dance",
    name: "Dance",
    numeral: "II",
    style: "Dance",
    epithet: "Floor · pulse · four on the floor",
    note: "House, bass, tribal, sax on the kick. Starseed Child and I Never Left You are tagged house. If the kick owns the bar, it lives here.",
    backdrop: "/images/tracks/bassline-serenade.jpg",
    trackIds: [
      "bassline-serenade",
      "starseed-child",
      "i-never-left-you-i-left-the-i",
      "dont-look-up",
      "djinn",
      "subterranean-pulse",
      "neon-nostalgia",
      "neon-pulse",
      "shamanic-in-the-woods",
      "shamanica",
      "shamanic-me-up",
      "marble-heartbeats",
      "quartz-pulse-ritual",
      "dusty-shoe-bass",
      "moonlit-handpan-groove-mp3",
      "hyperdimensional-dancefloor",
      "sunset-trap-15-09-2016-21-54",
      "bamboo-kickback",
      "that-sax-is-fine",
      "piano-hands",
      "saxatone",
      "saxamoan",
      "steel-peach-bloom",
      "throat-sing",
      "babushka-on-fire",
      "your-first-pill",
      "hidden-circuits-of-the-one",
      "beyond-the-body",
      "awake",
      "remember-who-you-are-mp3",
      "infinite-spark-of-atoms-1",
      "infinite-spark-of-atoms",
      "mo-bius-bowl-mp3",
      "moon-circles-1",
      "the-last-one",
    ],
  },
  {
    id: "soul",
    name: "Soul",
    numeral: "III",
    style: "Soul",
    epithet: "Love that stays · bloom · shadow",
    note: "Sung, not rapped. Heartache, attachment, the folk current. Fake Love Shadows is tagged folk on SoundCloud.",
    backdrop: "/images/tracks/wait-for-a-love-that-stays.jpg",
    trackIds: [
      "wait-for-a-love-that-stays",
      "now-i-see-you-blossom",
      "fake-love-shadows",
      "the-worst-kind-of-heartache",
      "i-tired",
      "solitudes-silent-flame",
      "hold-lightly",
      "half-way-heart-mp3",
      "miles-of-lies",
      "let-that-fear-go",
      "lift-me-up",
      "amy-all-out-of-love",
      "pocketful-umbrellas",
      "thats-life",
      "broken-brick-rebuild",
      "tracy-chapman-tape",
      "through-the-cracks",
      "whats-in-it-for-me",
      "7-signs-silent-danger",
    ],
  },
  {
    id: "psychedelic",
    name: "Psychedelic",
    numeral: "IV",
    style: "Psychedelic",
    epithet: "Mirror · atman · the long tone",
    note: "Esoteric, but not a club kick. Mirrors, mushrooms, the I that left the I — when the floor is not the point.",
    backdrop: "/images/tracks/the-endless-mirror.jpg",
    trackIds: [
      "the-endless-mirror",
      "find-your-atman",
      "the-mushroom-alchemist",
      "remember-who-you-are-mp3-1",
      "nine-completes",
      "shadows-of-the-cross",
      "quantum-stage",
      "two-blue-screens",
    ],
  },
  {
    id: "world",
    name: "World",
    numeral: "V",
    style: "World",
    epithet: "Baguio · plant · stone",
    note: "Place and body. Forest, chest, the trip. The shamanic four-on-the-floor went to Dance.",
    backdrop: "/images/tracks/natures-plant.jpg",
    trackIds: [
      "natures-plant",
      "stone-chest",
      "baguio-the-wrong-dam-room-mp3",
      "baguio-trip-mp3",
      "bonefire-circle",
      "funk-in-the-forest",
    ],
  },
];

export const JOURNAL = [
  {
    date: "20.09.26",
    title: "Hip-Hop",
    body: "The Sleepers Waking and Fragile God are tagged hip-hop on SoundCloud. Old Men's Game keeps the long count.",
  },
  {
    date: "18.09.26",
    title: "Dance",
    body: "Starseed Child and I Never Left You are tagged house. Bassline Serenade. Sax on the kick belongs on the floor.",
  },
  {
    date: "09.07.26",
    title: "Soul",
    body: "Wait for a Love That Stays. Fake Love Shadows is folk. Heartache is a genre, not a confession.",
  },
  {
    date: "24.07.26",
    title: "Psychedelic",
    body: "The Endless Mirror. Find Your Atman. The Mushroom Alchemist. The kick is not the point.",
  },
];

export const SOUNDCLOUD_PROFILE = "https://soundcloud.com/esoteric_vibrations";

export const FEATURED_ID = "the-sleepers-waking";

export function getTrack(id: string) {
  return TRACKS.find((t) => t.id === id);
}

export function getRoom(id: string) {
  return ROOMS.find((r) => r.id === id);
}

export function roomForTrack(trackId: string) {
  return ROOMS.find((r) => r.trackIds.includes(trackId));
}

export function tracksInRoom(room: StyleRoom) {
  return room.trackIds
    .map((id) => getTrack(id))
    .filter((t): t is Track => Boolean(t));
}

export function unassignedTracks() {
  const assigned = new Set(ROOMS.flatMap((room) => room.trackIds));
  return TRACKS.filter((track) => !assigned.has(track.id));
}

export function nextTrack(trackId: string) {
  const i = TRACKS.findIndex((t) => t.id === trackId);
  if (i < 0) return TRACKS[0]?.id;
  return TRACKS[(i + 1) % TRACKS.length]?.id;
}

export function randomTrack(except?: string) {
  const pool =
    except && TRACKS.length > 1
      ? TRACKS.filter((track) => track.id !== except)
      : TRACKS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function embedSrc(soundId: string, autoplay: boolean) {
  const params = new URLSearchParams({
    url: `https://api.soundcloud.com/tracks/${soundId}`,
    color: "#d6e24a",
    auto_play: autoplay ? "true" : "false",
    hide_related: "true",
    show_comments: "false",
    show_user: "false",
    show_reposts: "false",
    show_teaser: "false",
    show_artwork: "false",
    visual: "false",
    buying: "false",
    sharing: "false",
    download: "false",
  });
  return `https://w.soundcloud.com/player/?${params.toString()}`;
}
