// One of my own photos; position 1 is the cover.
export type MyPhoto = { id: string; position: number };

export const maxPhotos = 4;
// Photo positions, 1 (the cover) to maxPhotos.
export const photoPositions = Array.from(
  { length: maxPhotos },
  (_, index) => index + 1,
);
