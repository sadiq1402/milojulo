import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, fontFamily, fonts, radius, sizes } from '../theme';
import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  // A colour-coded filter chip (a Mode's tint) while it isn't selected.
  tint?: { bg: string; fg: string };
};

export function Chip({ label, selected = false, onPress, tint }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={(sizes.hitArea - sizes.chip.height) / 2}
      style={[
        styles.chip,
        tint && { backgroundColor: tint.bg, borderColor: tint.bg },
        selected && styles.selected,
      ]}
    >
      <Text
        variant="bodySmall"
        color={selected ? colors.white : tint?.fg ?? colors.ink}
        style={styles.label}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: sizes.chip.height,
    paddingHorizontal: sizes.chip.paddingX,
    borderRadius: radius.r20,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  selected: { backgroundColor: colors.orchid, borderColor: colors.orchid },
  label: { fontFamily: fontFamily(fonts.text, '500') },
});
