import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query, QueryKey } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { version } from '../../package.json';
import { activityKeys } from '../features/activities/queries';
import { catalogKeys } from '../features/catalog/queries';
import { chatKeys } from '../features/chat/queries';
import { circleKeys } from '../features/circles/queries';
import { discoverKeys } from '../features/discover/queries';

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'milojulo-query-cache',
});

// Catalogs and lists only: never messages, profiles, Activity venues or signed media links.
const kept: QueryKey[] = [
  ...Object.values(catalogKeys),
  chatKeys.conversations,
  activityKeys.board,
  activityKeys.joined,
  activityKeys.myJoinRequests,
  circleKeys.list,
  discoverKeys.me,
  ['discover', 'feed'],
];

const keeps = (query: Query) =>
  query.state.status === 'success' &&
  kept.some(prefix => prefix.every((part, i) => query.queryKey[i] === part));

export const cacheMaxAge = 24 * 60 * 60_000;

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: cacheMaxAge,
  buster: version,
  dehydrateOptions: { shouldDehydrateQuery: keeps },
};

export const forgetCache = async () => {
  await persister.removeClient();
};
