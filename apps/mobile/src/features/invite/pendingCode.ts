import AsyncStorage from '@react-native-async-storage/async-storage';

const key = 'milojulo:pending-invite';

// The code checked before sign-in, kept until it is redeemed (survives an app restart in between).
export const savePendingInvite = (code: string) =>
  AsyncStorage.setItem(key, code.trim());
export const loadPendingInvite = () => AsyncStorage.getItem(key);
export const clearPendingInvite = () => AsyncStorage.removeItem(key);
