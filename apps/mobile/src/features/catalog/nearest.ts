import type { Area } from './api';

export type Point = { lat: number; lng: number };
export type NearArea = { area: Area; km: number };

// The nearest Area is suggested only within this distance; further away the Member picks.
export const suggestWithinKm = 3;

const earthKm = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

// Great-circle (haversine) distance.
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(h));
}

export function nearestAreas(
  point: Point,
  areas: Area[],
  count: number,
): NearArea[] {
  return areas
    .map(area => ({ area, km: distanceKm(point, area) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count);
}

export function suggestedArea(point: Point, areas: Area[]): Area | undefined {
  const [nearest] = nearestAreas(point, areas, 1);
  return nearest && nearest.km <= suggestWithinKm ? nearest.area : undefined;
}

// As the server's distance_band: never finer than a kilometre.
export function distanceBand(km: number): string {
  return km < 2 ? '<2 km' : `~${Math.round(km)} km`;
}

// The Areas to offer first: mine, then the nearest open ones, always including the one chosen.
export function areaShortlist(
  areas: Area[],
  homeId: string | null,
  chosenId: string | null,
  count: number,
): Area[] {
  const open = areas.filter(area => area.active);
  const find = (id: string | null) => open.find(area => area.id === id);
  const from = find(homeId) ?? find(chosenId) ?? open[0];
  if (!from) {
    return [];
  }
  const list = nearestAreas(from, open, count).map(near => near.area);
  // An Activity keeps its Area even if that Area has since closed.
  const chosen = areas.find(area => area.id === chosenId);
  return chosen && !list.includes(chosen)
    ? [...list.slice(0, count - 1), chosen]
    : list;
}
