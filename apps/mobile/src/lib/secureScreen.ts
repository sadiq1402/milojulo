import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';

// The in-repo Android module (android/.../securescreen) sets FLAG_SECURE, which blocks
// screenshots and screen recording. iOS can't block them, so there it does nothing.
function setSecure(secure: boolean) {
  if (Platform.OS === 'android') {
    NativeModules.SecureScreen?.setSecure(secure);
  }
}

// While the screen is focused.
export function useSecureScreen() {
  useFocusEffect(
    useCallback(() => {
      setSecure(true);
      return () => setSecure(false);
    }, []),
  );
}
