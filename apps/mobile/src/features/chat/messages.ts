import type { Message, MessageMedia } from './api';

export type MediaFields = {
  media_mime: string | null;
  media_width: number | null;
  media_height: number | null;
  media_duration_ms: number | null;
  media_deleted_at: string | null;
};

// One mapping for media fields, whether from a stored row or a send still on its way.
export function toMessageMedia(
  type: Message['type'],
  row: MediaFields,
): MessageMedia | null {
  if (type !== 'image' && type !== 'video' && type !== 'voice') {
    return null;
  }
  return {
    mime: row.media_mime,
    width: row.media_width,
    height: row.media_height,
    durationMs: row.media_duration_ms,
    expired: row.media_deleted_at !== null,
  };
}

// One copy per id, oldest first, whichever source (load, catch-up, live) it came from.
export function mergeMessages(
  current: Message[],
  incoming: Message[],
): Message[] {
  const byId = new Map(current.map(m => [m.id, m]));
  for (const m of incoming) {
    byId.set(m.id, m);
  }
  return [...byId.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

// A message's time is its transaction start, so a slower commit can land with an earlier
// time than one already seen; catching up from a little before covers it.
const catchUpOverlapMs = 30_000;

export function catchUpFrom(messages: Message[]): string | undefined {
  const newest = messages.at(-1);
  return newest
    ? new Date(Date.parse(newest.createdAt) - catchUpOverlapMs).toISOString()
    : undefined;
}

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

export function formatTime(date: Date): string {
  const hour = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minutes} ${date.getHours() < 12 ? 'am' : 'pm'}`;
}

// Today: the time; the last six days: the weekday; older: the date.
export function formatChatTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (daysAgo === 0) {
    return formatTime(date);
  }
  if (daysAgo < 7) {
    return days[date.getDay()];
  }
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

const previews: Record<Exclude<Message['type'], 'text'>, string> = {
  image: 'Photo',
  video: 'Video',
  voice: 'Voice message',
  activity_card: 'Activity',
};

export function previewText(message: Pick<Message, 'type' | 'body'>): string {
  return message.type === 'text' ? message.body ?? '' : previews[message.type];
}
