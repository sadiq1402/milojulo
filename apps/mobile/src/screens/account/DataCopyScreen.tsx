import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  Button,
  Card,
  ErrorText,
  Screen,
  Text,
  TopBar,
} from '../../components';
import {
  useDataRequests,
  useRequestDataCopy,
} from '../../features/account/queries';
import type { MemberParams } from '../../navigation/types';
import { colors } from '../../theme';
import { LoadErrorScreen, LoadingScreen } from '../StatusScreen';

type Props = NativeStackScreenProps<MemberParams, 'DataCopy'>;

export function DataCopyScreen({ navigation }: Props) {
  const requests = useDataRequests();
  const ask = useRequestDataCopy();

  if (requests.isError) {
    return <LoadErrorScreen onRetry={() => requests.refetch()} />;
  }
  if (!requests.data) {
    return <LoadingScreen />;
  }
  // Newest first, so this is the latest copy asked for.
  const latest = requests.data.find(request => request.kind === 'access');
  return (
    <Screen
      header={<TopBar title="Your data" onBack={() => navigation.goBack()} />}
    >
      <Text color={colors.secondary}>
        Ask for a copy of what MiloJulo holds about you: your profile, photos,
        Connections, messages and consents. We send it to the email you sign in
        with.
      </Text>
      {latest ? (
        <Card>
          <Text accessibilityLiveRegion="polite">
            {latest.status === 'pending'
              ? "You've asked for a copy. We'll email it to you within 30 days."
              : 'Your last copy was sent to your email.'}
          </Text>
        </Card>
      ) : null}
      {ask.isError ? <ErrorText text={ask.error.message} /> : null}
      {latest?.status === 'pending' ? null : (
        <Button
          label="Request a copy"
          loading={ask.isPending}
          onPress={() => ask.mutate()}
        />
      )}
    </Screen>
  );
}
