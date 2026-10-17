import { act, fireEvent, screen } from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import * as catalog from '../src/features/catalog/api';
import * as chat from '../src/features/chat/api';
import type { Conversation } from '../src/features/chat/api';
import * as photos from '../src/features/photos/api';
import { areas } from '../test/catalog';
import storage from '../test/memoryStorage';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/photos/api');

const me = sessionFor('asha@example.com');

const isha: Conversation = {
  connectionId: 'conn-isha',
  otherId: 'isha',
  otherName: 'Isha',
  otherPhotoId: 'isha-1',
  otherAreaId: 'baner',
  mode: 'friends',
  status: 'accepted',
  direction: 'incoming',
  note: null,
  lastMessage: {
    type: 'text',
    body: 'Count me in',
    at: '2026-10-12T10:00:00.000Z',
  },
  unreadCount: 0,
};

const saved = async () => (await storage.getItem('milojulo-query-cache')) ?? '';

// Saving is throttled; let the app run (inside act) until the saved cache passes the check.
async function untilSaved(check: (cache: string) => boolean) {
  for (let tries = 0; !check(await saved()); tries++) {
    if (tries === 30) {
      throw new Error(`saved cache never matched: ${await saved()}`);
    }
    await act(() => new Promise<void>(resolve => setTimeout(resolve, 100)));
  }
}

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  jest.mocked(catalog.fetchAreas).mockResolvedValue(areas({ baner: 'Baner' }));
  jest.mocked(chat.fetchConversations).mockResolvedValue([isha]);
  jest.mocked(photos.fetchPhotoUrls).mockResolvedValue({
    'isha-1': 'https://r2.example/isha-1.jpg?X-Amz-Signature=abc',
  });
});

async function openChats() {
  const app = await renderApp(me);
  await fireEvent.press(await screen.findByRole('tab', { name: /^Inbox/ }));
  await fireEvent.press(screen.getByRole('tab', { name: 'Chats' }));
  return app;
}

test('on a cold start the Inbox shows what it had last time while it refreshes', async () => {
  const first = await openChats();
  await screen.findByRole('button', { name: /^Isha, Count me in/ });
  await untilSaved(cache => cache.includes('Count me in'));
  await first.unmount();

  jest.mocked(chat.fetchConversations).mockReturnValue(new Promise(() => {}));
  await openChats();
  expect(
    await screen.findByRole('button', { name: /^Isha, Count me in/ }),
  ).toBeOnTheScreen();
});

test('signed media links are never kept on the phone', async () => {
  await openChats();
  await screen.findByLabelText('Photo of Isha');
  await untilSaved(cache => cache.includes('Count me in'));
  expect(await saved()).not.toContain('X-Amz-Signature');
});

test('signing out leaves nothing kept on the phone', async () => {
  const app = await openChats();
  await untilSaved(cache => cache.includes('Count me in'));
  // Wiped at once, not on the next throttled save, so closing the app right after leaves nothing.
  await act(async () => {
    app.setSession(null);
    await new Promise<void>(resolve => setTimeout(resolve, 50));
  });
  expect(await saved()).toBe('');
});
