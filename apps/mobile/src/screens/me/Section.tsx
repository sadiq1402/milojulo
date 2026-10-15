import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components';
import { colors, spacing } from '../../theme';

// A small heading over a card of rows, as in the Me, Settings and Safety Centre mockups.
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text
        variant="caption"
        color={colors.secondary}
        accessibilityRole="header"
        style={styles.title}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  title: { textTransform: 'uppercase', paddingHorizontal: spacing.xxs },
});
