import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  ErrorText,
  List,
  ListRow,
  Screen,
  Switch,
  Text,
  TopBar,
} from '../../components';
import { useSession } from '../../features/auth/SessionProvider';
import { useMyDiscoverState } from '../../features/discover/queries';
import { setPaused } from '../../features/me/api';
import type { MemberParams } from '../../navigation/types';
import { colors } from '../../theme';
import { Section } from './Section';

type Props = NativeStackScreenProps<MemberParams, 'Settings'>;

// Only what's built: notifications, consent settings, data requests and account deletion
// arrive with their own tickets (#20 and the push ticket), so they have no rows yet.
export function SettingsScreen({ navigation }: Props) {
  const userId = useSession().session!.user.id;
  const state = useMyDiscoverState(userId);
  const client = useQueryClient();
  const pause = useMutation({
    mutationFn: (value: boolean) => setPaused(value),
    // Pausing empties Discover, the board and Circles, so everything reloads.
    onSuccess: () => client.invalidateQueries(),
  });
  const paused = pause.isPending
    ? pause.variables
    : (state.data?.paused ?? false);

  return (
    <Screen
      header={<TopBar title="Settings" onBack={() => navigation.goBack()} />}
    >
      <Section title="Visibility">
        <List>
          <ListRow
            title="Pause my profile"
            subtitle={paused ? 'Paused' : 'Visible to new people'}
            right={
              <Switch
                accessibilityLabel="Pause my profile"
                value={paused}
                disabled={!state.data || pause.isPending}
                onValueChange={value => pause.mutate(value)}
              />
            }
          />
        </List>
        <Text variant="bodySmall" color={colors.secondary}>
          While you're paused, nobody new sees you in Discover, Activities or
          Circles. Your existing chats carry on.
        </Text>
        {pause.isError ? <ErrorText text={pause.error.message} /> : null}
      </Section>

      <Section title="Privacy">
        <List>
          <ListRow
            title="Blocked people"
            subtitle="See and unblock"
            onPress={() => navigation.navigate('BlockedPeople')}
          />
        </List>
      </Section>
    </Screen>
  );
}
