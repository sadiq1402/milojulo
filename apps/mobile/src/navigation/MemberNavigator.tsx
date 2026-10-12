import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { TabBar, type TabItem } from '../components';
import { ChatScreen } from '../screens/chat/ChatScreen';
import { InboxScreen } from '../screens/inbox/InboxScreen';
import { PlaceholderScreen } from '../screens/PlaceholderScreen';
import type { MemberParams } from './types';

const Stack = createNativeStackNavigator<MemberParams>();
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
const MeScreen = () => <PlaceholderScreen title="Me" canSignOut />;
// Until the Safety Centre ticket (#43).
const SafetyCentreScreen = () => <PlaceholderScreen title="Safety Centre" />;

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

// A Member's app: the five tabs, with chats and other full screens pushed over them.
export function MemberNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="SafetyCentre" component={SafetyCentreScreen} />
    </Stack.Navigator>
  );
}
