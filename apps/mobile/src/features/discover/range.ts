// Discover distance steps in km.
export const rangeSteps = [2, 5, 10, 25, 50, 100] as const;
export type RangeKm = (typeof rangeSteps)[number];
