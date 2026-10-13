import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  fontFamily,
  fonts,
  radius,
  sizes,
  spacing,
  textStyles,
} from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease: boolean;
  canIncrease: boolean;
  // Spoken names for the buttons ("Fewer spots", "More spots").
  decreaseLabel: string;
  increaseLabel: string;
  disabled?: boolean;
};

// − value + with 48 x 48 outlined round buttons (CreateActivity mockup).
export function Stepper({
  label,
  value,
  onDecrease,
  onIncrease,
  canDecrease,
  canIncrease,
  decreaseLabel,
  increaseLabel,
  disabled = false,
}: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <StepButton
          icon="minus"
          accessibilityLabel={decreaseLabel}
          enabled={!disabled && canDecrease}
          onPress={onDecrease}
        />
        <Text
          variant="title"
          style={styles.value}
          accessibilityLabel={`${label}: ${value}`}
          accessibilityLiveRegion="polite"
        >
          {value}
        </Text>
        <StepButton
          icon="plus"
          accessibilityLabel={increaseLabel}
          enabled={!disabled && canIncrease}
          onPress={onIncrease}
        />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  accessibilityLabel,
  enabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  accessibilityLabel: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        !enabled && styles.inactive,
      ]}
    >
      <Icon name={icon} size={sizes.icon.inline} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { ...textStyles.bodySmall, fontFamily: fontFamily(fonts.text, '600') },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  value: { minWidth: sizes.iconButton, textAlign: 'center' },
  button: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.tint },
  inactive: { opacity: 0.5 },
});
