// Activities happen in Pune, so the form and labels work in India time (UTC + 5:30, no
// daylight saving) whatever zone the phone is set to.
const indiaOffsetMs = (5 * 60 + 30) * 60_000;
const dayMs = 24 * 60 * 60_000;

const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// An India calendar day ("2026-10-12") and minutes since its midnight.
export type IndiaTime = { dateKey: string; minutes: number };

export const minutesStep = 30;
export const lastStartMinutes = 24 * 60 - minutesStep;

export function indiaParts(instant: Date): IndiaTime {
  const shifted = new Date(instant.getTime() + indiaOffsetMs);
  return {
    dateKey: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function indiaInstant(dateKey: string, minutes: number): string {
  const midnight = Date.parse(`${dateKey}T00:00:00Z`);
  return new Date(midnight + minutes * 60_000 - indiaOffsetMs).toISOString();
}

export function addDays(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * dayMs)
    .toISOString()
    .slice(0, 10);
}

// Today, tomorrow and the five days after: how far ahead the form lets a Member post.
export function dayOptions(todayKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(todayKey, i));
}

export function dayLabel(dateKey: string, todayKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const ahead = Math.round((date.getTime() - Date.parse(todayKey)) / dayMs);
  if (ahead === 0) {
    return 'Today';
  }
  if (ahead === 1) {
    return 'Tomorrow';
  }
  const weekday = weekdays[date.getUTCDay()];
  if (ahead > 1 && ahead < 7) {
    return weekday;
  }
  return `${weekday.slice(0, 3)} ${date.getUTCDate()} ${
    months[date.getUTCMonth()]
  }`;
}

// How long ago an Activity ended: "earlier today", "last night", "on Saturday", "on Thu 1 Oct".
export function endedWhen(endsAt: string, now: Date = new Date()): string {
  const todayKey = indiaParts(now).dateKey;
  const end = indiaParts(new Date(endsAt));
  if (end.dateKey === todayKey) {
    return 'earlier today';
  }
  if (end.dateKey === addDays(todayKey, -1)) {
    return end.minutes >= 17 * 60 ? 'last night' : 'yesterday';
  }
  const date = new Date(`${end.dateKey}T00:00:00Z`);
  const weekday = weekdays[date.getUTCDay()];
  const daysAgo = Math.round((Date.parse(todayKey) - date.getTime()) / dayMs);
  return daysAgo < 7
    ? `on ${weekday}`
    : `on ${weekday.slice(0, 3)} ${date.getUTCDate()} ${
        months[date.getUTCMonth()]
      }`;
}

function clock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, '0');
  return { text: `${h % 12 || 12}:${m}`, half: h < 12 ? 'am' : 'pm' };
}

export function formatTime(minutes: number): string {
  const { text, half } = clock(minutes);
  return `${text} ${half}`;
}

// The first half hour at least an hour from now, or tomorrow evening if that's past the last slot.
export function defaultStart(now: Date = new Date()): IndiaTime {
  const { dateKey, minutes } = indiaParts(now);
  const next = Math.ceil((minutes + 60) / minutesStep) * minutesStep;
  if (next > lastStartMinutes) {
    return { dateKey: addDays(dateKey, 1), minutes: 18 * 60 };
  }
  return { dateKey, minutes: next };
}

// "Today, 7:30 to 9:00 pm", "Saturday, 10:00 am to 2:00 pm".
export function formatWhen(
  startsAt: string,
  endsAt: string | null,
  now: Date = new Date(),
): string {
  const todayKey = indiaParts(now).dateKey;
  const start = indiaParts(new Date(startsAt));
  const startDay = dayLabel(start.dateKey, todayKey);
  if (!endsAt) {
    return `${startDay}, ${formatTime(start.minutes)}`;
  }
  const end = indiaParts(new Date(endsAt));
  if (end.dateKey !== start.dateKey) {
    return `${startDay}, ${formatTime(start.minutes)} to ${dayLabel(
      end.dateKey,
      todayKey,
    )}, ${formatTime(end.minutes)}`;
  }
  const from = clock(start.minutes);
  const to = clock(end.minutes);
  return from.half === to.half
    ? `${startDay}, ${from.text} to ${to.text} ${to.half}`
    : `${startDay}, ${formatTime(start.minutes)} to ${formatTime(end.minutes)}`;
}

// "10 Sep 2026", the India calendar day of an instant.
export function dayMonthYear(instant: string): string {
  const [year, month, day] = indiaParts(new Date(instant))
    .dateKey.split('-')
    .map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}
