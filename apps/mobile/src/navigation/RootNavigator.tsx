import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { TabBar, type TabItem } from '../components';
import { fetchAccountStage } from '../features/account/api';
import { useSession } from '../features/auth/SessionProvider';
import { HelloScreen } from '../screens/HelloScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { LoadErrorScreen, LoadingScreen } from '../screens/StatusScreen';

const SignedOut = createNativeStackNavigator();
const Onboarding = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const tabs: TabItem[] = [
  { key: 'Discover', label: 'Discover', icon: 'discover' },
  { key: 'Activities', label: 'Activities', icon: 'activities' },
  { key: 'Circles', label: 'Circles', icon: 'circles' },
  { key: 'Inbox', label: 'Inbox', icon: 'inbox' },
  { key: 'Me', label: 'Me', icon: 'me' },
];

function NavTabBar({ state, navigation, insets }: BottomTabBarProps) {
  return (
    <TabBar
      items={tabs}
      activeKey={state.routes[state.index].name}
      onSelect={name => navigation.navigate(name)}
      bottomInset={insets.bottom}
    />
  );
}

const DiscoverScreen = () => <PlaceholderScreen title="Discover" />;
const ActivitiesScreen = () => <PlaceholderScreen title="Activities" />;
const CirclesScreen = () => <PlaceholderScreen title="Circles" />;
const InboxScreen = () => <PlaceholderScreen title="Inbox" />;
const MeScreen = () => <PlaceholderScreen title="Me" canSignOut />;

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }} tabBar={NavTabBar}>
      <Tabs.Screen name="Discover" component={DiscoverScreen} />
      <Tabs.Screen name="Activities" component={ActivitiesScreen} />
      <Tabs.Screen name="Circles" component={CirclesScreen} />
      <Tabs.Screen name="Inbox" component={InboxScreen} />
      <Tabs.Screen name="Me" component={MeScreen} />
    </Tabs.Navigator>
  );
}

// Signed out, onboarding, or a Member's tabs; switching stacks resets navigation history.
export function RootNavigator() {
  const { session, loading } = useSession();
  const userId = session?.user.id;
  const stage = useQuery({
    queryKey: ['account-stage', userId],
    queryFn: () => fetchAccountStage(userId!),
    enabled: !!userId,
  });

  if (loading || (userId && stage.isPending)) {
    return <LoadingScreen />;
  }
  if (!session) {
    return (
      <SignedOut.Navigator screenOptions={{ headerShown: false }}>
        <SignedOut.Screen name="SignIn" component={SignInScreen} />
      </SignedOut.Navigator>
    );
  }
  if (stage.isError) {
    return <LoadErrorScreen onRetry={() => stage.refetch()} />;
  }
  if (stage.data === 'member') {
    return <MainTabs />;
  }
  return (
    <Onboarding.Navigator screenOptions={{ headerShown: false }}>
      <Onboarding.Screen name="Hello" component={HelloScreen} />
    </Onboarding.Navigator>
  );
}
