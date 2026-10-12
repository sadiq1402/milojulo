import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, shadow, sizes } from '../theme';
import { Text } from './Text';

// inverse and inverseText sit on an orchid screen (Welcome).
type Variant =
  | 'primary'
  | 'secondary'
  | 'text'
  | 'danger'
  | 'inverse'
  | 'inverseText';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  compact?: boolean;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const labelColor: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.ink,
  text: colors.orchid,
  danger: colors.white,
  inverse: colors.orchid,
  inverseText: colors.white,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  compact = false,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={compact ? (sizes.hitArea - sizes.button.compact) / 2 : undefined}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        compact && styles.compact,
        pressed && variant === 'primary' && styles.primaryPressed,
        pressed && variant !== 'primary' && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor[variant]} />
      ) : (
        <Text variant="label" color={labelColor[variant]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.button.primary,
    borderRadius: radius.full,
    paddingHorizontal: sizes.button.paddingX,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  primary: { backgroundColor: colors.orchid, ...shadow('primaryButton') },
  secondary: { backgroundColor: colors.card, borderColor: colors.field },
  danger: { backgroundColor: colors.danger },
  inverse: { backgroundColor: colors.white, ...shadow('primaryButton') },
  inverseText: { minHeight: sizes.button.text, backgroundColor: 'transparent' },
  text: { minHeight: sizes.button.text, backgroundColor: 'transparent' },
  compact: {
    minHeight: sizes.button.compact,
    minWidth: sizes.button.compactMinWidth,
    alignSelf: 'flex-start',
  },
  primaryPressed: { backgroundColor: colors.orchidDark },
  pressed: { opacity: 0.7 },
  inactive: { opacity: 0.5 },
});
