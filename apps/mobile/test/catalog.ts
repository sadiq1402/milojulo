import type { Area, CatalogItem } from '../src/features/catalog/api';

// Active catalog entries in the order given: areas({ baner: 'Baner' }), numbered({ 1: 'Badminton' }).
// Areas sit in the West zone, far from any test location, unless placed.
export const areas = (
  names: Record<string, string>,
  placed: Record<string, Partial<Area>> = {},
): Area[] =>
  Object.entries(names).map(([id, label]) => ({
    id,
    label,
    active: true,
    zone: 'west',
    lat: 0,
    lng: 0,
    ...placed[id],
  }));

export const numbered = (
  names: Record<number, string>,
): CatalogItem<number>[] =>
  Object.entries(names).map(([id, label]) => ({
    id: Number(id),
    label,
    active: true,
  }));
