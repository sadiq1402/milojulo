import {
  getInitialNotification as fcmInitialNotification,
  getMessaging,
  getToken as fcmGetToken,
  onMessage as fcmOnMessage,
  onNotificationOpenedApp as fcmOnOpened,
  onTokenRefresh as fcmOnTokenRefresh,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

// The only file that touches RNFirebase, so Jest can stand it in.

export type PushData = Record<string, string>;

const dataOf = (message: { data?: Record<string, unknown> } | null) =>
  (message?.data ?? {}) as PushData;

// Android 13+ needs POST_NOTIFICATIONS at run time; older Android grants it at install.
export async function requestPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return true;
  }
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function getToken(): Promise<string | null> {
  return fcmGetToken(getMessaging());
}

export function onTokenRefresh(listener: (token: string) => void) {
  return fcmOnTokenRefresh(getMessaging(), listener);
}

export function onForegroundMessage(listener: (data: PushData) => void) {
  return fcmOnMessage(getMessaging(), async message =>
    listener(dataOf(message)),
  );
}

export function onNotificationOpened(listener: (data: PushData) => void) {
  return fcmOnOpened(getMessaging(), message => listener(dataOf(message)));
}

// The tap that launched the app from quit, if any.
export async function getInitialNotification(): Promise<PushData | null> {
  const message = await fcmInitialNotification(getMessaging());
  return message ? dataOf(message) : null;
}
