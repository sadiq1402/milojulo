import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  ErrorText,
  FlowScreen,
  Icon,
  Input,
  Text,
} from '../../components';
import { useDeleteAccount } from '../../features/account/queries';
import { useSetPaused } from '../../features/me/queries';
import { colors, sizes, spacing } from '../../theme';

const consequences = [
  'Your profile, photos and chat media are permanently deleted.',
  'Your Connections and chats are closed.',
  'This cannot be undone.',
];

// Also reached from the consent step after a withdrawal, where pausing makes no sense.
export function DeleteAccountScreen() {
  const navigation = useNavigation();
  const params = useRoute().params as { pauseInstead?: boolean } | undefined;
  const offerPause = params?.pauseInstead !== false;
  const [confirm, setConfirm] = useState('');
  const remove = useDeleteAccount();
  const pause = useSetPaused();

  return (
    <FlowScreen
      barTitle="Delete account"
      onBack={() => navigation.goBack()}
      icon={
        <View style={styles.badge}>
          <Icon name="trash" size={30} color={colors.danger} />
        </View>
      }
      title="Delete your account?"
      footer={
        <View style={styles.actions}>
          {remove.isError ? <ErrorText text={remove.error.message} /> : null}
          {pause.isError ? <ErrorText text={pause.error.message} /> : null}
          <Button
            label="Delete my account"
            variant="danger"
            disabled={confirm.trim() !== 'DELETE'}
            loading={remove.isPending}
            onPress={() => remove.mutate()}
          />
          {offerPause ? (
            <Button
              label="Pause my profile instead"
              variant="secondary"
              loading={pause.isPending}
              onPress={() =>
                pause.mutate(true, { onSuccess: () => navigation.goBack() })
              }
            />
          ) : null}
        </View>
      }
    >
      <View style={styles.list}>
        {consequences.map(line => (
          <View key={line} style={styles.row}>
            <Icon name="close" size={18} color={colors.danger} />
            <Text style={styles.line}>{line}</Text>
          </View>
        ))}
      </View>
      <Text variant="bodySmall" color={colors.secondary}>
        Safety records, such as reports, may be kept for a limited time where
        the law requires.
      </Text>
      <Input
        label="Type DELETE to confirm"
        placeholder="DELETE"
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="characters"
        autoCorrect={false}
      />
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: sizes.avatar.thumbnail,
    height: sizes.avatar.thumbnail,
    borderRadius: sizes.avatar.thumbnail / 2,
    backgroundColor: colors.warnTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  line: { flex: 1 },
  actions: { gap: spacing.xs },
});
