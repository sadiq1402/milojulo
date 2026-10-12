import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from '../../components';
import type { ModeChange } from '../../features/chat/modeChange';
import { modeLabels } from '../../features/modes';
import { colors, layout, radius, spacing } from '../../theme';

type Props = {
  change: ModeChange;
  mine: boolean;
  name: string;
  onRespond: (accept: boolean) => void;
  pending: boolean;
  error?: string;
};

export function ModeChangeCard({
  change,
  mine,
  name,
  onRespond,
  pending,
  error,
}: Props) {
  const to = modeLabels[change.toMode];
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text variant="bodySmall" color={colors.orchidDark}>
        {mine
          ? `You suggested moving to ${to}. Waiting for ${name}.`
          : `${name} would like to move this chat to ${to}.`}
      </Text>
      {error ? (
        <Text variant="bodySmall" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      {mine ? null : (
        <View style={styles.actions}>
          <Button
            label="Accept"
            compact
            onPress={() => onRespond(true)}
            disabled={pending}
          />
          <Button
            label="Decline"
            variant="secondary"
            compact
            onPress={() => onRespond(false)}
            disabled={pending}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    marginHorizontal: layout.pageMargin,
    marginBottom: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.r20,
    backgroundColor: colors.selected,
  },
  actions: { flexDirection: 'row', gap: spacing.xs },
});
