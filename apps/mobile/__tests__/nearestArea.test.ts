import {
  distanceBand,
  distanceKm,
  nearestAreas,
  suggestedArea,
} from '../src/features/catalog/nearest';
import { areas } from '../test/catalog';

const pune = areas(
  { aundh: 'Aundh', baner: 'Baner', kothrud: 'Kothrud' },
  {
    aundh: { lat: 18.558, lng: 73.808 },
    baner: { lat: 18.559, lng: 73.786 },
    kothrud: { lat: 18.507, lng: 73.808 },
  },
);

test('distance is the great-circle distance in km', () => {
  // One degree of latitude is about 111.2 km.
  expect(distanceKm({ lat: 18, lng: 73 }, { lat: 19, lng: 73 })).toBeCloseTo(
    111.19,
    1,
  );
  expect(distanceKm({ lat: 18.5, lng: 73.8 }, { lat: 18.5, lng: 73.8 })).toBe(
    0,
  );
});

test('the nearest Areas come first, as many as asked', () => {
  const near = nearestAreas({ lat: 18.56, lng: 73.79 }, pune, 2);
  expect(near.map(n => n.area.id)).toEqual(['baner', 'aundh']);
  expect(near[0].km).toBeLessThan(near[1].km);
});

test('the nearest Area is suggested within 3 km, not beyond', () => {
  expect(suggestedArea({ lat: 18.556, lng: 73.807 }, pune)?.id).toBe('aundh');
  // About 2.9 km south of Kothrud.
  expect(suggestedArea({ lat: 18.481, lng: 73.808 }, pune)?.id).toBe('kothrud');
  // About 3.3 km south of Kothrud.
  expect(suggestedArea({ lat: 18.477, lng: 73.808 }, pune)).toBeUndefined();
  expect(suggestedArea({ lat: 18.5, lng: 73.8 }, [])).toBeUndefined();
});

test('distance bands are never finer than a kilometre, as on Discover', () => {
  expect(distanceBand(0.4)).toBe('<2 km');
  expect(distanceBand(1.99)).toBe('<2 km');
  expect(distanceBand(2.4)).toBe('~2 km');
  expect(distanceBand(2.6)).toBe('~3 km');
});
