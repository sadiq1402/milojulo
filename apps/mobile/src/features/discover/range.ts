// Discover distance steps in km; no range (null) means Anywhere in Pune.
export const rangeSteps = [2, 5, 10, 25, 50] as const;
export type RangeKm = (typeof rangeSteps)[number];
