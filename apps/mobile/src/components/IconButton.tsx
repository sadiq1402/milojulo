import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, sizes } from '../theme';
import { Icon, type IconName } from './Icon';

type Props = {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  color = colors.ink,
  disabled = false,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { disabled } : undefined}
      disabled={disabled}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name={icon} color={disabled ? colors.secondary : color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.tint },
});
