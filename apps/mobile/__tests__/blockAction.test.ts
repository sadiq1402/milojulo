import { QueryClient } from '@tanstack/react-query';
import * as chat from '../src/features/chat/api';
import { activityKeys } from '../src/features/activities/queries';
import { catalogKeys } from '../src/features/catalog/queries';
import { chatKeys } from '../src/features/chat/queries';
import { circleKeys } from '../src/features/circles/queries';
import { discoverKeys } from '../src/features/discover/queries';
import { meetFeedbackKeys } from '../src/features/meetFeedback/queries';
import { blocksKey, blockAndRefresh } from '../src/features/me/queries';
import { photoKeys } from '../src/features/photos/queries';

jest.mock('../src/features/chat/api');

// Every list a Block changes: the blocked pair disappears from each of these.
const changedByABlock: Record<string, readonly unknown[]> = {
  'blocked list': blocksKey,
  'Discover feed': discoverKeys.feeds,
  'their profile': discoverKeys.profile('isha'),
  conversations: chatKeys.conversations,
  'chat state': chatKeys.state('conn-isha'),
  'Activity board': activityKeys.board,
  'joined Activities': activityKeys.joined,
  'an Activity': activityKeys.detail('act-1'),
  'its Join Requests': activityKeys.joinRequests('act-1'),
  'my Join Requests': activityKeys.myJoinRequests,
  'Circle members': circleKeys.members('circle-1'),
  'pending meet feedback': meetFeedbackKeys.pending,
};

// Nothing a Block can change, so a Block must leave it alone.
const untouchedByABlock: Record<string, readonly unknown[]> = {
  'the tag catalog': catalogKeys.tags,
  'my own photos': photoKeys.mine,
};

const seed = () => {
  const client = new QueryClient();
  for (const key of [
    ...Object.values(changedByABlock),
    ...Object.values(untouchedByABlock),
  ]) {
    client.setQueryData(key, 'cached');
  }
  return client;
};

const isStale = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated === true;

beforeEach(() => {
  jest.mocked(chat.blockMember).mockResolvedValue();
});

test('a Block refreshes every list it changes, and nothing else', async () => {
  const client = seed();

  await blockAndRefresh(client, 'isha');

  expect(chat.blockMember).toHaveBeenCalledWith('isha');
  for (const [name, key] of Object.entries(changedByABlock)) {
    expect([name, isStale(client, key)]).toEqual([name, true]);
  }
  for (const [name, key] of Object.entries(untouchedByABlock)) {
    expect([name, isStale(client, key)]).toEqual([name, false]);
  }
});
