import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, layout, radius, sizes, spacing } from '../theme';

// Onboarding progress: one 4-high segment per step, filled up to the current one.
export function Progress({ step, of }: { step: number; of: number }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${of}`}
      accessibilityValue={{ min: 1, max: of, now: step }}
    >
      {Array.from({ length: of }, (_, index) => (
        <View
          key={index}
          style={[styles.segment, index < step && styles.done]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: sizes.progress.gap,
    paddingHorizontal: layout.pageMargin,
    paddingBottom: spacing.xs,
  },
  segment: {
    flex: 1,
    height: sizes.progress.height,
    borderRadius: radius.full,
    backgroundColor: colors.track,
  },
  done: { backgroundColor: colors.orchid },
});
