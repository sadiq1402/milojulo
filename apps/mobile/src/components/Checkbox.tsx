import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, sizes, spacing } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  accessibilityLabel: string;
};

// A 24 box on a row at least 48 high; children may contain inline links.
export function Checkbox({
  checked,
  onChange,
  children,
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      style={styles.row}
    >
      <View style={[styles.box, checked && styles.checked]}>
        {checked ? (
          <Icon name="check" size={sizes.icon.tiny} color={colors.white} />
        ) : null}
      </View>
      <Text variant="bodySmall" style={styles.label}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    minHeight: sizes.hitArea,
    paddingVertical: spacing.xs,
  },
  box: {
    width: sizes.checkbox,
    height: sizes.checkbox,
    borderRadius: sizes.checkboxRadius,
    borderWidth: 1.5,
    borderColor: colors.field,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: colors.orchid, borderColor: colors.orchid },
  label: { flex: 1 },
});
