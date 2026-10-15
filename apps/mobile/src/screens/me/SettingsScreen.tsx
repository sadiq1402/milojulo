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
import { useSetPaused } from '../../features/me/queries';
import type { MemberParams } from '../../navigation/types';
import { colors } from '../../theme';
import { Section } from './Section';

type Props = NativeStackScreenProps<MemberParams, 'Settings'>;

// Only built features have rows; the rest arrive with #20 and the push ticket.
export function SettingsScreen({ navigation }: Props) {
  const userId = useSession().session!.user.id;
  const state = useMyDiscoverState(userId);
  const pause = useSetPaused();
  const paused = pause.isPending
    ? pause.variables
    : state.data?.paused ?? false;

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
