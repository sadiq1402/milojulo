import type { Message } from '../src/features/chat/api';
import {
  catchUpFrom,
  formatChatTime,
  mergeMessages,
  previewText,
} from '../src/features/chat/messages';

const message = (id: string, createdAt: string): Message => ({
  id,
  connectionId: 'c',
  senderId: 's',
  type: 'text',
  body: id,
  activityId: null,
  createdAt,
});

describe('merging messages from a load, a catch-up and the live channel', () => {
  test('keeps one copy of each id, oldest first', () => {
    const a = message('a', '2026-10-12T10:00:00Z');
    const b = message('b', '2026-10-12T10:01:00Z');
    const c = message('c', '2026-10-12T10:02:00Z');
    expect(mergeMessages([a, c], [c, b, a]).map(m => m.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('catching up', () => {
  test('starts a little before the newest message seen, since a slower commit can land earlier', () => {
    expect(catchUpFrom([message('a', '2026-10-12T10:00:00.000Z')])).toBe(
      '2026-10-12T09:59:30.000Z',
    );
  });

  test('with nothing seen yet, loads everything', () => {
    expect(catchUpFrom([])).toBeUndefined();
  });
});

describe('time labels', () => {
  const now = new Date(2026, 9, 12, 19, 0); // Monday 12 October 2026, 7 pm local

  test('today shows the time', () => {
    expect(
      formatChatTime(new Date(2026, 9, 12, 18, 42).toISOString(), now),
    ).toBe('6:42 pm');
    expect(formatChatTime(new Date(2026, 9, 12, 0, 5).toISOString(), now)).toBe(
      '12:05 am',
    );
  });

  test('earlier this week shows the day', () => {
    expect(formatChatTime(new Date(2026, 9, 6, 9, 0).toISOString(), now)).toBe(
      'Tue',
    );
  });

  test('older shows the date', () => {
    expect(formatChatTime(new Date(2026, 9, 5, 9, 0).toISOString(), now)).toBe(
      '5 Oct',
    );
  });
});

test('previews say what a non-text message is', () => {
  expect(previewText({ type: 'text', body: 'Coffee?' })).toBe('Coffee?');
  expect(previewText({ type: 'image', body: null })).toBe('Photo');
  expect(previewText({ type: 'video', body: null })).toBe('Video');
  expect(previewText({ type: 'voice', body: null })).toBe('Voice message');
  expect(previewText({ type: 'activity_card', body: null })).toBe('Activity');
});
