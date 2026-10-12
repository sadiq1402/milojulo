import { supabase } from '../../lib/supabase';
import type { Mode } from '../modes';

export type FeedCard = {
  id: string;
  name: string;
  age: number;
  areaId: string;
  // Eligible Modes: shared, and passing both sides' Dating Preferences.
  modes: Mode[];
  coverPhotoId: string | null;
  sharedTagIds: number[];
  whyYouMatch: string;
};

export type FeedPage = { cards: FeedCard[]; nextCursor: string | null };

export type Profile = {
  id: string;
  name: string;
  age: number;
  areaId: string;
  modes: Mode[];
  whyYouMatch: string;
  photoIds: string[];
  prompts: { position: number; questionId: number; answer: string }[];
  tagIds: number[];
};

export type DiscoverState = { modes: Mode[]; paused: boolean };

export const feedPageSize = 20;

// The Discover functions refuse nothing by name (a hidden profile just returns no rows),
// so any error is a failed load.
export const couldNotLoad =
  "We couldn't load this. Check your connection and try again.";
export const couldNotUnpause = "We couldn't unpause your profile. Try again.";

// `cursor` is opaque: pass back the previous page's nextCursor. A short page is the last.
export async function fetchFeedPage({
  mode,
  pageSize = feedPageSize,
  cursor = null,
}: {
  mode: Mode | null;
  pageSize?: number;
  cursor?: string | null;
}): Promise<FeedPage> {
  const { data, error } = await supabase.rpc('discover_feed', {
    mode_filter: mode ?? undefined,
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
      coverPhotoId: row.cover_photo_id,
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

// My own Modes (the filter chips) and whether I'm Paused, which empties my feed.
export async function fetchMyDiscoverState(
  userId: string,
): Promise<DiscoverState> {
  const { data, error } = await supabase
    .from('profiles')
    .select('modes, paused_at')
    .eq('id', userId)
    .single();
  if (error) {
    throw new Error(couldNotLoad);
  }
  return { modes: data.modes, paused: data.paused_at !== null };
}

export async function unpause(): Promise<void> {
  const { error } = await supabase.rpc('set_paused', { paused: false });
  if (error) {
    throw new Error(couldNotUnpause);
  }
}
