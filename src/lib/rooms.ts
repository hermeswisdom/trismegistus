import { SOUNDCLOUD_TRACKS } from "./soundcloud-tracks";
import { getMeaning } from "./meanings";
import { soundcloudPlayerSrc } from "./playback";

export type Track = {
  id: string;
  title: string;
  soundId: string;
  slug: string;
  image: string;
  permalink: string;
  recorded: string;
  /** Private Blob path key (`masters/<downloadKey>.mp3`) when a raw master exists. */
  downloadKey?: string;
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
    id: "wall",
    name: "The Wall",
    numeral: "I",
    style: "Esoteric",
    epithet: "The lyric is the lock",
    note: "No genre. The tablet keeps its own meaning. Read it.",
    backdrop: "/images/tracks/the-sleepers-waking.jpg",
    trackIds: TRACKS.map((track) => track.id),
  },
];

export const JOURNAL = [
  {
    date: "20.09.26",
    title: "The wall",
    body: "Genres taken down. The lyric is the filing system. Each tablet keeps a meaning you can read.",
  },
  {
    date: "18.09.26",
    title: "The I",
    body: "I Never Left You, I Left The I. The leaving was of the small self.",
  },
  {
    date: "09.07.26",
    title: "Atman",
    body: "Find Your Atman. What is looking is what you were hunting.",
  },
];

export const SOUNDCLOUD_PROFILE = "https://soundcloud.com/esoteric_vibrations";

export const FEATURED_ID = "the-sleepers-waking";

export function getTrack(id: string) {
  return TRACKS.find((t) => t.id === id);
}

export function getTrackBySlug(slug: string) {
  return TRACKS.find((t) => t.slug === slug);
}

export function getTrackByIdOrSlug(value: string) {
  return getTrack(value) ?? getTrackBySlug(value);
}

export { getMeaning };

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
  return soundcloudPlayerSrc(soundId, autoplay);
}
