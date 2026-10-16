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
import {
  useNotificationSettings,
  useSaveNotificationSettings,
} from '../../features/push/queries';
import type { MemberParams } from '../../navigation/types';
import { colors } from '../../theme';
import { Section } from './Section';

type Props = NativeStackScreenProps<MemberParams, 'Settings'>;

// Only built features have rows.
export function SettingsScreen({ navigation }: Props) {
  const userId = useSession().session!.user.id;
  const state = useMyDiscoverState(userId);
  const pause = useSetPaused();
  const paused = pause.isPending
    ? pause.variables
    : state.data?.paused ?? false;
  const notify = useNotificationSettings(userId);
  const saveNotify = useSaveNotificationSettings(userId);
  // While a save is in flight the switch shows where it is going.
  const notifyShown = {
    ...notify.data,
    ...(saveNotify.isPending ? saveNotify.variables : {}),
  };

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

      <Section title="Notifications">
        <List>
          <ListRow
            title="Requests and messages"
            right={
              <Switch
                accessibilityLabel="Requests and messages"
                value={notifyShown.messages ?? false}
                disabled={!notify.data || saveNotify.isPending}
                onValueChange={value => saveNotify.mutate({ messages: value })}
              />
            }
          />
          <ListRow
            title="Activity updates"
            right={
              <Switch
                accessibilityLabel="Activity updates"
                value={notifyShown.activities ?? false}
                disabled={!notify.data || saveNotify.isPending}
                onValueChange={value =>
                  saveNotify.mutate({ activities: value })
                }
              />
            }
          />
        </List>
        {saveNotify.isError ? (
          <ErrorText text={saveNotify.error.message} />
        ) : null}
      </Section>

      <Section title="Privacy and data">
        <List>
          <ListRow
            title="Consent settings"
            onPress={() => navigation.navigate('ConsentSettings')}
          />
          <ListRow
            title="Blocked people"
            subtitle="See and unblock"
            onPress={() => navigation.navigate('BlockedPeople')}
          />
          <ListRow
            title="Request a copy of my data"
            onPress={() => navigation.navigate('DataCopy')}
          />
        </List>
      </Section>

      <Section title="Account">
        <List>
          <ListRow
            title="Delete account"
            titleColor={colors.danger}
            onPress={() => navigation.navigate('DeleteAccount')}
          />
        </List>
      </Section>
    </Screen>
  );
}
