import { supabase } from '../../lib/supabase';
import type { Mode } from '../modes';
import type { RangeKm } from './range';

export type FeedCard = {
  id: string;
  name: string;
  age: number;
  areaId: string;
  // Eligible Modes: shared, and passing both sides' Dating Preferences.
  modes: Mode[];
  // Every Mode they chose that I may see, for the "They're here for" case.
  theirModes: Mode[];
  // Rounded on the server, such as "<2 km" or "~3 km".
  distanceBand: string;
  // Every live photo, in position order; the first is the cover.
  photoIds: string[];
  sharedTagIds: number[];
  whyYouMatch: string;
};

export type FeedPage = { cards: FeedCard[]; nextCursor: string | null };

export type Profile = {
  id: string;
  name: string;
  age: number;
  areaId: string;
  // Shared Modes; theirModes are all their Modes; requestModes the ones I may send a request under.
  modes: Mode[];
  theirModes: Mode[];
  requestModes: Mode[];
  distanceBand: string;
  whyYouMatch: string;
  photoIds: string[];
  prompts: { position: number; questionId: number; answer: string }[];
  tagIds: number[];
};

// rangeKm null means Anywhere in Pune.
export type DiscoverState = {
  modes: Mode[];
  paused: boolean;
  rangeKm: RangeKm | null;
  inServiceRegion: boolean;
};

export const feedPageSize = 20;

// The Discover functions refuse nothing by name (a hidden profile just returns no rows),
// so any error is a failed load.
export const couldNotLoad =
  "We couldn't load this. Check your connection and try again.";
export const couldNotUnpause = "We couldn't unpause your profile. Try again.";
export const couldNotSaveRange = "We couldn't change the distance. Try again.";

// `cursor` is opaque: pass back the previous page's nextCursor. A short page is the last.
// An empty `modes` means every Mode.
export async function fetchFeedPage({
  modes,
  pageSize = feedPageSize,
  cursor = null,
}: {
  modes: Mode[];
  pageSize?: number;
  cursor?: string | null;
}): Promise<FeedPage> {
  const { data, error } = await supabase.rpc('discover_feed', {
    mode_filter: modes,
    page_size: pageSize,
    after: cursor ?? undefined,
  });
  if (error) {
    throw new Error(couldNotLoad);
  }
  return {
    cards: data.map(row => ({
      id: row.user_id,
      name: row.display_name,
      age: row.age,
      areaId: row.area_id,
      modes: row.modes,
      theirModes: row.their_modes,
      distanceBand: row.distance_band,
      photoIds: row.photo_ids,
      sharedTagIds: row.shared_tag_ids,
      whyYouMatch: row.why_you_match,
    })),
    nextCursor: data.length === pageSize ? data[data.length - 1].cursor : null,
  };
}

type PromptRow = { position: number; question_id: number; answer: string };

// Null once the Member isn't visible to me (Paused, blocked, no Eligible Mode left).
export async function fetchProfile(memberId: string): Promise<Profile | null> {
  const { data, error } = await supabase.rpc('get_profile', {
    member_id: memberId,
  });
  if (error) {
    throw new Error(couldNotLoad);
  }
  const row = data[0];
  if (!row) {
    return null;
  }
  return {
    id: row.user_id,
    name: row.display_name,
    age: row.age,
    areaId: row.area_id,
    modes: row.modes,
    theirModes: row.their_modes,
    requestModes: row.request_modes,
    distanceBand: row.distance_band,
    whyYouMatch: row.why_you_match,
    photoIds: row.photo_ids,
    prompts: ((row.prompts ?? []) as PromptRow[]).map(p => ({
      position: p.position,
      questionId: p.question_id,
      answer: p.answer,
    })),
    tagIds: row.tag_ids,
  };
}

// My own Modes (Casual in the Modes filter), my distance, whether I'm Paused (an empty feed)
// and whether I'm inside a service region.
export async function fetchMyDiscoverState(
  userId: string,
): Promise<DiscoverState> {
  const [profile, region] = await Promise.all([
    supabase
      .from('profiles')
      .select('modes, paused_at, discover_range_km')
      .eq('id', userId)
      .single(),
    supabase.rpc('in_service_region'),
  ]);
  if (profile.error || region.error) {
    throw new Error(couldNotLoad);
  }
  return {
    modes: profile.data.modes,
    paused: profile.data.paused_at !== null,
    rangeKm: profile.data.discover_range_km as RangeKm | null,
    inServiceRegion: region.data,
  };
}

export async function saveRange(
  userId: string,
  rangeKm: RangeKm | null,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ discover_range_km: rangeKm })
    .eq('id', userId);
  if (error) {
    throw new Error(couldNotSaveRange);
  }
}

export async function unpause(): Promise<void> {
  const { error } = await supabase.rpc('set_paused', { paused: false });
  if (error) {
    throw new Error(couldNotUnpause);
  }
}
