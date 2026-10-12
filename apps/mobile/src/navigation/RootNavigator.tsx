import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { TabBar, type TabItem } from '../components';
import { useAccountStage } from '../features/account/useAccountStage';
import { useSession } from '../features/auth/SessionProvider';
import { AgeConsentScreen } from '../screens/gettingIn/AgeConsentScreen';
import { EmailScreen } from '../screens/gettingIn/EmailScreen';
import {
  CheckInviteScreen,
  RedeemInviteScreen,
} from '../screens/gettingIn/InviteCodeScreen';
import { OtpScreen } from '../screens/gettingIn/OtpScreen';
import { ProfileSetupScreen } from '../screens/gettingIn/ProfileSetupScreen';
import { WelcomeScreen } from '../screens/gettingIn/WelcomeScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import { LoadErrorScreen, LoadingScreen } from '../screens/StatusScreen';
import type { SignedOutParams } from './types';

const SignedOut = createNativeStackNavigator<SignedOutParams>();
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

// Signed out, then one onboarding step per account stage, then a Member's tabs.
// A completed step refreshes the stage, which swaps in the next screen.
export function RootNavigator() {
  const { session, loading } = useSession();
  const stage = useAccountStage();

  if (loading || (session && stage.isPending)) {
    return <LoadingScreen />;
  }
  if (!session) {
    return (
      <SignedOut.Navigator screenOptions={{ headerShown: false }}>
        <SignedOut.Screen name="Welcome" component={WelcomeScreen} />
        <SignedOut.Screen name="InviteCode" component={CheckInviteScreen} />
        <SignedOut.Screen name="Email" component={EmailScreen} />
        <SignedOut.Screen name="Otp" component={OtpScreen} />
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
      {stage.data === 'invite' ? (
        <Onboarding.Screen name="RedeemInvite" component={RedeemInviteScreen} />
      ) : stage.data === 'consent' ? (
        <Onboarding.Screen name="AgeConsent" component={AgeConsentScreen} />
      ) : (
        <Onboarding.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      )}
    </Onboarding.Navigator>
  );
}
