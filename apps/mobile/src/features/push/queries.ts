import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
} from './api';

const key = (userId: string) => ['notification-settings', userId];

export function useNotificationSettings(userId: string) {
  return useQuery({
    queryKey: key(userId),
    queryFn: () => fetchNotificationSettings(userId),
  });
}

export function useSaveNotificationSettings(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (change: Partial<NotificationSettings>) =>
      saveNotificationSettings(userId, change),
    onSuccess: (_, change) =>
      client.setQueryData<NotificationSettings>(key(userId), current =>
        current ? { ...current, ...change } : current,
      ),
  });
}
