import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  Avatar,
  Button,
  ErrorText,
  List,
  ListRow,
  Screen,
  Text,
  TopBar,
} from '../../components';
import { useMyBlocks, useUnblock } from '../../features/me/queries';
import type { MemberParams } from '../../navigation/types';
import { colors } from '../../theme';
import { LoadErrorScreen, LoadingScreen } from '../StatusScreen';

type Props = NativeStackScreenProps<MemberParams, 'BlockedPeople'>;

export function BlockedPeopleScreen({ navigation }: Props) {
  const blocks = useMyBlocks();
  const release = useUnblock();

  const header = (
    <TopBar title="Blocked people" onBack={() => navigation.goBack()} />
  );
  if (blocks.isError) {
    return <LoadErrorScreen onRetry={() => blocks.refetch()} />;
  }
  if (!blocks.data) {
    return <LoadingScreen />;
  }
  return (
    <Screen header={header}>
      {blocks.data.length === 0 ? (
        <Text color={colors.secondary}>You haven't blocked anyone.</Text>
      ) : (
        <>
          <Text variant="bodySmall" color={colors.secondary}>
            They can't see you or message you. Unblocking lets you see each
            other again; it doesn't bring back a closed chat.
          </Text>
          <List>
            {blocks.data.map(member => (
              <ListRow
                key={member.memberId}
                title={member.name}
                left={<Avatar name={member.name} />}
                right={
                  <Button
                    label="Unblock"
                    accessibilityLabel={`Unblock ${member.name}`}
                    variant="secondary"
                    compact
                    loading={
                      release.isPending && release.variables === member.memberId
                    }
                    onPress={() => release.mutate(member.memberId)}
                  />
                }
              />
            ))}
          </List>
        </>
      )}
      {release.isError ? <ErrorText text={release.error.message} /> : null}
    </Screen>
  );
}
