// The data modules run in node without Firebase's native module: no phone, so no push token.
export const getMessaging = () => ({});
export const getToken = async (): Promise<string | null> => null;
export const getInitialNotification = async () => null;
export const onMessage = () => () => {};
export const onNotificationOpenedApp = () => () => {};
export const onTokenRefresh = () => () => {};
