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
  Text,
  TopBar,
} from '../../components';
import { signOut } from '../../features/auth/api';
import { useSession } from '../../features/auth/SessionProvider';
import { useAreaName, useTagNames } from '../../features/catalog/queries';
import { useMyDiscoverState } from '../../features/discover/queries';
import { ageOn } from '../../features/me/api';
import { modeLabels } from '../../features/modes';
import { useMyPhotos, usePhotoUrl } from '../../features/photos/queries';
import { availabilityLabels } from '../../features/profileSetup/model';
import { useProfileDraft } from '../../features/profileSetup/queries';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, spacing } from '../../theme';
import { LoadErrorScreen, LoadingScreen } from '../StatusScreen';
import { Section } from './Section';

type Navigation = NativeStackNavigationProp<MemberParams>;

// The Member's own profile at a glance, each part opening its setup step to edit.
export function MeScreen() {
  const navigation = useNavigation<Navigation>();
  const userId = useSession().session!.user.id;
  const draft = useProfileDraft(userId);
  const photos = useMyPhotos();
  const state = useMyDiscoverState(userId);
  const areaName = useAreaName();
  const tagNames = useTagNames();
  const cover = usePhotoUrl(photos.data?.[0]?.id);

  if (draft.isError || photos.isError) {
    return (
      <LoadErrorScreen
        onRetry={() => {
          draft.refetch();
          photos.refetch();
        }}
      />
    );
  }
  if (!draft.data || !photos.data) {
    return <LoadingScreen />;
  }

  const p = draft.data;
  const name = p.displayName ?? '';
  const age = p.birthDate ? ageOn(p.birthDate, new Date()) : undefined;
  const area = areaName(p.areaId);
  const list = (items: string[]) => items.filter(Boolean).join(', ');
  const edit = (section: MemberParams['EditProfile']['section']) => () =>
    navigation.navigate('EditProfile', { section });

  return (
    <Screen header={<TopBar title="Me" />}>
      <View style={styles.who}>
        <Avatar name={name} size="profile" uri={cover.data ?? undefined} />
        <View style={styles.grow}>
          <Text variant="h2">{age === undefined ? name : `${name}, ${age}`}</Text>
          {area ? <Text color={colors.secondary}>{area}</Text> : null}
        </View>
      </View>

      <Section title="Edit profile">
        <List>
          <ListRow
            title="Name and Area"
            subtitle={list([name, area ?? ''])}
            onPress={edit('basics')}
          />
          <ListRow
            title="Photos"
            subtitle={`${photos.data.length} photos`}
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
            state.data?.paused ? 'Your profile is paused' : 'Pause, blocked people'
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
  grow: { flex: 1, gap: layout.blockGap / 4 },
});
