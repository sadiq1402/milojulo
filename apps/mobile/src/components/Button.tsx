import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, shadow, sizes, spacing } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

// inverse sits on a dark brand screen (Welcome).
type Variant = 'primary' | 'secondary' | 'text' | 'danger' | 'inverse';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  compact?: boolean;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  icon?: IconName;
  // A count shown in an orchid pill after the label; hidden at 0.
  badge?: number;
  style?: StyleProp<ViewStyle>;
};

const labelColor: Record<Variant, string> = {
  primary: colors.white,
  secondary: colors.ink,
  text: colors.orchid,
  danger: colors.white,
  inverse: colors.orchid,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  compact = false,
  disabled = false,
  loading = false,
  accessibilityLabel,
  icon,
  badge = 0,
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
        <View style={styles.content}>
          {icon ? (
            <Icon
              name={icon}
              size={sizes.icon.inline}
              color={labelColor[variant]}
            />
          ) : null}
          <Text variant="label" color={labelColor[variant]}>
            {label}
          </Text>
          {badge > 0 ? (
            <View style={styles.badge}>
              <Text variant="caption" color={colors.white}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
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
  text: { minHeight: sizes.button.text, backgroundColor: 'transparent' },
  compact: {
    minHeight: sizes.button.compact,
    minWidth: sizes.button.compactMinWidth,
    alignSelf: 'flex-start',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  badge: {
    minWidth: sizes.tabBadge.min,
    minHeight: sizes.tabBadge.min,
    borderRadius: sizes.tabBadge.min / 2,
    paddingHorizontal: sizes.tabBadge.paddingX,
    backgroundColor: colors.orchid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: { backgroundColor: colors.orchidDark },
  pressed: { opacity: 0.7 },
  inactive: { opacity: 0.5 },
});
