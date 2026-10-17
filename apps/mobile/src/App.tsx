import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from './features/auth/SessionProvider';
import { queryClient } from './lib/queryClient';
import { navigationRef } from './navigation/navigationRef';
import { RootNavigator } from './navigation/RootNavigator';
import { colors } from './theme';

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.orchid,
    background: colors.ground,
    text: colors.ink,
  },
};

export default function App({
  client = queryClient,
}: {
  client?: QueryClient;
}) {
  // Foreground counts as focused: polls pause in the background, stale queries refetch on return.
  useEffect(
    () =>
      focusManager.setEventListener(setFocused => {
        const sub = AppState.addEventListener('change', state =>
          setFocused(state === 'active'),
        );
        return () => sub.remove();
      }),
    [],
  );
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <QueryClientProvider client={client}>
        <SessionProvider>
          <NavigationContainer ref={navigationRef} theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
