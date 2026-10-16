// The data modules run in node without Firebase's native module: no phone, so no push token.
export type PushData = Record<string, string>;
export const requestPermission = async () => false;
export const getToken = async (): Promise<string | null> => null;
export const onTokenRefresh = () => () => {};
export const onForegroundMessage = () => () => {};
export const onNotificationOpened = () => () => {};
export const getInitialNotification = async (): Promise<PushData | null> => null;
