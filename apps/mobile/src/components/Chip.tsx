import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, fontFamily, fonts, radius, sizes } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  // A colour-coded filter chip (a Mode's tint) while it isn't selected.
  tint?: { bg: string; fg: string };
  // A chip that opens a picker: an optional leading icon, a bold label and a chevron.
  icon?: IconName;
  opensPicker?: boolean;
  accessibilityLabel?: string;
};

export function Chip({
  label,
  selected = false,
  onPress,
  tint,
  icon,
  opensPicker = false,
  accessibilityLabel,
}: Props) {
  const ink = selected ? colors.white : tint?.fg ?? colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={(sizes.hitArea - sizes.chip.height) / 2}
      style={[
        styles.chip,
        tint && { backgroundColor: tint.bg, borderColor: tint.bg },
        selected && styles.selected,
      ]}
    >
      {icon ? <Icon name={icon} size={sizes.icon.tiny} color={ink} /> : null}
      <Text
        variant="bodySmall"
        color={ink}
        style={opensPicker ? styles.bold : styles.label}
      >
        {label}
      </Text>
      {opensPicker ? (
        <Icon name="chevronDown" size={sizes.icon.tiny} color={ink} />
      ) : null}
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
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  selected: { backgroundColor: colors.orchid, borderColor: colors.orchid },
  label: { fontFamily: fontFamily(fonts.text, '500') },
  bold: { fontFamily: fontFamily(fonts.text, '700') },
});
