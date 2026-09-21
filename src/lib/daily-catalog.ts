import {
  londonDateKey,
  pickDailyTablet,
  resolveFocusedTablet,
  type FocusedTablet,
} from "@/lib/daily-tablet";
import { TRACKS, getTrack, getTrackByIdOrSlug, type Track } from "@/lib/rooms";

export function catalogIds(): string[] {
  return TRACKS.map((track) => track.id);
}

export function dailyTrackId(at?: Date): string {
  return pickDailyTablet(catalogIds(), londonDateKey(at));
}

export function dailyTrack(at?: Date): Track {
  return getTrack(dailyTrackId(at)) ?? TRACKS[0]!;
}

export function focusedTrackFromSearch(search: {
  daily?: boolean;
  tablet?: string;
  at?: Date;
}): FocusedTablet {
  return resolveFocusedTablet({
    daily: search.daily,
    tablet: search.tablet,
    ids: catalogIds(),
    dateKey: londonDateKey(search.at),
    resolveId: (value) => getTrackByIdOrSlug(value)?.id,
  });
}
