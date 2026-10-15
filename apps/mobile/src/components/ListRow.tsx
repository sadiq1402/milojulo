import React, { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  layout,
  radius,
  shadow,
  sizes,
  spacing,
  fontFamily,
  fonts,
} from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  // Destructive rows (Delete account) read in the danger colour.
  titleColor?: string;
};

export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  accessibilityLabel,
  titleColor,
}: Props) {
  const content = (
    <>
      {left}
      <View style={styles.grow}>
        <Text style={styles.title} color={titleColor} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" color={colors.secondary} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ??
        (onPress ? (
          <Icon
            name="chevronRight"
            size={sizes.icon.inline}
            color={colors.secondary}
          />
        ) : null)}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)
      }
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

// A card of rows with a divider between each.
export function List({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.list}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.card,
    borderRadius: radius.r24,
    overflow: 'hidden',
    ...shadow('card'),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.listRowMin,
    paddingVertical: spacing.xs,
    paddingHorizontal: layout.cardPadding,
  },
  grow: { flex: 1, minWidth: 0 },
  title: { fontFamily: fontFamily(fonts.text, '600') },
  divider: { height: 1, backgroundColor: colors.line },
  pressed: { backgroundColor: colors.selected },
});
