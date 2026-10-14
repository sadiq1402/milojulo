import { useQuery } from '@tanstack/react-query';
import { fetchMyPhotos, fetchPhotoUrls } from './api';

export const photoKeys = {
  mine: ['my-photos'],
  url: (photoId: string) => ['photo-url', photoId],
};

// Links are signed for 600 s; fetch a fresh one well before that when a photo is shown again.
const urlStaleTime = 8 * 60_000;

type Waiting = {
  photoId: string;
  resolve: (url: string | null) => void;
  reject: (error: unknown) => void;
};
let waiting: Waiting[] = [];

// Every photo asked for in the same tick shares one call (fetchPhotoUrls splits it by 60).
async function flush() {
  const batch = waiting;
  waiting = [];
  try {
    const urls = await fetchPhotoUrls(batch.map(entry => entry.photoId));
    batch.forEach(entry => entry.resolve(urls[entry.photoId] ?? null));
  } catch (error) {
    batch.forEach(entry => entry.reject(error));
  }
}

function loadPhotoUrl(photoId: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (waiting.length === 0) {
      setTimeout(flush, 0);
    }
    waiting.push({ photoId, resolve, reject });
  });
}

// A signed link for one photo, or null when it isn't mine to see. TanStack Query
// de-duplicates by id; the loader batches different ids into one call.
export function usePhotoUrl(photoId: string | null | undefined) {
  return useQuery({
    queryKey: photoKeys.url(photoId ?? ''),
    queryFn: () => loadPhotoUrl(photoId!),
    enabled: !!photoId,
    staleTime: urlStaleTime,
  });
}

// Reloaded whenever the photos step opens, so a photo confirmed elsewhere shows up.
export function useMyPhotos() {
  return useQuery({
    queryKey: photoKeys.mine,
    queryFn: fetchMyPhotos,
    staleTime: 0,
  });
}
