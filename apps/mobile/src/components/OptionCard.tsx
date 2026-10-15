import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fontFamily, fonts, radius, sizes, spacing } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  // Shown beside the title, such as an adult-intent tag.
  badge?: ReactNode;
  // A radio card is one of a set; pressing it again keeps it chosen.
  role?: 'checkbox' | 'radio';
  // 56 high, for a long list in a sheet (Discover's distance and Modes pickers).
  compact?: boolean;
};

// An option card: 64 min, radius 20, orchid border and tint when chosen.
export function OptionCard({
  title,
  description,
  checked,
  onChange,
  badge,
  role = 'checkbox',
  compact = false,
}: Props) {
  return (
    <Pressable
      onPress={() => onChange(role === 'radio' || !checked)}
      accessibilityRole={role}
      accessibilityState={{ checked }}
      accessibilityLabel={title}
      accessibilityHint={description}
      style={[
        styles.card,
        compact && styles.compact,
        checked && styles.checked,
      ]}
    >
      <View
        style={[
          styles.box,
          role === 'radio' && styles.radio,
          checked && styles.boxChecked,
        ]}
      >
        {checked ? (
          <Icon name="check" size={sizes.icon.tiny} color={colors.white} />
        ) : null}
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {badge}
        </View>
        {description ? (
          <Text variant="bodySmall" color={colors.secondary}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.optionCardMin,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.r20,
    borderWidth: 1,
    borderColor: colors.field,
    backgroundColor: colors.card,
  },
  compact: { minHeight: sizes.listRowMin, paddingVertical: 10 },
  // As in the mockup: the 1 border turns orchid and an inset 1 ring doubles it, so the
  // content doesn't shift.
  checked: {
    borderColor: colors.orchid,
    boxShadow: `inset 0 0 0 1px ${colors.orchid}`,
    backgroundColor: colors.selected,
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
  radio: { borderRadius: radius.full },
  boxChecked: { backgroundColor: colors.orchid, borderColor: colors.orchid },
  text: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  title: { fontFamily: fontFamily(fonts.text, '600') },
});
