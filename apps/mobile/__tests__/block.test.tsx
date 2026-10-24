import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import * as chat from '../src/features/chat/api';
import { useBlockMember } from '../src/features/me/queries';

jest.mock('../src/features/chat/api');

const changedByBlock = [
  ['discover', 'feed', ['friends'], 10],
  ['discover', 'profile', 'isha'],
  ['conversations'],
  ['chat-state', 'conn-isha'],
  ['activities', 'board'],
  ['activities', 'joined'],
  ['activities', 'my-join-requests'],
  ['activities', 'detail', 'act-1'],
  ['circles', 'members', 'circle-1'],
  ['meet-feedback', 'pending'],
  ['my-blocks'],
];
const untouched = [['areas'], ['my-photos']];

async function setup() {
  // No garbage-collection timers, so Jest can exit.
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  [...changedByBlock, ...untouched].forEach(key =>
    client.setQueryData(key, []),
  );
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = await renderHook(() => useBlockMember(), { wrapper });
  return { client, block: result.current };
}

const stale = (client: QueryClient, key: unknown[]) =>
  client.getQueryState(key)?.isInvalidated;

test('a Block refreshes every list that could still show the blocked Member', async () => {
  jest.mocked(chat.blockMember).mockResolvedValue();
  const { client, block } = await setup();
  await act(() => block('isha'));
  expect(chat.blockMember).toHaveBeenCalledWith('isha');
  changedByBlock.forEach(key =>
    expect([key, stale(client, key)]).toEqual([key, true]),
  );
});

test('it leaves unrelated data alone', async () => {
  jest.mocked(chat.blockMember).mockResolvedValue();
  const { client, block } = await setup();
  await act(() => block('isha'));
  untouched.forEach(key =>
    expect([key, stale(client, key)]).toEqual([key, false]),
  );
});

test('a failed Block refreshes nothing and says why', async () => {
  jest.mocked(chat.blockMember).mockRejectedValue(new Error('offline'));
  const { client, block } = await setup();
  await expect(block('isha')).rejects.toThrow('offline');
  changedByBlock.forEach(key =>
    expect([key, stale(client, key)]).toEqual([key, false]),
  );
});
