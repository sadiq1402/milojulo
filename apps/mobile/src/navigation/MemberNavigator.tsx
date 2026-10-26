import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { TabBar, type TabItem } from '../components';
import { MemberLive } from '../features/live/MemberLive';
import { PushNotifications } from '../features/push/PushNotifications';
import { useRequests } from '../features/requests/queries';
import { ActivitiesScreen } from '../screens/activities/ActivitiesScreen';
import { ActivityDetailScreen } from '../screens/activities/ActivityDetailScreen';
import { CreateActivityScreen } from '../screens/activities/CreateActivityScreen';
import { JoinedScreen } from '../screens/activities/JoinedScreen';
import { EditActivityScreen } from '../screens/activities/EditActivityScreen';
import { ChatScreen } from '../screens/chat/ChatScreen';
import { CircleDetailScreen } from '../screens/circles/CircleDetailScreen';
import { CirclesScreen } from '../screens/circles/CirclesScreen';
import { DiscoverScreen } from '../screens/discover/DiscoverScreen';
import { InboxScreen } from '../screens/inbox/InboxScreen';
import { ConsentSettingsScreen } from '../screens/account/ConsentSettingsScreen';
import { DataCopyScreen } from '../screens/account/DataCopyScreen';
import { DeleteAccountScreen } from '../screens/account/DeleteAccountScreen';
import { BlockedPeopleScreen } from '../screens/me/BlockedPeopleScreen';
import { EditProfileScreen } from '../screens/me/EditProfileScreen';
import { MeScreen } from '../screens/me/MeScreen';
import { SafetyCentreScreen } from '../screens/me/SafetyCentreScreen';
import { SettingsScreen } from '../screens/me/SettingsScreen';
import { MeetFeedbackScreen } from '../screens/meetFeedback/MeetFeedbackScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ReportScreen } from '../screens/reports/ReportScreen';
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
  const requests = useRequests();
  const waiting =
    requests.waiting.length +
    requests.joinWaiting.length +
    requests.unreadChats.length;
  return (
    <TabBar
      items={tabs.map(tab =>
        tab.key === 'Inbox'
          ? { ...tab, badge: waiting, badgeLabel: 'waiting' }
          : tab,
      )}
      activeKey={state.routes[state.index].name}
      onSelect={name => navigation.navigate(name)}
      bottomInset={insets.bottom}
    />
  );
}

// Rendered as a component so its hooks (the Inbox badge) have their own place.
const renderTabBar = (props: BottomTabBarProps) => <NavTabBar {...props} />;

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={renderTabBar}
    >
      <Tabs.Screen name="Discover" component={DiscoverScreen} />
      <Tabs.Screen name="Activities" component={ActivitiesScreen} />
      <Tabs.Screen name="Circles" component={CirclesScreen} />
      <Tabs.Screen name="Inbox" component={InboxScreen} />
      <Tabs.Screen name="Me" component={MeScreen} />
    </Tabs.Navigator>
  );
}

// A Member's app: the five tabs, with chats, profiles and other full screens pushed over them.
export function MemberNavigator() {
  return (
    <>
      <PushNotifications />
      <MemberLive />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={MainTabs} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="SafetyCentre" component={SafetyCentreScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="BlockedPeople" component={BlockedPeopleScreen} />
        <Stack.Screen
          name="ConsentSettings"
          component={ConsentSettingsScreen}
        />
        <Stack.Screen name="DataCopy" component={DataCopyScreen} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} />
        <Stack.Screen name="CreateActivity" component={CreateActivityScreen} />
        <Stack.Screen name="Joined" component={JoinedScreen} />
        <Stack.Screen name="EditActivity" component={EditActivityScreen} />
        <Stack.Screen name="CircleDetail" component={CircleDetailScreen} />
        <Stack.Screen name="Report" component={ReportScreen} />
        <Stack.Screen name="MeetFeedback" component={MeetFeedbackScreen} />
      </Stack.Navigator>
    </>
  );
}
