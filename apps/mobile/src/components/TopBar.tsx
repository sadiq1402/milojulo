import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { sizes, spacing } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

type Props = { title?: string; onBack?: () => void; right?: ReactNode };

export function TopBar({ title, onBack, right }: Props) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {onBack ? (
          <IconButton icon="back" accessibilityLabel="Back" onPress={onBack} />
        ) : null}
      </View>
      <Text
        variant="title"
        style={styles.title}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: sizes.topBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  side: { width: sizes.iconButton, flexDirection: 'row' },
  right: { justifyContent: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
});
