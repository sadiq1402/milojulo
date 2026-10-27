import { supabase } from '../../lib/supabase';
import type { Venue } from './model';

// Calls to the `places` Edge Function (#248), which asks Google Places for the venue search.

export type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  // The parts of mainText that match what was typed, as [start, end) offsets.
  matches: { start: number; end: number }[];
};

export const placeSearchFailed =
  "We couldn't search for places. Check your connection and try again.";

// One per search: Google bills the typing and the pick that ends it as one session. It only
// needs to be unique, not secret (Hermes has no crypto.randomUUID).
export function newSessionToken(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

async function invokePlaces<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('places', { body });
  if (error) {
    throw new Error(placeSearchFailed);
  }
  return data as T;
}

export async function searchPlaces(
  input: string,
  sessionToken: string,
): Promise<PlaceSuggestion[]> {
  const { suggestions } = await invokePlaces<{
    suggestions: PlaceSuggestion[];
  }>({ action: 'autocomplete', input, sessionToken });
  return suggestions;
}

export async function placeDetails(
  placeId: string,
  sessionToken: string,
): Promise<Venue> {
  const place = await invokePlaces<{
    placeId: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
  }>({ action: 'details', placeId, sessionToken });
  return {
    name: place.name,
    address: place.address,
    placeId: place.placeId,
    lat: place.lat,
    lng: place.lng,
  };
}

// The suggestion's main text cut into plain and matched parts, for highlighting.
export function highlightParts(
  suggestion: Pick<PlaceSuggestion, 'mainText' | 'matches'>,
): { text: string; matched: boolean }[] {
  const text = suggestion.mainText;
  const parts: { text: string; matched: boolean }[] = [];
  let at = 0;
  const matches = [...suggestion.matches]
    .filter(m => m.end > m.start)
    .sort((a, b) => a.start - b.start);
  for (const m of matches) {
    const start = Math.max(m.start, at);
    const end = Math.min(m.end, text.length);
    if (start >= end) {
      continue;
    }
    if (start > at) {
      parts.push({ text: text.slice(at, start), matched: false });
    }
    parts.push({ text: text.slice(start, end), matched: true });
    at = end;
  }
  if (at < text.length) {
    parts.push({ text: text.slice(at), matched: false });
  }
  return parts;
}
