import {
  dayMonthYear,
  addDays,
  dayLabel,
  dayOptions,
  defaultStart,
  endedWhen,
  formatTime,
  formatWhen,
  indiaParts,
  indiaInstant,
  addMonths,
  lastPickableDay,
  monthGrid,
  monthTitle,
  shortDate,
} from '../src/features/activities/time';

// 2026-10-12 is a Monday. 20:00 UTC is 01:30 the next day in India.
const mondayNoonIndia = new Date('2026-10-12T06:30:00Z');

test.each([
  ['2026-10-12T04:30:00Z', 'earlier today'],
  // 22:00 on Sunday in India.
  ['2026-10-11T16:30:00Z', 'last night'],
  ['2026-10-11T06:30:00Z', 'yesterday'],
  ['2026-10-10T06:30:00Z', 'on Saturday'],
  ['2026-10-06T06:30:00Z', 'on Tuesday'],
  ['2026-10-05T06:30:00Z', 'on Mon 5 Oct'],
  ['2026-10-01T06:30:00Z', 'on Thu 1 Oct'],
])('an Activity that ended at %p reads %p', (endsAt, label) => {
  expect(endedWhen(endsAt, mondayNoonIndia)).toBe(label);
});

test('India date and minutes come from UTC + 5:30, whatever the phone zone', () => {
  expect(indiaParts(mondayNoonIndia)).toEqual({
    dateKey: '2026-10-12',
    minutes: 12 * 60,
  });
  expect(indiaParts(new Date('2026-10-12T20:00:00Z'))).toEqual({
    dateKey: '2026-10-13',
    minutes: 90,
  });
});

test('an India date and time becomes the matching instant', () => {
  expect(indiaInstant('2026-10-12', 19 * 60 + 30)).toBe(
    '2026-10-12T14:00:00.000Z',
  );
  expect(indiaInstant('2026-10-13', 90)).toBe('2026-10-12T20:00:00.000Z');
});

test('days add across month ends', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
});

test('day chips are Today, Tomorrow, then five weekdays', () => {
  expect(
    dayOptions('2026-10-12').map(key => dayLabel(key, '2026-10-12')),
  ).toEqual([
    'Today',
    'Tomorrow',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ]);
  expect(dayLabel('2026-10-24', '2026-10-12')).toBe('Sat 24 Oct');
});

test('a date can be picked up to 90 days ahead', () => {
  expect(lastPickableDay('2026-10-27')).toBe('2027-01-25');
});

test('a month grid starts its weeks on Monday', () => {
  // 1 Nov 2026 is a Sunday, so six blanks lead.
  const grid = monthGrid('2026-11');
  expect(grid.slice(0, 7)).toEqual([
    null,
    null,
    null,
    null,
    null,
    null,
    '2026-11-01',
  ]);
  expect(grid[grid.length - 1]).toBe('2026-11-30');
  expect(grid.filter(Boolean)).toHaveLength(30);
  // 1 Feb 2027 is a Monday: no blanks.
  expect(monthGrid('2027-02')[0]).toBe('2027-02-01');
});

test('a short date names the weekday, day and month', () => {
  expect(shortDate('2026-11-14')).toBe('Sat 14 Nov');
});

test('months step across a year', () => {
  expect(addMonths('2026-12', 1)).toBe('2027-01');
  expect(addMonths('2027-01', -1)).toBe('2026-12');
});

test('a month reads as its name and year', () => {
  expect(monthTitle('2027-01')).toBe('January 2027');
});

test('times read as a 12-hour clock', () => {
  expect(formatTime(0)).toBe('12:00 am');
  expect(formatTime(12 * 60 + 30)).toBe('12:30 pm');
  expect(formatTime(19 * 60 + 30)).toBe('7:30 pm');
});

test('the default start is the first half hour at least an hour away', () => {
  expect(defaultStart(mondayNoonIndia)).toEqual({
    dateKey: '2026-10-12',
    minutes: 13 * 60,
  });
  expect(defaultStart(new Date('2026-10-12T06:40:00Z'))).toEqual({
    dateKey: '2026-10-12',
    minutes: 13 * 60 + 30,
  });
  // Too late tonight: tomorrow evening instead.
  expect(defaultStart(new Date('2026-10-12T17:45:00Z'))).toEqual({
    dateKey: '2026-10-13',
    minutes: 18 * 60,
  });
});

test('when an Activity happens, in India time', () => {
  const now = mondayNoonIndia;
  expect(formatWhen('2026-10-12T14:00:00Z', null, now)).toBe('Today, 7:30 pm');
  expect(
    formatWhen('2026-10-12T14:00:00+00:00', '2026-10-12T15:30:00+00:00', now),
  ).toBe('Today, 7:30 to 9:00 pm');
  expect(formatWhen('2026-10-17T04:30:00Z', '2026-10-17T08:30:00Z', now)).toBe(
    'Saturday, 10:00 am to 2:00 pm',
  );
  expect(formatWhen('2026-10-12T17:30:00Z', '2026-10-12T19:30:00Z', now)).toBe(
    'Today, 11:00 pm to Tomorrow, 1:00 am',
  );
});

test('a date reads as day, month and year in India time', () => {
  expect(dayMonthYear('2026-09-10T20:00:00Z')).toBe('11 Sep 2026');
  expect(dayMonthYear('2026-09-10T10:00:00Z')).toBe('10 Sep 2026');
});
