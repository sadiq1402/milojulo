import type { CatalogItem } from '../src/features/catalog/api';

// Active catalog entries in the order given: numbered({ 1: 'Badminton' }).
export const numbered = (
  names: Record<number, string>,
): CatalogItem<number>[] =>
  Object.entries(names).map(([id, label]) => ({
    id: Number(id),
    label,
    active: true,
  }));
