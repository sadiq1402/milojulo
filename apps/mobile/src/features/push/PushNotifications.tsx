import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { navigationRef } from '../../navigation/navigationRef';
import { activityKeys } from '../activities/queries';
import { chatKeys } from '../chat/queries';
import { registerDeviceToken } from './api';
import {
  getInitialNotification,
  getToken,
  onForegroundMessage,
  onNotificationOpened,
  onTokenRefresh,
  requestPermission,
  type PushData,
} from './messaging';

const platform = Platform.OS === 'ios' ? 'ios' : 'android';

// A failed registration only costs notifications; the next launch or token refresh tries again.
const register = (token: string | null) =>
  token ? registerDeviceToken(token, platform).catch(() => {}) : undefined;

function openFor(data: PushData) {
  // A tap that opens the app can land before the navigator mounts; follow it once it is ready.
  if (!navigationRef.isReady()) {
    const stop = navigationRef.addListener('state', () => {
      stop();
      openFor(data);
    });
    return;
  }
  switch (data.kind) {
    case 'message':
    case 'accepted':
      if (data.connectionId) {
        navigationRef.navigate('Chat', { connectionId: data.connectionId });
      }
      return;
    case 'request':
      navigationRef.navigate('Tabs', {
        screen: 'Inbox',
        params: { segment: 'requests' },
      });
      return;
    case 'join_request':
    case 'join_accepted':
      if (data.activityId) {
        navigationRef.navigate('ActivityDetail', {
          activityId: data.activityId,
        });
      }
      return;
  }
}

// Requests and chats both come from the conversations list.
function refreshFor(client: QueryClient, data: PushData) {
  if (data.kind === 'join_request' || data.kind === 'join_accepted') {
    client.invalidateQueries({ queryKey: activityKeys.all });
  } else if (data.kind) {
    client.invalidateQueries({ queryKey: chatKeys.conversations });
    if (data.connectionId) {
      client.invalidateQueries({
        queryKey: chatKeys.messages(data.connectionId),
      });
    }
  }
}

// Mounted only for Members: register_device_token refuses anyone earlier in onboarding.
export function PushNotifications() {
  const client = useQueryClient();
  useEffect(() => {
    let live = true;
    requestPermission()
      .catch(() => false)
      .then(() => getToken())
      .then(token => (live ? register(token) : undefined))
      .catch(() => {});
    getInitialNotification()
      .then(data => {
        if (live && data) {
          openFor(data);
        }
      })
      .catch(() => {});
    const stops = [
      onTokenRefresh(token => register(token)),
      onNotificationOpened(openFor),
      // In the foreground FCM shows nothing; the open lists just catch up.
      onForegroundMessage(data => refreshFor(client, data)),
    ];
    return () => {
      live = false;
      stops.forEach(stop => stop());
    };
  }, [client]);
  return null;
}
