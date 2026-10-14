import type { CatalogItem } from '../src/features/catalog/api';

// Active catalog entries in the order given: areas({ baner: 'Baner' }), numbered({ 1: 'Badminton' }).
export const areas = (names: Record<string, string>): CatalogItem<string>[] =>
  Object.entries(names).map(([id, label]) => ({ id, label, active: true }));

export const numbered = (
  names: Record<number, string>,
): CatalogItem<number>[] =>
  Object.entries(names).map(([id, label]) => ({
    id: Number(id),
    label,
    active: true,
  }));
