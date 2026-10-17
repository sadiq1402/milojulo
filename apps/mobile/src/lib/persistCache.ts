import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { activityKeys } from '../features/activities/queries';
import { catalogKeys } from '../features/catalog/queries';
import { chatKeys } from '../features/chat/queries';
import { circleKeys } from '../features/circles/queries';
import { discoverKeys } from '../features/discover/queries';

// Bump when a saved query's data changes shape, so old copies are dropped instead of hydrated.
const cacheVersion = '1';
const savedFor = 24 * 60 * 60_000;

// Chat text never goes to the phone's (unencrypted) storage: the Inbox preview fills in on refresh.
const withoutMessageText = (key: string, value: unknown) =>
  key === 'lastMessage' && value ? { ...value, body: null } : value;

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'milojulo-query-cache',
  serialize: client => JSON.stringify(client, withoutMessageText),
});

// Catalogs and lists only: never messages, profiles, Activity venues or signed media links.
const persistedKeys: QueryKey[] = [
  ...Object.values(catalogKeys),
  chatKeys.conversations,
  activityKeys.board,
  activityKeys.joined,
  activityKeys.myJoinRequests,
  circleKeys.list,
  discoverKeys.me,
  discoverKeys.feeds,
];

const shouldPersist = (query: Query) =>
  query.state.status === 'success' &&
  persistedKeys.some(prefix =>
    prefix.every((part, i) => query.queryKey[i] === part),
  );

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: savedFor,
  buster: cacheVersion,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
};

// Saved queries stay in memory as long as on the phone, or an idle one drops out of the save.
export function keepSavedQueries(client: QueryClient) {
  const gcTime = Math.max(
    client.getDefaultOptions().queries?.gcTime ?? 0,
    savedFor,
  );
  persistedKeys.forEach(queryKey =>
    client.setQueryDefaults(queryKey, { gcTime }),
  );
}

export const forgetCache = async () => {
  await persister.removeClient();
};
