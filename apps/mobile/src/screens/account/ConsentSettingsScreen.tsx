import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomSheet,
  Button,
  ErrorText,
  List,
  ListRow,
  Screen,
  Text,
  TopBar,
} from '../../components';
import type { MyConsent } from '../../features/account/api';
import {
  useMyConsents,
  useWithdrawConsent,
} from '../../features/account/queries';
import { consentNames as names } from '../../features/consents/api';
import type { MemberParams } from '../../navigation/types';
import { colors, spacing } from '../../theme';
import { LoadErrorScreen, LoadingScreen } from '../StatusScreen';

type Props = NativeStackScreenProps<MemberParams, 'ConsentSettings'>;

export function ConsentSettingsScreen({ navigation }: Props) {
  const consents = useMyConsents();
  const withdraw = useWithdrawConsent();
  const [chosen, setChosen] = useState<MyConsent>();

  const close = () => {
    setChosen(undefined);
    withdraw.reset();
  };

  if (consents.isError) {
    return <LoadErrorScreen onRetry={() => consents.refetch()} />;
  }
  if (!consents.data) {
    return <LoadingScreen />;
  }
  return (
    <Screen
      header={
        <TopBar title="Consent settings" onBack={() => navigation.goBack()} />
      }
    >
      <Text variant="bodySmall" color={colors.secondary}>
        You accepted these to use MiloJulo. You can withdraw any of them; while
        one is withdrawn, your profile is hidden from everyone.
      </Text>
      <List>
        {consents.data
          .filter(consent => !consent.withdrawnAt)
          .map(consent => (
            <ListRow
              key={consent.documentId}
              title={names[consent.kind]}
              subtitle={`Version ${consent.version}`}
              right={
                <Button
                  label="Withdraw"
                  accessibilityLabel={`Withdraw ${names[consent.kind]}`}
                  variant="secondary"
                  compact
                  onPress={() => setChosen(consent)}
                />
              }
            />
          ))}
      </List>

      <BottomSheet visible={!!chosen} onClose={close}>
        {chosen ? (
          <>
            <Text variant="h2" accessibilityRole="header">
              Withdraw the {names[chosen.kind]}?
            </Text>
            <Text color={colors.secondary}>
              MiloJulo can't show you to anyone without it, so your profile is
              hidden from everyone until you accept again: nobody sees you in
              Discover, Activities or Circles, and you can't use the app. You
              can accept again straight away on the next screen, or delete your
              account.
            </Text>
            {withdraw.isError ? (
              <ErrorText text={withdraw.error.message} />
            ) : null}
            <View style={styles.actions}>
              <Button
                label="Withdraw"
                variant="danger"
                loading={withdraw.isPending}
                onPress={() => withdraw.mutate(chosen.documentId)}
              />
              <Button label="Keep it" variant="secondary" onPress={close} />
            </View>
          </>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { gap: spacing.xs } });
