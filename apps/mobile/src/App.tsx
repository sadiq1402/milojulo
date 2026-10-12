import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from './features/auth/SessionProvider';
import { queryClient } from './lib/queryClient';
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
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <QueryClientProvider client={client}>
        <SessionProvider>
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
