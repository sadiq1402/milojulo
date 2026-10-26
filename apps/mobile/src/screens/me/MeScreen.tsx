import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  List,
  ListRow,
  Screen,
  Tag,
  Text,
  TopBar,
} from '../../components';
import { signOut } from '../../features/auth/api';
import { useSession } from '../../features/auth/SessionProvider';
import { useTagNames } from '../../features/catalog/queries';
import { useMyDiscoverState } from '../../features/discover/queries';
import { ageOn } from '../../features/consents/birthDate';
import { useOwnProfile } from '../../features/me/queries';
import { modeLabels } from '../../features/modes';
import { usePhotoUrl } from '../../features/photos/queries';
import { availabilityLabels } from '../../features/profileSetup/model';
import type { MemberParams } from '../../navigation/types';
import { spacing } from '../../theme';
import { LoadErrorScreen, LoadingScreen } from '../StatusScreen';
import { Section } from './Section';

type Navigation = NativeStackNavigationProp<MemberParams>;

// The Member's own profile at a glance, each part opening its setup step to edit.
export function MeScreen() {
  const navigation = useNavigation<Navigation>();
  const userId = useSession().session!.user.id;
  const profile = useOwnProfile(userId);
  const state = useMyDiscoverState(userId);
  const tagNames = useTagNames();
  const cover = usePhotoUrl(profile.photos?.[0]?.id);

  if (profile.isError) {
    return <LoadErrorScreen onRetry={profile.retry} />;
  }
  if (!profile.draft || !profile.photos) {
    return <LoadingScreen />;
  }

  const p = profile.draft;
  const name = p.displayName ?? '';
  const age = p.birthDate ? ageOn(p.birthDate, new Date()) : undefined;
  const list = (items: string[]) => items.filter(Boolean).join(', ');
  const edit = (section: MemberParams['EditProfile']['section']) => () =>
    navigation.navigate('EditProfile', { section });

  return (
    <Screen header={<TopBar title="Me" />}>
      <View style={styles.who}>
        <Avatar name={name} size="profile" uri={cover.data} />
        <View style={styles.grow}>
          <Text variant="h2">
            {age === undefined ? name : `${name}, ${age}`}
          </Text>
          {state.data?.paused ? <Tag label="Paused" tone="butter" /> : null}
        </View>
      </View>

      <Section title="Edit profile">
        <List>
          <ListRow title="Name" subtitle={name} onPress={edit('basics')} />
          <ListRow
            title="Photos"
            subtitle={`${profile.photos.length} photos`}
            onPress={edit('photos')}
          />
          <ListRow
            title="Prompts"
            subtitle={p.prompts[0]?.answer}
            onPress={edit('prompts')}
          />
          <ListRow
            title="Modes and preferences"
            subtitle={list(p.modes.map(mode => modeLabels[mode]))}
            onPress={edit('modes')}
          />
          <ListRow
            title="Interests and availability"
            subtitle={list([
              ...p.tagIds.map(id => tagNames.data?.[id] ?? ''),
              ...p.availability.map(slot => availabilityLabels[slot]),
            ])}
            onPress={edit('interests')}
          />
        </List>
      </Section>

      <List>
        <ListRow
          title="Safety Centre"
          subtitle="Tips, reporting and blocking"
          onPress={() => navigation.navigate('SafetyCentre')}
        />
        <ListRow
          title="Settings"
          subtitle={
            state.data?.paused
              ? 'Your profile is paused'
              : 'Pause, blocked people'
          }
          onPress={() => navigation.navigate('Settings')}
        />
      </List>

      <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  grow: { flex: 1, gap: spacing.xxs, alignItems: 'flex-start' },
});
